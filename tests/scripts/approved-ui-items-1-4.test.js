// Contract for the approved UI increment (items 1-4 of the 2026-10-24 design audit).
// Static source checks only: they pin the markup and CSS decisions so a silent revert
// fails unit tests. Visual and behavioural proof lives in the Playwright receipts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'app/index-page.js'), 'utf8');

test('item 4: each role card uses its approved orb art, not a glyph', () => {
  const roles = [
    ['The Critic', 'assets/orb-critic.jpg'],
    ['The Scorecard', 'assets/orb-score.jpg'],
    ['The Synthesizer', 'assets/orb-synth.jpg'],
    ['The Matchmaker', 'assets/orb-match.jpg'],
  ];
  for (const [name, src] of roles) {
    const card = html.match(new RegExp('<div class="rolecard">(?:(?!</div><div class="rolecard">).)*?<b>' + name + '</b>', 's'));
    assert.ok(card, name + ' role card present');
    assert.match(card[0], new RegExp('<img[^>]+src="' + src.replace(/\./g, '\\.') + '"'), name + ' uses ' + src);
    assert.ok(fs.existsSync(path.join(root, src)), src + ' exists in repo');
  }
  assert.match(html, /\.orb img\{[^}]*border-radius:50%/, 'orb image is clipped to a circle');
});

test('item 2: index.html loads the approved display serif and headings use it', () => {
  assert.match(html, /<link[^>]+fonts\.googleapis\.com\/css2\?family=Playfair\+Display/, 'Playfair Display stylesheet link');
  assert.match(html, /h1,h2,h3\{font-family:'Playfair Display',Georgia/, 'h1-h3 use Playfair Display with Georgia fallback');
});

test('item 1: nav links, brand and starter chips meet a 44px touch target', () => {
  assert.match(html, /\.navlinks a\{[^}]*min-height:44px/, 'nav text links min-height 44px');
  assert.match(html, /\.starter-chip\{[^}]*min-height:44px/, 'starter chips min-height 44px');
  assert.match(html, /\.brand\{[^}]*min-height:44px/, 'brand link min-height 44px');
});

test('item 3: hub New Idea is non-destructive and never calls reset or clearCurrent', () => {
  const btn = html.match(/<button[^>]*id="hubNewIdea"[^>]*>/);
  assert.ok(btn, 'hubNewIdea button sits in the hub panel');
  const hub = html.slice(html.indexOf('id="idea-hub"'), html.indexOf('id="about"'));
  assert.match(hub, /id="hubNewIdea"/, 'button is inside #idea-hub');
  const handler = controller.match(/\$\('hubNewIdea'\)\.addEventListener\('click',\(\)=>\{([^}]*)\}\)/);
  assert.ok(handler, 'hubNewIdea click handler present');
  assert.doesNotMatch(handler[1], /reset\(|clearCurrent|removeItem|saveCurrent/, 'handler must not delete or overwrite the saved record');
  assert.match(handler[1], /ideaInput/, 'handler moves focus to the Start idea input');
});
