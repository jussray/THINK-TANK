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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, viewport.name + ' horizontal overflow').toBe(false);
    await page.screenshot({path:path.join(output, 'think-tank-'+viewport.name+'.png'),fullPage:true,animations:'disabled'});
  }
});
