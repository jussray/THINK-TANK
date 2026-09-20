const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPolicy() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const file of ['app/policy/capability-service.js', 'app/policy/local-capability-policy.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context.ThinkTankPolicy;
}

test('local founder capability policy enables only verified V0 actions', async () => {
  const policy = loadPolicy();
  const capabilities = await new policy.LocalCapabilityPolicy().capabilitiesFor({ kind: 'local-founder' });
  const C = policy.CAPABILITY;

  for (const capability of [C.IDEA_READ, C.IDEA_EDIT, C.ANALYSIS_RUN, C.RECORD_EXPORT, C.RECORD_IMPORT]) {
    assert.equal(policy.can(capabilities, capability), true, `${capability} should be enabled`);
  }

  for (const capability of [C.RESEARCH_RUN, C.AGENT_RUN, C.MEMBER_INVITE, C.BILLING_MANAGE, C.DECISION_APPROVE]) {
    assert.equal(policy.can(capabilities, capability), false, `${capability} must remain disabled until separately implemented and proved`);
  }
});

test('unknown capabilities fail closed', async () => {
  const policy = loadPolicy();
  const capabilities = await new policy.LocalCapabilityPolicy().capabilitiesFor({ kind: 'local-founder' });
  assert.equal(policy.can(capabilities, 'unknown.capability'), false);
  assert.equal(policy.can(null, policy.CAPABILITY.IDEA_READ), false);
});
