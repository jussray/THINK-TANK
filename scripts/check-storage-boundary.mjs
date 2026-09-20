#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const allowed = new Set([
  'app/stores/local-idea-store.js',
  'tests/stores/local-idea-store.test.js'
]);

const result = spawnSync('git', ['grep', '-n', 'localStorage', '--', '*.js'], {
  encoding: 'utf8'
});

if (![0, 1].includes(result.status)) {
  process.stderr.write(result.stderr || 'git grep failed\n');
  process.exit(result.status || 1);
}

const output = (result.stdout || '').trim();
const violations = output
  ? output.split('\n').filter((line) => !allowed.has(line.split(':', 1)[0]))
  : [];

if (violations.length) {
  console.error('Direct localStorage access is forbidden outside approved local-store paths:');
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log('Storage boundary verified.');
