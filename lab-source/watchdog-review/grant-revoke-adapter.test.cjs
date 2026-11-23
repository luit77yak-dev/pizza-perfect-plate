'use strict';
// Offline DI: zero real sockets, PostgreSQL, tokens, Cloudflare or migrations.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {LAB_A,DB_ROLE,READ_SQL,REVOKE_SQL,IDENTITY_SQL,makeLabARevoker}=require('./grant-revoke-adapter.cjs');
const A='71c3d0e3-cb63-4bcd-9f85-a250b0c1ea29', B='7e020000-0000-4000-8000-000000000002';
const now=Date.parse('2026-11-23T18:00:00Z');
const start=new Date(now).toISOString(),end=new Date(now+14*60000).toISOString();
function fixture(options={}){
  const calls=[];let revoked=options.revoked===true;
  const createClient=()=>{
    const c={
      async connect(){calls.push(['connect']);if(options.connectFails)throw Error('db unreachable');},
      async query(sql,args){
        calls.push(['query',sql,args]);
        if(sql===IDENTITY_SQL)return {rows:[{actor:options.role||DB_ROLE,session_actor:options.role||DB_ROLE,db:'postgres',ssl:options.ssl!==false}]};
        if(options.throws && sql===options.throws)throw Error('db operation failed');
        if(sql===REVOKE_SQL)revoked=true;
        if(options.invalidShape)return {rows:[]};
        return {rows:[{revoked}]};
      },
      async end(){calls.push(['end']);}
    };return c;
  };
  const adapter=makeLabARevoker({createClient,grantId:A,createdAtIso:start,expiresAtIso:end});
  return {adapter,calls,get revoked(){return revoked}};
}
test('config validation denies missing client, wrong UUID and grant TTL >15 minutes',()=>{
  const f=fixture();
  assert.ok(f.adapter);
  for(const opts of [
    {createClient:()=>({}),grantId:'incorrect',createdAtIso:start,expiresAtIso:end},
    {createClient:()=>({}),grantId:A,createdAtIso:start,expiresAtIso:new Date(now+900001).toISOString()},
    {createClient:null,grantId:A,createdAtIso:start,expiresAtIso:end},
    {createClient:()=>({}),grantId:A,createdAtIso:end,expiresAtIso:start}
  ])assert.throws(()=>makeLabARevoker(opts),/NOT_ADMITTED/);
});
test('LAB B and missing instance denied before even opening a connection',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.adapter.isTemporaryLabAGrantRevoked({instanceId:B}),/LAB_A_ONLY/);
  await assert.rejects(()=>f.adapter.revokeTemporaryLabAGrant({}),/LAB_A_ONLY/);
  assert.deepEqual(f.calls,[]);
});
test('read returns false for valid unrevoked grant; does not use raw table SELECT',async()=>{
  const f=fixture();
  assert.equal(await f.adapter.isTemporaryLabAGrantRevoked({instanceId:LAB_A}),false);
  const queries=f.calls.filter(c=>c[0]==='query');
  assert.deepEqual(queries.map(c=>c[1]),[IDENTITY_SQL,READ_SQL]);
  assert.deepEqual(queries[1][2],[A,end]);assert.deepEqual(f.calls.at(-1),['end']);
});
test('revoke uses private RPC and idempotent readback true',async()=>{
  const f=fixture();
  assert.equal(await f.adapter.revokeTemporaryLabAGrant({instanceId:LAB_A}),true);
  assert.equal(await f.adapter.isTemporaryLabAGrantRevoked({instanceId:LAB_A}),true);
  assert.equal(f.calls.filter(x=>x[1]===REVOKE_SQL).length,1);
  assert.equal(f.calls.filter(x=>x[0]==='end').length,2);
});
test('wrong database role or missing TLS fails before revocation',async()=>{
  for(const options of [{role:'postgres'},{ssl:false}]){
    const f=fixture(options);
    await assert.rejects(()=>f.adapter.revokeTemporaryLabAGrant({instanceId:LAB_A}),/IDENTITY_OR_TLS_DENIED/);
    assert.equal(f.calls.filter(x=>x[1]===REVOKE_SQL).length,0);
  }
});
test('failed connect, query and malformed output must fail closed without leaking SQL params',async()=>{
  for(const options of [{connectFails:true},{throws:REVOKE_SQL},{invalidShape:true}]){
    const f=fixture(options);
    await assert.rejects(()=>f.adapter.revokeTemporaryLabAGrant({instanceId:LAB_A}));
    assert.equal(f.revoked,options.invalidShape===true);
  }
});
test('SQL template is REVIEW ONLY with same LAB A and revoked_at IS NOT NULL readback',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'sql','REVIEW_ONLY_lab_a_grant_revocation.sql'),'utf8');
  assert.match(sql,/NOT APPLIED/);
  assert.match(sql,/private\.neroxa_i04_watchdog_lab_a_revoke_grant/);
  assert.match(sql,/private\.neroxa_i04_watchdog_lab_a_grant_revoked/);
  assert.match(sql,/g\.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid/g);
  assert.match(sql,/g\.expires_at <= g\.created_at \+ interval '15 minutes'/g);
  assert.match(sql,/g\.revoked_at IS NOT NULL/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/SET search_path = ''/);
  assert.match(sql,/FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql,/LOGIN NOINHERIT PASSWORD NULL/);
  assert.match(sql,/REVOKE ALL ON FUNCTION/);
  assert.doesNotMatch(sql,/GRANT (SELECT|UPDATE|INSERT|DELETE) ON (TABLE )?private\.neroxa_lab_operator_grants/i);
});
test('review adapter has only immutable private RPC names and no service role or raw DML',()=>{
  assert.match(READ_SQL,/^SELECT private\./);assert.match(REVOKE_SQL,/^SELECT private\./);
  for(const sql of [READ_SQL,REVOKE_SQL])assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
  assert.equal(DB_ROLE,'neroxa_i04_lab_watchdog_revoke');
});
