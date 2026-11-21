const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/verify-live.yml', 'utf8');
const verifier = fs.readFileSync('scripts/verify-live-runtime.mjs', 'utf8');

test('live content proof defaults to canonical public product rather than the Access-protected origin', () => {
  assert.match(workflow, /default: https:\/\/thinktank\.jussco\.company\b/);
  assert.doesNotMatch(workflow, /default: https:\/\/thinktank-app\.jussco\.company/);
  assert.match(verifier, /new URL\(base\)\.origin !== 'https:\/\/thinktank\.jussco\.company'/);
  assert.doesNotMatch(verifier, /new URL\(base\)\.origin !== 'https:\/\/thinktank-app\.jussco\.company'/);
});

test('public verifier still requires trusted exact-source manifest and byte hashes', () => {
  assert.match(workflow, /THINK_TANK_EXPECTED_SHA: \$\{\{ inputs\.expected_head_sha \}\}/);
  assert.match(workflow, /THINK_TANK_TRUSTED_MANIFEST_FILE: _site\/version\.json/);
  assert.match(verifier, /trusted\.source\?\.sha !== expectedSha/);
  assert.match(verifier, /mismatches\.length/);
  assert.match(verifier, /crypto\.createHash\('sha256'\)/);
});
