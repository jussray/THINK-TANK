// Fail closed before changing Think Tank's production deployment owner.
// This checks the checked-in workflow, not Cloudflare's actual provider settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy-worker.yml'), 'utf8');
const triggers = workflow.split('\non:\n')[1]?.split('\npermissions:\n')[0] || '';

test('deploy workflow never publishes merely because a PR merges into main', () => {
  assert.match(triggers, /^  workflow_dispatch:/m);
  assert.doesNotMatch(triggers, /^  push:/m);
  assert.doesNotMatch(triggers, /^  pull_request:/m);
});

test('manual deployment requires an exact current-main SHA and explicit provider cutover', () => {
  assert.match(triggers, /expected_main_sha:/);
  assert.match(triggers, /workers_builds_cutover_confirmed:/);
  assert.match(triggers, /default: false/);
  assert.match(workflow, /\$GITHUB_REF.*refs\/heads\/main/);
  assert.match(workflow, /\$CUTOVER_CONFIRMED.*true/);
  assert.match(workflow, /\$EXPECTED_MAIN_SHA.*\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /\$GITHUB_SHA.*\$EXPECTED_MAIN_SHA/);
});

test('build is pinned and remote main is rechecked before deploying', () => {
  assert.match(workflow, /ref: \$\{\{ inputs\.expected_main_sha \}\}/);
  assert.match(workflow, /THINK_TANK_SOURCE_SHA: \$\{\{ inputs\.expected_main_sha \}\}/);
  const remoteChecks = workflow.match(/git ls-remote origin refs\/heads\/main/g) || [];
  assert.equal(remoteChecks.length, 2);
  const remoteRecheck = workflow.indexOf('Recheck main did not move before provider mutation');
  const deploy = workflow.indexOf('Deploy the gated _site artifact');
  assert.ok(remoteRecheck > 0 && deploy > remoteRecheck);
  assert.match(workflow.slice(deploy), /npx --no-install wrangler deploy --config wrangler\.jsonc/);
});

test('production verification is independent of deploy promotion', () => {
  assert.match(workflow, /npm run build\n/);
  assert.match(workflow, /npm run check:storage-boundary/);
  assert.match(workflow, /npm run check:domain-purity/);
  assert.match(workflow, /npm run test:unit/);
  assert.doesNotMatch(workflow, /result=VERIFIED|live_state: verified/);
});
