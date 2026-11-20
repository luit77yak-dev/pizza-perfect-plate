import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrivateTrackingRequest} from '../src/server/private-tracking.ts';
import {issueTrackingOnce} from '../src/server/tracking-issuance.ts';
const order='91000000-0000-4000-8000-000000000103';
const instance='91000000-0000-4000-8000-000000000100';
const token='a'.repeat(43);
function req(headers={},body={order_id:order},url='https://a.synthetic.invalid/api/order-track') {
 return new Request(url,{method:'POST',headers:{Origin:'https://a.synthetic.invalid','Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(body)});
}
function deps(overrides={}) {return {enabled:true,canonicalDomains:['a.synthetic.invalid'],reserveIngress:async()=>true,resolveContext:async(domain)=>({domain,instance_id:instance}),track:async()=>({order_id:order,status:'RECEIVED',total:30,customer_phone:'NEVER-RETURN',items:[{name:'Synthetic pizza',quantity:1,line_total:30,address:'NEVER-RETURN'}]}),...overrides};}
test('HTTP contract unit: allowlist strips added PII and forbids caching',async()=>{
 const r=await handlePrivateTrackingRequest(req(),deps());assert.equal(r.status,200);const text=await r.text();assert(!text.includes('NEVER-RETURN'));assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('set-cookie'),null);
});
for(const [name,headers,body,url] of [
 ['no token',{Authorization:''}],['bad token',{Authorization:'Bearer no'}],['spoof proxy',{'X-Forwarded-Host':'b.synthetic.invalid'}],['foreign origin',{Origin:'https://b.synthetic.invalid'}],['wrong host',{Host:'b.synthetic.invalid'}],['instance tamper',{}, {order_id:order,instance_id:instance}],['URL token',{},undefined,'https://a.synthetic.invalid/api/order-track?token=secret']]) {
 test('HTTP contract unit: reject '+name,async()=>{let touched=0;const r=await handlePrivateTrackingRequest(req(headers,body,url),deps({track:async()=>{touched++;throw Error();}}));assert.equal(r.status,403);assert.equal(touched,0);assert.deepEqual(await r.json(),{error:'Acompanhamento indisponível.'});});
}
test('HTTP contract unit: ingress quota precedes any DB lookup',async()=>{let touched=0;const r=await handlePrivateTrackingRequest(req(),deps({reserveIngress:async()=>false,resolveContext:async()=>{touched++;return null;}}));assert.equal(r.status,429);assert.equal(touched,0);});
test('HTTP contract unit: foreign result order is denied',async()=>{const r=await handlePrivateTrackingRequest(req(),deps({track:async()=>({order_id:instance,status:'RECEIVED',total:30,items:[]})}));assert.equal(r.status,403);});
test('issuance unit: concurrent retries disclose one CSPRNG secret only',async()=>{
 let registered=false;const hashes=[];
 const register=async(hash)=>{hashes.push(hash);if(registered)return false;registered=true;return true;};
 const results=await Promise.all(Array.from({length:8},()=>issueTrackingOnce(register)));
 assert.equal(results.filter(Boolean).length,1);assert.match(results.find(Boolean),/^[A-Za-z0-9_-]{43}$/);assert.equal(new Set(hashes).size,8);assert(!hashes.includes(results.find(Boolean)));
});
