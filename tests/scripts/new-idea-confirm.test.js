// Contract: the interview "New idea" button must not delete the saved Idea Record
// without an explicit, separate confirmation. reset() clears the record from
// browser storage through ideaStore.clearCurrent() and there is no undo in the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('New idea no longer calls reset() directly', () => {
  assert.doesNotMatch(
    html,
    /\$\('resetBtn'\)\.addEventListener\('click',\(\)=>void runCapability\(C\.IDEA_EDIT,reset\)\)/,
    'resetBtn must open the confirmation, not delete the record'
  );
  assert.match(html, /\$\('resetBtn'\)\.addEventListener\('click',\(\)=>showResetConfirm\(\)\)/);
});

test('confirmation container, warning copy and both actions exist', () => {
  assert.match(html, /<div id="resetConfirm" class="hidden reset-confirm"/, 'hidden confirmation region');
  assert.match(html, /Delete the saved Idea Record in this browser, including its versions\?/, 'states what is deleted');
  assert.match(html, /Export JSON first/, 'points to the only backup');
  assert.match(html, /<button[^>]*id="resetCancel"[^>]*>Keep it<\/button>/, 'cancel keeps the record');
  assert.match(html, /<button[^>]*id="resetDelete"[^>]*data-testid="confirm-new-idea"[^>]*>Delete saved record<\/button>/, 'explicit delete action');
});

test('only the explicit delete action reaches reset(), via confirmReset', () => {
  assert.match(html, /\$\('resetDelete'\)\.addEventListener\('click',\(\)=>void runCapability\(C\.IDEA_EDIT,confirmReset\)\)/);
  assert.match(html, /async function confirmReset\(\)\{hideResetConfirm\(\);await reset\(\)\}/);
  assert.match(html, /\$\('resetCancel'\)\.addEventListener\('click',\(\)=>hideResetConfirm\(\)\)/);
});
