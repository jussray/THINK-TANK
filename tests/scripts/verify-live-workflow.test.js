// Regression: a literal backslash-n once hid the verify step inside a
// comment, producing a GitHub Actions run with no jobs and no useful logs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
const live = fs.readFileSync(path.join(workflowDir, 'verify-live.yml'), 'utf8');

test('workflow comments cannot swallow executable steps', () => {
  for (const file of fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
    const source = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.doesNotMatch(source, /\\n[ \t]+(?:#|- name:)/, file + ' contains escaped newlines that can hide YAML steps');
  }
});

test('verify-live retains a separate source build and live byte verification step', () => {
  assert.match(live, /^      - name: Build trusted artifact from the checked-out exact source$/m);
  assert.match(live, /^      - name: Verify live bytes against trusted source artifact$/m);
  const sourceStep = live.indexOf('      - name: Build trusted artifact from the checked-out exact source');
  const liveStep = live.indexOf('      - name: Verify live bytes against trusted source artifact');
  assert.ok(sourceStep >= 0 && liveStep > sourceStep, 'live proof must follow the source build');
  assert.match(live.slice(sourceStep, liveStep), /npm run test:unit/);
  assert.match(live.slice(liveStep), /node scripts\\/verify-live-runtime\\.mjs/);
  assert.match(live, /^  workflow_dispatch:$/m);
  assert.match(live, /^  contents: read$/m);
});
