import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handlePreparedCommercialCheckout } from "../src/server/commercial-checkout.server.ts";
const domain="review.example.com";
const instance="b0000000-0000-4000-8000-000000000001";
const org="a0000000-0000-4000-8000-000000000001";
const order="d0000000-0000-4000-8000-000000000001";
const payload={instance_id:instance,organization_id:org,store_domain:domain,idempotency_key:"c0000000-0000-4000-8000-000000000001",client_cart_reference:"a".repeat(64),customer_name:"Cliente de teste",customer_phone:"00000000001",fulfillment:"PICKUP",payment_method:"CASH",expected_total:31.5,items:[{product_id:"e0000000-0000-4000-8000-000000000001",selection_contract:"GROUP_ADDONS_V1",quantity:1,expected_unit_price:31.5,group_addon_ids:[],size_id:null,crust_id:null,notes:null}]};
function req(p=payload){return new Request("https://"+domain+"/api/commercial/checkout",{method:"POST",headers:{origin:"https://"+domain,"content-type":"application/json"},body:JSON.stringify({p_order:p})});}
function fixture(options={}){
 const calls=[];let opened=0,released=0,checks=0;
 const ports={allowedDomains:[domain],quotaSecret:"test-only-".repeat(5),assertAdmission(){checks++;if(options.denied)throw Error("admission");},
 async connect(){opened++;return {async query(sql,args){calls.push({sql,args});
 if(sql.includes("neroxa_go02_checkout_contract"))return {rows:[{contract:options.contract??"GO02_COMMERCIAL_CHECKOUT_V1"}]};
 if(sql.includes("get_public_storefront_context"))return {rows:[{domain,instance_id:instance,organization_id:org}]};
 if(sql.includes("neroxa_checkout_reserve_quota"))return {rows:[{reserved:options.quota??true}]};
 if(sql.includes("neroxa_commercial_checkout_atomic")){if(options.error)throw Object.assign(Error("internal"),{code:options.error});return {rows:[{order_id:order,order_number:"3",total:"31.50",capabilities_issued:options.issued??true}]};}
 throw Error("unexpected SQL");},release(){released++;}};}};
 return {ports,calls,stats:()=>({opened,released,checks})};
}
const sha=v=>createHash("sha256").update(v).digest("hex");
const writes=f=>f.calls.filter(x=>x.sql.includes("neroxa_commercial_checkout_atomic"));
test("real gateway plus commercial adapter binds context, quota and atomic checkout",async()=>{
 const f=fixture();const r=await handlePreparedCommercialCheckout(req(),f.ports);assert.equal(r.status,200);
 const v=await r.json();assert.equal(v.order_id,order);assert.equal(v.order_number,3);assert.equal(v.total,31.5);
 assert.match(v.tracking_token,/^[A-Za-z0-9_-]{43}$/);assert.match(v.amendment_token,/^[A-Za-z0-9_-]{43}$/);
 const w=writes(f);assert.equal(w.length,1);assert.deepEqual(JSON.parse(w[0].args[0]),payload);
 assert.equal(w[0].args[1],sha(v.tracking_token));assert.equal(w[0].args[2],sha(v.amendment_token));assert.notEqual(w[0].args[1],w[0].args[2]);
 assert.equal(f.stats().opened,f.stats().released);assert.ok(f.stats().checks>0);assert.equal(r.headers.get("cache-control"),"no-store");
});
test("idempotent replay never issues invented replacement capabilities",async()=>{const f=fixture({issued:false});const r=await handlePreparedCommercialCheckout(req(),f.ports);assert.equal(r.status,200);const v=await r.json();assert.equal(v.order_id,order);assert.equal(v.tracking_token,undefined);assert.equal(v.amendment_token,undefined);});
test("explicit quota rejection returns 429 and does not create",async()=>{const f=fixture({quota:false});const r=await handlePreparedCommercialCheckout(req(),f.ports);assert.equal(r.status,429);assert.equal(writes(f).length,0);});
test("missing admission does not connect",async()=>{const f=fixture({denied:true});assert.equal((await handlePreparedCommercialCheckout(req(),f.ports)).status,503);assert.equal(f.stats().opened,0);});
test("wrong SQL contract stops before any privileged operation",async()=>{const f=fixture({contract:"wrong"});assert.equal((await handlePreparedCommercialCheckout(req(),f.ports)).status,503);assert.equal(f.calls.length,1);assert.equal(f.stats().opened,f.stats().released);});
test("other tenant and non-grouped legacy input rejected before writes",async()=>{for(const p of [{...payload,instance_id:"b0000000-0000-4000-8000-000000000002"},{...payload,items:[{product_id:payload.items[0].product_id,quantity:1}]},{...payload,client_cart_reference:"bad"}]){const f=fixture();assert.ok([400,403].includes((await handlePreparedCommercialCheckout(req(p),f.ports)).status));assert.equal(writes(f).length,0);}});
test("price change, closed shop, expired intent and database failure mapped",async()=>{for(const [error,expected] of [["PT409",409],["PT423",423],["PT410",410],["XX000",503]]){const f=fixture({error});const r=await handlePreparedCommercialCheckout(req(),f.ports);assert.equal(r.status,expected);assert.doesNotMatch(await r.text(),/internal/);assert.equal(f.stats().opened,f.stats().released);}});
