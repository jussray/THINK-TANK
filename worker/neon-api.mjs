// Think Tank customer-only gateway for dedicated Neon Auth + Neon Data API.
// No founder Supabase key, service-role key or client-side session token.
const SITE = 'https://thinktank.jussco.company';
const TABLE = 'think_tank_idea_records';
const SESSION = '__Host-tt_neon';
const NEON_SESSION = '__Secure-neon-auth.session_token';
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX = 1_000_000;

function reply(data, status = 200, cookies = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(data), { status, headers });
}
const sessionCookie = (value, maxAge = 604800) =>
  `${SESSION}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
function settings(env) {
  if (env.NEON_AUTH_RELEASE !== 'enabled' || env.PUBLIC_ORIGIN !== SITE) return null;
  try {
    const auth = new URL(env.NEON_AUTH_URL);
    const data = new URL(env.NEON_DATA_API_URL);
    if (auth.protocol !== 'https:' || data.protocol !== 'https:' ||
        !auth.hostname.includes('.neonauth.') || !data.hostname.includes('.apirest.') ||
        !auth.hostname.endsWith('.neon.tech') || !data.hostname.endsWith('.neon.tech') ||
        auth.pathname !== '/think_tank/auth' || data.pathname !== '/think_tank/rest/v1' ||
        auth.username || data.username || auth.search || data.search || auth.hash || data.hash) return null;
    return { auth: auth.href.replace(/\/$/, ''), data: data.href.replace(/\/$/, '') };
  } catch { return null; }
}
function csrf(request) {
  const site = request.headers.get('Sec-Fetch-Site');
  return request.headers.get('Origin') === SITE && (!site || site === 'same-origin');
}
function readCookie(request) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i >= 0 && part.slice(0, i).trim() === SESSION) {
      try {
        const value = decodeURIComponent(part.slice(i + 1).trim());
        return /^[A-Za-z0-9._%=-]{16,4096}$/.test(value) ? value : null;
      } catch { return null; }
    }
  }
  return null;
}
function receivedSession(headers) {
  const values = headers.getSetCookie?.() || [headers.get('set-cookie')].filter(Boolean);
  for (const header of values) {
    const match = /(?:^|,\s*)(?:__Secure-neon-auth\.session_token|neon-auth\.session_token)=([^;,\r\n]+)/.exec(header);
    if (match) {
      const value = match[1];
      if (/^[A-Za-z0-9._%=-]{16,4096}$/.test(value)) return value;
    }
  }
  return null;
}
async function jsonBody(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new Error('Invalid JSON');
  if (Number(request.headers.get('Content-Length') || '0') > MAX) throw new Error('Payload too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid JSON');
  const bytes = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX) { await reader.cancel(); throw new Error('Payload too large'); }
    bytes.push(value);
  }
  const assembled = new Uint8Array(length);
  let offset = 0;
  for (const part of bytes) { assembled.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(assembled)); }
  catch { throw new Error('Invalid JSON'); }
}
async function neonAuth(cfg, endpoint, method = 'GET', body, session) {
  const headers = { 'Accept': 'application/json', 'Origin': SITE };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers.Cookie = `${NEON_SESSION}=${session}`;
  const response = await fetch(`${cfg.auth}${endpoint}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}
async function identity(cfg, token) {
  if (!token) return null;
  const { response, data } = await neonAuth(cfg, '/get-session', 'GET', undefined, token);
  if (!response.ok) return null;
  const object = data?.data || data;
  const user = object?.user;
  const jwt = response.headers.get('set-auth-jwt') || object?.session?.access_token;
  if (!object?.session || !user?.id || user.emailVerified !== true || !TOKEN.test(jwt || '')) return null;
  return { user: { userId: user.id, email: typeof user.email === 'string' ? user.email : null }, jwt };
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^\S+@\S+\.\S+$/.test(value);
}
function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}
function validIdea(body, id = null) {
  const r = body?.record;
  return r && typeof r === 'object' && !Array.isArray(r) && r.schemaVersion === 'IdeaRecordV1' &&
    typeof r.id === 'string' && UUID.test(r.id) && (!id || r.id === id) &&
    typeof r.idea === 'string' && r.idea.trim().length > 0 && r.idea.length <= 4000;
}
async function neonData(cfg, path, method, jwt, body) {
  const headers = { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation';
  const response = await fetch(`${cfg.data}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(12000),
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
}
const fail = (message = 'Account service unavailable') => reply({ error: message }, 503);
export async function api(request, env, pathname) {
  const cfg = settings(env);
  if (!cfg) return fail();
  const method = request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT'].includes(method)) return reply({ error: 'Method not allowed' }, 405);
  if (method !== 'GET' && !csrf(request)) return reply({ error: 'Invalid request origin' }, 403);
  let body;
  if (method !== 'GET') {
    try { body = await jsonBody(request); }
    catch (error) { return reply({ error: error.message }, error.message === 'Payload too large' ? 413 : 400); }
  }
  try {
    if (pathname === '/api/auth/signup' && method === 'POST') {
      if (!validEmail(body?.email) || !validPassword(body?.password)) return reply({ error: 'Valid email and 12–128-character password required' }, 400);
      const { response } = await neonAuth(cfg, '/sign-up/email', 'POST', { email: body.email, password: body.password, name: 'Think Tank Member' });
      if (!response.ok) return reply({ error: 'Sign-up not available' }, response.status === 429 ? 429 : 400);
      return reply({ message: 'Enter the verification code sent to your email before signing in.' }, 202);
    }
    if (pathname === '/api/auth/verify-email' && method === 'POST') {
      if (!validEmail(body?.email) || !/^\d{6}$/.test(body?.otp || '')) return reply({ error: 'Valid email and 6-digit verification code required' }, 400);
      const { response } = await neonAuth(cfg, '/email-otp/verify-email', 'POST', { email: body.email, otp: body.otp });
      return response.ok ? reply({ verified: true }) : reply({ error: 'Invalid or expired verification code' }, response.status === 429 ? 429 : 400);
    }
    if (pathname === '/api/auth/password-reset/start' && method === 'POST') {
      if (!validEmail(body?.email)) return reply({ error: 'Valid email required' }, 400);
      await neonAuth(cfg, '/email-otp/forget-password', 'POST', { email: body.email });
      return reply({ message: 'If the address has an account, a reset code will be sent.' }, 202);
    }
    if (pathname === '/api/auth/password-reset/complete' && method === 'POST') {
      if (!validEmail(body?.email) || !/^\d{6}$/.test(body?.otp || '') || !validPassword(body?.password)) return reply({ error: 'Valid email, code and new password required' }, 400);
      const { response } = await neonAuth(cfg, '/email-otp/reset-password', 'POST', { email: body.email, otp: body.otp, password: body.password });
      return response.ok ? reply({ reset: true }, 200, [sessionCookie('', 0)]) : reply({ error: 'Invalid or expired reset code' }, response.status === 429 ? 429 : 400);
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      if (!validEmail(body?.email) || typeof body?.password !== 'string') return reply({ error: 'Email and password required' }, 400);
      const { response } = await neonAuth(cfg, '/sign-in/email', 'POST', { email: body.email, password: body.password });
      if (!response.ok) return reply({ error: 'Incorrect credentials or unverified account' }, 401);
      const session = receivedSession(response.headers);
      const signed = await identity(cfg, session);
      if (!signed) return fail('Session verification unavailable');
      return reply({ user: signed.user }, 200, [sessionCookie(session)]);
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = readCookie(request);
      if (token) await neonAuth(cfg, '/sign-out', 'POST', {}, token).catch(() => null);
      return reply({ signedOut: true }, 200, [sessionCookie('', 0)]);
    }
    const signed = await identity(cfg, readCookie(request));
    if (!signed) return reply({ error: 'Sign in required', ...(pathname === '/api/auth/me' ? { service: 'think-tank-auth-v1' } : {}) }, 401, [sessionCookie('', 0)]);
    if (pathname === '/api/auth/me' && method === 'GET') return reply({ service: 'think-tank-auth-v1', user: signed.user });
    if (pathname === '/api/ideas' && method === 'GET') {
      const query = new URLSearchParams({ select: 'id,title,revision,updated_at', owner_user_id: `eq.${signed.user.userId}`, order: 'updated_at.desc', limit: '100' });
      const got = await neonData(cfg, `/${TABLE}?${query}`, 'GET', signed.jwt);
      return got.ok && Array.isArray(got.data) ? reply({ ideas: got.data }) : fail('Idea vault unavailable');
    }
    if (pathname === '/api/ideas' && method === 'POST') {
      if (!validIdea(body)) return reply({ error: 'Invalid IdeaRecordV1' }, 400);
      const row = { id: body.record.id, owner_user_id: signed.user.userId, title: body.record.idea, record: body.record, revision: 1 };
      const got = await neonData(cfg, `/${TABLE}`, 'POST', signed.jwt, row);
      if (got.status === 409 || got.data?.code === '23505') return reply({ error: 'Already stored; load current revision' }, 409);
      return got.ok ? reply({ saved: true, id: row.id, revision: 1 }, 201) : fail('Idea was not saved');
    }
    const match = /^\/api\/ideas\/([0-9a-f-]+)$/i.exec(pathname);
    if (match && UUID.test(match[1])) {
      const id = match[1];
      if (method === 'GET') {
        const q = new URLSearchParams({ select: 'id,record,revision,updated_at', id: `eq.${id}`, owner_user_id: `eq.${signed.user.userId}`, limit: '1' });
        const got = await neonData(cfg, `/${TABLE}?${q}`, 'GET', signed.jwt);
        return got.ok && Array.isArray(got.data) ? (got.data[0] ? reply({ idea: got.data[0] }) : reply({ error: 'Not found' }, 404)) : fail('Idea vault unavailable');
      }
      if (method === 'PUT') {
        if (!validIdea(body, id) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) return reply({ error: 'Invalid record or revision' }, 400);
        const q = new URLSearchParams({ id: `eq.${id}`, owner_user_id: `eq.${signed.user.userId}`, revision: `eq.${body.expectedRevision}`, select: 'id,revision' });
        const got = await neonData(cfg, `/${TABLE}?${q}`, 'PATCH', signed.jwt, { record: body.record, title: body.record.idea, revision: body.expectedRevision + 1, updated_at: new Date().toISOString() });
        return got.ok && Array.isArray(got.data) ? (got.data[0] ? reply({ saved: true, revision: got.data[0].revision }) : reply({ error: 'Conflict or inaccessible idea' }, 409)) : fail('Idea was not saved');
      }
    }
    return reply({ error: 'Not found' }, 404);
  } catch { return fail('Service temporarily unavailable'); }
}
