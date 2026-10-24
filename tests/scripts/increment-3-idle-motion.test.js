// Contract for increment 3: the idle interview frame and the reduced-motion-gated hero drift.
// Static source checks only. Visual and behavioural proof lives in the Playwright captures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('idle interview frame shows question progress and copy, without reusing live progress IDs', () => {
  const start = html.indexOf('<div id="interviewIdle"');
  assert.ok(start >= 0, 'interviewIdle present');
  const end = html.indexOf('<div id="conversation"', start);
  assert.ok(end > start, 'conversation block follows the idle block');
  const block = html.slice(start, end);
  assert.match(block, /<div class="idle-frame">/, 'idle frame wrapper present');
  assert.match(block, /Question 1 of 4 · not started/, 'progress meta reads question 1 of 4');
  assert.match(block, /class="progress-track" aria-hidden="true"/, 'decorative progress track is hidden from assistive tech');
  assert.match(block, /Describe an idea in the Start panel to begin\./, 'idle copy kept');
  assert.doesNotMatch(block, /id="progress/, 'idle frame must not duplicate live progress element IDs');
});

test('hero drift is defined and runs only when reduced motion is not requested', () => {
  assert.match(
    html,
    /@media \(prefers-reduced-motion:no-preference\)\{\.hero-art\{animation:hero-drift 40s ease-in-out infinite alternate\}\}/,
    'hero drift sits inside the no-preference media query',
  );
  assert.match(html, /@keyframes hero-drift\{from\{transform:scale\(1\.02\)\}to\{transform:scale\(1\.06\) translate3d\(-\.6%,\.4%,0\)\}\}/, 'hero-drift keyframes present');
  assert.match(html, /\.idle-frame\{[^}]*max-width:420px/, 'idle frame width is capped');
});

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
