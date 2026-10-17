const {test,expect}=require('@playwright/test');

test('Cloudflare-served landing follows approved cinematic hierarchy and links to workspace',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Where ideas become companies.'})).toBeVisible();
 await expect(page.getByText('A safe place for bold ideas',{exact:false}).first()).toBeVisible();
 await expect(page.locator('.hero-promises li')).toHaveCount(4);
 await expect(page.locator('.orb-card')).toHaveCount(4);
 await expect(page.getByText('Provider-backed Scorecard',{exact:false})).toBeVisible();
 await page.getByRole('link',{name:/Start Exploring/}).click();
 await expect(page).toHaveURL(/\/workspace(?:\.html)?$/);
 await expect(page.getByText('Sign in through Cloudflare Access')).toBeVisible();
 await expect(page.getByRole('status')).toContainText(/Authentication required|Secure identity setup pending/);
 expect(errors).toEqual([]);
});

test('D1 API refuses anonymous and forged Access headers',async({request})=>{
 const denied=await request.get('/api/me');
 expect([401,503]).toContain(denied.status());
 const bypass=await request.get('/api/ideas',{headers:{'Cf-Access-Jwt-Assertion':'forged.header.signature'}});
 expect(bypass.status()).toBe(401);
});

test('mobile layout has no horizontal scroll; no fake agent completion',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of ['/','/workspace.html']){
  await page.goto(path);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBe(false);
 }
 await expect(page.getByText('Sign in through Cloudflare Access')).toBeVisible();
 await expect(page.getByText('Court: READY_FOR_EXTERNAL_VERIFICATION')).toHaveCount(0);
});

test('capture desktop and mobile browser evidence for founder visual review',async({page})=>{
 await page.setViewportSize({width:1536,height:1024});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Where ideas become companies.'})).toBeVisible();
 await page.screenshot({path:'test-results/visual-home-1536x1024.png',fullPage:true});
 await page.goto('/workspace.html');
 await expect(page.getByText('Sign in through Cloudflare Access')).toBeVisible();
 await page.screenshot({path:'test-results/visual-workspace-gate-1536x1024.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.screenshot({path:'test-results/visual-home-390x844.png',fullPage:true});
 await page.goto('/workspace.html');
 await page.screenshot({path:'test-results/visual-workspace-gate-390x844.png',fullPage:true});
});
