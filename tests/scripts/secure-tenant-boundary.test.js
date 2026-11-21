const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const api = fs.readFileSync('worker/secure-api.mjs','utf8');
const front = fs.readFileSync('worker/frontdoor.mjs','utf8');
const migration = fs.readFileSync('supabase/migrations/20261121000000_think_tank_private_idea_records.sql','utf8');
const build = fs.readFileSync('scripts/build-static-artifact.mjs','utf8');
const page = fs.readFileSync('workspace.html','utf8');

test('public frontdoor dispatches secure API before asset service proxy',()=>{
  assert.ok(front.indexOf('return api(request, env, url.pathname)') < front.indexOf('env.APP.fetch'));
  assert.match(front,/script-src 'self'/);
  assert.match(front,/connect-src 'self'/);
  assert.match(front,/frame-ancestors 'none'/);
});
test('server uses only a publishable key with verified end-user bearer',()=>{
  assert.match(api,/SUPABASE_PUBLISHABLE_KEY/);
  assert.match(api,/verifiedUser/);
  assert.match(api,/sameOriginMutation/);
  assert.match(api,/HttpOnly/);
  assert.doesNotMatch(api,/SUPABASE_SERVICE_ROLE_KEY|service_role|bypassrls|access_token.*JSON\.stringify/);
});
test('database vault has owner-bound RLS and no anonymous or DELETE grants',()=>{
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/FORCE ROW LEVEL SECURITY/);
  assert.match(migration,/REVOKE ALL[\s\S]*FROM PUBLIC, anon/);
  assert.match(migration,/FOR SELECT TO authenticated/);
  assert.match(migration,/FOR INSERT TO authenticated/);
  assert.match(migration,/FOR UPDATE TO authenticated/);
  assert.match(migration,/auth\.uid\(\)\)\s*=\s*owner_user_id/);
  assert.doesNotMatch(migration,/GRANT[^\n]*DELETE/);
  assert.doesNotMatch(migration,/CREATE POLICY[^\n]*delete/i);
});
test('cloud vault assets are part of signed static artifact and opt-in only',()=>{
  assert.match(page,/id="cloudVault"/);
  assert.match(page,/assets\/cloud-vault\.js/);
  assert.match(build,/'assets\/cloud-vault\.js'/);
  const vault=fs.readFileSync('assets/cloud-vault.js','utf8');
  assert.match(vault,/confirm\(/);
  assert.match(vault,/Save current idea to private vault/);
  assert.doesNotMatch(vault,/service_role|localStorage\.clear/);
});