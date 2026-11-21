const { test, expect } = require('@playwright/test');

test('sign-in is clearly local mode and cannot accept credentials', async ({ page }) => {
  await page.goto('/signin.html');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Explore without signing in');
  await expect(page.locator('p[role="note"]')).toContainText('not enabled');
  await expect(page.locator('#signin-form #email')).toBeDisabled();
  await expect(page.locator('#signin-form #password')).toBeDisabled();
  await expect(page.locator('#signin-form input[type="checkbox"]')).toBeDisabled();
  await expect(page.getByRole('link', { name: /Forgot password/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Explore Locally/ }).click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.getByTestId('idea-input')).toBeVisible();
});

test('local entry screens do not advertise working OAuth or registration', async ({ page }) => {
  for (const path of ['/signin.html', '/create-account.html']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: /Continue with Google/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Sign In|Create Account/ })).toHaveCount(0);
    await expect(page.locator('p[role="note"]')).toContainText('not enabled');
  }
});

test('create account is a non-credential local preview', async ({ page }) => {
  await page.goto('/create-account.html');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Explore the local workspace');
  for (const id of ['name', 'email', 'password', 'confirm']) {
    await expect(page.locator('#create-form #' + id)).toBeDisabled();
  }
  await expect(page.locator('input[type="radio"][value="founder"]')).toBeChecked();
  await page.getByRole('button', { name: /Explore Locally/ }).click();
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
