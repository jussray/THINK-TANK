const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Cloudflare production live proof targets only approved HTTPS hosts', async () => {
  const { assertProductionLiveOrigin } = await import('../../scripts/live-origin-policy.mjs');
  for (const url of ['https://thinktank.jussco.company/', 'https://thinktank-app.jussco.company/']) {
    assert.doesNotThrow(() => assertProductionLiveOrigin(url, 'cloudflare-workers'));
  }
  for (const url of ['http://thinktank.jussco.company/', 'https://attacker.example/', 'https://thinktank.jussco.company/admin', 'https://thinktank.jussco.company/?foo=bar']) {
    assert.throws(() => assertProductionLiveOrigin(url, 'cloudflare-workers'));
  }
  assert.doesNotThrow(() => assertProductionLiveOrigin('http://127.0.0.1:4173/', 'test'));
});

test('manual verification defaults to the public product hostname', () => {
  const workflow = fs.readFileSync('.github/workflows/verify-live.yml', 'utf8');
  assert.match(workflow, /default: https:\/\/thinktank\.jussco\.company\b/);
  assert.match(workflow, /Verify live bytes against trusted source artifact/);
});
