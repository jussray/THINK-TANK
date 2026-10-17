const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'*.spec.cjs',timeout:30000,
 use:{baseURL:'http://127.0.0.1:4180',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'npm run dev',url:'http://127.0.0.1:4180',reuseExistingServer:!process.env.CI,timeout:120000}
});
