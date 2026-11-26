const {test,expect}=require('@playwright/test');
const IDEA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('AI actions are invisible when the external provider has not been explicitly enabled',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{
    service:'think-tank-auth-v1',user:{userId:'11111111-1111-4111-8111-111111111111',email:'test@example.test'}
  }}));
  await page.route('**/api/ai/status',route=>route.fulfill({json:{enabled:false,requiresExplicitConsent:true}}));
  await page.route('**/api/ideas',route=>route.fulfill({json:{ideas:[{id:IDEA,title:'Private idea',revision:2}]}}));
  await page.goto('/workspace.html');
  await expect(page.getByRole('button',{name:'Ask AI a question'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Draft startup package'})).toHaveCount(0);
});

test('consent prompt blocks AI requests until accepted, and responses do not overwrite idea',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{
    service:'think-tank-auth-v1',user:{userId:'11111111-1111-4111-8111-111111111111',email:'test@example.test'}
  }}));
  await page.route('**/api/ai/status',route=>route.fulfill({json:{
    enabled:true,requiresExplicitConsent:true
  }}));
  await page.route('**/api/ideas',route=>route.fulfill({json:{ideas:[{id:IDEA,title:'Private idea',revision:2}]}}));
  let calls=0;
  await page.route('**/api/ai/interview',async route=>{
    calls++;
    const request=route.request().postDataJSON();
    expect(request).toEqual({ideaId:IDEA,externalAIConsent:true});
    await route.fulfill({json:{ideaId:IDEA,question:'Who would pay for this first?',source:'provider-generated-unverified'}});
  });
  await page.goto('/workspace.html');
  const ask=page.getByRole('button',{name:'Ask AI a question'});
  await expect(ask).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());
  await ask.click();
  expect(calls).toBe(0);
  page.once('dialog',dialog=>dialog.accept());
  await ask.click();
  await expect(page.getByText('Who would pay for this first?')).toBeVisible();
  await expect(page.getByText('AI-generated draft · unverified · no changes saved')).toBeVisible();
  expect(calls).toBe(1);
  const localWrites=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('think-tank.idea-')));
  expect(localWrites).toEqual([]);
});
