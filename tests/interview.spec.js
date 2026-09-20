const { test, expect } = require('@playwright/test');
const { seedCorruptIdeaRecord } = require('./stores/local-storage-test-fixture');

async function completeInterview(page) {
  await page.goto('/');
  await page.getByTestId('idea-input').fill('A subscription service that helps solo founders pressure-test startup ideas before building.');
  await page.getByTestId('start-interview').click();

  const answers = [
    'Solo founders paying from their own budget because they need sharper decisions before spending scarce build money.',
    'They currently use notes, friends, generic chatbots, founder communities, or simply start building without a structured challenge.',
    'They would switch this month if one guided interview turns a vague idea into a clear go, revise, or stop decision in under an hour.',
    'The defensibility starts with a durable history of interviews, evidence, pivots, and scoring patterns that compounds around the founder.'
  ];

  for (const answer of answers) {
    await page.getByTestId('answer-input').fill(answer);
    await page.getByTestId('submit-answer').click();
  }
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

test('founder can export and restore a portable V1 Idea Record', async ({ page }) => {
  await completeInterview(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-record').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));

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
