const { test, expect } = require('@playwright/test');

// landing.html is a presentation surface. It must not claim capabilities V0 does
// not have, and it must not become a second front door that strands the app.
test('landing surface renders and routes into the real product', async ({ page }) => {
  await page.goto('/landing.html');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where ideas become');

  // First-time founders get oriented before entering the unchanged V0 app.
  const start = page.locator('a.start-btn');
  await expect(start).toHaveAttribute('href', './onboarding.html');
  await start.click();
  await expect(page).toHaveURL(/onboarding\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Give your idea');
  await expect(page.locator('[aria-current="step"]')).toHaveText('2. Get started');
  await page.getByTestId('continue-to-interview').click();
  await expect(page).toHaveURL(/index\.html#start$/);
  await expect(page.getByTestId('idea-input')).toBeVisible();
});

test('landing surface states the V0 truth boundary', async ({ page }) => {
  await page.goto('/landing.html');
  const truth = page.locator('#truth');

  // Must say the roles are deterministic, not production AI (AGENTS.md).
  await expect(truth).toContainText('deterministic');
  await expect(truth).toContainText('not external market validation');

  // Must not claim the capabilities local-capability-policy.js disables.
  await expect(truth).toContainText('Accounts, billing, team seats and API access');

  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const claim of ['$29', '$99', '/mo', 'unlimited interviews', 'api access included']) {
    expect(body).not.toContain(claim);
  }
});

test('landing surface has no horizontal overflow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing.html');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every landing image resolves', async ({ page }) => {
  await page.goto('/landing.html');
  const broken = await page.evaluate(() =>
    [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute('src'))
  );
  expect(broken).toEqual([]);
});

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  test('onboarding preserves browser state and fits ' + name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/landing.html');
    await page.evaluate(() => localStorage.setItem('onboarding-continuity-probe', 'preserve-me'));
    await page.locator('a.start-btn').click();
    await expect(page).toHaveURL(/onboarding\\.html$/);
    await expect(page.locator('main')).toContainText('No account or payment is needed');
    await expect(page.locator('main')).toContainText('not market validation');
    await expect(page.getByRole('link', { name: 'Open My Ideas' })).toHaveAttribute('href', './index.html#idea-hub');
    expect(await page.evaluate(() => localStorage.getItem('onboarding-continuity-probe'))).toBe('preserve-me');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const broken = await page.evaluate(() => [...document.images].filter(img => !img.complete || img.naturalWidth === 0).length);
    expect(broken).toBe(0);
    require('fs').mkdirSync('visual-proof', { recursive: true });
    await page.screenshot({ path: 'visual-proof/think-tank-onboarding-' + name + '.png', fullPage: true });
  });
}
