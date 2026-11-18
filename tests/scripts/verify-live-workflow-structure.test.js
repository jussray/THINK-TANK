const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression: literal backslash-n text inside a YAML comment accidentally
// swallowed the following step and made GitHub reject the whole workflow.
test('verify-live keeps the protected source-artifact proof as a real YAML step', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'verify-live.yml'),
    'utf8'
  );
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /^      - name: Verify live bytes against trusted source artifact$/m);
  assert.match(workflow, /THINK_TANK_TRUSTED_MANIFEST_FILE: _site\/version\.json/);
  assert.match(workflow, /node scripts\/verify-live-runtime\.mjs "\$LIVE_URL"/);
  assert.doesNotMatch(workflow, /verifier\\n\s*#/);
});

test('browser proof uses a runner compatible with the reviewed Playwright version', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'playwright.yml'),
    'utf8'
  );
  assert.match(workflow, /^    runs-on: ubuntu-24\.04$/m);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
});
