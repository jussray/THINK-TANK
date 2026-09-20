const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'sovereignty-file.spec.js',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
