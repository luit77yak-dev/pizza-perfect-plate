'use strict';
// Offline security boundaries, not a Cloudflare/production test. No real JWT or credentials.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {generateKeyPairSync,createSign,webcrypto}=require('node:crypto');
const ts=require(process.env.NEROXA_TYPESCRIPT_PATH||'typescript');
const root=process.env.NEROXA_LAB_WORKER_DIR;
if(!root)throw Error('Set NEROXA_LAB_WORKER_DIR to extracted archive lab-source/worker');
const jwt=fs.readFileSync(path.join(root,'access-jwt.ts'),'utf8');
const lifecycle=fs.readFileSync(path.join(root,'order-lifecycle.ts'),'utf8');
function constant(name){const m=jwt.match(new RegExp('const '+name+"='([^']+)';"));assert.ok(m);return m[1];}
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const key={...publicKey.export({format:'jwk'}),kid:'ephemeral-test-key',kty:'RSA'};
function moduleFrom(source,file,imports={}){
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,crypto:webcrypto,Uint8Array,TextDecoder,TextEncoder,atob,Date,Object,Number,JSON,Error,Promise,require(n){if(!(n in imports))throw Error('Unexpected import');return imports[n];}},{filename:file});
 return module.exports;
}
const {verifyAccess}=moduleFrom(jwt,'access-jwt.ts',{'./access-keys.ts':{PINNED_ACCESS_KEYS:[key]}});
const ops=moduleFrom(lifecycle,'order-lifecycle.ts');
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function signed(claims={},head={}){
 const now=Math.floor(Date.now()/1000);
 const text=b64({alg:'RS256',kid:key.kid,...head})+'.'+b64({iss:constant('ISSUER'),aud:constant('AUDIENCE'),exp:now+300,nbf:now-10,sub:'synthetic',...claims});
 return text+'.'+createSign('RSA-SHA256').update(text).end().sign(privateKey).toString('base64url');
}
const denies=(tok,re)=>assert.rejects(()=>verifyAccess(tok),e=>re.test(String(e.message)));
test('positive control: ephemeral signed JWT passes',async()=>assert.equal((await verifyAccess(signed())).subject,'synthetic'));
test('missing/malformed JWT denied',async()=>{await denies(null,/required/);await denies('bad',/malformed/);});
test('tampered payload denied',async()=>{const p=signed().split('.');const claims=JSON.parse(Buffer.from(p[1],'base64url').toString());claims.sub='tampered';p[1]=b64(claims);await denies(p.join('.'),/signature denied/);});
test('expired and future nbf denied',async()=>{await denies(signed({exp:1}),/lifetime/);await denies(signed({nbf:Math.floor(Date.now()/1000)+600}),/lifetime/);});
test('wrong issuer/audience denied',async()=>{await denies(signed({iss:'wrong'}),/issuer/);await denies(signed({aud:'wrong'}),/audience/);});
test('untrusted key / algorithm denied',async()=>{await denies(signed({},{kid:'unknown'}),/key not found/);await denies(signed({},{alg:'none'}),/algorithm/);});
test('43-character bearer only',()=>{assert.equal(ops.operatorBearer('Bearer '+'A'.repeat(43)),'A'.repeat(43));for(const s of [null,'Bearer '+'A'.repeat(42),'Bearer '+'A'.repeat(44),'bearer '+'A'.repeat(43)])assert.throws(()=>ops.operatorBearer(s));});
test('reject invalid transition shape',()=>{const p={instance_id:'7e020000-0000-4000-8000-000000000001',order_id:'c91642dc-4181-4632-90fa-e1a2305eef77',operation_id:'7190c486-8232-4caf-831c-4054cc2b6df4',expected_status:'READY',next_status:'DELIVERED'};assert.equal(ops.parseTransition(p).next_status,'DELIVERED');assert.throws(()=>ops.parseTransition({...p,order_id:'wrong'}));assert.throws(()=>ops.parseTransition({...p,next_status:'INVALID'}));});
test('unauthorized SQL errors return 403',()=>{assert.equal(ops.lifecycleHttpStatus('42501'),403);assert.equal(ops.lifecycleHttpStatus('PT409'),409);assert.equal(ops.lifecycleHttpStatus('22023'),422);});
test('Worker requires origin, deadline, nonce and closes public checkout (static)',()=>{const c=fs.readFileSync(path.join(root,'worker-order-ui-entry.ts'),'utf8');for(const x of ['public.neroxa_claim_cloudflare_grant',"request.headers.get('origin')!==url.origin",'Date.now()>=deadline',"request.headers.get('x-neroxa-lab-nonce')","url.pathname==='/api/checkout'"])assert.ok(c.includes(x),x);});
