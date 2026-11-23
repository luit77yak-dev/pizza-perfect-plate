'use strict';
// No network, no keys, no databases: model-based tests of watchdog safety.
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcileRecovery,LAB_A,ORIGINAL,MAX_WINDOW_MS,REQUIREMENTS}=require('./recovery-contract.cjs');
const NOW=Date.parse('2026-11-23T17:00:00.000Z');
function config(extra={}){return {armed:true,guardEnabled:true,targetInstance:LAB_A,
  originalVersion:ORIGINAL,startedAtMs:NOW-14*60000,deadlineMs:NOW-60000,...extra};}
function fake(){
 const state={hostClosed:false,grantRevoked:false,originalAt100:false},calls=[];
 const adapters={
   async isHostClosed(){calls.push('read:host');return state.hostClosed;},
   async closeHost(){calls.push('write:host');state.hostClosed=true;},
   async isTemporaryLabAGrantRevoked(x){assert.equal(x.instanceId,LAB_A);calls.push('read:grant');return state.grantRevoked;},
   async revokeTemporaryLabAGrant(x){assert.equal(x.instanceId,LAB_A);calls.push('write:grant');state.grantRevoked=true;},
   async isOriginalAt100(x){assert.equal(x.originalVersion,ORIGINAL);calls.push('read:original');return state.originalAt100;},
   async restoreOriginal100(x){assert.equal(x.originalVersion,ORIGINAL);calls.push('write:original');state.originalAt100=true;}
 };
 return {state,calls,adapters};
}
test('disarmed is idle with NO callbacks',async()=>{
 const f=fake();const r=await reconcileRecovery(config({armed:false}),f.adapters,NOW);
 assert.equal(r.state,'IDLE_NOT_ARMED');assert.deepEqual(f.calls,[]);
});
test('guard disabled, wrong LAB, wrong original and invalid deadline always HOLD before effects',async()=>{
 for(const x of [{guardEnabled:false},{targetInstance:'bad'},{originalVersion:'wrong'},
  {deadlineMs:NOW-20*60000},{startedAtMs:NOW,deadlineMs:NOW-1000}]){
  const f=fake();const r=await reconcileRecovery(config(x),f.adapters,NOW);
  assert.equal(r.state,'HOLD_INVALID_OR_UNAUTHORIZED_WINDOW',JSON.stringify(x));assert.equal(f.calls.length,0);
 }
 assert.equal(MAX_WINDOW_MS,900000);
});
test('armed but deadline not due is no-op',async()=>{
 const f=fake();const r=await reconcileRecovery(config({startedAtMs:NOW,deadlineMs:NOW+600000}),f.adapters,NOW);
 assert.equal(r.state,'ARMED_NOT_DUE');assert.deepEqual(f.calls,[]);
});
test('due recovery closes host, revokes grant and restores original with verified readbacks',async()=>{
 const f=fake(),r=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(r.state,'RECOVERY_VERIFIED');assert.deepEqual(r.details,[]);
 assert.deepEqual(f.state,{hostClosed:true,grantRevoked:true,originalAt100:true});
 assert.deepEqual(f.calls.filter(s=>s.startsWith('write:')),['write:host','write:grant','write:original']);
 assert.equal(r.commercialGo,'NO_GO');assert.equal(r.authority,'NONE');
});
test('second tick is idempotent and performs zero extra writes',async()=>{
 const f=fake();await reconcileRecovery(config(),f.adapters,NOW);
 const before=f.calls.filter(s=>s.startsWith('write:')).length;
 const r=await reconcileRecovery(config(),f.adapters,NOW+60000);
 assert.equal(r.state,'RECOVERY_VERIFIED');
 assert.equal(f.calls.filter(s=>s.startsWith('write:')).length,before);
});
test('failure to revoke grants is HOLD even when original and host are safe',async()=>{
 const f=fake();f.adapters.revokeTemporaryLabAGrant=async()=>{f.calls.push('write:grant:FAILED');throw Error('lab PG offline');};
 const r=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');
 assert.ok(r.details.includes('LAB_A_GRANT_REVOKED_WRITE_FAILED'));
 assert.ok(r.details.includes('LAB_A_GRANT_REVOKED_READBACK_FAILED'));
 assert.equal(f.state.hostClosed,true);assert.equal(f.state.originalAt100,true);
 assert.equal(f.state.grantRevoked,false);
});
test('failure of Cloudflare URL closure does not suppress restore and LAB grant revocation',async()=>{
 const f=fake();f.adapters.closeHost=async()=>{throw Error('cf API unavailable')};
 const r=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');
 assert.equal(f.state.hostClosed,false);assert.equal(f.state.grantRevoked,true);assert.equal(f.state.originalAt100,true);
});
test('missing revocation adapter cannot be treated as a successful recovery',async()=>{
 const f=fake();delete f.adapters.revokeTemporaryLabAGrant;
 const r=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');
 assert.ok(r.details.includes('LAB_A_GRANT_REVOKED_ADAPTER_MISSING'));
 assert.equal(f.state.hostClosed,true);assert.equal(f.state.originalAt100,true);
});
test('retry next tick after partial failure works (no permanent D1 one-shot blocker)',async()=>{
 const f=fake();const good=f.adapters.revokeTemporaryLabAGrant;let failure=true;
 f.adapters.revokeTemporaryLabAGrant=async x=>{if(failure){failure=false;throw Error('transient SQL');}return good(x)};
 const first=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(first.state,'HOLD_RETRY_NEXT_TICK');
 const second=await reconcileRecovery(config(),f.adapters,NOW+60*1000);
 assert.equal(second.state,'RECOVERY_VERIFIED');
 assert.equal(f.state.grantRevoked,true);
 assert.equal(f.calls.filter(x=>x==='write:host').length,1);
 assert.equal(f.calls.filter(x=>x==='write:original').length,1);
});
test('only true readbacks count; apparent action success is insufficient',async()=>{
 const f=fake();f.adapters.isOriginalAt100=async()=>false;
 const r=await reconcileRecovery(config(),f.adapters,NOW);
 assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');assert.ok(r.details.includes('ORIGINAL_100_READBACK_FAILED'));
});
test('required effects are exactly closure, scoped LAB A revocation and original rollback',()=>{
 assert.deepEqual(REQUIREMENTS.map(x=>x.name),['HOST_CLOSED','LAB_A_GRANT_REVOKED','ORIGINAL_100']);
});
