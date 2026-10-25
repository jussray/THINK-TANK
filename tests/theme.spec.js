const { test, expect } = require('@playwright/test');

// Day/night theme (founder addendum 2026-10-25): a nav toggle flips the
// site from the approved night look to Ray's day grade — tan and lighter
// warm colors take over, the silhouette stays, the scene switches to
// morning. The mechanism is pure CSS (nav checkbox + body:has() variable
// blocks), so it must work with JavaScript disabled; motion.js only
// persists the choice.
const PAGES = [
  { path: '/landing.html', surface: '.guides-in' },
  { path: '/signin.html', surface: '.card' },
  { path: '/create-account.html', surface: '.card' },
];

async function ink(page) {
  return page.evaluate(
    () => getComputedStyle(document.body).getPropertyValue('--ink').trim().toUpperCase()
  );
}
async function surfaceBg(page, selector) {
  return page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor,
    selector
  );
}

for (const { path, surface } of PAGES) {
  test(`theme toggle flips ${path} from night to tan day`, async ({ page }) => {
    await page.goto(path);
    const toggle = page.locator('.tt-theme-toggle');
    await expect(toggle).toHaveCount(1);
    await expect(page.locator('.theme-btn')).toBeVisible();
    await expect(toggle).not.toBeChecked();
    expect(await ink(page)).toBe('#F3EFFA');
    const nightBg = await surfaceBg(page, surface);

    await page.locator('.theme-btn').click();
    await expect(toggle).toBeChecked();
    expect(await ink(page)).toBe('#2E2115');
    const dayBg = await surfaceBg(page, surface);
    expect(dayBg).not.toBe(nightBg);

    // And back to night.
    await page.locator('.theme-btn').click();
    await expect(toggle).not.toBeChecked();
    expect(await ink(page)).toBe('#F3EFFA');
  });
}

test('day theme renders with JavaScript disabled (pure CSS mechanism)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/signin.html');
  expect(await ink(page)).toBe('#F3EFFA');
  const nightBg = await surfaceBg(page, '.card');
  await page.locator('.theme-btn').click();
  await expect(page.locator('.tt-theme-toggle')).toBeChecked();
  expect(await ink(page)).toBe('#2E2115');
  expect(await surfaceBg(page, '.card')).not.toBe(nightBg);
  await context.close();
});
