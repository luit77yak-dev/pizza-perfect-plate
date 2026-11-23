'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeWatchdogScheduledPreview}=require('./watchdog-wiring-preview.cjs');
const {IDENTITY_SQL,READ_SQL,REVOKE_SQL,DB_ROLE}=require('./grant-revoke-adapter.cjs');
const NOW=Date.parse('2026-11-23T18:20:00Z');
const start=new Date(NOW-14*60000).toISOString(),end=new Date(NOW+60000).toISOString();
const UUID='9f01c4c9-e003-4e30-96a6-e8e9748a88fa';
const due=NOW+120000;
function vars(extra={}){
  return {I04_WATCHDOG_ARMED:'true',I04_GUARD_ENABLED:'true',
    I04_WATCHDOG_WINDOW_STARTED_ISO:start,I04_WATCHDOG_DEADLINE_ISO:end,
    I04_TEMP_GRANT_ID:UUID,I04_TEMP_GRANT_EXPIRES_AT_ISO:end,...extra};
}
function harness(opts={}){
  const state={hostClosed:false,grantRevoked:false,original:false},calls=[];
  let revokeFailures=opts.revokeFailures||0;
  const cloudflarePort={
    async isHostClosed(){calls.push('cf:read-host');return state.hostClosed;},
    async closeHost(){calls.push('cf:close');state.hostClosed=true;},
    async isOriginalAt100(){calls.push('cf:read-original');return state.original;},
    async restoreOriginal100(){calls.push('cf:restore');state.original=true;}
  };
  const createDbClient=()=>({
    async connect(){calls.push('db:connect');},
    async query(sql,params){
      if(sql===IDENTITY_SQL){calls.push('db:identity');return {rows:[{actor:opts.dbRole||DB_ROLE,session_actor:opts.dbRole||DB_ROLE,db:'postgres',ssl:true}]};}
      if(sql===READ_SQL){calls.push('db:read');assert.deepEqual(params,[UUID,end]);return {rows:[{revoked:state.grantRevoked}]};}
      if(sql===REVOKE_SQL){
        calls.push('db:revoke');assert.deepEqual(params,[UUID,end]);
        if(revokeFailures>0){revokeFailures--;throw Error('simulated private SQL outage');}
        state.grantRevoked=true;return {rows:[{revoked:true}]};
      }
      throw Error('UNEXPECTED_SQL');
    },
    async end(){calls.push('db:end');}
  });
  return {state,calls,run:makeWatchdogScheduledPreview({createDbClient,cloudflarePort})};
}
test('disarmed watchdog returns IDLE and does no I/O',async()=>{
  const h=harness();const r=await h.run(vars({I04_WATCHDOG_ARMED:'false'}),due);
  assert.equal(r.state,'IDLE_NOT_ARMED');assert.deepEqual(h.calls,[]);
});
test('armed but not due performs no DB or CF work',async()=>{
  const h=harness(),r=await h.run(vars(),NOW);
  assert.equal(r.state,'ARMED_NOT_DUE');assert.deepEqual(h.calls,[]);
});
test('due three-sided recovery succeeds with exact private SQL funcs and readback',async()=>{
  const h=harness(),r=await h.run(vars(),due);
  assert.equal(r.state,'RECOVERY_VERIFIED');assert.equal(r.authority,'NONE');
  assert.deepEqual(h.state,{hostClosed:true,grantRevoked:true,original:true});
  assert.equal(h.calls.filter(x=>x==='cf:close').length,1);
  assert.equal(h.calls.filter(x=>x==='db:revoke').length,1);
  assert.equal(h.calls.filter(x=>x==='cf:restore').length,1);
  assert.ok(!JSON.stringify(r).includes(UUID));
});
test('next tick does not repeat confirmed recovery writes',async()=>{
  const h=harness();await h.run(vars(),due);
  const previous=h.calls.filter(x=>x.includes('revoke')||x.includes('restore')||x.includes('cf:close')).length;
  const r=await h.run(vars(),due+60000);
  assert.equal(r.state,'RECOVERY_VERIFIED');
  assert.equal(h.calls.filter(x=>x.includes('revoke')||x.includes('restore')||x.includes('cf:close')).length,previous);
});
test('no grant ID: close host and restore original but never label full recovery',async()=>{
  const h=harness(),r=await h.run(vars({I04_TEMP_GRANT_ID:'NOT_CONFIGURED'}),due);
  assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');
  assert.ok(r.details.includes('LAB_A_GRANT_REVOKED_ADAPTER_MISSING'));
  assert.equal(h.state.hostClosed,true);assert.equal(h.state.original,true);
  assert.equal(h.state.grantRevoked,false);
});
test('SQL transient error: first tick HOLD, second tick retries and completes',async()=>{
  const h=harness({revokeFailures:1});
  assert.equal((await h.run(vars(),due)).state,'HOLD_RETRY_NEXT_TICK');
  assert.equal(h.state.hostClosed,true);assert.equal(h.state.original,true);
  assert.equal((await h.run(vars(),due+60000)).state,'RECOVERY_VERIFIED');
  assert.equal(h.state.grantRevoked,true);
  assert.equal(h.calls.filter(x=>x==='cf:restore').length,1);
});
test('wrong DB identity denies revocation; host still closes and original restores',async()=>{
  const h=harness({dbRole:'postgres'}),r=await h.run(vars(),due);
  assert.equal(r.state,'HOLD_RETRY_NEXT_TICK');
  assert.equal(h.state.hostClosed,true);assert.equal(h.state.original,true);
  assert.equal(h.state.grantRevoked,false);
});
test('mismatched grant expiry and over-15-minute window reject without I/O',async()=>{
  for(const cfg of [
    vars({I04_TEMP_GRANT_EXPIRES_AT_ISO:new Date(NOW).toISOString()}),
    vars({I04_WATCHDOG_WINDOW_STARTED_ISO:new Date(NOW-20*60000).toISOString()})
  ]){
    const h=harness(),r=await h.run(cfg,due);
    assert.equal(r.state,'HOLD_INVALID_OR_UNAUTHORIZED_WINDOW');assert.deepEqual(h.calls,[]);
  }
});
test('disabled guard denies all effects, even when watchdog armed and due',async()=>{
  const h=harness(),r=await h.run(vars({I04_GUARD_ENABLED:'false'}),due);
  assert.equal(r.state,'HOLD_INVALID_OR_UNAUTHORIZED_WINDOW');assert.deepEqual(h.calls,[]);
});
