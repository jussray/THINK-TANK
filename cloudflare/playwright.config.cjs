const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'*.spec.cjs',timeout:30000,
 use:{baseURL:'http://127.0.0.1:8787',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{
  command:'npx wrangler dev --local --ip 127.0.0.1 --port 8787',
  url:'http://127.0.0.1:8787/health',
  reuseExistingServer:!process.env.CI,timeout:90000
 }
});
