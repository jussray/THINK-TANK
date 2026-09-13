const { test, expect } = require('@playwright/test');

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

test('founder can export and restore a portable Idea Record', async ({ page }) => {
  await completeInterview(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-record').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  expect(payload.format).toBe('think-tank-export-v1');
  expect(payload.record.idea).toContain('subscription service');
  expect(payload.record.versions).toHaveLength(1);

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

test('mobile interview surface has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.getByTestId('idea-input')).toBeVisible();
  await expect(page.getByTestId('export-record')).toBeVisible();
});
