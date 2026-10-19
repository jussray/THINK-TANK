const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('approved cinematic journey has responsive desktop and mobile browser receipts', async ({ page }) => {
  const output = path.resolve(process.cwd(), 'visual-proof');
  fs.mkdirSync(output, { recursive: true });
  for (const viewport of [{name:'desktop',width:1536,height:1024},{name:'mobile',width:390,height:844}]) {
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Where ideas become');
    await expect(page.locator('h1')).toContainText('companies.');
    await expect(page.getByTestId('truth-boundary')).toContainText('not external market validation');
    await expect(page.getByTestId('idea-input')).toBeVisible();
    await expect(page.getByRole('heading', {name:'Four perspectives. One stronger idea.'})).toBeVisible();
    await expect(page.getByTestId('export-record')).toBeVisible();
    const heroImage = await page.locator('.hero-art').evaluate(el => getComputedStyle(el).backgroundImage);
    expect(heroImage).toContain('think-tank-hero-scene.webp');
    // Detect a missing runtime asset rather than passing on a CSS filename alone.
    const heroAsset = await page.request.get('/assets/think-tank-hero-scene.webp');
    expect(heroAsset.status(), 'approved hero asset must actually be served').toBe(200);
    expect(heroAsset.headers()['content-type']).toMatch(/^image\/webp\b/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, viewport.name + ' horizontal overflow').toBe(false);
    await page.screenshot({path:path.join(output, 'think-tank-'+viewport.name+'.png'),fullPage:true,animations:'disabled'});
  }
});

test('completed interview reveals source-grounded results and survives reload', async ({ page }) => {
  const output = path.resolve(process.cwd(),'visual-proof');
  fs.mkdirSync(output,{recursive:true});
  await page.setViewportSize({width:1536,height:1024});
  await page.goto('/');
  await page.getByTestId('idea-input').fill('A guided idea studio for independent makers and founders.');
  await page.getByTestId('start-interview').click();
  const responses = [
    'Independent makers funding their own early decisions about unmet customer needs.',
    'They use spreadsheets, interviews, friends, and general chatbots.',
    'They would switch when a clear first-pass record saves their time.',
    'Their accumulated decision history and revisions create defensibility.'
  ];
  for (const response of responses) {
    await page.getByTestId('answer-input').fill(response);
    await page.getByTestId('submit-answer').click();
  }
  await expect(page.locator('#resultsLive')).toBeVisible();
  await expect(page.locator('#resultScore')).toContainText('/10');
  await expect(page.locator('#resultCritique')).not.toBeEmpty();
  await expect(page.locator('#resultPattern')).not.toBeEmpty();
  await page.screenshot({path:path.join(output,'think-tank-completed-results.png'),fullPage:true,animations:'disabled'});
  await page.reload();
  await expect(page.locator('#resultsLive')).toBeVisible();
  await expect(page.locator('#resultScore')).toContainText('/10');
});
