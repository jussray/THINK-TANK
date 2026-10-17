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
  const layout=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   return {viewport:width,scrollWidth:document.documentElement.scrollWidth,
    offenders:[...document.querySelectorAll('*')].map(x=>({
      tag:x.tagName,className:typeof x.className==='string'?x.className:'',text:x.textContent?.trim().slice(0,25)||'',
      left:Math.round(x.getBoundingClientRect().left),right:Math.round(x.getBoundingClientRect().right)
    })).filter(x=>x.right>width+1||x.left< -1).slice(0,15)};
  });
  expect(layout.scrollWidth<=layout.viewport,JSON.stringify({path,layout})).toBe(true);
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


test('offline model does not block saved ideas and never queues unserviceable answers',async({page})=>{
 const idea={id:'12345678-1234-4234-8234-123456789113',title:'Proof-backed founder idea',revision:0,created_at:'2026-10-16T00:00:00Z'};
 let stored=false,queuePosts=0;
 await page.route('**/api/me',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({authenticated:true,provider:'cloudflare-access',
   capabilities:{interviewer:'unavailable',council:'evidence-review',court:'evidence-review',councilBus:'not-connected'}})
 }));
 await page.route('**/api/ideas',async route=>{
  const method=route.request().method();
  if(method==='POST'){stored=true;return route.fulfill({
   status:201,contentType:'application/json',body:JSON.stringify({idea})});}
  return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ideas:stored?[idea]:[]})});
 });
 await page.route('**/api/ideas/'+idea.id,route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({idea,messages:[],executions:[]})
 }));
 await page.route('**/api/ideas/'+idea.id+'/answer',route=>{
  queuePosts++;return route.fulfill({status:503,contentType:'application/json',
   body:'{"error":"INTERVIEWER_UNAVAILABLE"}'});
 });
 await page.goto('/workspace.html');
 await expect(page.getByText('Interviewer is paused until the model service is configured.',{exact:false})).toBeVisible();
 await page.locator('#title').fill(idea.title);
 await page.locator('#create').getByRole('button',{name:/Save idea/}).click();
 await expect(page.locator('#active-title')).toHaveText(idea.title);
 await expect(page.locator('#submit')).toBeDisabled();
 await page.locator('#answer').fill('An assumption to test.');
 await expect(page.locator('#submit')).toBeDisabled();
 expect(queuePosts).toBe(0);
});


test('the approved landscape is served as real art, not a flattened interface screenshot',async({page,request})=>{
 const image=await request.get('/hero-vista.webp');
 expect(image.ok()).toBe(true);
 expect(image.headers()['content-type']).toMatch(/image\/webp/);
 expect((await image.body()).byteLength).toBeGreaterThan(3000);
 await page.goto('/');
 const css=await page.locator('.hero-scene').evaluate(node=>getComputedStyle(node).backgroundImage);
 expect(css).toContain('hero-vista.webp');
 await expect(page.getByRole('link',{name:/Start Exploring/})).toBeVisible();
 await page.getByRole('link',{name:/Start Exploring/}).click();
 await expect(page).toHaveURL(/\/workspace(?:\.html)?$/);
});
