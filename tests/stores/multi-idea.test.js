const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup() {
  const data = new Map();
  const storage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
  const context = vm.createContext({ console, structuredClone });
  context.globalThis = context;
  for (const path of [
    'app/contracts/runtime-contracts.js', 'app/stores/idea-store.js',
    'app/stores/local-idea-store.js'
  ]) vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  return { store: new context.ThinkTankStores.LocalIdeaStore({ storage }), data };
}
function idea(id) {
  return {
    schemaVersion:'IdeaRecordV1', id, idea:'Idea '+id,
    status:'interviewing', createdAt:'2026-10-16T00:00:00.000Z', updatedAt:'2026-10-16T00:00:00.000Z',
    answers:[], modules:{}, scorecard:null, critique:'', pattern:'', versions:[]
  };
}
test('multi-idea storage preserves V0 current key and keeps prior ideas when a new one starts', async () => {
  const { store, data } = setup();
  await store.saveCurrent(idea('a'));
  await store.clearCurrent();
  assert.equal(await store.loadCurrent(), null);
  await store.saveCurrent(idea('b'));
  assert.deepEqual((await store.listRecords()).map(item => item.id), ['a','b']);
  assert.equal((await store.loadCurrent()).id, 'b');
  const restored = await store.selectCurrent('a');
  assert.equal(restored.id, 'a');
  assert.equal((await store.loadCurrent()).id, 'a');
  assert.ok(data.has('think-tank.idea-record.v0'));
});
test('legacy V0 record is surfaced in collection without duplication', async () => {
  const { store, data } = setup();
  data.set('think-tank.idea-record.v0', JSON.stringify(idea('legacy')));
  assert.deepEqual((await store.listRecords()).map(item => item.id), ['legacy']);
  await store.saveCurrent(idea('legacy'));
  assert.equal((await store.listRecords()).length, 1);
});
test('corrupt idea collection fails closed instead of silently overwriting it', async () => {
  const { store, data } = setup();
  data.set('think-tank.idea-collection.v1', 'not-json');
  await assert.rejects(() => store.listRecords(), /valid JSON/);
  await assert.rejects(() => store.saveCurrent(idea('a')), /valid JSON/);
  assert.equal(data.get('think-tank.idea-collection.v1'), 'not-json');
});
