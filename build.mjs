#!/usr/bin/env node
// build.mjs — turn out/data.json into a single self-contained out/index.html.
//
// The data is embedded into the page, so the result opens with a double-click
// (file://) without a web server and without any further Canvas requests.
//
//   node build.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = import.meta.dirname;
const OUT = path.join(ROOT, 'out');
const DATA = path.join(OUT, 'data.json');
const TEMPLATE = path.join(ROOT, 'lib', 'template.html');

if (!fs.existsSync(DATA)) {
  console.error(`Missing ${path.join('out', 'data.json')}. Run:  node collect.mjs`);
  process.exit(1);
}

const template = fs.readFileSync(TEMPLATE, 'utf8');
const raw = fs.readFileSync(DATA, 'utf8');
// Escape "</" so a literal </script> inside course HTML can't close our
// <script type="application/json"> block early.
const json = raw.replace(/<\//g, '<\\/');

// Restrict images/media in the CSP to the institution origin (+ data:/blob:),
// so injected remote content can't beacon the viewer's IP to a third party.
let imgSrc = "'self'";
try { const b = JSON.parse(raw).baseUrl; if (b) imgSrc = new URL(b).origin; } catch { /* keep 'self' */ }

// Fresh per-build nonce: only our own two <script> tags carry it, so the CSP
// admits them while blocking any inline handler injected via embedded HTML.
const nonce = crypto.randomBytes(16).toString('hex');

const html = template
  .replaceAll('__CSP_NONCE__', nonce)
  .replaceAll('__IMG_SRC__', imgSrc)
  .replace('__CANVAS_DATA__', json);
const outFile = path.join(OUT, 'index.html');
fs.writeFileSync(outFile, html);

const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Wrote ${path.join('out', 'index.html')} (${kb} kB).`);
console.log('Open it in your browser (double-click, or File > Open).');
