import { handleAiAction } from './ai-gateway.mjs';
// Account session and private-vault API for the public Think Tank Worker.
const TABLE = 'think_tank_idea_records';
const COOKIE_ACCESS = '__Host-tt_access';
const COOKIE_REFRESH = '__Host-tt_refresh';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_ORIGIN = 'https://thinktank.jussco.company';
const MAX_BODY_BYTES = 1_000_000;
function result(data, status = 200, cookies = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  });
  for (const item of cookies) headers.append('Set-Cookie', item);
  return new Response(JSON.stringify(data), { status, headers });
}
function cookie(name, value, seconds) {
  return name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + seconds + '; Secure; HttpOnly; SameSite=Lax';
}
function clearCookies() {
  return [cookie(COOKIE_ACCESS, '', 0), cookie(COOKIE_REFRESH, '', 0)];
}
function sessionCookies(session) {
  const expires = Math.max(1, Math.min(Number(session.expires_in) || 3600, 3600));
  return [cookie(COOKIE_ACCESS, session.access_token, expires), cookie(COOKIE_REFRESH, session.refresh_token, 30 * 86400)];
}
function cookiesFor(request) {
  const out = Object.create(null);
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    try { out[key] = decodeURIComponent(part.slice(at + 1).trim()); } catch { /* malformed cookie rejected */ }
  }
  return out;
}
function sameOriginMutation(request, env) {
  const origin = env.PUBLIC_ORIGIN || DEFAULT_ORIGIN;
  const suppliedOrigin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return suppliedOrigin === origin && (fetchSite === null || fetchSite === 'same-origin');
}
async function readBody(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new Error('Expected JSON');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) throw new Error('Payload too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body');
  let total = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('Payload too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Invalid JSON'); }
}
function configReady(env) {
  if (typeof env.SUPABASE_URL !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL)) return false;
  return typeof env.SUPABASE_PUBLISHABLE_KEY === 'string' && env.SUPABASE_PUBLISHABLE_KEY.length >= 20;
}
async function upstream(env, path, method, data, bearer) {
  const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = 'Bearer ' + bearer;
  if (path.startsWith('/rest/v1/') && ['POST', 'PATCH'].includes(method)) headers.Prefer = 'return=representation';
  const response = await fetch(env.SUPABASE_URL + path, {
    method, headers, body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* invalid upstream body fails closed */ }
  return { status: response.status, body, ok: response.ok };
}
async function verifiedUser(env, token) {
  if (!token) return null;
  const response = await upstream(env, '/auth/v1/user', 'GET', undefined, token);
  const user = response.body;
  return response.ok && typeof user?.id === 'string' && UUID.test(user.id) && user.email_confirmed_at ? user : null;
}
async function authenticate(request, env) {
  const stored = cookiesFor(request);
  const access = stored[COOKIE_ACCESS];
  const current = await verifiedUser(env, access);
  if (current) return { user: current, token: access, set: [] };
  if (!stored[COOKIE_REFRESH]) return null;
  const refreshed = await upstream(env, '/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: stored[COOKIE_REFRESH] });
  if (!refreshed.ok || !refreshed.body?.access_token || !refreshed.body?.refresh_token) return null;
  const user = await verifiedUser(env, refreshed.body.access_token);
  return user ? { user, token: refreshed.body.access_token, set: sessionCookies(refreshed.body) } : null;
}
function validIdea(body, id = null) {
  const record = body?.record;
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.schemaVersion !== 'IdeaRecordV1' ||
      typeof record.id !== 'string' || !UUID.test(record.id) || (id && id !== record.id) ||
      typeof record.idea !== 'string' || !record.idea.trim() || record.idea.length > 4000) return false;
  return true;
}
function safeMember(user) {
  return { userId: user.id, email: typeof user.email === 'string' ? user.email : null };
}
export async function api(request, env, pathname) {
  if (!configReady(env)) return result({ error: 'Account service unavailable' }, 503);
  const method = request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT'].includes(method)) return result({ error: 'Method not allowed' }, 405);
  if (method !== 'GET' && !sameOriginMutation(request, env)) return result({ error: 'Invalid request origin' }, 403);
  let body;
  if (method !== 'GET') {
    try { body = await readBody(request); }
    catch (error) { return result({ error: error.message === 'Payload too large' ? 'Payload too large' : 'Invalid JSON request' }, error.message === 'Payload too large' ? 413 : 400); }
  }
  try {
    if (pathname === '/api/auth/signup' && method === 'POST') {
      const email = body?.email, password = body?.password;
      if (typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) ||
          typeof password !== 'string' || password.length < 12 || password.length > 128) {
        return result({ error: 'Use a valid email and a password of 12–128 characters' }, 400);
      }
      const created = await upstream(env, '/auth/v1/signup', 'POST', { email, password });
      if (!created.ok) return result({ error: 'Registration unavailable or request not accepted' }, created.status === 429 ? 429 : 400);
      return result({ message: 'Check your email to verify your account, then sign in.' }, 202);
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      if (typeof body?.email !== 'string' || typeof body?.password !== 'string') return result({ error: 'Email and password required' }, 400);
      const signed = await upstream(env, '/auth/v1/token?grant_type=password', 'POST', { email: body.email, password: body.password });
      if (!signed.ok || !signed.body?.access_token || !signed.body?.refresh_token) return result({ error: 'Incorrect credentials or unverified account' }, 401);
      const user = await verifiedUser(env, signed.body.access_token);
      if (!user) return result({ error: 'Verify your email before signing in' }, 403);
      return result({ user: safeMember(user) }, 200, sessionCookies(signed.body));
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = cookiesFor(request)[COOKIE_ACCESS];
      if (token) await upstream(env, '/auth/v1/logout', 'POST', undefined, token).catch(() => null);
      return result({ signedOut: true }, 200, clearCookies());
    }
    const session = await authenticate(request, env);
    if (!session) return result({ error: 'Sign in required', ...(pathname === '/api/auth/me' ? {service: 'think-tank-auth-v1'} : {}) }, 401, clearCookies());
    if (pathname === '/api/auth/me' && method === 'GET') return result({ service: 'think-tank-auth-v1', user: safeMember(session.user) }, 200, session.set);
    if (pathname === '/api/ai/interview' || pathname === '/api/ai/synthesize') {
      if (method !== 'POST') return result({ error: 'Method not allowed' },405);
      return handleAiAction({ pathname, body, session, env, upstream, reply:result });
    }
    if (pathname === '/api/ideas' && method === 'GET') {
      const where = new URLSearchParams({ select: 'id,title,revision,updated_at', owner_user_id: 'eq.' + session.user.id, order: 'updated_at.desc', limit: '100' });
      const got = await upstream(env, '/rest/v1/' + TABLE + '?' + where, 'GET', undefined, session.token);
      return got.ok && Array.isArray(got.body) ? result({ ideas: got.body }, 200, session.set) : result({ error: 'Idea vault unavailable' }, 503);
    }
    if (pathname === '/api/ideas' && method === 'POST') {
      if (!validIdea(body)) return result({ error: 'Invalid IdeaRecordV1' }, 400);
      const data = { id: body.record.id, owner_user_id: session.user.id, title: body.record.idea, record: body.record, revision: 1 };
      const got = await upstream(env, '/rest/v1/' + TABLE, 'POST', data, session.token);
      if (got.status === 409 || got.body?.code === '23505') return result({ error: 'Already stored; retrieve the current revision before updating' }, 409);
      if (!got.ok) return result({ error: 'Idea was not saved' }, 503);
      return result({ saved: true, id: data.id, revision: 1 }, 201, session.set);
    }
    const match = /^\/api\/ideas\/([0-9a-f-]+)$/i.exec(pathname);
    if (match && UUID.test(match[1])) {
      const id = match[1];
      if (method === 'GET') {
        const query = new URLSearchParams({ select: 'id,record,revision,updated_at', id: 'eq.' + id, owner_user_id: 'eq.' + session.user.id, limit: '1' });
        const got = await upstream(env, '/rest/v1/' + TABLE + '?' + query, 'GET', undefined, session.token);
        return got.ok && Array.isArray(got.body) ? (got.body[0] ? result({ idea: got.body[0] }, 200, session.set) : result({ error: 'Not found' }, 404)) : result({ error: 'Idea vault unavailable' }, 503);
      }
      if (method === 'PUT') {
        if (!validIdea(body, id) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) return result({ error: 'Invalid revision or IdeaRecordV1' }, 400);
        const expected = body.expectedRevision;
        const query = new URLSearchParams({ id: 'eq.' + id, owner_user_id: 'eq.' + session.user.id, revision: 'eq.' + expected, select: 'id,revision' });
        const got = await upstream(env, '/rest/v1/' + TABLE + '?' + query, 'PATCH', { record: body.record, title: body.record.idea, revision: expected + 1, updated_at: new Date().toISOString() }, session.token);
        return got.ok && Array.isArray(got.body) ? (got.body[0] ? result({ saved: true, revision: got.body[0].revision }, 200, session.set) : result({ error: 'Conflict or inaccessible idea; reload before saving' }, 409)) : result({ error: 'Idea was not saved' }, 503);
      }
    }
    return result({ error: 'Not found' }, 404);
  } catch {
    return result({ error: 'Service temporarily unavailable' }, 503);
  }
}