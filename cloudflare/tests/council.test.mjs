import test from 'node:test';
import assert from 'node:assert/strict';
import {runCouncilIntelligence,parseInterviewerResult} from '../src/council-intelligence.mjs';
import {verifyCourt} from '../../live/vendor/ultrathink-council/src/council.mjs';
import {verifyCouncilBusHandoff} from '../../live/vendor/ultrathink-council/src/busHandoff.mjs';
import {verifyFounderAccess} from '../src/access.mjs';

const question={
 status:'completed',
 output:[{content:[{type:'output_text',text:JSON.stringify({next_question:'What evidence would make your first customer pay?'})}]}]
};
test('Council orchestrates model response and Court rejects unproven market outcomes',async()=>{
 let calls=0;
 const fetcher=async(_url,options)=>{
  calls++;
  const payload=JSON.parse(options.body);
  assert.equal(payload.store,false);
  assert.equal(payload.text.format.type,'json_schema');
  assert.equal(payload.max_output_tokens,220);
  return {ok:true,json:async()=>question};
 };
 const env={OPENAI_API_KEY:'local-test-only',OPENAI_MODEL:'fake-model'};
 const identity={
  runId:'12345678-1234-4234-8234-123456789111',
  executionId:'12345678-1234-4234-8234-123456789112',
  ideaId:'12345678-1234-4234-8234-123456789113'
 };
 const result=await runCouncilIntelligence({answer:'People may pay for it'},env,identity,fetcher);
 assert.equal(calls,1);
 assert.equal(result.council.independent,false);
 assert.equal(result.council.authority.grantsExecutionAuthority,false);
 assert.equal(result.court.verdict,'HOLD');
 assert.equal(result.busHandoff.deliveryStatus,'PREPARED_NOT_SENT');
 assert.equal(verifyCourt(result.council,result.court),true);
 assert.equal(verifyCouncilBusHandoff({council:result.council,court:result.court,handoff:result.busHandoff}),true);
});
test('refusals, omissions and unstructured responses are fail-closed',()=>{
 for(const value of [
  {status:'incomplete',output:[]},
  {status:'completed',output:[]},
  {status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]},
  {status:'completed',output:[{content:[{type:'output_text',text:'not json'}]}]},
  {status:'completed',output:[{content:[{type:'output_text',text:'{"next_question":"Hi","role":"admin"}'}]}]}
 ]) assert.throws(()=>parseInterviewerResult(value));
});
test('Cloudflare Access rejects unconfigured identity and missing JWT',async()=>{
 await assert.rejects(()=>verifyFounderAccess(new Request('https://example.test/api/me'),{}),
  /ACCESS_NOT_CONFIGURED/);
 await assert.rejects(()=>verifyFounderAccess(new Request('https://example.test/api/me'),{
  ACCESS_TEAM_DOMAIN:'unit.cloudflareaccess.com',ACCESS_AUD:'a'.repeat(64)
 }),/UNAUTHORIZED/);
});
