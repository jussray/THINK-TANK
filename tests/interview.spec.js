const { test, expect } = require('@playwright/test');
const { seedCorruptIdeaRecord } = require('./stores/local-storage-test-fixture');

const DEFAULT_IDEA = 'A subscription service that helps solo founders pressure-test startup ideas before building.';
const DEFAULT_ANSWERS = [
  'Solo founders paying from their own budget because they need sharper decisions before spending scarce build money.',
  'They currently use notes, friends, generic chatbots, founder communities, or simply start building without a structured challenge.',
  'They would switch this month if one guided interview turns a vague idea into a clear go, revise, or stop decision in under an hour.',
  'The defensibility starts with a durable history of interviews, evidence, pivots, and scoring patterns that compounds around the founder.'
];

async function startInterview(page, idea = DEFAULT_IDEA) {
  await page.goto('/');
  await page.getByTestId('idea-input').fill(idea);
  await page.getByTestId('start-interview').click();
}

async function answerInterview(page, answers = DEFAULT_ANSWERS) {
  for (const answer of answers) {
    await page.getByTestId('answer-input').fill(answer);
    await page.getByTestId('submit-answer').click();
  }
}

async function completeInterview(page, idea = DEFAULT_IDEA, answers = DEFAULT_ANSWERS) {
  await startInterview(page, idea);
  await answerInterview(page, answers);
}

async function downloadRecord(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-record').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('founder can complete an interview and persist an Idea Record', async ({ page }) => {
  await completeInterview(page);

  await expect(page.getByText('CRITIC', { exact: true })).toBeVisible();
  await expect(page.getByText('SCORECARD', { exact: true })).toBeVisible();
  await expect(page.getByText('SYNTHESIZER', { exact: true })).toBeVisible();
  await expect(page.getByText('MATCHMAKER', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scorecard')).toContainText('Overall');
  await expect(page.getByTestId('versions')).toContainText('v1');

  await page.reload();
  await expect(page.getByTestId('idea-record')).toContainText('subscription service');
  await expect(page.getByTestId('versions')).toContainText('v1');
  await expect(page.getByTestId('truth-boundary')).toContainText('not external market validation');
});

test('interrupted interview resumes after reload from the next unanswered question', async ({ page }) => {
  await startInterview(page);
  await answerInterview(page, DEFAULT_ANSWERS.slice(0, 2));
  await expect(page.locator('#sessionState')).toHaveText('QUESTION 3/4');

  await page.reload();

  await expect(page.locator('#sessionState')).toHaveText('QUESTION 3/4');
  await expect(page.getByTestId('transcript')).toContainText(DEFAULT_ANSWERS[0]);
  await expect(page.getByTestId('transcript')).toContainText(DEFAULT_ANSWERS[1]);
  await answerInterview(page, DEFAULT_ANSWERS.slice(2));
  await expect(page.getByTestId('scorecard')).toContainText('Overall');
  await expect(page.getByTestId('versions')).toContainText('v1');
});

test('founder can export and restore a portable V1 Idea Record', async ({ page }) => {
  await completeInterview(page);
  const payload = await downloadRecord(page);

  expect(payload.format).toBe('think-tank-export-v1');
  expect(payload.record.schemaVersion).toBe('IdeaRecordV1');
  expect(payload.record.idea).toContain('subscription service');
  expect(payload.record.versions).toHaveLength(1);
  expect(payload.record.versions[0].schemaVersion).toBe('IdeaVersionV1');

  await page.getByTestId('new-idea').click();
  await expect(page.getByTestId('idea-record')).toContainText('No active record');

  await page.getByTestId('import-record').setInputFiles({
    name: 'idea-record.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  });

  await expect(page.getByTestId('portability-status')).toContainText('Imported Idea Record');
  await expect(page.getByTestId('idea-record')).toContainText('subscription service');
  await expect(page.getByTestId('versions')).toContainText('v1');
});

test('in-progress portable record resumes after import', async ({ page }) => {
  await startInterview(page);
  await answerInterview(page, DEFAULT_ANSWERS.slice(0, 2));
  const payload = await downloadRecord(page);

  await page.getByTestId('new-idea').click();
  await page.getByTestId('import-record').setInputFiles({
    name: 'in-progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  });

  await expect(page.getByTestId('portability-status')).toContainText('Imported and resumed Idea Record');
  await expect(page.locator('#sessionState')).toHaveText('QUESTION 3/4');
  await answerInterview(page, DEFAULT_ANSWERS.slice(2));
  await expect(page.getByTestId('versions')).toContainText('v1');
});

test('pivot preserves Idea Record identity and adds a new version', async ({ page }) => {
  await completeInterview(page);
  const first = await downloadRecord(page);
  const originalId = first.record.id;

  await page.reload();
  const pivotIdea = 'A focused founder interview tool for validating one painful startup assumption at a time.';
  await page.getByTestId('idea-input').fill(pivotIdea);
  await page.getByTestId('start-interview').click();
  await answerInterview(page, DEFAULT_ANSWERS);

  const second = await downloadRecord(page);
  expect(second.record.id).toBe(originalId);
  expect(second.record.versions).toHaveLength(2);
  expect(second.record.versions[0].idea).toBe(DEFAULT_IDEA);
  expect(second.record.versions[1].idea).toBe(pivotIdea);
});

test('browser loads truthful local capability policy and future features fail closed', async ({ page }) => {
  await page.goto('/');
  const capabilities = await page.evaluate(async () => {
    const policy = new ThinkTankPolicy.LocalCapabilityPolicy();
    return policy.capabilitiesFor({ kind: 'local-founder' });
  });

  expect(capabilities['idea.read']).toBe(true);
  expect(capabilities['idea.edit']).toBe(true);
  expect(capabilities['analysis.run']).toBe(true);
  expect(capabilities['record.export']).toBe(true);
  expect(capabilities['record.import']).toBe(true);
  expect(capabilities['research.run']).toBe(false);
  expect(capabilities['agent.run']).toBe(false);
  expect(capabilities['member.invite']).toBe(false);
  expect(capabilities['billing.manage']).toBe(false);
  expect(capabilities['decision.approve']).toBe(false);
});

test('import refuses unknown data instead of treating it as product state', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('import-record').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'not-think-tank', record: { idea: '<img src=x>' } }))
  });

  await expect(page.getByTestId('portability-status')).toContainText('Import refused');
  await expect(page.getByTestId('idea-record')).toContainText('No active record');
});

test('import refuses malformed IdeaRecordV1 even when the export format is known', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('import-record').setInputFiles({
    name: 'malformed-record.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      format: 'think-tank-export-v1',
      record: {
        schemaVersion: 'IdeaRecordV1',
        id: 'bad-record',
        idea: '',
        status: 'complete',
        answers: [],
        versions: []
      }
    }))
  });

  await expect(page.getByTestId('portability-status')).toContainText('Import refused');
  await expect(page.getByTestId('idea-record')).toContainText('No active record');
});

test('corrupt stored state is surfaced and never rendered as canonical product state', async ({ page }) => {
  await page.goto('/');
  await seedCorruptIdeaRecord(page);
  await page.reload();

  await expect(page.getByTestId('portability-status')).toContainText('Stored Idea Record refused');
  await expect(page.getByTestId('idea-record')).toContainText('No active record');
});

test('mobile interview surface has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.getByTestId('idea-input')).toBeVisible();
  await expect(page.getByTestId('export-record')).toBeVisible();
});

test('import refuses oversized files before parsing them', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('import-record').setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(1_000_001, 32)
  });

  await expect(page.getByTestId('portability-status')).toContainText('File is too large');
  await expect(page.getByTestId('idea-record')).toContainText('No active record');
});
