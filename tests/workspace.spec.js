const { test, expect } = require('@playwright/test');

const answers = [
  'Solo founders who pay to understand whether their idea solves a costly customer problem.',
  'They currently use unstructured notes, generic chatbots and costly trial-and-error.',
  'They would switch for a repeatable interview that preserves decisions and highlights unknowns.',
  'Long-term defensibility is a portable history of founder decisions with audit-friendly receipts.'
];

async function createAndComplete(page, idea) {
  await page.goto('/');
  await page.getByTestId('idea-input').fill(idea);
  await page.getByTestId('start-interview').click();
  for (const answer of answers) {
    await page.getByTestId('answer-input').fill(answer);
    await page.getByTestId('submit-answer').click();
  }
  await expect(page.getByTestId('scorecard')).toContainText('Overall');
}
async function readDownload(page, trigger) {
  const pending = page.waitForEvent('download');
  await trigger();
  const item = await pending;
  const stream = await item.createReadStream();
  const pieces = [];
  for await (const piece of stream) pieces.push(piece);
  return JSON.parse(Buffer.concat(pieces).toString('utf8'));
}

test('workspace opens from the original V0 interview and preserves approved modules through portable export', async ({ page }) => {
  const original = 'A local-first interviewing tool that helps founders test unproven assumptions.';
  await createAndComplete(page, original);
  await page.getByTestId('open-workspace').click();
  await expect(page).toHaveURL(/workspace\.html$/);
  await expect(page.getByTestId('idea-list')).toContainText(original);
  await expect(page.getByTestId('workspace-boundary')).toContainText('not external market evidence');
  await page.getByRole('textarea', {name:'Revenue content'}).fill('Founder price hypothesis: $5 per session; untested.');
  await page.getByRole('button', {name:'Save Revenue'}).click();
  await expect(page.getByTestId('workspace-status')).toContainText('Revenue saved');
  await page.getByRole('button', {name:/03 · Proposals/}).click();
  await page.getByRole('button', {name:'Generate local proposal'}).click();
  await expect(page.getByTestId('workspace-status')).toContainText('proposal ready');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('accept-proposal').click();
  // Accept only after explicitly reviewing and confirming; the dialog may fire before .click resolves.
  await expect(page.getByRole('textarea', {name:'Summary content'})).toHaveValue(original);
  const exported = await readDownload(page, () => page.getByTestId('workspace-export-selected').click());
  expect(exported.format).toBe('think-tank-export-v1');
  expect(exported.record.workspace.modules.Revenue.content).toContain('$5 per session');
  expect(exported.record.workspace.modules.Summary.origin).toBe('accepted-local-proposal');
  expect(exported.record.workspace.proposals[0].status).toBe('accepted');
  expect(exported.record.workspace.history.some(e => e.kind === 'proposal.accepted')).toBe(true);
  await page.reload();
  await expect(page.getByRole('textarea', {name:'Revenue content'})).toHaveValue(/Founder price hypothesis/);
  await page.getByRole('link', {name:/01 · Interview/}).click();
  await expect(page.getByTestId('scorecard')).toContainText('Overall');
  await expect(page.getByTestId('versions')).toContainText('v1');
});

test('a second idea does not destroy the first and switching preserves each independent IdeaRecord', async ({ page }) => {
  await createAndComplete(page, 'First idea retained for version history');
  await page.getByTestId('open-workspace').click();
  page.once('dialog', dialog => dialog.accept('Second idea using a different customer niche'));
  await page.getByTestId('workspace-new-idea').click();
  await expect(page.getByTestId('idea-list').locator('button')).toHaveCount(2);
  await expect(page.getByRole('heading', {level:1})).toContainText('Second idea');
  await page.getByTestId('idea-list').getByRole('button', {name:/First idea/}).click();
  await expect(page.getByRole('heading', {level:1})).toContainText('First idea');
  const all = await readDownload(page, () => page.getByTestId('workspace-export-all').click());
  expect(all.format).toBe('think-tank-workspace-v1');
  expect(all.records).toHaveLength(2);
  expect(all.records.find(record => record.idea.includes('First idea')).versions).toHaveLength(1);
  await page.reload();
  await expect(page.getByTestId('idea-list').locator('button')).toHaveCount(2);
});

test('workspace refuses invalid imported module state without replacing the current Idea Record', async ({ page }) => {
  await createAndComplete(page, 'A legitimate record that must survive a hostile import');
  await page.getByTestId('open-workspace').click();
  const before = await readDownload(page, () => page.getByTestId('workspace-export-selected').click());
  const hostile = structuredClone(before.record);
  hostile.id = 'malicious';
  hostile.workspace = {
    schemaVersion: 'IdeaWorkspaceV1',
    modules: {
      'billing.manage': {content:'true',origin:'founder',updatedAt:'2026-10-16T12:00:00.000Z'}
    }, proposals: [], history: []
  };
  await page.getByTestId('workspace-import-all').setInputFiles({
    name:'hostile.json', mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'think-tank-workspace-v1',records:[hostile]}))
  });
  await expect(page.getByTestId('workspace-status')).toContainText('Action refused');
  await expect(page.getByTestId('idea-list').locator('button')).toHaveCount(1);
  const after = await readDownload(page, () => page.getByTestId('workspace-export-selected').click());
  expect(after.record.id).toBe(before.record.id);
});

test('workspace keeps mobile navigation accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/workspace.html');
  await expect(page.getByTestId('workspace-new-idea')).toBeVisible();
  await expect(page.getByTestId('workspace-export-all')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
