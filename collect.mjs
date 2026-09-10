#!/usr/bin/env node
// collect.mjs — walk everything the token can read from your Canvas and write
// it to out/data.json (plus out/raw/*.json for the untouched API responses).
//
// Read-only: all traffic goes through the client's GET/HEAD-only guard.
//
//   node collect.mjs            fetch everything (may take a few minutes)
//   node collect.mjs --shallow  skip page bodies / discussion entries / files
//
// Endpoints that your account can't see (hidden tabs, teacher-only routes)
// simply return null and are skipped — this works for students and teachers.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from './lib/canvas.mjs';
import { loadConfig } from './lib/config.mjs';

const ROOT = import.meta.dirname;
const OUT = path.join(ROOT, 'out');
const RAW = path.join(OUT, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const SHALLOW = process.argv.includes('--shallow');
const { baseUrl, token } = loadConfig(ROOT);

const log = [];
const client = createClient({ baseUrl, token, onError: (e) => { log.push(e); } });
const { fetchApi } = client;

// ---------------------------------------------------------------------------
// 🔴 Scrub capability-bearing secrets before anything is written to disk.
// ---------------------------------------------------------------------------
// Canvas embeds unauthenticated access URLs in normal responses:
//   - file download links carry ?verifier=<secret> (downloads without login)
//   - a file's `uuid` doubles as that verifier
//   - calendar.ics is a secret feed URL (reads your calendar without login)
// The built index.html embeds all of this, so if the user ever shares the page
// these secrets would grant strangers access. We strip them here. The user's own
// use is unaffected: while logged in to Canvas the plain links still work.
function scrubSecrets(node) {
  if (Array.isArray(node)) { for (const x of node) scrubSecrets(x); return; }
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === 'string') {
      // Strip the secret VALUE after these keys wherever they appear — including
      // inside embedded HTML where the delimiter is an entity (&amp;verifier=…).
      node[k] = v
        .replace(/(verifier|access_token)=[^"'\s&#<>]*/gi, '$1=')
        .replace(/([?&])token=[^"'\s&#<>]*/gi, '$1token=');
    } else if (v && typeof v === 'object') {
      scrubSecrets(v);
    }
  }
  if (typeof node.verifier === 'string') delete node.verifier;
  if (node.calendar && typeof node.calendar === 'object' && typeof node.calendar.ics === 'string') delete node.calendar.ics;
  // A file object's uuid is its download verifier — drop it on file-like objects.
  if ((node.display_name || node['content-type'] || node.mime_class) && typeof node.uuid === 'string') delete node.uuid;
}

const saveRaw = (name, data) => {
  scrubSecrets(data);
  fs.writeFileSync(path.join(RAW, name + '.json'), JSON.stringify(data, null, 1));
  const n = Array.isArray(data) ? data.length : (data ? 1 : 0);
  console.log(`  ${name}: ${n}`);
  return data;
};

// ---------------------------------------------------------------- user level
console.log('== account');
const profile = saveRaw('profile', await fetchApi('users/self/profile'));
const enrollments = saveRaw('enrollments', await fetchApi('users/self/enrollments?per_page=100&state[]=active&state[]=completed&state[]=invited&state[]=inactive'));
const communicationChannels = saveRaw('communication_channels', await fetchApi('users/self/communication_channels'));
const favorites = saveRaw('favorites', await fetchApi('users/self/favorites/courses'));
const groups = saveRaw('groups', await fetchApi('users/self/groups?per_page=100'));
const files = saveRaw('files', await fetchApi('users/self/files?per_page=100'));
const folders = saveRaw('folders', await fetchApi('users/self/folders?per_page=100'));
const planner = saveRaw('planner', await fetchApi('planner/items?start_date=2000-01-01&per_page=100'));
const bookmarks = saveRaw('bookmarks', await fetchApi('users/self/bookmarks'));

// conversations + each thread's messages
const conversations = saveRaw('conversations', await fetchApi('conversations?per_page=100')) || [];
const conversationMessages = [];
for (const c of conversations) {
  const full = await fetchApi(`conversations/${c.id}`);
  if (full) conversationMessages.push(full);
}
saveRaw('conversation_messages', conversationMessages);

// ------------------------------------------------------------------- courses
console.log('== courses');
const courseMap = new Map();
for (const state of ['active', 'completed', 'invited_or_pending']) {
  const list = await fetchApi(`courses?enrollment_state=${state}&per_page=100&include[]=syllabus_body&include[]=term&include[]=teachers&include[]=total_scores&include[]=course_progress&include[]=public_description`);
  for (const c of list || []) if (!courseMap.has(c.id)) courseMap.set(c.id, { ...c, _enrollmentState: state });
}
const courses = [...courseMap.values()];
saveRaw('courses', courses);

const courseCodes = courses.map((c) => `context_codes[]=course_${c.id}`).join('&');

// announcements across all courses (needs context_codes or it returns empty)
const announcements = saveRaw('announcements', await fetchApi(`announcements?${courseCodes}&start_date=2000-01-01&end_date=2100-12-31&per_page=100`)) || [];

// calendar events + calendar-style assignments, chunked (context_codes cap)
const calendar = { events: [], assignments: [] };
for (const [type, bucket] of [['event', 'events'], ['assignment', 'assignments']]) {
  for (let i = 0; i < courses.length; i += 10) {
    const chunk = courses.slice(i, i + 10).map((c) => `context_codes[]=course_${c.id}`).join('&');
    const r = await fetchApi(`calendar_events?type=${type}&all_events=true&${chunk}&per_page=100`);
    if (r) calendar[bucket].push(...r);
  }
}
saveRaw('calendar_events', calendar.events);
saveRaw('calendar_assignments', calendar.assignments);

// --------------------------------------------------------- per-course detail
const courseData = {};
for (const c of courses) {
  console.log(`-- ${c.id} ${c.course_code || c.name}`);
  const d = { course: c };

  d.tabs = await fetchApi(`courses/${c.id}/tabs`);
  const enabled = new Set((d.tabs || []).map((t) => t.id));

  d.assignments = await fetchApi(`courses/${c.id}/assignments?per_page=100&include[]=submission&include[]=all_dates&include[]=overrides`);
  d.modules = await fetchApi(`courses/${c.id}/modules?include[]=items&per_page=100`);
  d.discussions = await fetchApi(`courses/${c.id}/discussion_topics?per_page=100`);
  d.myEnrollments = await fetchApi(`courses/${c.id}/enrollments?user_id=self&per_page=100`);
  d.frontPage = await fetchApi(`courses/${c.id}/front_page`);
  d.teachers = (await fetchApi(`courses/${c.id}/users?enrollment_type[]=teacher&enrollment_type[]=ta&per_page=100`)) || [];
  d.groups = await fetchApi(`courses/${c.id}/groups?per_page=100`);
  if (enabled.has('pages')) d.pages = await fetchApi(`courses/${c.id}/pages?per_page=100`);
  if (enabled.has('quizzes')) d.quizzes = await fetchApi(`courses/${c.id}/quizzes?per_page=100`);
  if (enabled.has('files')) d.files = await fetchApi(`courses/${c.id}/files?per_page=100`);
  d.submissions = await fetchApi(`courses/${c.id}/students/submissions?student_ids[]=self&per_page=100&include[]=assignment&include[]=submission_comments`);

  d.pageBodies = [];
  d.discussionEntries = {};
  if (!SHALLOW) {
    // Page index tab can be hidden (404) while an individual page still
    // answers 200, so also resolve Page items found inside modules.
    const pageUrls = new Set();
    for (const p of d.pages || []) if (p.url) pageUrls.add(p.url);
    for (const m of d.modules || []) for (const it of m.items || []) {
      if (it.type === 'Page' && it.page_url) pageUrls.add(it.page_url);
    }
    for (const url of pageUrls) {
      const full = await fetchApi(`courses/${c.id}/pages/${url}`);
      if (full) d.pageBodies.push(full);
    }
    for (const k of d.discussions || []) {
      const entries = await fetchApi(`courses/${c.id}/discussion_topics/${k.id}/entries?per_page=100`);
      if (entries && entries.length) d.discussionEntries[k.id] = entries;
    }
  }

  courseData[c.id] = d;
  scrubSecrets(d);
  fs.writeFileSync(path.join(RAW, `course_${c.id}.json`), JSON.stringify(d, null, 1));
}

// --------------------------------------------------------------- assemble
const data = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  shallow: SHALLOW,
  profile,
  account: { enrollments, communicationChannels, favorites, groups, files, folders, planner, bookmarks },
  conversations: conversationMessages,
  announcements,
  calendar,
  courses: courses.map((c) => courseData[c.id]),
};
scrubSecrets(data); // final safety net before the shared artifact is written
fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(RAW, '_log.json'), JSON.stringify({ requests: client.requests, log }, null, 1));

console.log(`\nDONE. requests=${client.requests} courses=${courses.length} notes=${log.length}`);
console.log(`Wrote ${path.join('out', 'data.json')}. Now run:  node build.mjs`);
if (log.length) {
  console.log('\nNotes (skipped / rate-limited / errors):');
  for (const e of log.slice(0, 15)) console.log('  !', JSON.stringify(e));
  if (log.length > 15) console.log(`  ... and ${log.length - 15} more (see out/raw/_log.json)`);
}
