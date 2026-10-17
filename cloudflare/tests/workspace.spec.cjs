const {test,expect}=require('@playwright/test');
test('Cloudflare-served landing matches cinematic direction and links to workspace',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Where ideas become companies.'})).toBeVisible();
 await page.getByRole('link',{name:/Begin with an idea/}).click();
 await expect(page).toHaveURL(/\/workspace(?:\.html)?$/);
 await expect(page.getByRole('heading',{name:'A universe for your next idea.'})).toBeVisible();
 await expect(page.locator('.orb-card')).toHaveCount(4);
 await expect(page.getByText('01 · Live Interviewer')).toBeVisible();
 await expect(page.getByRole('status')).toContainText(/Authentication required|Secure identity setup pending/);
 expect(errors).toEqual([]);
});
test('D1 API refuses anonymous and forged Access headers',async({request})=>{
 const denied=await request.get('/api/me');
 expect([401,503]).toContain(denied.status());
 const bypass=await request.get('/api/ideas',{
  headers:{'Cf-Access-Jwt-Assertion':'forged.header.signature'}
 });
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
