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

test('the canonical hostname preserves the existing proxied Worker Route without claiming DNS', () => {
  const config = readWranglerConfig();
  const routes = config.routes ?? [];
  assert.equal(routes.length, 1, 'one canonical route; do not add an alternate publication surface');
  const [canonical] = routes;
  assert.equal(canonical.pattern, '*thinktank.jussco.company/*', 'use the existing Cloudflare Worker Route');
  assert.equal(canonical.zone_name, 'jussco.company', 'route must stay within the owned zone');
  assert.equal(canonical.custom_domain, undefined, 'do not claim externally managed DNS via custom_domain');
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
