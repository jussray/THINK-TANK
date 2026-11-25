#!/usr/bin/env node
// Read-only, fail-closed production Cloudflare Access drift check.
// Required: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ACCESS_READ_TOKEN.
// Prints policy structure only; never prints account owners or token values.
import { assertAccessBoundary } from './access-boundary-contract.mjs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = process.env.CLOUDFLARE_ACCESS_READ_TOKEN || '';
if (!/^[a-f0-9]{32}$/.test(account) || !token.trim()) {
  console.error('Missing Cloudflare Access read-only account ID or API token');
  process.exit(2);
}

const root = 'https://api.cloudflare.com/client/v4/accounts/' + account;

async function get(path) {
  const res = await fetch(root + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('Cloudflare Access audit request failed (HTTP ' + res.status + ')');
  const payload = await res.json();
  if (!payload.success || !payload.result) throw new Error('Cloudflare Access audit API returned failure');
  if (payload.result_info?.total_pages > 1) throw new Error('Cloudflare Access audit requires pagination before it can certify this account');
  return payload.result;
}

try {
  const [apps, policies, frontSettings] = await Promise.all([
    get('/access/apps?per_page=100&page=1'),
    get('/access/policies?per_page=100&page=1'),
    get('/workers/scripts/think-tank-public-front-door/settings')
  ]);
  if (!Array.isArray(apps) || !Array.isArray(policies)) throw new Error('Unexpected Access API collection shape');
  const uniqueNamed = (items, name) => {
    const found = items.filter(x => x.name === name);
    if (found.length !== 1) throw new Error('Missing or duplicated Access resource: ' + name);
    return found[0];
  };
  const proof = assertAccessBoundary({
    publicApp: uniqueNamed(apps, 'think-tank-public-front-door - Public Only'),
    originApp: uniqueNamed(apps, 'think-tank - Cloudflare Workers'),
    ownerPolicy: uniqueNamed(policies, 'Allow founder owner mailboxes'),
    frontSettings
  });
  console.log(JSON.stringify({ verified: 'configuration-only', ...proof }));
} catch (error) {
  console.error('Cloudflare Access drift check failed: ' + error.message);
  process.exitCode = 1;
}
