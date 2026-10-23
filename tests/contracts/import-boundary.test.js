const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRealm() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const file of [
    'app/contracts/runtime-contracts.js',
    'app/policy/capability-service.js',
    'app/policy/local-capability-policy.js'
  ]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

function validRecord(realm) {
  const now = new Date().toISOString();
  return vm.runInContext(
    `({schemaVersion:'IdeaRecordV1',id:'i1',idea:'an idea',status:'interviewing',` +
      `createdAt:'${now}',updatedAt:'${now}',answers:[],modules:{},scorecard:null,` +
      `critique:'',pattern:'',versions:[]})`,
    realm
  );
}

test('import drops unknown keys instead of persisting attacker-authored state', () => {
  const realm = loadRealm();
  const record = validRecord(realm);
  record.capabilities = { 'agent.run': true, 'billing.manage': true, 'decision.approve': true };
  record.evil = { a: 1 };

  const normalized = realm.ThinkTankContracts.normalizeIdeaRecordV1(record);

  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized, 'capabilities'),
    false,
    'an imported capabilities table must never survive into canonical state'
  );
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'evil'), false);
});

test('an imported capabilities table cannot grant a disabled capability', () => {
  const realm = loadRealm();
  const record = validRecord(realm);
  record.capabilities = { 'billing.manage': true };

  const normalized = realm.ThinkTankContracts.normalizeIdeaRecordV1(record);

  assert.equal(
    realm.ThinkTankPolicy.can(normalized.capabilities, 'billing.manage'),
    false,
    'billing.manage is explicitly disabled in V0 and import must not enable it'
  );
});

test('__proto__ in an imported record does not survive as an own property', () => {
  const realm = loadRealm();
  const record = validRecord(realm);
  Object.defineProperty(record, '__proto__', {
    value: { 'agent.run': true },
    enumerable: true,
    configurable: true,
    writable: true
  });

  const normalized = realm.ThinkTankContracts.normalizeIdeaRecordV1(record);

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, '__proto__'), false);
  const copy = Object.assign({}, normalized);
  assert.notEqual(copy['agent.run'], true, 'Object.assign of an imported record must not inherit capabilities');
});

test('a hostile deeply nested unknown field is refused without a RangeError escaping', () => {
  const realm = loadRealm();
  const record = validRecord(realm);
  let deep = {};
  const head = deep;
  for (let i = 0; i < 60000; i += 1) {
    deep.n = {};
    deep = deep.n;
  }
  record.unknownDeep = head;

  // Must not throw RangeError out of the clone; unknown fields are never serialized.
  const normalized = realm.ThinkTankContracts.normalizeIdeaRecordV1(record);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'unknownDeep'), false);
});
