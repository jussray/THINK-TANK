const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const html = '<!doctype html>\n<html><body>Source content\n</body></html>\n';
const sourceHash = 'sha256:' + crypto.createHash('sha256').update(html).digest('hex');
const fakeBeacon = '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092" integrity="sha512-' + Buffer.alloc(64, 1).toString('base64') + '" data-cf-beacon=\'{"version":"2024.11.0","token":"' + 'a'.repeat(32) + '","r":1,"spa":2}\' crossorigin="anonymous"></script>';
const injected = html.replace('\n</body>', '\n' + fakeBeacon + '\n</body>');

async function verify(path, bytes, expected = sourceHash) {
  const { verifyServedFile } = await import('../../scripts/edge-asset-attestation.mjs');
  return verifyServedFile(path, Buffer.from(bytes), expected);
}

test('exact original bytes attest without any transformation', async () => {
  assert.deepEqual(await verify('index.html', html), { match: true, transform: 'none' });
});

test('one observed Cloudflare Analytics injection is isolated and declared', async () => {
  assert.deepEqual(await verify('index.html', injected), { match: true, transform: 'cloudflare-web-analytics-beacon' });
});

test('unrecognized script injection still fails closed', async () => {
  const altered = html.replace('\n</body>', '\n<script>fetch("https://example.invalid")</script>\n</body>');
  assert.equal((await verify('index.html', altered)).match, false);
});

test('beacon normalization never allows other modified HTML', async () => {
  const changed = injected.replace('Source content', 'Altered content');
  assert.equal((await verify('index.html', changed)).match, false);
});

test('beacon injection cannot be laundered into CSS or JavaScript', async () => {
  const expected = 'sha256:' + crypto.createHash('sha256').update('body{}').digest('hex');
  assert.equal((await verify('assets/auth.css', 'body{}' + fakeBeacon, expected)).match, false);
  assert.equal((await verify('app/index-page.js', 'body{}' + fakeBeacon, expected)).match, false);
});

test('wrong-domain and duplicated beacons are not normalized', async () => {
  const wrongDomain = injected.replace('static.cloudflareinsights.com', 'attacker.example');
  assert.equal((await verify('index.html', wrongDomain)).match, false);
  const doubleBeacon = injected.replace('\n</body>', '\n' + fakeBeacon + '\n</body>');
  assert.equal((await verify('index.html', doubleBeacon)).match, false);
});

test('changing beacon metadata or integrity outside the accepted format fails', async () => {
  assert.equal((await verify('landing.html', injected.replace('"r":1', '"r":999'))).match, false);
  assert.equal((await verify('landing.html', injected.replace('sha512-', 'sha256-'))).match, false);
});
