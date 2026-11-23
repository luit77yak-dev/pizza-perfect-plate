'use strict';
// No sockets / secrets / actual HTTP; a finite synthetic Worker is injected.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'browser-negative-harness.js'),'utf8');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ACTIVE='A'.repeat(43), REVOKED='R'.repeat(43);
const hostname='isolated-test.workers.dev';
function setup() {
  const scope={}; vm.runInNewContext(source,{globalThis:scope, Uint8Array, Array, Date, JSON, Promise, Error, Object}, {timeout:1500});
  return scope.neroxaLabSecurityHTTP;
}
const cfg={execute:true,approval:'LAB-SECURITY-HTTP-APPROVED',expectedHost:hostname,
  instanceA:A,instanceB:B,approvedUntil:new Date(Date.now()+4*60*1000).toISOString()};
function mock(overrides={}) {
  const requests=[];let seed=0;
  const used=new Set();
  const io={location:{protocol:'https:',hostname,origin:'https://'+hostname}, now:()=>Date.now(),
    crypto:{getRandomValues(arr){arr.fill(++seed); return arr;}},
    confirm:()=>true,readSecret:async label=>label.startsWith('ACTIVE')?ACTIVE:REVOKED,
    async fetch(url,opt){
      requests.push({url,method:opt.method,redirect:opt.redirect,credentials:opt.credentials,
        nonce:opt.headers['x-neroxa-lab-nonce'],auth:opt.headers.authorization});
      const path=new URL(url).pathname;
      const body=JSON.parse(opt.body);
      let status,result;
      if(path==='/__neroxa_lab/order-list'){
        if(!opt.headers.authorization){status=401;result={error:'Operational authorization required'};}
        else if(opt.headers.authorization==='Bearer '+REVOKED){status=403;result={error:'LAB operation denied or unavailable',sqlstate:'42501'};}
        else if(body.instance_id===B){status=403;result={error:'LAB instance denied'};}
        else {status=200;result={lab:true,orders:[]};}
      } else if(path==='/__neroxa_lab/catalog'){
        const nonce=opt.headers['x-neroxa-lab-nonce'];
        if(used.has(nonce)){status=409;result={error:'LAB nonce already consumed'};}
        else {used.add(nonce);status=200;result={lab:true,catalog:[]};}
      } else throw Error('Unexpected test endpoint');
      if(overrides.response)({status,result}=overrides.response({status,result,path}) || {status,result});
      return {status,redirected:false,type:'basic',headers:{get(n){return n==='content-type'?'application/json':n==='x-content-type-options'?'nosniff':null;}},json:async()=>result};
    }
  };return {io,requests};
}

test('on load and dry-run: no network and no operational input',async()=>{
  const run=setup();let calls=0;
  const r=await run({}, {fetch:()=>{calls++}});
  assert.equal(r.state,'DRY_RUN');assert.equal(r.cases.length,6);assert.equal(calls,0);
});
test('rejects missing approval without any HTTP or secret reads',async()=>{
  const run=setup();const {io,requests}=mock();let reads=0;io.readSecret=()=>{reads++;return ACTIVE};
  await assert.rejects(()=>run({...cfg,approval:'wrong'},io),/approval gate/);
  assert.equal(requests.length,0);assert.equal(reads,0);
});
test('rejects host mismatch, invalid A/B UUID and oversized approval window',async()=>{
  const run=setup(),{io,requests}=mock();
  for(const c of [{...cfg,expectedHost:'elsewhere.workers.dev'}, {...cfg,instanceB:A}, {...cfg,approvedUntil:new Date(Date.now()+20*60*1000).toISOString()}])
    await assert.rejects(()=>run(c,io));
  assert.equal(requests.length,0);
});
test('rejects missing, same or badly shaped operator grants before HTTP',async()=>{
  const run=setup(),{io,requests}=mock();
  io.readSecret=async()=>ACTIVE;
  await assert.rejects(()=>run(cfg,io),/distinct and well-formed/);
  assert.equal(requests.length,0);
});
test('six bounded calls: negative tests require correct Worker JSON markers and fresh nonces',async()=>{
  const run=setup(),{io,requests}=mock();
  const r=await run(cfg,io);
  assert.equal(r.state,'HTTP_NEGATIVES_PASS_WITH_LIMITS');
  assert.equal(r.jwtInvalid,'NOT_RUN_SEPARATE_GATED_TEST');
  assert.deepEqual(Array.from(r.cases,x=>x.http_status),[200,403,403,401,200,409]);
  assert.equal(requests.length,6);
  assert.ok(requests.every(x=>x.url.startsWith('https://'+hostname+'/__neroxa_lab/')&&x.redirect==='manual'&&x.method==='POST'&&x.credentials==='same-origin'));
  assert.equal(new Set(requests.map(x=>x.nonce)).size,5);
  assert.equal(requests[4].nonce,requests[5].nonce);
  assert.equal(requests[0].auth,'Bearer '+ACTIVE);
  assert.equal(requests[1].auth,'Bearer '+ACTIVE);
  assert.equal(requests[2].auth,'Bearer '+REVOKED);
  assert.equal(requests[3].auth,undefined);
  assert.ok(!JSON.stringify(r).includes(ACTIVE));assert.ok(!JSON.stringify(r).includes(REVOKED));
});
test('arbitrary 403/401/HTML cannot be mistaken for Worker negative',async()=>{
  const run=setup();
  const r1=mock({response({status,result,path}){return path.endsWith('order-list')?{status:403,result:{error:'Cloudflare Access denied'}}:{status,result};}});
  await assert.rejects(()=>run(cfg,r1.io),/INCONCLUSIVE\/FAIL/);
  assert.equal(r1.requests.length,1);
});
test('window expiration aborts before request, not a false PASS',async()=>{
  const run=setup(),{io,requests}=mock();io.now=()=>Date.now()+5*60*1000;
  await assert.rejects(()=>run(cfg,io),/window/);assert.equal(requests.length,0);
});
