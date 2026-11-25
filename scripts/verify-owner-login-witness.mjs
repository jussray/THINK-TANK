#!/usr/bin/env node
// Manual read-only Access login receipt. Never prints identities, raw logs,
// cookies, API tokens or private application content. This does not emulate
// an owner session or prove the application works after Access accepts login.
import { evaluateOwnerLoginEvidence } from './owner-login-evidence.mjs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = process.env.CLOUDFLARE_ACCESS_READ_TOKEN || '';
const APP_ID = '708fdf8f-bf42-4ee7-91e5-5ddf42b921b9';
if (!/^[a-f0-9]{32}$/.test(account) || !token.trim()) {
  console.error('Missing read-only Cloudflare Access audit credentials');
  process.exit(2);
}

const now = Date.now();
const since = new Date(now - 86400000).toISOString();
async function get(relativePath) {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + relativePath, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Cloudflare Access read request failed (HTTP ' + response.status + ')');
  const value = await response.json();
  if (value.success !== true || !value.result) throw new Error('Cloudflare Access API returned an invalid result');
  if (value.result_info?.total_pages > 1) throw new Error('Access audit result was paginated; cannot certify partial evidence');
  return value.result;
}

try {
  const [app, events] = await Promise.all([
    get('/access/apps/' + APP_ID),
    get('/access/logs/access_requests?app_uid=' + encodeURIComponent(APP_ID) + '&since=' + encodeURIComponent(since) + '&limit=100')
  ]);
  const policy = app?.policies;
  if (app?.name !== 'think-tank - Cloudflare Workers' || policy?.length !== 1 ||
      policy[0]?.name !== 'Think Tank origin - owner mailboxes' ||
      policy[0]?.decision !== 'allow' || policy[0]?.reusable !== false ||
      !Array.isArray(events) || events.length >= 100) {
    throw new Error('Origin policy changed or Access log coverage is incomplete');
  }
  const ownerEmails = policy[0].include?.map(entry => entry?.email?.email);
  const result = evaluateOwnerLoginEvidence({ events, originAppId: APP_ID, ownerEmails, nowMs: now });
  console.log(JSON.stringify({ ...result, scope: 'Think Tank Access authentication only', source: 'Cloudflare Access logs', windowHours: 24, credentialsExposed: false }));
} catch (error) {
  console.error('Owner Access login witness unavailable: ' + error.message);
  process.exitCode = 1;
}
