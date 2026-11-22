import test from 'node:test';
import assert from 'node:assert/strict';
import frontdoor from '../worker/frontdoor.mjs';

const SITE = 'https://thinktank.jussco.company';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const IDEA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env = {
  SUPABASE_URL: 'https://auth-example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_only_sufficient_length',
  PUBLIC_ORIGIN: SITE,
  APP: { fetch: async r => new Response('<h1>' + new URL(r.url).pathname + '</h1>', { headers: { 'Content-Type':'text/html' } }) }
};
function req(path, method='GET', body, token='goodA', extra={}) {
  return new Request(SITE+path,{ method,
    headers:{...(method==='GET'?{}:{Origin:SITE,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'}),
      ...(token?{Cookie:'__Host-tt_access='+token}:{}), ...extra},
    body:body===undefined?undefined:JSON.stringify(body) });
}
const rec = (changes={}) => ({schemaVersion:'IdeaRecordV1',id:IDEA,idea:'Private idea',...changes});
async function withMock(fn) {
  const prev=globalThis.fetch; const rows=new Map();const calls=[];
  globalThis.fetch=async (raw,opt={})=>{
    const url=new URL(raw);const headers=new Headers(opt.headers||{});
    const access=headers.get('Authorization')?.split(' ')[1];
    const user=access==='goodA'?A:access==='goodB'?B:null;
    calls.push({method:opt.method,path:url.pathname,access});
    if(url.pathname==='/auth/v1/user') return user?Response.json({id:user,email:'confirmed@example.test',email_confirmed_at:'2026-01-01'}):Response.json({error:'denied'},{status:401});
    if(url.pathname==='/auth/v1/signup')return Response.json({id:A});
    if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='password'){
      if(opt.body?.includes('invalid@example.test'))return Response.json({error:'invalid'},{status:400});
      return Response.json({access_token:'goodA',refresh_token:'refreshA',expires_in:1800});
    }
    if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='refresh_token')return Response.json({access_token:'goodA',refresh_token:'rotated',expires_in:1800});
    if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(url.pathname==='/rest/v1/think_tank_idea_records'){
      if(!user)return Response.json({error:'unauthenticated'},{status:401});
      const id=url.searchParams.get('id')?.slice(3);
      const data=[...rows.values()].filter(x=>x.owner_user_id===user && (!id||x.id===id));
      if(opt.method==='GET')return Response.json(data);
      if(opt.method==='POST'){
        const value=JSON.parse(opt.body);
        if(value.owner_user_id!==user)return Response.json({error:'RLS'},{status:403});
        if(rows.has(value.id))return Response.json({code:'23505'},{status:409});
        rows.set(value.id,value);return Response.json([value],{status:201});
      }
      if(opt.method==='PATCH'){
        const revision=Number(url.searchParams.get('revision')?.slice(3));
        if(!data.length||data[0].revision!==revision)return Response.json([]);
        const changed={...data[0],...JSON.parse(opt.body)};
        rows.set(changed.id,changed);return Response.json([changed]);
      }
    }
    throw new Error('Unexpected request in mock');
  };
  try {await fn({rows,calls});}finally{globalThis.fetch=prev;}
}

test('public entrance is public, with script-src self',async()=>{
  const response=await frontdoor.fetch(req('/'),env);
  assert.equal(response.status,200);
  assert.match(await response.text(),/landing/);
  assert.match(response.headers.get('Content-Security-Policy'),/script-src 'self'/);
});
test('account API fails closed when the canonical public origin is missing or mismatched',async()=>{
  const missing=await frontdoor.fetch(req('/api/auth/me'),{...env,PUBLIC_ORIGIN:undefined});
  const wrong=await frontdoor.fetch(req('/api/auth/me'),{...env,PUBLIC_ORIGIN:'https://wrong.example'});
  assert.equal(missing.status,503);
  assert.equal(wrong.status,503);
});
test('unconfigured account API fails closed',async()=>{
  const response=await frontdoor.fetch(req('/api/auth/me'),{APP:env.APP});
  assert.equal(response.status,503);
});
test('signup rejects weak password and cross-site attempts',async()=>withMock(async({calls})=>{
  const cross=await frontdoor.fetch(req('/api/auth/signup','POST',{email:'a@example.test',password:'longpassword123'},null,{Origin:'https://evil.example'}),env);
  assert.equal(cross.status,403);
  const weak=await frontdoor.fetch(req('/api/auth/signup','POST',{email:'a@example.test',password:'short'},null),env);
  assert.equal(weak.status,400);
  assert.equal(calls.length,0);
  const good=await frontdoor.fetch(req('/api/auth/signup','POST',{email:'a@example.test',password:'longpassword123'},null),env);
  assert.equal(good.status,202);
  assert.equal(good.headers.get('set-cookie'),null);
}));
test('login has verified HttpOnly cookies but no tokens in JSON',async()=>withMock(async()=>{
  const good=await frontdoor.fetch(req('/api/auth/login','POST',{email:'a@example.test',password:'longpassword123'},null),env);
  assert.equal(good.status,200);
  assert.match(good.headers.get('set-cookie'),/__Host-tt_access/);
  assert.match(good.headers.get('set-cookie'),/HttpOnly/);
  assert.doesNotMatch(JSON.stringify(await good.json()),/goodA|refreshA/);
  const wrong=await frontdoor.fetch(req('/api/auth/login','POST',{email:'invalid@example.test',password:'longpassword123'},null),env);
  assert.equal(wrong.status,401);
}));
test('anonymous sessions cannot list or write private ideas',async()=>withMock(async()=>{
  const a=await frontdoor.fetch(req('/api/ideas','GET',undefined,null),env);
  const b=await frontdoor.fetch(req('/api/ideas','POST',{record:rec()},null),env);
  assert.equal(a.status,401);assert.equal(b.status,401);
}));
test('one user cannot read another user idea or overwrite it',async()=>withMock(async({rows})=>{
  const created=await frontdoor.fetch(req('/api/ideas','POST',{record:rec(),owner_user_id:B}),env);
  assert.equal(created.status,201);
  assert.equal(rows.get(IDEA).owner_user_id,A);
  const owner=await frontdoor.fetch(req('/api/ideas/'+IDEA),env);
  assert.equal(owner.status,200);
  const foreign=await frontdoor.fetch(req('/api/ideas/'+IDEA,'GET',undefined,'goodB'),env);
  assert.equal(foreign.status,404);
  const modified=await frontdoor.fetch(req('/api/ideas/'+IDEA,'PUT',{record:rec({idea:'Revised'}),expectedRevision:1}),env);
  assert.equal(modified.status,200);
  assert.equal((await modified.json()).revision,2);
  const stale=await frontdoor.fetch(req('/api/ideas/'+IDEA,'PUT',{record:rec({idea:'Stale'}),expectedRevision:1}),env);
  assert.equal(stale.status,409);
  const attacker=await frontdoor.fetch(req('/api/ideas/'+IDEA,'PUT',{record:rec({idea:'Stolen'}),expectedRevision:2},'goodB'),env);
  assert.equal(attacker.status,409);
  assert.equal(rows.get(IDEA).record.idea,'Revised');
}));
test('refresh rotates cookies and logout clears local session cookies',async()=>withMock(async()=>{
  const me=await frontdoor.fetch(req('/api/auth/me','GET',undefined,'expired',{Cookie:'__Host-tt_access=expired; __Host-tt_refresh=refreshA'}),env);
  assert.equal(me.status,200);
  assert.match(me.headers.get('set-cookie'),/rotated/);
  const out=await frontdoor.fetch(req('/api/auth/logout','POST',{},'goodA'),env);
  assert.equal(out.status,200);
  assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
}));
test('oversized or malformed idea payload cannot write',async()=>withMock(async({rows})=>{
  const big=await frontdoor.fetch(req('/api/ideas','POST',{record:rec({idea:'x'.repeat(1100000)})}),env);
  assert.equal(big.status,413);
  const malformed=await frontdoor.fetch(req('/api/ideas','POST',{record:{idea:'No UUID'}}),env);
  assert.equal(malformed.status,400);
  assert.equal(rows.size,0);
}));