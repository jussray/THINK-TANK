const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function contracts() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync('app/contracts/runtime-contracts.js', 'utf8'), context);
  return context.ThinkTankContracts;
}
function idea(workspace) {
  return {
    schemaVersion: 'IdeaRecordV1', id: 'idea-1', idea: 'Interview founder customers',
    status: 'complete', createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    answers: [], modules: {}, scorecard: null, critique: '', pattern: '', versions: [],
    ...(workspace === undefined ? {} : { workspace })
  };
}
function workspace() {
  return {
    schemaVersion: 'IdeaWorkspaceV1',
    modules: { Revenue: { content: 'Test willingness to pay', origin: 'founder', updatedAt: '2026-10-16T00:00:00.000Z' } },
    proposals: [{
      id: 'proposal-1', createdAt: '2026-10-16T00:00:00.000Z',
      status: 'pending', baseRevision: '2026-10-16T00:00:00.000Z', answerCount: 0,
      modules: { Summary: 'Founder-reported summary' }
    }],
    history: [{
      id: 'receipt-1', at: '2026-10-16T00:00:00.000Z', kind: 'module.saved',
      module: 'Revenue', proposalId: '', before: '', after: 'Test willingness to pay'
    }]
  };
}

test('optional workspace round trips through existing portable IdeaRecordV1', () => {
  const { normalizeIdeaRecordV1 } = contracts();
  const normalized = normalizeIdeaRecordV1(idea(workspace()));
  assert.equal(normalized.workspace.modules.Revenue.content, 'Test willingness to pay');
  assert.equal(normalized.workspace.proposals[0].status, 'pending');
  assert.equal(normalized.workspace.history[0].kind, 'module.saved');
  assert.equal(normalizeIdeaRecordV1(idea()).workspace, undefined);
});

test('workspace unknown authority, injection fields and module names cannot be imported', () => {
  const { normalizeIdeaRecordV1, ContractValidationError } = contracts();
  const hostile = idea(workspace());
  hostile.capabilities = { 'billing.manage': true };
  hostile.workspace.capabilities = { 'billing.manage': true };
  hostile.workspace.modules.Revenue.capabilities = { 'billing.manage': true };
  hostile.workspace.proposals[0].admin = true;
  hostile.workspace.history[0].providerKey = 'leak';
  const safe = normalizeIdeaRecordV1(hostile);
  assert.equal(Object.hasOwn(safe, 'capabilities'), false);
  assert.equal(Object.hasOwn(safe.workspace, 'capabilities'), false);
  assert.equal(Object.hasOwn(safe.workspace.modules.Revenue, 'capabilities'), false);
  assert.equal(Object.hasOwn(safe.workspace.proposals[0], 'admin'), false);
  assert.equal(Object.hasOwn(safe.workspace.history[0], 'providerKey'), false);
  const unknown = idea(workspace());
  unknown.workspace.modules['billing.manage'] = {content:'enable',origin:'founder',updatedAt:'2026-10-16T00:00:00.000Z'};
  assert.throws(() => normalizeIdeaRecordV1(unknown), ContractValidationError);
});

test('workspace rejects malformed proposals and overlong receipts rather than truncating evidence', () => {
  const { normalizeIdeaRecordV1, ContractValidationError } = contracts();
  const dup = idea(workspace());
  dup.workspace.proposals.push({...dup.workspace.proposals[0]});
  assert.throws(() => normalizeIdeaRecordV1(dup), ContractValidationError);
  const tooLong = idea(workspace());
  tooLong.workspace.history[0].before = 'x'.repeat(8001);
  assert.throws(() => normalizeIdeaRecordV1(tooLong), ContractValidationError);
  const badOrigin = idea(workspace());
  badOrigin.workspace.modules.Revenue.origin = 'autonomous-agent';
  assert.throws(() => normalizeIdeaRecordV1(badOrigin), ContractValidationError);
});
