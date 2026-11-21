import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../worker/neon-api.mjs';

const HOST = 'https://thinktank.jussco.company';
const AUTH = 'https://ep-example.neonauth.c-9.us-east-2.aws.neon.tech/think_tank/auth';
const DATA = 'https://ep-example.apirest.c-9.us-east-2.aws.neon.tech/think_tank/rest/v1';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const IDEA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_A = '0123456789sessionALongValid';
const SESSION_B = '0123456789sessionBLongValid';
const env = { NEON_AUTH_RELEASE: 'enabled', NEON_AUTH_URL: AUTH, NEON_DATA_API_URL: DATA, PUBLIC_ORIGIN: HOST };
const idea = changes => ({ schemaVersion: 'IdeaRecordV1', id: IDEA, idea: 'Private idea', ...changes });
const request = (path, method = 'GET', body, session, other = {}) => new Request(HOST + path, {
  method,
  headers: { ...(method === 'GET' ? {} : { Origin: HOST, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }),
    ...(session ? { Cookie: '__Host-tt_neon=' + session } : {}), ...other },
  body: body === undefined ? undefined : JSON.stringify(body),
});
async function withProvider(fn) {
  const old = globalThis.fetch, calls = [], rows = new Map();
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url: url.toString(), options });
    if (url.pathname.includes('/auth/')) {
      if (url.pathname.endsWith('/sign-in/email'))
        return new Response(JSON.stringify({ user: { id: A } }), { status: 200, headers: { 'Set-Cookie': '__Secure-neon-auth.session_token=' + SESSION_A + '; Secure; HttpOnly' } });
      if (url.pathname.endsWith('/get-session')) {
        const sid = options.headers.Cookie?.endsWith(SESSION_A) ? A : options.headers.Cookie?.endsWith(SESSION_B) ? B : null;
        return sid ? new Response(JSON.stringify({ session: { id: 's' }, user: { id: sid, email: 'verified@example.test', emailVerified: true } }), {
          headers: { 'Set-Auth-Jwt': sid === A ? 'aaa.userA.sig' : 'bbb.userB.sig' }
        }) : Response.json(null);
      }
      return Response.json({ success: true });
    }
    const bearer = options.headers.Authorization?.split(' ')[1];
    const owner = bearer === 'aaa.userA.sig' ? A : bearer === 'bbb.userB.sig' ? B : null;
    if (!owner) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const owned = [...rows.values()].filter(x => x.owner_user_id === owner && (!id || x.id === id));
    if (options.method === 'GET') return Response.json(owned);
    if (options.method === 'POST') {
      const row = JSON.parse(options.body);
      if (row.owner_user_id !== owner) return Response.json({ error: 'denied' }, { status: 403 });
      if (rows.has(row.id)) return Response.json({ code: '23505' }, { status: 409 });
      rows.set(row.id, row); return Response.json([row], { status: 201 });
    }
    if (options.method === 'PATCH') {
      const stored = owned[0];
      if (!stored || stored.revision !== Number(url.searchParams.get('revision')?.replace('eq.', ''))) return Response.json([]);
      const updated = { ...stored, ...JSON.parse(options.body) };
      rows.set(updated.id, updated); return Response.json([updated]);
    }
    throw new Error('Unexpected provider method');
  };
  try { await fn({ calls, rows }); } finally { globalThis.fetch = old; }
}

test('unconfigured gateway and alternate origins fail closed', async () => {
  assert.equal((await api(request('/api/auth/me'), {}, '/api/auth/me')).status, 503);
  assert.equal((await api(request('/api/auth/me'), { ...env, NEON_AUTH_RELEASE: 'closed' }, '/api/auth/me')).status, 503);
  assert.equal((await api(request('/api/auth/me'), { ...env, NEON_DATA_API_URL: 'https://evil.test' }, '/api/auth/me')).status, 503);
});
test('anonymous idea records are denied and cookies cleared', async () => withProvider(async () => {
  const res = await api(request('/api/ideas'), env, '/api/ideas');
  assert.equal(res.status, 401);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
}));
test('mutations reject foreign Origin before any upstream requests', async () => withProvider(async ({ calls }) => {
  const res = await api(request('/api/auth/login', 'POST', { email: 'a@example.test', password: 'longpassword123' }, null, { Origin: 'https://evil.test' }), env, '/api/auth/login');
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
}));
test('sign-in creates HttpOnly cookie but never returns provider JWT', async () => withProvider(async () => {
  const res = await api(request('/api/auth/login', 'POST', { email: 'a@example.test', password: 'longpassword123' }), env, '/api/auth/login');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /__Host-tt_neon=.*Secure; HttpOnly/);
  assert.doesNotMatch(JSON.stringify(await res.json()), /userA\.sig|sessionALongValid/);
}));
test('owner vault cannot read, update or overwrite another tenant', async () => withProvider(async ({ rows }) => {
  const created = await api(request('/api/ideas', 'POST', { record: idea(), owner_user_id: B }, SESSION_A), env, '/api/ideas');
  assert.equal(created.status, 201);
  assert.equal(rows.get(IDEA).owner_user_id, A);
  assert.equal((await api(request('/api/ideas/' + IDEA, 'GET', undefined, SESSION_B), env, '/api/ideas/' + IDEA)).status, 404);
  assert.equal((await api(request('/api/ideas/' + IDEA, 'PUT', { record: idea({ idea: 'Revised' }), expectedRevision: 1 }, SESSION_A), env, '/api/ideas/' + IDEA)).status, 200);
  assert.equal((await api(request('/api/ideas/' + IDEA, 'PUT', { record: idea({ idea: 'Stale' }), expectedRevision: 1 }, SESSION_A), env, '/api/ideas/' + IDEA)).status, 409);
  assert.equal((await api(request('/api/ideas/' + IDEA, 'PUT', { record: idea({ idea: 'Stolen' }), expectedRevision: 2 }, SESSION_B), env, '/api/ideas/' + IDEA)).status, 409);
  assert.equal(rows.get(IDEA).record.idea, 'Revised');
}));
test('email verification and reset endpoints delegate only to dedicated Neon Auth', async () => withProvider(async ({ calls }) => {
  assert.equal((await api(request('/api/auth/verify-email', 'POST', { email: 'a@example.test', otp: '123456' }), env, '/api/auth/verify-email')).status, 200);
  assert.equal((await api(request('/api/auth/password-reset/start', 'POST', { email: 'a@example.test' }), env, '/api/auth/password-reset/start')).status, 202);
  assert.equal((await api(request('/api/auth/password-reset/complete', 'POST', { email: 'a@example.test', otp: '123456', password: 'newpassword12345' }), env, '/api/auth/password-reset/complete')).status, 200);
  assert.ok(calls.every(c => new URL(c.url).hostname.includes('.neonauth.')));
  assert.ok(calls.some(c => new URL(c.url).pathname.endsWith('/email-otp/verify-email')));
  assert.ok(calls.some(c => new URL(c.url).pathname.endsWith('/email-otp/request-password-reset')));
  assert.ok(calls.some(c => new URL(c.url).pathname.endsWith('/email-otp/reset-password')));
  assert.ok(!calls.some(c => new URL(c.url).pathname.endsWith('/email-otp/forget-password')));
}));
