#!/usr/bin/env node
// run.mjs — collect + build in one go.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = import.meta.dirname;
const args = process.argv.slice(2);

function run(script, extra = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...extra], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

run('collect.mjs', args);
run('build.mjs');
