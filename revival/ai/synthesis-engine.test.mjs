import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_NAMES, prepareSynthesis, parseDraftPackage, generateDraftPackage } from './synthesis-engine.mjs';

const record = {
  id: 'idea-1',
  idea: 'A guided AI founder interview',
  updatedAt: '2026-10-25T12:00:00.000Z',
  answers: [
    { question:'Who pays?', answer:'Solo founders pay for clarity' },
    { question:'What do they use?', answer:'General AI tools' }
  ],
  workspace: { privateNotes: 'Must not appear in provider request' }
};
const fakeOutput = JSON.stringify({ modules: Object.fromEntries(MODULE_NAMES.map(name => [name, name + ': founder hypothesis; unverified'])) });

test('synthesis prepares only explicit idea and interview answers, not private workspace', () => {
  const req = prepareSynthesis({ record });
  assert.equal(req.ideaId, 'idea-1');
  assert.ok(req.messages[0].content.includes('Solo founders pay'));
  assert.ok(!req.messages[0].content.includes('Must not appear'));
  assert.equal(req.messages.length, 1);
});

test('draft package includes complete June module suite and never mutates founder record', async () => {
  const before = JSON.stringify(record);
  const draft = await generateDraftPackage({ record }, async () => fakeOutput);
  assert.deepEqual(Object.keys(draft.modules), MODULE_NAMES);
  assert.equal(draft.validationStatus, 'unverified-founder-hypotheses');
  assert.equal(draft.status, 'pending-founder-review');
  assert.equal(draft.sourceIdeaRevision, record.updatedAt);
  assert.equal(JSON.stringify(record), before);
});

test('parse rejects unsupported or incomplete model output without changing any state', async () => {
  assert.throws(() => parseDraftPackage('nonsense'), /valid JSON/);
  assert.throws(() => parseDraftPackage(JSON.stringify({modules:{summary:'Only a summary'}})), /module problem/);
  await assert.rejects(generateDraftPackage({ record }, async () => '{}'), /modules object/);
});

test('synthesis removes arbitrary model-authored fields instead of trusting them', () => {
  const raw = JSON.stringify({modules:{...JSON.parse(fakeOutput).modules, 'billing.manage':true}, privateMemories:['secret']});
  const parsed = parseDraftPackage(raw);
  assert.equal(parsed['billing.manage'], undefined);
  assert.equal(parsed.privateMemories, undefined);
});

test('provider use is opt-in and record must be scoped to one idea', async () => {
  await assert.rejects(generateDraftPackage({ record }), /consented model provider/);
  assert.throws(() => prepareSynthesis({record: {...record, answers: 'invalid'}}), /answers are invalid/);
});
