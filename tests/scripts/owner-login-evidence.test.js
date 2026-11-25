const test = require('node:test');
const assert = require('node:assert/strict');

const APP = '708fdf8f-bf42-4ee7-91e5-5ddf42b921b9';
const OWNER = ['one@example.net', 'two@example.net'];
const now = Date.parse('2026-11-25T18:00:00.000Z');
const event = (email, allowed = true, time = now, app = APP) => ({
  app_uid: app, action: 'login', allowed, user_email: email, created_at: new Date(time).toISOString()
});

const inspect = async (events, options = {}) => {
  const { evaluateOwnerLoginEvidence } = await import('../../scripts/owner-login-evidence.mjs');
  return evaluateOwnerLoginEvidence({
    events, originAppId: APP, ownerEmails: OWNER, nowMs: now,
    maxAgeMs: 24 * 60 * 60 * 1000, ...options
  });
};

test('accepts one recent real owner login without returning identity data', async () => {
  const result = await inspect([event('One@Example.Net')]);
  assert.deepEqual(result, { status: 'observed-access-login', ownerLoginEvents: 1 });
  assert.equal(JSON.stringify(result).includes('@'), false);
});

test('rejects denied-only events and missing evidence', async () => {
  await assert.rejects(() => inspect([]), /no recent approved owner login/i);
  await assert.rejects(() => inspect([event('one@example.net', false)]), /no recent approved owner login/i);
});

test('rejects a successful event from a non-owner (policy regression)', async () => {
  await assert.rejects(() => inspect([event('outsider@example.net', true)]), /non-owner/i);
});

test('ignores successful logins from different Access applications', async () => {
  await assert.rejects(() => inspect([event('one@example.net', true, now, 'other-app')]), /no recent approved owner login/i);
});

test('rejects stale or implausibly future-dated evidence', async () => {
  await assert.rejects(() => inspect([event('one@example.net', true, now - 25 * 3600000)]), /no recent approved owner login/i);
  await assert.rejects(() => inspect([event('one@example.net', true, now + 10 * 60000)]), /no recent approved owner login/i);
});

test('rejects malformed events and malformed owner allowlists', async () => {
  await assert.rejects(() => inspect([{ action: 'login', allowed: true, app_uid: APP }]), /invalid|unverifiable/i);
  await assert.rejects(() => inspect([event('one@example.net')], { ownerEmails: ['*'] }), /owner allowlist/i);
});

test('rejects anonymous bypass and non-login events', async () => {
  await assert.rejects(() => inspect([{ ...event('one@example.net'), action: 'bypass' }]), /no recent approved owner login/i);
  await assert.rejects(() => inspect([{ ...event('one@example.net'), action: 'login', allowed: 'true' }]), /unverifiable/i);
});
