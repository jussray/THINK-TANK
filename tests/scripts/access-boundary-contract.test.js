const test = require('node:test');
const assert = require('node:assert/strict');

function fixture() {
  const addresses = ['owner-a@example.net', 'owner-b@example.net', 'sekretowner@example.net'];
  return {
    publicApp: {
      name: 'think-tank-public-front-door - Public Only',
      type: 'self_hosted',
      destinations: [{ type: 'worker', worker_id: 'public-worker' }],
      policies: [{
        name: 'Public homepage Worker bypass',
        decision: 'bypass', reusable: false,
        include: [{ everyone: {} }], exclude: [], require: []
      }]
    },
    originApp: {
      name: 'think-tank - Cloudflare Workers',
      type: 'self_hosted',
      destinations: [{ type: 'worker', worker_id: 'origin-worker' }],
      policies: [{
        name: 'Think Tank origin - owner mailboxes',
        decision: 'allow', reusable: false,
        include: addresses.map(email => ({ email: { email } })),
        exclude: [], require: []
      }]
    },
    ownerPolicy: {
      name: 'Allow founder owner mailboxes',
      decision: 'allow',
      include: addresses.map(email => ({ email: { email } }))
    },
    frontSettings: {
      bindings: [{ type: 'service', name: 'APP', service: 'think-tank', environment: 'production' }]
    }
  };
}

test('allow intentional public Worker while restricting direct origin access to founder identities', async () => {
  const { assertAccessBoundary } = await import('../../scripts/access-boundary-contract.mjs');
  const actual = assertAccessBoundary(fixture());
  assert.equal(actual.ownerIdentityCount, 3);
  assert.equal(actual.publicBypass, true);
  assert.equal(actual.originOwnerOnly, true);
});

test('reject shared linked-app token and Everyone on the protected origin', async () => {
  const { assertAccessBoundary } = await import('../../scripts/access-boundary-contract.mjs');
  const shared = fixture();
  shared.originApp.policies = [{ name: 'Login', reusable: true, decision: 'non_identity', include: [{ linked_app_token: { app_uid: 'source-app' } }] }];
  assert.throws(() => assertAccessBoundary(shared), /origin|owner|policy/i);
  const broad = fixture();
  broad.originApp.policies[0].include = [{ everyone: {} }];
  assert.throws(() => assertAccessBoundary(broad), /email|owner/i);
});

test('reject expanded owner addresses and missing public service binding', async () => {
  const { assertAccessBoundary } = await import('../../scripts/access-boundary-contract.mjs');
  const expanded = fixture();
  expanded.originApp.policies[0].include.push({ email: { email: 'not-owner@example.net' } });
  assert.throws(() => assertAccessBoundary(expanded), /owner/i);
  const unbound = fixture();
  unbound.frontSettings.bindings = [];
  assert.throws(() => assertAccessBoundary(unbound), /service binding/i);
});

test('reject removal of public exemption and overlapping Worker destinations', async () => {
  const { assertAccessBoundary } = await import('../../scripts/access-boundary-contract.mjs');
  const nonPublic = fixture();
  nonPublic.publicApp.policies[0].decision = 'allow';
  assert.throws(() => assertAccessBoundary(nonPublic), /public|bypass/i);
  const overlap = fixture();
  overlap.originApp.destinations[0].worker_id = 'public-worker';
  assert.throws(() => assertAccessBoundary(overlap), /distinct/i);
});
