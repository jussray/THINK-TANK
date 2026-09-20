(function (root) {
  'use strict';

  const SCHEMA = Object.freeze({
    IDEA_RECORD: 'IdeaRecordV1',
    IDEA_VERSION: 'IdeaVersionV1',
    AGENT_RESULT: 'AgentResultV1',
    EVIDENCE_RECEIPT: 'EvidenceReceiptV1',
    SCORE_RECEIPT: 'ScoreReceiptV1',
    VALIDATION_TASK: 'ValidationTaskV1'
  });

  const LIMITS = Object.freeze({
    ideaChars: 4000,
    answerChars: 8000,
    versions: 200
  });

  class ContractValidationError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ContractValidationError';
      this.code = code;
    }
  }

  function fail(code, message) {
    throw new ContractValidationError(code, message);
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function requireObject(value, label) {
    if (!isObject(value)) fail('VALIDATION_ERROR', `${label} must be an object.`);
    return value;
  }

  function requireString(value, label, { min = 0, max = Infinity, nullable = false } = {}) {
    if (value === null && nullable) return null;
    if (typeof value !== 'string' || value.length < min || value.length > max) {
      fail('VALIDATION_ERROR', `${label} is invalid.`);
    }
    return value;
  }

  function requireNumber(value, label, { min = -Infinity, max = Infinity, integer = false, nullable = false } = {}) {
    if (value === null && nullable) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      fail('VALIDATION_ERROR', `${label} is invalid.`);
    }
    return value;
  }

  function requireEnum(value, allowed, label) {
    if (!allowed.includes(value)) fail('VALIDATION_ERROR', `${label} is invalid.`);
    return value;
  }

  function requireTimestamp(value, label, { nullable = true } = {}) {
    if (value === null || value === undefined) {
      if (nullable) return null;
      fail('VALIDATION_ERROR', `${label} is required.`);
    }
    requireString(value, label, { min: 1, max: 100 });
    if (Number.isNaN(Date.parse(value))) fail('VALIDATION_ERROR', `${label} is invalid.`);
    return value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateScorecard(value, label = 'scorecard', { nullable = true } = {}) {
    if (value === null && nullable) return null;
    const score = requireObject(value, label);
    for (const field of ['market', 'differentiation', 'timing', 'total']) {
      requireNumber(score[field], `${label}.${field}`, { min: 0, max: 10, integer: true });
    }
    return value;
  }

  function validateModules(value, label = 'modules') {
    const modules = requireObject(value, label);
    for (const field of ['customer', 'alternative', 'wedge', 'moat']) {
      if (modules[field] !== undefined) requireString(modules[field], `${label}.${field}`, { max: LIMITS.answerChars });
    }
    return value;
  }

  function validateIdeaVersionV1(candidate) {
    const version = requireObject(candidate, 'IdeaVersionV1');
    requireEnum(version.schemaVersion, [SCHEMA.IDEA_VERSION], 'IdeaVersionV1.schemaVersion');
    requireNumber(version.version, 'IdeaVersionV1.version', { min: 1, integer: true });
    requireTimestamp(version.createdAt, 'IdeaVersionV1.createdAt');
    requireString(version.idea, 'IdeaVersionV1.idea', { min: 1, max: LIMITS.ideaChars });
    validateScorecard(version.scorecard, 'IdeaVersionV1.scorecard', { nullable: false });
    validateModules(version.modules, 'IdeaVersionV1.modules');
    return candidate;
  }

  function normalizeIdeaVersionV1(candidate) {
    const normalized = clone(requireObject(candidate, 'IdeaVersion'));
    if (normalized.schemaVersion === undefined) normalized.schemaVersion = SCHEMA.IDEA_VERSION;
    validateIdeaVersionV1(normalized);
    return normalized;
  }

  function validateIdeaRecordV1(candidate) {
    const record = requireObject(candidate, 'IdeaRecordV1');
    requireEnum(record.schemaVersion, [SCHEMA.IDEA_RECORD], 'IdeaRecordV1.schemaVersion');
    requireString(record.id, 'IdeaRecordV1.id', { min: 1, max: 200 });
    requireString(record.idea, 'IdeaRecordV1.idea', { min: 1, max: LIMITS.ideaChars });
    requireEnum(record.status, ['interviewing', 'complete'], 'IdeaRecordV1.status');
    requireTimestamp(record.createdAt, 'IdeaRecordV1.createdAt');
    requireTimestamp(record.updatedAt, 'IdeaRecordV1.updatedAt');
    if (!Array.isArray(record.answers) || record.answers.length > 4) fail('VALIDATION_ERROR', 'IdeaRecordV1.answers is invalid.');
    for (const [index, entry] of record.answers.entries()) {
      requireObject(entry, `IdeaRecordV1.answers[${index}]`);
      requireString(entry.question, `IdeaRecordV1.answers[${index}].question`, { min: 1, max: 500 });
      requireString(entry.answer, `IdeaRecordV1.answers[${index}].answer`, { min: 1, max: LIMITS.answerChars });
      requireTimestamp(entry.createdAt, `IdeaRecordV1.answers[${index}].createdAt`);
    }
    validateModules(record.modules, 'IdeaRecordV1.modules');
    validateScorecard(record.scorecard, 'IdeaRecordV1.scorecard');
    requireString(record.critique, 'IdeaRecordV1.critique', { max: LIMITS.answerChars });
    requireString(record.pattern, 'IdeaRecordV1.pattern', { max: LIMITS.answerChars });
    if (!Array.isArray(record.versions) || record.versions.length > LIMITS.versions) fail('VALIDATION_ERROR', 'IdeaRecordV1.versions is invalid.');
    record.versions.forEach(validateIdeaVersionV1);
    return candidate;
  }

  function normalizeIdeaRecordV1(candidate) {
    const normalized = clone(requireObject(candidate, 'IdeaRecord'));
    if (normalized.schemaVersion === undefined) normalized.schemaVersion = SCHEMA.IDEA_RECORD;
    normalized.createdAt ??= null;
    normalized.updatedAt ??= null;
    normalized.answers = Array.isArray(normalized.answers) ? normalized.answers.map((entry) => ({ ...entry, createdAt: entry?.createdAt ?? null })) : normalized.answers;
    normalized.modules ??= {};
    normalized.scorecard ??= null;
    normalized.critique ??= '';
    normalized.pattern ??= '';
    normalized.versions = Array.isArray(normalized.versions) ? normalized.versions.map(normalizeIdeaVersionV1) : normalized.versions;
    validateIdeaRecordV1(normalized);
    return normalized;
  }

  function validateAgentResultV1(candidate) {
    const result = requireObject(candidate, 'AgentResultV1');
    requireEnum(result.schemaVersion, [SCHEMA.AGENT_RESULT], 'AgentResultV1.schemaVersion');
    requireString(result.id, 'AgentResultV1.id', { min: 1, max: 200 });
    requireString(result.recordId, 'AgentResultV1.recordId', { min: 1, max: 200 });
    requireString(result.recordVersionId, 'AgentResultV1.recordVersionId', { min: 1, max: 200 });
    requireEnum(result.status, ['complete', 'truncated', 'failed', 'cancelled', 'budget_rejected'], 'AgentResultV1.status');
    requireString(result.providerCapability, 'AgentResultV1.providerCapability', { min: 1, max: 100 });
    requireString(result.inputFingerprint, 'AgentResultV1.inputFingerprint', { min: 1, max: 500 });
    if (result.outputFingerprint !== null) requireString(result.outputFingerprint, 'AgentResultV1.outputFingerprint', { min: 1, max: 500 });
    requireTimestamp(result.startedAt, 'AgentResultV1.startedAt', { nullable: false });
    requireTimestamp(result.completedAt, 'AgentResultV1.completedAt');
    return candidate;
  }

  function validateEvidenceReceiptV1(candidate) {
    const receipt = requireObject(candidate, 'EvidenceReceiptV1');
    requireEnum(receipt.schemaVersion, [SCHEMA.EVIDENCE_RECEIPT], 'EvidenceReceiptV1.schemaVersion');
    for (const field of ['id', 'recordId', 'recordVersionId']) requireString(receipt[field], `EvidenceReceiptV1.${field}`, { min: 1, max: 200 });
    requireEnum(receipt.sourceType, ['web', 'dataset', 'interview', 'founder_upload', 'api'], 'EvidenceReceiptV1.sourceType');
    if (receipt.sourceUrl !== null) requireString(receipt.sourceUrl, 'EvidenceReceiptV1.sourceUrl', { min: 1, max: 4000 });
    requireString(receipt.excerpt, 'EvidenceReceiptV1.excerpt', { min: 1, max: 16000 });
    requireString(receipt.claim, 'EvidenceReceiptV1.claim', { min: 1, max: 8000 });
    requireEnum(receipt.claimPolarity, ['supports', 'contradicts', 'contextual', 'unknown'], 'EvidenceReceiptV1.claimPolarity');
    requireTimestamp(receipt.createdAt, 'EvidenceReceiptV1.createdAt', { nullable: false });
    return candidate;
  }

  function validateScoreReceiptV1(candidate) {
    const receipt = requireObject(candidate, 'ScoreReceiptV1');
    requireEnum(receipt.schemaVersion, [SCHEMA.SCORE_RECEIPT], 'ScoreReceiptV1.schemaVersion');
    for (const field of ['id', 'recordId', 'recordVersionId', 'engineVersion', 'rubricVersion', 'inputsFingerprint']) {
      requireString(receipt[field], `ScoreReceiptV1.${field}`, { min: 1, max: 500 });
    }
    requireEnum(receipt.kind, ['founder', 'evidence', 'synthesis'], 'ScoreReceiptV1.kind');
    requireEnum(receipt.status, ['computed', 'unknown', 'insufficient_evidence', 'conflicted', 'blocked'], 'ScoreReceiptV1.status');
    requireNumber(receipt.totalScore, 'ScoreReceiptV1.totalScore', { min: 0, max: 100, nullable: true });
    if (!Array.isArray(receipt.evidenceReceiptIds) || !Array.isArray(receipt.agentResultIds)) fail('VALIDATION_ERROR', 'ScoreReceiptV1 receipt references are invalid.');
    requireTimestamp(receipt.createdAt, 'ScoreReceiptV1.createdAt', { nullable: false });
    return candidate;
  }

  function validateValidationTaskV1(candidate) {
    const task = requireObject(candidate, 'ValidationTaskV1');
    requireEnum(task.schemaVersion, [SCHEMA.VALIDATION_TASK], 'ValidationTaskV1.schemaVersion');
    requireString(task.id, 'ValidationTaskV1.id', { min: 1, max: 200 });
    requireString(task.recordId, 'ValidationTaskV1.recordId', { min: 1, max: 200 });
    requireEnum(task.kind, ['deterministic_rule', 'agent_proposal', 'accepted'], 'ValidationTaskV1.kind');
    requireString(task.hypothesis, 'ValidationTaskV1.hypothesis', { min: 1, max: 8000 });
    if (task.kind === 'deterministic_rule') {
      requireString(task.successThreshold, 'ValidationTaskV1.successThreshold', { min: 1, max: 4000 });
      requireString(task.failureThreshold, 'ValidationTaskV1.failureThreshold', { min: 1, max: 4000 });
    }
    if (task.kind === 'agent_proposal') {
      requireString(task.question, 'ValidationTaskV1.question', { min: 1, max: 8000 });
      requireString(task.openMethod, 'ValidationTaskV1.openMethod', { min: 1, max: 4000 });
    }
    if (task.kind === 'accepted') {
      requireString(task.acceptedByUserId, 'ValidationTaskV1.acceptedByUserId', { min: 1, max: 200 });
      requireTimestamp(task.acceptedAt, 'ValidationTaskV1.acceptedAt', { nullable: false });
    }
    return candidate;
  }

  root.ThinkTankContracts = Object.freeze({
    SCHEMA,
    LIMITS,
    ContractValidationError,
    normalizeIdeaRecordV1,
    normalizeIdeaVersionV1,
    validateIdeaRecordV1,
    validateIdeaVersionV1,
    validateAgentResultV1,
    validateEvidenceReceiptV1,
    validateScoreReceiptV1,
    validateValidationTaskV1
  });
})(globalThis);
