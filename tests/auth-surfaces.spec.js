const { test, expect } = require('@playwright/test');

// sign-in and create-account are disabled previews. V0 has no accounts, so every
// account control must be disabled and labeled, and must not collect or save anything.
test('sign-in preview disables every account control and routes to the workspace', async ({ page }) => {
  await page.goto('/signin.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back to Think Tank');
  await expect(page.locator('.notice')).toContainText('Not in V0');

  // Email, password and "Remember me" are all disabled.
  const inputs = page.locator('input');
  await expect(inputs).toHaveCount(3);
  for (const input of await inputs.all()) {
    await expect(input).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: /Sign In/ })).toBeDisabled();

  const open = page.locator('a.open');
  await expect(open).toHaveAttribute('href', './index.html');
  await open.click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.getByTestId('idea-input')).toBeVisible();
});

test('create-account preview disables roles and submission', async ({ page }) => {
  await page.goto('/create-account.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Turn your ideas into');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Create your account');
  await expect(page.locator('fieldset.roles')).toHaveAttribute('disabled', '');

  const radios = page.locator('input[type="radio"]');
  await expect(radios).toHaveCount(4);
  for (const radio of await radios.all()) {
    await expect(radio).toBeDisabled();
  }
  for (const label of ['Founder', 'Creator', 'Learner', 'Partner']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Create Account/ })).toBeDisabled();
});

test('auth previews have no horizontal overflow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/signin.html', '/create-account.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('landing hides the fake account chrome and labels sample results', async ({ page }) => {
  await page.goto('/landing.html');
  await expect(page.locator('.avatar')).toHaveCount(0);
  await expect(page.locator('.icon-off')).toHaveCount(2);
  for (const button of await page.locator('.icon-off').all()) {
    await expect(button).toBeDisabled();
  }
  await expect(page.locator('.sample-tag').first()).toContainText('Illustrative');
  await expect(page.locator('a.sign-in')).toHaveAttribute('href', './signin.html');
});

test('landing shows the four-guide band with no model claim', async ({ page }) => {
  await page.goto('/landing.html');
  await expect(page.locator('.guide')).toHaveCount(4);
  await expect(page.locator('.guides')).toContainText('Nothing here calls an AI model.');
  await expect(page.locator('a.ghost-btn')).toHaveAttribute('href', './signin.html');
});
