// The deploy configuration is the one place where a silent edit changes what
// the public Internet serves, with no test failing anywhere else. These assert
// the two founder rulings that live in wrangler.jsonc.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function readWranglerConfig() {
  const raw = fs.readFileSync('wrangler.jsonc', 'utf8');
  // Strip // line comments that are not inside a string literal.
  const stripped = raw
    .split('\n')
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"' && line[i - 1] !== '\\') inString = !inString;
        if (!inString && ch === '/' && line[i + 1] === '/') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
  return JSON.parse(stripped);
}

test('wrangler.jsonc is valid JSONC and names the think-tank Worker', () => {
  const config = readWranglerConfig();
  assert.equal(config.name, 'think-tank');
});

test('the Worker serves the inspected artifact directory, not the working tree', () => {
  const config = readWranglerConfig();
  assert.equal(config.assets?.directory, './_site');
  // No `main`: V0 is static and local-first. A server entrypoint here would
  // contradict the V0 boundary in AGENTS.md.
  assert.equal(config.main, undefined, 'V0 must not gain a server entrypoint through deploy config');
});

test('the canonical hostname is bound as a Cloudflare custom domain', () => {
  const config = readWranglerConfig();
  const routes = config.routes ?? [];
  const canonical = routes.find((route) => route.pattern === 'thinktank.jussco.company');
  assert.ok(canonical, 'thinktank.jussco.company must be declared in wrangler.jsonc');
  assert.equal(canonical.custom_domain, true, 'the Worker is the origin for this hostname');
});

test('Version/Preview URLs are explicitly disabled', () => {
  const config = readWranglerConfig();
  // Omitting the field inherits a default that has changed three times across
  // Wrangler versions, so it must be explicit, and it must be false: a branch
  // preview would otherwise publish an unapproved artifact under this product's
  // name at a public *.workers.dev URL.
  assert.equal(config.preview_urls, false);
});

test('no second deploy surface has been reintroduced', () => {
  // Cloudflare is canon. A returning Pages workflow would be a second owner of
  // one product, which is the drift this ruling exists to prevent.
  assert.equal(
    fs.existsSync('.github/workflows/publish-pages.yml'),
    false,
    'the GitHub Pages publication workflow must stay removed'
  );
  assert.ok(fs.existsSync('.github/workflows/verify-live.yml'), 'the live proof workflow must exist');
  assert.ok(fs.existsSync('scripts/verify-live-runtime.mjs'), 'the live verifier must exist');
});


test('Cloudflare deployment uses a pinned, project-local Wrangler CLI', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const pin = pkg.devDependencies?.wrangler;
  assert.equal(pin, '4.149.0', 'production deploy requires the reviewed exact Wrangler version');
  assert.match(pin, /^\d+\.\d+\.\d+$/, 'do not permit implicit latest, caret, or range');
});


test('all local stylesheet links and their image assets belong to the signed static artifact', () => {
  const path = require('node:path');
  const build = fs.readFileSync('scripts/build-static-artifact.mjs', 'utf8');
  const list = build.match(/const requiredFiles = \[([\s\S]*?)\];/);
  assert.ok(list, 'packaging allowlist must be explicit');
  const bundled = new Set([...list[1].matchAll(/'([^']+)'/g)].map((hit) => hit[1]));
  const pages = ['index.html', 'landing.html', 'workspace.html', 'signin.html', 'create-account.html'];
  let checked = 0;

  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const stylesheetLinks = html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi);
    for (const [, href] of stylesheetLinks) {
      if (/^(?:https?:|\/\/|data:)/i.test(href)) continue;
      const clean = href.split(/[?#]/, 1)[0];
      const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(page), clean));
      assert.ok(!normalized.startsWith('../') && !path.posix.isAbsolute(normalized), 'stylesheet must stay in the source tree');
      assert.ok(bundled.has(normalized), page + ' links unbundled CSS: ' + normalized);
      assert.ok(fs.existsSync(normalized), 'stylesheet does not exist: ' + normalized);
      checked += 1;

      const css = fs.readFileSync(normalized, 'utf8');
      for (const [, quoted, bare] of css.matchAll(/url\(\s*(?:["']([^"']+)["']|([^)]+))\s*\)/gi)) {
        const url = (quoted ?? bare ?? '').trim();
        if (!url || /^(?:https?:|\/\/|data:|#)/i.test(url)) continue;
        const image = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), url.split(/[?#]/, 1)[0]));
        assert.ok(!image.startsWith('../') && !path.posix.isAbsolute(image), 'stylesheet asset must remain local');
        assert.ok(bundled.has(image), normalized + ' references unbundled asset: ' + image);
        assert.ok(fs.existsSync(image), 'stylesheet image asset does not exist: ' + image);
      }
    }
  }
  assert.ok(checked >= 2, 'at least interactive UI and authentication CSS must be accounted for');
});
