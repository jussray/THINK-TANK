const { test, expect } = require('@playwright/test');

test('account credentials remain disabled when the secure API is unavailable', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({status:503,contentType:'application/json',body:'{"error":"Account service unavailable"}'}));
  for (const path of ['/signin.html', '/create-account.html']) {
    await page.goto(path);
    await expect(page.locator('#accountStatus')).toContainText('not available');
    await expect(page.locator('#email')).toBeDisabled();
    await expect(page.locator('#password')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Explore locally without an account' })).toBeVisible();
  }
});

test('verified sign-in navigates to the workspace without URL credential leakage', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({status:401,contentType:'application/json',body:'{"service":"think-tank-auth-v1","error":"Sign in required"}'}));
  await page.route('**/api/auth/login', route => route.fulfill({status:200,contentType:'application/json',body:'{"user":{"userId":"test-user","email":"a@example.test"}}'}));
  await page.goto('/signin.html');
  await expect(page.locator('#email')).toBeEnabled();
  await expect(page.locator('#password')).toBeEnabled();
  await page.locator('#email').fill('a@example.test');
  await page.locator('#password').fill('a-strong-demo-password');
  await page.getByRole('button', {name:/Sign in/i}).click();
  await expect(page).toHaveURL(/workspace\.html$/);
  expect(page.url()).not.toContain('a@example.test');
  expect(page.url()).not.toContain('a-strong-demo-password');
});

test('signup requires consent and password match before using the account API', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({status:401,contentType:'application/json',body:'{"service":"think-tank-auth-v1","error":"Sign in required"}'}));
  let signupCalls=0;
  await page.route('**/api/auth/signup', route => {signupCalls++;return route.fulfill({status:202,contentType:'application/json',body:'{"message":"Check your email to verify your account, then sign in."}'});});
  await page.goto('/create-account.html');
  await expect(page.locator('#name')).toBeDisabled();
  await expect(page.locator('#email')).toBeEnabled();
  await page.locator('#email').fill('a@example.test');
  await page.locator('#password').fill('a-strong-demo-password');
  await page.locator('#confirm').fill('different-password');
  await page.locator('input[name="accountConsent"]').check();
  await page.getByRole('button', {name:/Create account/i}).click();
  await expect(page.locator('#accountStatus')).toContainText('Passwords do not match');
  expect(signupCalls).toBe(0);
  await page.locator('#confirm').fill('a-strong-demo-password');
  await page.getByRole('button', {name:/Create account/i}).click();
  await expect(page.locator('#accountStatus')).toContainText('Check your email');
  expect(signupCalls).toBe(1);
});

test('public local-first exploration works without account service', async ({page}) => {
  await page.route('**/api/auth/me', route => route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/signin.html');
  await page.getByRole('link', {name:'Explore locally without an account'}).click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.getByTestId('idea-input')).toBeVisible();
});

test('auth pages have no horizontal overflow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/signin.html', '/create-account.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('landing nav is live chrome with a profile avatar, no disabled tells', async ({ page }) => {
  await page.goto('/landing.html');
  await expect(page.locator('.avatar')).toHaveCount(1);
  await expect(page.locator('.icon-off')).toHaveCount(0);
  await expect(page.getByText('not in V0')).toHaveCount(0);
  await expect(page.locator('.sample-tag')).toHaveCount(0);
});

test('landing shows the four-guide band as the mockup words it', async ({ page }) => {
  await page.goto('/landing.html');
  await expect(page.locator('.guide')).toHaveCount(4);
  await expect(page.locator('.guides')).toContainText('Meet your AI guides');
  await expect(page.locator('.guides')).toContainText('from a team of specialized AI guides');
  await expect(page.locator('.guides')).toContainText('Evaluates potential and viability.');
  await expect(page.locator('.guides')).toContainText('Finds people, resources and real-world possibilities.');
  const guideLinks = page.locator('a.guide-foot');
  await expect(guideLinks).toHaveCount(4);
  for (const link of await guideLinks.all()) {
    await expect(link).toHaveAttribute('href', './index.html');
  }
});

test('landing panels route into the workspace', async ({ page }) => {
  await page.goto('/landing.html');
  const panelLinks = page.locator('a.card-link');
  await expect(panelLinks).toHaveCount(6);
  for (const link of await panelLinks.all()) {
    await expect(link).toHaveAttribute('href', './index.html');
  }
  await panelLinks.first().click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.getByTestId('idea-input')).toBeVisible();
});
