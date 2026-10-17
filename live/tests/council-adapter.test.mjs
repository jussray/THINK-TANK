import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleCouncil,reviewCourt,verifyCourt} from '../vendor/ultrathink-council/src/council.mjs';
import {prepareCouncilBusHandoff,verifyCouncilBusHandoff} from '../vendor/ultrathink-council/src/busHandoff.mjs';
function prepare(){
 const council=assembleCouncil({roundId:'thinktank-review-1',sourceRef:'idea-version-reference',
 goal:'Check founder evidence',independent:false,seats:[{id:'critic',finding:'No external customer witnesses yet.',
 evidenceRefs:[],dissent:[],providerState:'UNVERIFIED'}]});
 const court=reviewCourt(council,{claims:[{id:'demand',status:'UNKNOWN',witnesses:[]}],
 strongestChallenge:'Where are independently verified customers?',dissent:[],
 launchGate:{destinationIdentity:'UNKNOWN',functionalRuntime:'UNKNOWN',visualCanon:'UNKNOWN'}});
 const handoff=prepareCouncilBusHandoff({council,court,origin:
 {agent:'thinktank',route:'interview',threadId:'idea-one',correlationId:'round-one'}});
 return {council,court,handoff};
}
test('Council and Court preserve HOLD and lack execution authority',()=>{
 const {council,court}=prepare();
 assert.equal(council.authority.grantsExecutionAuthority,false);
 assert.equal(court.verdict,'HOLD');
 assert.equal(verifyCourt(council,court),true);
});
test('Council Bus is a prepared handoff, never invented delivery',()=>{
 const {council,court,handoff}=prepare();
 assert.equal(handoff.deliveryStatus,'PREPARED_NOT_SENT');
 assert.equal(verifyCouncilBusHandoff({council,court,handoff}),true);
 assert.throws(()=>verifyCouncilBusHandoff({council,court,handoff:{...handoff,deliveryStatus:'DELIVERED'}}));
});
