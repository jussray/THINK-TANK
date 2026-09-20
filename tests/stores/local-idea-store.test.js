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
    'app/stores/idea-store.js',
    'app/stores/local-idea-store.js',
    'app/stores/memory-idea-store.js'
  ]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context.ThinkTankStores;
}

test('LocalIdeaStore preserves the current V0 storage key and round-trips a record', async () => {
  const data = new Map();
  const localStorage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  const { LocalIdeaStore } = loadStores({ localStorage });
  const store = new LocalIdeaStore();
  const record = { id: 'idea-1', idea: 'Test', versions: [] };

  await store.saveCurrent(record);
  assert.equal(JSON.stringify(await store.loadCurrent()), JSON.stringify(record));
  assert.ok(data.has('think-tank.idea-record.v0'));

  await store.clearCurrent();
  assert.equal(await store.loadCurrent(), null);
});

test('MemoryIdeaStore isolates stored state from caller mutation', async () => {
  const { MemoryIdeaStore } = loadStores();
  const store = new MemoryIdeaStore();
  const record = { id: 'idea-1', nested: { value: 1 } };

  await store.saveCurrent(record);
  record.nested.value = 9;

  const loaded = await store.loadCurrent();
  assert.equal(loaded.nested.value, 1);
});
