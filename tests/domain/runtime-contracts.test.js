const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadContracts() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync('app/contracts/runtime-contracts.js', 'utf8'), context, {
    filename: 'app/contracts/runtime-contracts.js'
  });
  return context.ThinkTankContracts;
}

test('IdeaRecordV1 normalizes legacy V0 records without inventing content', () => {
  const { normalizeIdeaRecordV1 } = loadContracts();
  const legacy = {
    id: 'idea-legacy',
    idea: 'Legacy idea',
    status: 'interviewing',
    createdAt: null,
    updatedAt: null,
    answers: [],
    modules: {},
    scorecard: null,
    critique: '',
    pattern: '',
    versions: []
  };

  const normalized = normalizeIdeaRecordV1(legacy);
  assert.equal(normalized.schemaVersion, 'IdeaRecordV1');
  assert.equal(normalized.id, legacy.id);
  assert.equal(normalized.idea, legacy.idea);
  assert.equal(JSON.stringify(normalized.answers), '[]');
});

test('IdeaRecordV1 refuses malformed persisted state', () => {
  const { normalizeIdeaRecordV1, ContractValidationError } = loadContracts();
  assert.throws(
    () => normalizeIdeaRecordV1({ id: 'x', idea: '', status: 'complete', answers: [], versions: [] }),
    ContractValidationError
  );
});

test('inert V1 receipt contracts validate shape without creating product behavior', () => {
  const {
    validateAgentResultV1,
    validateEvidenceReceiptV1,
    validateScoreReceiptV1,
    validateValidationTaskV1
  } = loadContracts();

  assert.doesNotThrow(() => validateAgentResultV1({
    schemaVersion: 'AgentResultV1',
    id: 'agent-1', recordId: 'idea-1', recordVersionId: 'version-1',
    status: 'complete', providerCapability: 'structured-analysis',
    inputFingerprint: 'input:abc', outputFingerprint: 'output:def',
    startedAt: '2026-09-20T12:00:00.000Z', completedAt: '2026-09-20T12:00:01.000Z'
  }));

  assert.doesNotThrow(() => validateEvidenceReceiptV1({
    schemaVersion: 'EvidenceReceiptV1',
    id: 'evidence-1', recordId: 'idea-1', recordVersionId: 'version-1',
    sourceType: 'web', sourceUrl: 'https://example.com', excerpt: 'Bounded observation',
    claim: 'Example claim', claimPolarity: 'contextual', createdAt: '2026-09-20T12:00:00.000Z'
  }));

  assert.doesNotThrow(() => validateScoreReceiptV1({
    schemaVersion: 'ScoreReceiptV1', id: 'score-1', kind: 'founder',
    recordId: 'idea-1', recordVersionId: 'version-1', engineVersion: 'v0.1.0', rubricVersion: 'v0',
    status: 'computed', totalScore: 7, evidenceReceiptIds: [], agentResultIds: [],
    inputsFingerprint: 'input:abc', createdAt: '2026-09-20T12:00:00.000Z'
  }));

  assert.doesNotThrow(() => validateValidationTaskV1({
    schemaVersion: 'ValidationTaskV1', id: 'task-1', recordId: 'idea-1', kind: 'agent_proposal',
    hypothesis: 'People will value this.', question: 'What would prove or disprove it?', openMethod: 'Customer interviews'
  }));
});
