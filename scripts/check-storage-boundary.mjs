#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const allowed = new Set([
  'app/stores/local-idea-store.js',
  'tests/stores/local-idea-store.test.js',
  'tests/stores/local-storage-test-fixture.js',
  // Tooling that NAMES the token rather than accessing storage: the boundary
  // gate itself, the purity gate's forbidden-pattern table, and the mutation
  // test that proves this gate can fail.
  'scripts/check-storage-boundary.mjs',
  'scripts/check-domain-purity.mjs',
  'tests/scripts/gate-mutation.test.js',
  // Browser proof asserting on persisted state is verification, not app access.
  'tests/interview.spec.js'
]);

// The V0 application controller is the inline <script> in index.html, and the
// build/check gates are .mjs. A '*.js'-only pathspec exempted both, so direct
// localStorage access outside the store layer passed this gate unseen.
const result = spawnSync(
  'git',
  ['grep', '-n', 'localStorage', '--', '*.js', '*.mjs', '*.cjs', '*.ts', '*.html'],
  { encoding: 'utf8' }
);

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
