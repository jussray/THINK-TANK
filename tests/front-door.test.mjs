import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../front-door/worker.mjs';
const origin = 'https://thinktank.jussco.company';
test('public GET exposes only presentation HTML', async () => {
  const r = await worker.fetch(new Request(origin + '/'));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Where ideas become companies/);
  assert.match(r.headers.get('Content-Security-Policy'), /script-src 'none'/);
});
test('HEAD is empty and other paths are denied by the public worker', async () => {
  const head = await worker.fetch(new Request(origin + '/', {method:'HEAD'}));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/index.html', '/api/private', '/admin', '/workspace.html']) {
    assert.equal((await worker.fetch(new Request(origin + path))).status, 404, path);
  }
  assert.equal((await worker.fetch(new Request(origin + '/', {method:'POST'}))).status, 404);
});
test('public Worker routes exclude the private app hostname', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.front-door.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(config.routes.map(r => r.pattern), ['thinktank.jussco.company/*', 'thinktank.jussco.company/']);
  assert.ok(config.routes.every(r => !r.pattern.includes('thinktank-app.jussco.company')));
  assert.equal(config.preview_urls, false);
});
