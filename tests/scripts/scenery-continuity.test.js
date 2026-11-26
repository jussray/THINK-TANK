// Design regression: one anchored landscape behind real interactive stages.
// This is a source contract, not a substitute for desktop/mobile Playwright screenshots.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../../assets/cinematic-app.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

test('one shared portal scene spans the interactive hero and board', () => {
  assert.match(css, /body::before\s*\{[^}]*position:\s*fixed;[^}]*think-tank-hero-scene\.webp/s,
    'landscape is anchored once to viewport, rather than repeated in sections');
  assert.match(css, /\.hero\s*,\s*\.board\s*\{\s*background:\s*transparent;/,
    'hero and six-stage board reveal the same scene');
  assert.match(css, /\.hero-art\s*\{\s*background:\s*none;/,
    'hero does not draw a second, independently cropped scene');
  assert.match(css, /body\s*>\s*header\s*,\s*body\s*>\s*main\s*,\s*body\s*>\s*footer/,
    'interactive content remains above the scene layer');
  assert.match(css, /pointer-events:\s*none;/,
    'scenic backdrop cannot intercept form or navigation input');
});

test('cinematic source still preserves the real V0 interview and portable record entry', () => {
  assert.match(html, /data-testid="idea-input"/);
  assert.match(html, /data-testid="export-record"/);
  assert.match(html, /prefers-reduced-motion/);
});
