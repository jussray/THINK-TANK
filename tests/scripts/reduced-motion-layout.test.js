// Contract: layout rules must not depend on the motion preference.
// The hub header flex layout and the orb image sizing were inside the
// prefers-reduced-motion:no-preference block, so reduced-motion users got a
// block-flow hub header and unsized orb images. Only animation and transition
// rules belong in that block.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('layout rules are not gated behind the motion preference', () => {
  const marker = '@media(prefers-reduced-motion:no-preference){';
  const start = html.indexOf(marker);
  assert.ok(start >= 0, 'motion-gated block present');
  let depth = 0;
  let end = -1;
  for (let i = start + marker.length - 1; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.ok(end > start, 'motion-gated block closes');
  const gated = html.slice(start, end + 1);
  assert.doesNotMatch(gated, /\.hub-head\{/, 'hub header flex layout must not depend on motion preference');
  assert.doesNotMatch(gated, /\.orb img\{/, 'orb image sizing must not depend on motion preference');
  assert.match(html, /\.hub-head\{display:flex/, 'hub header flex rule present outside the gated block');
  assert.match(html, /\.orb img\{display:block;width:100%;height:100%;border-radius:50%/, 'orb image sizing present outside the gated block');
});
