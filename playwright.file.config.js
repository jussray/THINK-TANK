const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  testDir: './tests',
  testMatch: 'sovereignty-file.spec.js',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
