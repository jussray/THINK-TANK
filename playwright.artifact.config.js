const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: 'sovereignty-file.spec.js',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run serve:artifact',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false
  }
});
