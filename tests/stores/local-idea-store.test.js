const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadStores(extra = {}) {
  const context = vm.createContext({
    console,
    structuredClone,
    ...extra
  });
  context.globalThis = context;
  for (const file of [
    'app/contracts/runtime-contracts.js',
    'app/stores/idea-store.js',
    'app/stores/local-idea-store.js',
    'app/stores/memory-idea-store.js'
  ]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return { stores: context.ThinkTankStores, contracts: context.ThinkTankContracts };
}

function validRecord(overrides = {}) {
  return {
    schemaVersion: 'IdeaRecordV1',
    id: 'idea-1',
    idea: 'A valid idea',
    status: 'interviewing',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    answers: [],
    modules: {},
    scorecard: null,
    critique: '',
    pattern: '',
    versions: [],
    ...overrides
  };
}

test('LocalIdeaStore preserves the V0 storage key and writes a validated V1 record', async () => {
  const data = new Map();
  const localStorage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  const { stores: { LocalIdeaStore } } = loadStores({ localStorage });
  const store = new LocalIdeaStore();
  const record = validRecord();

  await store.saveCurrent(record);
  assert.equal(JSON.stringify(await store.loadCurrent()), JSON.stringify(record));
  assert.ok(data.has('think-tank.idea-record.v0'));

  await store.clearCurrent();
  assert.equal(await store.loadCurrent(), null);
});

test('LocalIdeaStore normalizes a legacy V0 record additively', async () => {
  const legacy = validRecord();
  delete legacy.schemaVersion;
  const data = new Map([['think-tank.idea-record.v0', JSON.stringify(legacy)]]);
  const localStorage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  const { stores: { LocalIdeaStore } } = loadStores({ localStorage });
  const loaded = await new LocalIdeaStore().loadCurrent();
  assert.equal(loaded.schemaVersion, 'IdeaRecordV1');
  assert.equal(loaded.id, legacy.id);
});

test('LocalIdeaStore refuses malformed writes and corrupt persisted JSON', async () => {
  const data = new Map();
  const localStorage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  const { stores: { LocalIdeaStore }, contracts: { ContractValidationError } } = loadStores({ localStorage });
  const store = new LocalIdeaStore();

  await assert.rejects(() => store.saveCurrent({ id: 'broken' }), ContractValidationError);
  data.set('think-tank.idea-record.v0', '{not-json');
  await assert.rejects(() => store.loadCurrent(), (error) => error instanceof ContractValidationError && error.code === 'INVALID_JSON');
});

test('MemoryIdeaStore validates and isolates stored state from caller mutation', async () => {
  const { stores: { MemoryIdeaStore }, contracts: { ContractValidationError } } = loadStores();
  const store = new MemoryIdeaStore();
  const record = validRecord({ modules: { customer: 'Founder' } });

  await store.saveCurrent(record);
  record.modules.customer = 'Changed';

  const loaded = await store.loadCurrent();
  assert.equal(loaded.modules.customer, 'Founder');
  await assert.rejects(() => store.saveCurrent({ idea: 'invalid' }), ContractValidationError);
});
