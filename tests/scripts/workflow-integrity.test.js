// Workflow integrity gate: a workflow file can look right to a string search
// while YAML folds a step into a comment (verify-live.yml shipped exactly
// that defect: literal "\n" text swallowed its decisive step, and the lane
// failed with zero jobs on every push while existence checks stayed green).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS = ['playwright.yml', 'deploy-worker.yml', 'verify-live.yml'];
const dir = path.resolve(__dirname, '..', '..', '.github', 'workflows');

for (const file of WORKFLOWS) {
  test(`${file} contains no literal backslash-n corruption`, () => {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(!text.includes('\\n'), `${file} must not contain literal \\n sequences`);
  });
}

test('verify-live.yml exposes its live-verification step as a real step', () => {
  const text = fs.readFileSync(path.join(dir, 'verify-live.yml'), 'utf8');
  assert.match(
    text,
    /^\s*- name: Verify live bytes against trusted source artifact\s*$/m,
    'the verify step must exist as a YAML step, not inside a comment'
  );
  assert.match(text, /node scripts\/verify-live-runtime\.mjs/, 'the step must invoke the live verifier');
});

test('playwright.yml pins least-privilege permissions', () => {
  const text = fs.readFileSync(path.join(dir, 'playwright.yml'), 'utf8');
  assert.match(text, /^permissions:\s*\n\s+contents: read\s*$/m, 'playwright lane must declare contents: read only');
});
