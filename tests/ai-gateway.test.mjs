import test from 'node:test';
import assert from 'node:assert/strict';
import frontdoor from '../worker/frontdoor.mjs';
import { MODULE_NAMES } from '../revival/ai/synthesis-engine.mjs';

const SITE='https://thinktank.jussco.company';
const OWNER='11111111-1111-4111-8111-111111111111';
const STRANGER='22222222-2222-4222-8222-222222222222';
const IDEA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ideaRecord={
  schemaVersion:'IdeaRecordV1', id:IDEA, idea:'A founder interview that preserves decisions',
  updatedAt:'2026-11-25T01:00:00.000Z',
  answers:[{question:'Who needs this?',answer:'First-time founders who struggle with focus.'}]
};
const draft=JSON.stringify({modules:Object.fromEntries(MODULE_NAMES.map(name=>[name,name+': unverified founder hypothesis']))});
function env(extra={}) {
  return {
    SUPABASE_URL:'https://auth-example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock_only_sufficient_length',
    PUBLIC_ORIGIN:SITE,
    THINK_TANK_AI_ENABLED:'true',
    ANTHROPIC_API_KEY:'test-placeholder-only',
    THINK_TANK_AI_MODEL:'test-model',
    THINK_TANK_AI_OWNER_USER_ID:OWNER,
    AI_RATE_LIMIT:{limit:async()=>({success:true})},
    APP:{fetch:async()=>new Response('public asset')},
    ...extra
  };
}
function request(path,body,{user='owner',origin=SITE}={}) {
  return new Request(SITE+path,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':origin,'Sec-Fetch-Site':origin===SITE?'same-origin':'cross-site',
      ...(user?{'Cookie':'__Host-tt_access='+user}:{})},
    body:JSON.stringify(body)
  });
}
async function fakeUpstream(work) {
  const prev=globalThis.fetch;
  const outbound=[];
  globalThis.fetch=async(url,options={})=>{
    const dest=new URL(url);
    outbound.push({path:dest.pathname,host:dest.host,body:options.body});
    if(dest.pathname==='/auth/v1/user') {
      const token=new Headers(options.headers).get('Authorization')?.split(' ')[1];
      const id=token==='owner'?OWNER:token==='stranger'?STRANGER:null;
      return id?Response.json({id,email_confirmed_at:'2026-01-01',email:'founder@example.test'}):Response.json({}, {status:401});
    }
    if(dest.pathname==='/rest/v1/think_tank_idea_records') {
      const id=dest.searchParams.get('id');
      const owner=dest.searchParams.get('owner_user_id');
      const ok=id==='eq.'+IDEA && owner==='eq.'+OWNER;
      return Response.json(ok?[{id:IDEA,owner_user_id:OWNER,record:ideaRecord,revision:2}]:[]);
    }
    if(dest.host==='api.anthropic.com') {
      const sent=JSON.parse(options.body);
      return Response.json({content:[{type:'text',text:sent.max_tokens>1000?draft:'What specific outcome would those founders pay for?'}]});
    }
    throw new Error('Unexpected outbound request');
  };
  try {await work(outbound);} finally {globalThis.fetch=prev;}
}
const input={ideaId:IDEA,externalAIConsent:true};
function providerCalls(outbound){return outbound.filter(x=>x.host==='api.anthropic.com')}

test('no AI capability or provider request unless enabled and configured',async()=>fakeUpstream(async calls=>{
  const response=await frontdoor.fetch(request('/api/ai/interview',input),env({THINK_TANK_AI_ENABLED:'false'}));
  assert.equal(response.status,503);
  assert.equal(providerCalls(calls).length,0);
}));
test('no AI without authenticated founder and same-origin consent',async()=>fakeUpstream(async calls=>{
  const anonymous=await frontdoor.fetch(request('/api/ai/interview',input,{user:null}),env());
  const noConsent=await frontdoor.fetch(request('/api/ai/interview',{ideaId:IDEA,externalAIConsent:false}),env());
  const cross=await frontdoor.fetch(request('/api/ai/interview',input,{origin:'https://attacker.example'}),env());
  assert.equal(anonymous.status,401);
  assert.equal(noConsent.status,403);
  assert.equal(cross.status,403);
  assert.equal(providerCalls(calls).length,0);
}));
test('AI requires an owner-scoped server-side stored idea, never client content',async()=>fakeUpstream(async calls=>{
  const foreign=await frontdoor.fetch(request('/api/ai/interview',input,{user:'stranger'}),env());
  const invalid=await frontdoor.fetch(request('/api/ai/interview',{...input,ideaId:'not-valid'}),env());
  assert.equal(foreign.status,403);
  assert.equal(invalid.status,400);
  assert.equal(providerCalls(calls).length,0);
}));
test('AI is owner-only until paid entitlements have been verified',async()=>fakeUpstream(async calls=>{
  const disabled=await frontdoor.fetch(request('/api/ai/interview',input),env({THINK_TANK_AI_OWNER_USER_ID:undefined}));
  const other=await frontdoor.fetch(request('/api/ai/interview',input,{user:'stranger'}),env());
  assert.equal(disabled.status,503);
  assert.equal(other.status,403);
  assert.equal(providerCalls(calls).length,0);
}));
test('missing or exhausted rate-limit binding blocks external AI cost',async()=>fakeUpstream(async calls=>{
  const absent=await frontdoor.fetch(request('/api/ai/interview',input),env({AI_RATE_LIMIT:null}));
  const exhausted=await frontdoor.fetch(request('/api/ai/interview',input),env({AI_RATE_LIMIT:{limit:async()=>({success:false})}}));
  assert.equal(absent.status,503);
  assert.equal(exhausted.status,429);
  assert.equal(providerCalls(calls).length,0);
}));
test('authorized interview returns one unverified question without writing records',async()=>fakeUpstream(async calls=>{
  const response=await frontdoor.fetch(request('/api/ai/interview',input),env());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ideaId,IDEA);
  assert.equal(body.question,'What specific outcome would those founders pay for?');
  assert.equal(body.source,'provider-generated-unverified');
  assert.equal(providerCalls(calls).length,1);
  const modelInput=JSON.parse(providerCalls(calls)[0].body);
  assert.ok(JSON.stringify(modelInput).includes('First-time founders'));
  assert.ok(!JSON.stringify(modelInput).includes('test-placeholder-only'));
}));
test('authorized synthesis returns only reviewable draft modules; no automatic writes',async()=>fakeUpstream(async calls=>{
  const response=await frontdoor.fetch(request('/api/ai/synthesize',input),env());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.status,'pending-founder-review');
  assert.deepEqual(Object.keys(body.modules),MODULE_NAMES);
  assert.equal(body.ideaId,IDEA);
  assert.equal(providerCalls(calls).length,1);
  assert.ok(JSON.parse(providerCalls(calls)[0].body).max_tokens>=3000);
  assert.equal(calls.filter(x=>x.path==='/rest/v1/think_tank_idea_records'&&x.body!==undefined).length,0);
}));
