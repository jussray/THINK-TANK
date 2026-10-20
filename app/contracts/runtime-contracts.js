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

  // Strict ISO 8601 date-time with an explicit zone. Date.parse alone accepts
  // "5", "2026", and rolled-over dates such as 2026-02-30, so it is not a validator.
  const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/;
  function isIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    const m = ISO_TIMESTAMP.exec(value);
    if (!m) return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? 0) > 59) return false;
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return false;
    if (m[8] !== undefined && (Number(m[8]) > 23 || Number(m[9]) > 59)) return false;
    return !Number.isNaN(Date.parse(value));
  }

  function requireTimestamp(value, label, { nullable = true } = {}) {
    if (value === null || value === undefined) {
      if (nullable) return null;
      fail('VALIDATION_ERROR', `${label} is required.`);
    }
    requireString(value, label, { min: 1, max: 100 });
    if (!isIsoTimestamp(value)) fail('VALIDATION_ERROR', `${label} is invalid.`);
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
    if (record.workspace !== undefined) normalizeWorkspaceV1(record.workspace);
    return candidate;
  }

  // The Idea Record is the one object an importer fully controls, so the
  // normalizer copies an explicit allowlist of known fields instead of cloning
  // the candidate whole. Cloning passed unknown attacker-authored keys straight
  // through into persisted and re-exported state -- including a `capabilities`
  // table that `can()` would then honor -- and also carried `__proto__` through
  // as an own data property. Copying by field also means unknown deep subtrees
  // are never serialized, so a hostile deeply-nested payload cannot throw
  // RangeError out of the clone.
  const IDEA_RECORD_FIELDS = Object.freeze([
    'schemaVersion', 'id', 'idea', 'status', 'createdAt', 'updatedAt',
    'answers', 'modules', 'scorecard', 'critique', 'pattern', 'versions', 'workspace'
  ]);

  function pickKnown(candidate, fields) {
    const picked = Object.create(null);
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(candidate, field)) picked[field] = candidate[field];
    }
    return Object.assign({}, picked);
  }

  function normalizeIdeaRecordV1(candidate) {
    const normalized = clone(pickKnown(requireObject(candidate, 'IdeaRecord'), IDEA_RECORD_FIELDS));
    if (normalized.schemaVersion === undefined) normalized.schemaVersion = SCHEMA.IDEA_RECORD;
    normalized.createdAt ??= null;
    normalized.updatedAt ??= null;
    normalized.answers = Array.isArray(normalized.answers) ? normalized.answers.map((entry) => ({ ...entry, createdAt: entry?.createdAt ?? null })) : normalized.answers;
    normalized.modules ??= {};
    normalized.scorecard ??= null;
    normalized.critique ??= '';
    normalized.pattern ??= '';
    normalized.versions = Array.isArray(normalized.versions) ? normalized.versions.map(normalizeIdeaVersionV1) : normalized.versions;
    if (normalized.workspace !== undefined) normalized.workspace = normalizeWorkspaceV1(normalized.workspace);
    validateIdeaRecordV1(normalized);
    return normalized;
  }

  // Editable founder workspace state is attached to the portable Idea Record.
  // The deterministic assessment fields above remain separate and unchanged.
  const WORKSPACE_MODULES = Object.freeze([
    'Summary', 'Problem', 'Solution', 'Customer', 'Revenue',
    'MVP roadmap', 'Growth', 'Pitch', 'Action plan', 'Scorecard'
  ]);
  const WORKSPACE_SCHEMA = 'IdeaWorkspaceV1';

  function normalizeWorkspaceV1(candidate) {
    const input = requireObject(candidate, WORKSPACE_SCHEMA);
    requireEnum(input.schemaVersion, [WORKSPACE_SCHEMA], 'workspace.schemaVersion');
    const rawModules = requireObject(input.modules, 'workspace.modules');
    const keys = Object.keys(rawModules);
    if (keys.length > WORKSPACE_MODULES.length) fail('VALIDATION_ERROR', 'Too many workspace modules.');
    const modules = {};
    for (const name of keys) {
      requireEnum(name, WORKSPACE_MODULES, 'workspace module');
      const entry = requireObject(rawModules[name], 'workspace module entry');
      modules[name] = {
        content: requireString(entry.content, 'workspace content', { max: 8000 }),
        origin: requireEnum(entry.origin, ['founder', 'accepted-local-proposal'], 'workspace origin'),
        updatedAt: requireTimestamp(entry.updatedAt, 'workspace module timestamp', { nullable: false })
      };
    }
    if (!Array.isArray(input.proposals) || input.proposals.length > 30) {
      fail('VALIDATION_ERROR', 'workspace.proposals is invalid.');
    }
    const proposals = input.proposals.map((item) => {
      const proposal = requireObject(item, 'workspace proposal');
      const raw = requireObject(proposal.modules, 'proposal modules');
      if (Object.keys(raw).length > WORKSPACE_MODULES.length) fail('VALIDATION_ERROR', 'Proposal modules overflow.');
      const proposedModules = {};
      for (const name of Object.keys(raw)) {
        requireEnum(name, WORKSPACE_MODULES, 'proposal module');
        proposedModules[name] = requireString(raw[name], 'proposal text', { max: 8000 });
      }
      return {
        id: requireString(proposal.id, 'proposal.id', { min: 1, max: 200 }),
        createdAt: requireTimestamp(proposal.createdAt, 'proposal.createdAt', { nullable: false }),
        status: requireEnum(proposal.status, ['pending', 'accepted', 'rejected'], 'proposal.status'),
        baseRevision: requireTimestamp(proposal.baseRevision, 'proposal.baseRevision', { nullable: false }),
        answerCount: requireNumber(proposal.answerCount, 'proposal.answerCount', { min: 0, max: 4, integer: true }),
        modules: proposedModules
      };
    });
    if (!Array.isArray(input.history) || input.history.length > 300) fail('VALIDATION_ERROR', 'workspace.history is invalid.');
    const history = input.history.map((item) => {
      const event = requireObject(item, 'workspace event');
      return {
        id: requireString(event.id, 'event.id', { min: 1, max: 200 }),
        at: requireTimestamp(event.at, 'event.at', { nullable: false }),
        kind: requireEnum(event.kind, [
          'proposal.generated', 'proposal.accepted', 'proposal.rejected', 'module.saved'
        ], 'event.kind'),
        module: requireEnum(event.module ?? '', ['', ...WORKSPACE_MODULES], 'event.module'),
        proposalId: requireString(event.proposalId ?? '', 'event.proposalId', { max: 200 }),
        before: requireString(event.before ?? '', 'event.before', { max: 8000 }),
        after: requireString(event.after ?? '', 'event.after', { max: 8000 })
      };
    });
    if (new Set(proposals.map((p) => p.id)).size !== proposals.length) {
      fail('VALIDATION_ERROR', 'Duplicate proposal ids.');
    }
    return { schemaVersion: WORKSPACE_SCHEMA, modules, proposals, history };
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
    WORKSPACE_MODULES,
    WORKSPACE_SCHEMA,
    normalizeWorkspaceV1,
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
