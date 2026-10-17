const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRealm() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const file of ['app/policy/capability-service.js', 'app/policy/local-capability-policy.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

test('an inherited capability flag does not grant a capability', () => {
  const realm = loadRealm();
  // Pollute inside the realm so `can` sees it exactly as a browser would.
  vm.runInContext("Object.prototype['agent.run'] = true;", realm);
  try {
    const table = vm.runInContext("({'idea.read': true})", realm);
    assert.equal(
      realm.ThinkTankPolicy.can(table, 'agent.run'),
      false,
      'a prototype-supplied flag must not grant a capability the policy never wrote'
    );
  } finally {
    vm.runInContext("delete Object.prototype['agent.run'];", realm);
  }
});

test('an unknown capability name is denied even when an inherited flag is true', () => {
  const realm = loadRealm();
  vm.runInContext("Object.prototype['super.power'] = true;", realm);
  try {
    const table = vm.runInContext("({'idea.read': true})", realm);
    assert.equal(realm.ThinkTankPolicy.can(table, 'super.power'), false);
  } finally {
    vm.runInContext("delete Object.prototype['super.power'];", realm);
  }
});

test('an unknown capability name is denied even when written as an own true property', () => {
  const realm = loadRealm();
  const table = vm.runInContext("({'super.power': true})", realm);
  assert.equal(
    realm.ThinkTankPolicy.can(table, 'super.power'),
    false,
    'only capability names this build defines are answerable'
  );
});

test('truthy-but-not-true values do not grant a capability', () => {
  const realm = loadRealm();
  for (const value of ['true', 1, {}, []]) {
    const table = { 'agent.run': value };
    assert.equal(realm.ThinkTankPolicy.can(table, 'agent.run'), false, `value ${JSON.stringify(value)} must not grant`);
  }
});

test('the five disabled V0 capabilities stay false under a poisoned prototype', async () => {
  const realm = loadRealm();
  const policy = realm.ThinkTankPolicy;
  const table = await new policy.LocalCapabilityPolicy().capabilitiesFor({ kind: 'local-founder' });
  const disabled = ['research.run', 'agent.run', 'member.invite', 'billing.manage', 'decision.approve'];
  vm.runInContext(`for (const c of ${JSON.stringify(disabled)}) Object.prototype[c] = true;`, realm);
  try {
    for (const capability of disabled) {
      assert.equal(policy.can(table, capability), false, `${capability} must remain disabled`);
    }
  } finally {
    vm.runInContext(`for (const c of ${JSON.stringify(disabled)}) delete Object.prototype[c];`, realm);
  }
});

test('a null or non-object capability table is denied, not thrown on', () => {
  const realm = loadRealm();
  for (const table of [null, undefined, 'idea.read', 42]) {
    assert.equal(realm.ThinkTankPolicy.can(table, 'idea.read'), false);
  }
});
