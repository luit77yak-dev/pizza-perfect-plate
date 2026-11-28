import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateOrderTransport } from "../src/features/admin/private-order-transport.ts";
const instance = "12345678-1234-4123-8123-123456789abc";
const other = "12345678-1234-4123-8123-123456789abd";
const order = "22345678-1234-4123-8123-123456789abc";
const host = "https://review.example.com";
const fixture = (instance_id=instance, status="RECEIVED") => ({id:order,instance_id,status});
function mock(payload, status=200, origin=host, token="test-token") {
  const calls=[];
  const api=createPrivateOrderTransport({origin:()=>origin,getToken:async()=>token,fetcher:async(url,opts)=>{
    calls.push({url:String(url),...opts});
    return Response.json(payload,{status});
  }});
  return {api,calls};
}
test("catalog context same origin, no bearer",async()=>{
 const {api,calls}=mock({catalog:{selection_contract:"GROUP_ADDONS_V1",context:{domain:"review.example.com",instance_id:instance,instance_name:"A"}}});
 assert.equal((await api.context()).instance_id,instance);
 assert.equal(calls[0].url,host+"/api/commercial/catalog");
 assert.equal(calls[0].headers.Authorization,undefined);
 assert.match(calls[0].headers["X-Neroxa-Request-Nonce"],/^[a-f0-9]{64}$/);
});
test("wrong tenant catalog rejected",async()=>{const {api}=mock({catalog:{selection_contract:"GROUP_ADDONS_V1",context:{domain:"other.example.com",instance_id:instance,instance_name:"A"}}});await assert.rejects(api.context());});
test("list authenticates and scopes",async()=>{const {api,calls}=mock({orders:[fixture()],truncated:false});assert.equal((await api.list(instance,null)).orders.length,1);assert.equal(calls[0].headers.Authorization,"Bearer test-token");assert.deepEqual(JSON.parse(calls[0].body),{instance_id:instance,status:null});assert.equal(calls[0].redirect,"error");});
test("cross-store list rejected",async()=>{const {api}=mock({orders:[fixture(other)],truncated:false});await assert.rejects(api.list(instance,null));});
test("list filter mismatch rejected",async()=>{const {api}=mock({orders:[fixture()],truncated:false});await assert.rejects(api.list(instance,"DELIVERED"));});
test("transition sends once and validates response",async()=>{const {api,calls}=mock({order:fixture(instance,"CONFIRMED")});await api.transition(instance,order,"CONFIRMED");assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].body),{instance_id:instance,order_id:order,status:"CONFIRMED",note:null});});
test("unknown response never retried",async()=>{const {api,calls}=mock({},503);await assert.rejects(api.transition(instance,order,"CONFIRMED"));assert.equal(calls.length,1);});
test("cross-store transition and detail rejected",async()=>{await assert.rejects(mock({order:fixture(other,"CONFIRMED")}).api.transition(instance,order,"CONFIRMED"));await assert.rejects(mock({detail:{order:fixture(other)}}).api.detail(instance,order));});
test("no session, insecure origin and preview denied before fetch",async()=>{for(const [origin,token] of [[host,""],["http://review.example.com","x"],["https://probe.workers.dev","x"]]){const {api,calls}=mock({},200,origin,token);await assert.rejects(api.list(instance,null));assert.equal(calls.length,0);}});
test("fresh nonce per operation",async()=>{const {api,calls}=mock({orders:[],truncated:false});await api.list(instance,null);await api.list(instance,null);assert.notEqual(calls[0].headers["X-Neroxa-Request-Nonce"],calls[1].headers["X-Neroxa-Request-Nonce"]);});
