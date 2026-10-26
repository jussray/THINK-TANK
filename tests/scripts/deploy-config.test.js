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

// Public journey files the private Worker may serve on the public host. Exact
// file routes only: no wildcard, no "/" and no workspace.html.
const PUBLIC_JOURNEY_FILES = [
  'index.html',
  'landing.html',
  'signin.html',
  'create-account.html',
  'app/contracts/runtime-contracts.js',
  'app/domain/deterministic-engine.js',
  'app/policy/capability-service.js',
  'app/policy/local-capability-policy.js',
  'app/stores/idea-store.js',
  'app/stores/local-idea-store.js',
  'assets/auth.css',
  'assets/hero-scene.jpg',
  'assets/band.jpg',
  'assets/c1.jpg',
  'assets/c2.jpg',
  'assets/c3.jpg',
  'assets/c4.jpg',
  'assets/orb-critic.jpg',
  'assets/orb-score.jpg',
  'assets/orb-synth.jpg',
  'assets/orb-match.jpg'
];

test('private Worker claims only the exact public journey files and the protected app host', () => {
  const config = readWranglerConfig();
  // Founder ruling: the www canonical public root and the apex redirect stay owned in Cloudflare.
  // The private Worker may serve only the exact public journey files listed above, on www.
  // Every other public-host path stays at the Access-protected app host, and no
  // Worker Custom Domain may be declared on either public hostname.
  const expected = [
    { pattern: 'thinktank-app.jussco.company/*', zone_name: 'jussco.company' },
    ...PUBLIC_JOURNEY_FILES.map((file) => ({
      pattern: `www.thinktank.jussco.company/${file}`,
      zone_name: 'jussco.company'
    }))
  ];
  assert.deepEqual(config.routes, expected);
  assert.equal(config.routes.some((route) => route.custom_domain), false);
  assert.equal(
    config.routes.some((route) => route.pattern.includes('*') && route.pattern.startsWith('www.thinktank.jussco.company')),
    false,
    'no wildcard may cover the public host'
  );
  assert.equal(
    config.routes.some((route) => route.pattern.startsWith('thinktank.jussco.company/')),
    false,
    'the apex carries no Worker route; it redirects to www at the edge'
  );
  assert.equal(
    config.routes.some((route) => route.pattern === 'www.thinktank.jussco.company/workspace.html'),
    false,
    'workspace.html stays behind Access'
  );
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
