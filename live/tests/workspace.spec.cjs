const {test,expect}=require('@playwright/test');
test('cinematic landing has distinct account workspace route',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Where your next big idea meets its future/})).toBeVisible();
 await page.getByRole('link',{name:/Enter the Think Tank/}).click();
 await expect(page).toHaveURL(/\/workspace$/);
 await expect(page.getByText('No Supabase project is connected',{exact:false})).toBeVisible();
 expect(errors).toEqual([]);
});
test('mobile layout has no horizontal overflow, including disconnected truth state',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const route of ['/','/workspace']){
  await page.goto(route);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBe(false);
 }
 await expect(page.getByText('No Supabase project is connected',{exact:false})).toBeVisible();
});
