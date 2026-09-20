const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('deterministic V0 survives offline from file URL with reload and export', async ({ page, context }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await context.setOffline(true);
  await page.goto(pathToFileURL(path.resolve('index.html')).href);

  await expect(page.getByTestId('truth-boundary')).toContainText('deterministic and local-first');
  await page.getByTestId('idea-input').fill('An offline sovereignty probe for a deterministic founder tool.');
  await page.getByTestId('start-interview').click();

  const answers = [
    'Solo founders who need to keep working even when every external provider or network path is unavailable.',
    'They use notes and local documents today because those tools remain available without a hosted account.',
    'They would switch when a structured local interview can preserve their work and produce a portable record offline.',
    'The durable advantage is project-owned deterministic logic and portable records that do not depend on one provider.'
  ];

  for (const answer of answers) {
    await page.getByTestId('answer-input').fill(answer);
    await page.getByTestId('submit-answer').click();
  }

  await expect(page.getByTestId('scorecard')).toContainText('Overall');
  await expect(page.getByTestId('versions')).toContainText('v1');

  await page.reload();
  await expect(page.getByTestId('idea-record')).toContainText('offline sovereignty probe');
  await expect(page.getByTestId('versions')).toContainText('v1');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-record').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  expect(payload.format).toBe('think-tank-export-v1');
  expect(payload.record.schemaVersion).toBe('IdeaRecordV1');
  expect(payload.record.idea).toContain('offline sovereignty probe');
  expect(pageErrors).toEqual([]);
});
