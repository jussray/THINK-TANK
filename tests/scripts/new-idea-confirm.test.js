// Contract: the interview "New idea" button must not discard a saved Idea Record.
// reset() clears only the active pointer after LocalIdeaStore safeguards its
// durable collection copy. No user's existing idea is deleted.
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
  assert.match(html, /Your current Idea Record, answers, and versions will remain in My Ideas/, 'states that ideas are preserved');
  assert.match(html, /Export JSON for an additional backup/, 'offers a separate backup');
  assert.match(html, /<button[^>]*id="resetCancel"[^>]*>Keep it<\/button>/, 'cancel keeps the record');
  assert.match(html, /<button[^>]*id="resetDelete"[^>]*data-testid="confirm-new-idea"[^>]*>Keep idea &amp; start new<\/button>/, 'explicit non-destructive action');
});

test('only the explicit keep-and-start-new action reaches reset(), via confirmReset', () => {
  assert.match(html, /\$\('resetDelete'\)\.addEventListener\('click',\(\)=>void runCapability\(C\.IDEA_EDIT,confirmReset\)\)/);
  assert.match(html, /async function confirmReset\(\)\{hideResetConfirm\(\);await reset\(\)\}/);
  assert.match(html, /\$\('resetCancel'\)\.addEventListener\('click',\(\)=>hideResetConfirm\(\)\)/);
});
