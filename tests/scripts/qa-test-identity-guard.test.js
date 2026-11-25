const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('QA account runbook distinguishes proposed identity from verified creation', () => {
  const source = fs.readFileSync('docs/THINK_TANK_TEST_ACCOUNT.md', 'utf8');
  assert.match(source, /test-user-tt@jussco\.company/);
  assert.match(source, /proposed.*not created/i);
  assert.match(source, /verified.*mailbox/i);
  assert.match(source, /no.*founder.*privilege/i);
  assert.match(source, /Cloudflare Access/);
  assert.match(source, /Supabase Auth/);
  assert.match(source, /rollback|revok/i);
});

test('no SQL migration automatically grants a named QA identity privileged roles', () => {
  const dirs = ['supabase/migrations', 'drizzle/migrations'];
  const forbidden = /insert\s+into\s+(?:public\.)?(?:user_roles|founder_users)[\s\S]{0,1000}?(?:from|where)[\s\S]{0,400}?\bemail\s*=\s*'/i;
  const failures = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filename of fs.readdirSync(dir).filter(f => f.endsWith('.sql'))) {
      const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
      if (forbidden.test(sql)) failures.push(path.join(dir, filename));
    }
  }
  assert.deepEqual(failures, []);
});

test('test-account runbook does not contain credentials or administrative bootstrap commands', () => {
  const source = fs.readFileSync('docs/THINK_TANK_TEST_ACCOUNT.md', 'utf8');
  assert.doesNotMatch(source, /(?:sk-proj-|ghp_|sb_secret_|service_role\s*[:=]\s*\S+)/i);
  assert.doesNotMatch(source, /INSERT\s+INTO\s+(?:public\.)?(?:user_roles|founder_users)/i);
});
