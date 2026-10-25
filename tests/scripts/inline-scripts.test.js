// Strict-CSP regression gate: the public front door must be able to serve
// every product surface under script-src 'self'. That is only possible if no
// surface carries an inline executable script. JSON-LD metadata blocks are
// data, not executable code, and are the one allowed exception.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const PAGES = ['landing.html', 'signin.html', 'create-account.html', 'index.html', 'workspace.html'];

function inlineExecutableScripts(html) {
  const found = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    found.push(match[2].trim().slice(0, 60));
  }
  return found;
}

for (const page of PAGES) {
  test(`${page} carries no inline executable script`, () => {
    const html = fs.readFileSync(page, 'utf8');
    assert.deepEqual(inlineExecutableScripts(html), []);
  });
}

test('page controllers load from allowlisted external files', () => {
  assert.match(fs.readFileSync('index.html', 'utf8'), /<script src="\.\/app\/index-page\.js"><\/script>/);
  assert.match(fs.readFileSync('workspace.html', 'utf8'), /<script src="\.\/app\/workspace-page\.js"><\/script>/);
  assert.match(fs.readFileSync('signin.html', 'utf8'), /<script src="assets\/auth-entry\.js"><\/script>/);
  assert.match(fs.readFileSync('create-account.html', 'utf8'), /<script src="assets\/auth-entry\.js"><\/script>/);
  const build = fs.readFileSync('scripts/build-static-artifact.mjs', 'utf8');
  for (const file of ['app/index-page.js', 'app/workspace-page.js', 'assets/auth-entry.js']) {
    assert.ok(build.includes(`'${file}'`), `${file} must be in the static artifact allowlist`);
    assert.ok(fs.existsSync(file), `${file} must exist`);
  }
});
