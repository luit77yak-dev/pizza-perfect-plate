/** Deliberately memory-only: reload loses capability and requires assisted support. */
import type { OrderStatus } from "./types";
const tokens = new Map<string,string>();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const statuses=new Set(["RECEIVED","CONFIRMED","PREPARING","READY","OUT_FOR_DELIVERY","DELIVERED","CANCELLED"]);
export function rememberPrivateTrackingToken(instance:string,order:string,token:string):void{
 if(typeof window!=="undefined"&&UUID.test(instance)&&UUID.test(order)&&TOKEN.test(token))tokens.set(instance+":"+order,token);
}
export type TrackingState={order_id:string;status:OrderStatus;total:number};
export function validatePrivateTrackingState(value:unknown,order:string):TrackingState|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(r["order_id"]!==order||!UUID.test(order)||typeof r["status"]!=="string"||!statuses.has(r["status"])||typeof r["total"]!=="number"||!Number.isFinite(r["total"])||r["total"]<0||!Array.isArray(r["items"]))return null;
 return {order_id:order,status:r["status"] as OrderStatus,total:r["total"]};
}
export async function readPrivateTracking(instance:string,order:string):Promise<TrackingState|null>{
 if(typeof window==="undefined"||window.location.protocol!=="https:")return null;
 const token=tokens.get(instance+":"+order);if(!token)return null;
 try{
  const response=await fetch("/api/commercial/tracking",{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json","X-Neroxa-Request-Nonce":Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("")},body:JSON.stringify({order_id:order,tracking_token:token}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return null;
  return validatePrivateTrackingState(await response.json(),order);
 }catch{return null;}
}
