const { test, expect } = require('@playwright/test');

// Founder decision 2026-10-25 (exact-match rebuild) supersedes the earlier
// disabled-preview behaviour: sign-in and create-account now match the
// approved mockups and act as entry points into the workspace. They are NOT
// authentication — nothing typed is sent or stored, and the primary and
// Google actions navigate straight to ./index.html.
test('sign-in matches the mockup and routes into the workspace', async ({ page }) => {
  await page.goto('/signin.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back to Think Tank');
  await expect(page.locator('.notice')).toHaveCount(0);
  await expect(page.getByText('Not in V0')).toHaveCount(0);

  // Email, password and "Remember me" are all typeable, nothing disabled.
  // (Scoped to the form: the nav also carries the day/night theme checkbox.)
  const inputs = page.locator('#signin-form input');
  await expect(inputs).toHaveCount(3);
  for (const input of await inputs.all()) {
    await expect(input).toBeEnabled();
  }
  await page.locator('#email').fill('founder@example.com');
  await page.locator('#password').fill('not-a-real-secret');

  // Submitting discards the input (no query string carries it) and lands in the app.
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/index\.html$/);
  expect(page.url()).not.toContain('founder@example.com');
  expect(page.url()).not.toContain('not-a-real-secret');
  await expect(page.getByTestId('idea-input')).toBeVisible();
});

test('sign-in Google action and forgot-password route correctly', async ({ page }) => {
  await page.goto('/signin.html');
  await page.getByRole('link', { name: /Continue with Google/ }).click();
  await expect(page).toHaveURL(/index\.html$/);

  await page.goto('/signin.html');
  await page.getByRole('link', { name: /Forgot password/ }).click();
  await expect(page).toHaveURL(/create-account\.html$/);

  await page.goto('/signin.html');
  await page.getByRole('link', { name: /Create one/ }).click();
  await expect(page).toHaveURL(/create-account\.html$/);
});

test('create-account preselects Founder and routes into the workspace', async ({ page }) => {
  await page.goto('/create-account.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Turn your ideas into');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Create your account');
  await expect(page.getByText('Not in V0')).toHaveCount(0);

  // Role tiles are live single-select radios with Founder pre-selected.
  const radios = page.locator('input[type="radio"]');
  await expect(radios).toHaveCount(4);
  for (const radio of await radios.all()) {
    await expect(radio).not.toBeDisabled();
  }
  await expect(page.locator('input[type="radio"][value="founder"]')).toBeChecked();
  await page.locator('label.role', { hasText: 'Learner' }).click();
  await expect(page.locator('input[type="radio"][value="learner"]')).toBeChecked();
  await expect(page.locator('input[type="radio"][value="founder"]')).not.toBeChecked();

  for (const label of ['Founder', 'Creator', 'Learner', 'Partner']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: /Create Account/ }).click();
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
