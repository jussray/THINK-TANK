// Protect the approved portal landscape across the public entrance.
// Source assertions only; Playwright still owns visual and journey proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../landing.html'), 'utf8');

test('public entrance uses the same anchored scenic plate as the interview', () => {
  assert.match(html, /body::after\s*\{[^}]*position:fixed;[^}]*think-tank-hero-scene\.webp/s);
  assert.match(html, /\.hero-bg\s*\{\s*display:none;/);
  assert.match(html, /body\s*>\s*:is\(header,section,main,footer,\.grid\)/);
  assert.match(html, /body::after\s*\{[^}]*pointer-events:none;/s);
});

test('scene remains legible in day theme and still honors reduced motion', () => {
  assert.match(html, /body:has\(\.tt-theme-toggle:checked\)::after\s*\{/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:reduce\)\s*\{\s*body::after\s*\{/);
  assert.match(html, /body::before\s*\{[^}]*height:env\(safe-area-inset-top,0px\)/s,
    'safe-area status strip must remain distinct from scene layer');
});

test('landing preserves the real onboarding route and production-truth notice', () => {
  assert.match(html, /href="\.\/onboarding\.html"/);
  assert.match(html, /id="truth"/);
});
