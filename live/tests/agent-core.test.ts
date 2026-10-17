import test from 'node:test';
import assert from 'node:assert/strict';
import {AnswerSchema,assertQuestion,requestFingerprint,errorCode} from '../lib/agent-core.ts';
test('validates answer content and idempotency key',()=>{
 assert.equal(AnswerSchema.parse({answer:' Real ',idempotencyKey:'key-for-the-founder'}).answer,'Real');
 for(const answer of ['','  ','x'.repeat(8001)])
  assert.equal(AnswerSchema.safeParse({answer,idempotencyKey:'key-for-the-founder'}).success,false);
 assert.equal(AnswerSchema.safeParse({answer:'hi',idempotencyKey:'short'}).success,false);
 assert.equal(AnswerSchema.safeParse({answer:'hi',idempotencyKey:'key-for-the-founder',admin:true}).success,false);
});
test('refuses unstructured and overlong model outputs',()=>{
 assert.equal(assertQuestion({next_question:'Who would pay first?'}),'Who would pay first?');
 for(const value of [null,{},'fake',{next_question:' '},{next_question:'Q'.repeat(1001)},
  {next_question:'Valid?',capabilities:{'billing.manage':true}}])
  assert.throws(()=>assertQuestion(value));
});
test('request input digest subject changes when idea or answer changes',()=>{
 assert.equal(requestFingerprint('a',' Value '),requestFingerprint('a','Value'));
 assert.notEqual(requestFingerprint('a','Value'),requestFingerprint('b','Value'));
 assert.notEqual(requestFingerprint('a','Value'),requestFingerprint('a','Other'));
});
test('worker error code never includes a secret exception message',()=>{
 assert.equal(errorCode(new Error('sk-sensitive-secret')),'MODEL_EXECUTION_FAILED');
});
