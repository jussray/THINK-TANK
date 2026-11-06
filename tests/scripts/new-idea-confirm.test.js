// Contract: starting another idea requires confirmation. The existing idea
// remains in the validated collection, and reset only clears the active pointer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'app/index-page.js'), 'utf8');

test('New idea no longer calls reset() directly', () => {
  assert.doesNotMatch(
    controller,
    /\$\('resetBtn'\)\.addEventListener\('click',\(\)=>void runCapability\(C\.IDEA_EDIT,reset\)\)/,
    'resetBtn must open the confirmation, not delete the record'
  );
  assert.match(controller, /\$\('resetBtn'\)\.addEventListener\('click',\(\)=>showResetConfirm\(\)\)/);
});

test('new idea confirmation explicitly preserves stored records', () => {
  assert.match(html, /<div id="resetConfirm" class="hidden reset-confirm"/);
  assert.match(html, /Your current Idea Record, answers, and versions will remain in My Ideas/);
  assert.match(html, /Export JSON for an additional backup/);
  assert.match(html, /<button[^>]*id="resetCancel"[^>]*>Keep it<\/button>/);
  assert.match(html, /<button[^>]*id="resetDelete"[^>]*data-testid="confirm-new-idea"[^>]*>Keep idea &amp; start new<\/button>/);
});

test('only the confirmed non-destructive action clears the active pointer', () => {
  assert.match(controller, /\$\('resetDelete'\)\.addEventListener\('click',\(\)=>void runCapability\(C\.IDEA_EDIT,confirmReset\)\)/);
  assert.match(controller, /async function confirmReset\(\)\{hideResetConfirm\(\);await reset\(\)\}/);
  assert.match(controller, /\$\('resetCancel'\)\.addEventListener\('click',\(\)=>hideResetConfirm\(\)\)/);
});
