// Keep the documented public/private Cloudflare boundary aligned with the
// founder-approved deployment topology. This test is not a live Access test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('README matches the public-front-door and protected-origin contract', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const publicFace = fs.readFileSync('PUBLIC_FACE.md', 'utf8');

  assert.match(publicFace, /every artifact path is public product surface/i);
  assert.match(readme, /\`think-tank-public-front-door\`/);
  assert.match(readme, /\`workspace\.html\` is public/);
  assert.match(readme, /https:\/\/thinktank\.jussco\.company\//);
  assert.match(readme, /https:\/\/www\.thinktank\.jussco\.company\//);
  assert.match(readme, /https:\/\/thinktank-app\.jussco\.company\//);
  assert.match(readme, /\`Bypass\`[^\n]*\`Everyone\`/);
  assert.doesNotMatch(readme, /temporary 302|workspace behind Access/i);
});
