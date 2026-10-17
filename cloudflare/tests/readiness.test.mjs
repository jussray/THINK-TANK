import test from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../src/index.mjs';

const ideaId='12345678-1234-4234-8234-123456789113';
const url='https://example.test/api/ideas/'+ideaId+'/answer';
function dbFixture(previous=null){
 let reads=0,writes=0;
 return {db:{
  prepare(sql){
   if (!sql.startsWith('SELECT '))writes++;
   return {bind(...args){return {
    async first(){
     reads++;
     if(sql.includes('SELECT id,revision FROM ideas'))return {id:ideaId,revision:0};
     if(sql.includes('SELECT id,request_hash,status FROM agent_executions'))return previous;
     throw new Error('Unexpected SQL: '+sql);
    },
    async run(){throw new Error('Unexpected write: '+sql);}
   }}};
  }
 },counts:()=>({reads,writes})};
}
function req(){
 return new Request(url,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({answer:'People may want this.',idempotencyKey:'account-action-123456'})});
}
test('authenticated capability readback reports truthful unavailable model state',async()=>{
 const res=await route(new Request('https://example.test/api/me'),{},'verified-owner');
 assert.equal(res.status,200);
 const v=await res.json();
 assert.equal(v.authenticated,true);
 assert.equal(v.capabilities.interviewer,'unavailable');
 assert.equal(v.capabilities.councilBus,'not-connected');
});
test('fresh founder answer is rejected without model instead of leaving queued work',async()=>{
 const f=dbFixture();
 const res=await route(req(),{DB:f.db},'verified-owner');
 assert.equal(res.status,503);
 assert.deepEqual(await res.json(),{error:'INTERVIEWER_UNAVAILABLE'});
 assert.deepEqual(f.counts(),{reads:2,writes:0});
});
test('existing idempotent request remains readable while model is unavailable',async()=>{
 const canonical=JSON.stringify({v:1,ideaId,answer:'People may want this.'});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const f=dbFixture({id:'previous-execution',request_hash:hash,status:'succeeded'});
 const res=await route(req(),{DB:f.db},'verified-owner');
 assert.equal(res.status,202);
 assert.deepEqual(await res.json(),{executionId:'previous-execution',status:'succeeded',idempotent:true});
 assert.equal(f.counts().writes,0);
});
test('configured model is announced only as configured, not verified running',async()=>{
 const r=await route(new Request('https://example.test/api/me'),{
  OPENAI_API_KEY:'unit-test-only',OPENAI_MODEL:'fake-model'},'verified-owner');
 const v=await r.json();
 assert.equal(v.capabilities.interviewer,'configured');
});
