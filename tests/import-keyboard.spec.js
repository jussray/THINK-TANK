const { test, expect } = require('@playwright/test');

// Audit 2026-10-25: Import was a <label> over a display:none file input, so
// no keyboard user could reach it. These tests require a focusable button that
// opens the file chooser when activated with the keyboard.

test('index Import JSON is a keyboard button that opens the file chooser', async ({ page }) => {
  await page.goto('/index.html');
  const importButton = page.getByRole('button', { name: /Import JSON/ });
  await importButton.focus();
  await expect(importButton).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await chooser;
});

test('workspace Import backup is a keyboard button that opens the file chooser', async ({ page }) => {
  await page.goto('/workspace.html');
  const importButton = page.getByRole('button', { name: /Import backup/ });
  await importButton.focus();
  await expect(importButton).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await chooser;
});
