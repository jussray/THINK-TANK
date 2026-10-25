/**
 * Draft startup package generation — staged June synthesis revival.
 * Read-only input and output: no database, browser, billing, or sharing writes.
 * All content is flagged unverified and requires founder acceptance.
 */
export const MODULE_NAMES = Object.freeze([
  'summary', 'problem', 'solution', 'customer', 'revenue',
  'mvp_roadmap', 'growth', 'pitch', 'action_plan'
]);

const SYSTEM = [
  'You are Think Tank Synthesis. Create draft startup documents using ONLY founder-provided statements.',
  'Return ONLY valid JSON with a "modules" object containing these text fields: ' + MODULE_NAMES.join(', ') + '.',
  'Summarize faithfully. Differentiate a founder hypothesis from external proof.',
  'Unknown information must remain clearly marked "Unverified" or "To investigate".',
  'Never fabricate traction, testimonials, customer interviews, market sizing, funding or revenue.',
  'Do not tell the founder to publish or share private information.',
  'This is an editable proposal, not a business verdict or market validation.'
].join('\n');

function requireString(value, label, max = 8000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TypeError(label + ' must be 1-' + max + ' characters');
  }
  return value.trim();
}

export function prepareSynthesis({ record }) {
  if (!record || typeof record !== 'object') throw new TypeError('record required');
  const ideaId = requireString(record.id, 'record.id', 200);
  const idea = requireString(record.idea, 'record.idea', 4000);
  if (!Array.isArray(record.answers) || record.answers.length > 50) {
    throw new TypeError('record answers are invalid');
  }
  const answers = record.answers.map((entry) => ({
    question: requireString(entry.question, 'question', 500),
    answer: requireString(entry.answer, 'answer')
  }));
  // No workspace data, past profiles, other founder ideas, or secrets are
  // implicitly added to this provider request.
  return {
    ideaId,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: JSON.stringify({ founderIdea: idea, answers })
    }]
  };
}

export function parseDraftPackage(raw) {
  const source = requireString(raw, 'synthesis output', 55000);
  let parsed;
  try { parsed = JSON.parse(source); }
  catch { throw new TypeError('Synthesis response must be valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Synthesis response must be a JSON object');
  }
  const proposed = parsed.modules;
  if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) {
    throw new TypeError('Synthesis modules object is missing');
  }
  const modules = {};
  for (const name of MODULE_NAMES) modules[name] = requireString(proposed[name], 'module ' + name, 8000);
  return modules; // allowlisted only; never persist unknown model-authored fields
}

export async function generateDraftPackage({ record }, provider) {
  if (typeof provider !== 'function') throw new TypeError('a consented model provider is required');
  const { ideaId, system, messages } = prepareSynthesis({ record });
  const response = await provider({ system, messages });
  return {
    schemaVersion: 'ThinkTankDraftPackageV1',
    ideaId,
    sourceIdeaRevision: record.updatedAt ?? null,
    status: 'pending-founder-review',
    validationStatus: 'unverified-founder-hypotheses',
    modules: parseDraftPackage(response),
    generatedAt: new Date().toISOString()
  };
}
