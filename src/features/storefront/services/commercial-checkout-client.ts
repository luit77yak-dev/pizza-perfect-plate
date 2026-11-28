// Private checkout: preserve random intent IDs and payload digest, not customer details or capabilities.
type Row=Record<string,unknown>;
type Marker={key:string;reference:string;digest:string};
type StoragePort=Pick<Storage,"getItem"|"setItem"|"removeItem">;
type LockPort={request<T>(name:string,callback:()=>Promise<T>):Promise<T>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,"0")).join("");
const object=(v:unknown):v is Row=>!!v&&typeof v==="object"&&!Array.isArray(v);
export type CheckoutReceipt={order_id:string;order_number:number;total:number;tracking_token:string;amendment_token:string};
export async function submitCommercialCheckout({payload,origin,storage,locks,fetcher=fetch,accept}:{
 payload:Row;origin:string;storage:StoragePort;locks:LockPort;fetcher?:typeof fetch;accept:(receipt:CheckoutReceipt)=>void|Promise<void>;
}){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.origin!==origin||url.hostname==="localhost"||/\.(workers\.dev|lovable\.app|lovableproject\.com|vercel\.app|invalid)$/.test(url.hostname)||payload["store_domain"]!==url.hostname||!UUID.test(String(payload["instance_id"]))||!UUID.test(String(payload["organization_id"]))||"idempotency_key" in payload||"client_cart_reference" in payload)throw Error("Origem ou pedido inválido.");
 if(!locks||typeof locks.request!=="function")throw Error("Navegador não oferece proteção contra envio simultâneo.");
 const slot="ppp:commercial-intent:"+String(payload["instance_id"]);
 return locks.request(slot,async()=>{
  const saved=storage.getItem(slot);
  let marker:Marker;
  if(saved!==null){
   const m:unknown=JSON.parse(saved);
   if(!object(m)||typeof m["key"]!=="string"||!UUID.test(m["key"])||typeof m["reference"]!=="string"||!HEX.test(m["reference"])||typeof m["digest"]!=="string"||!HEX.test(m["digest"]))throw Error("Tentativa anterior precisa de reconciliação pela loja.");
   if(m["confirmed"]===true)throw Error("Pedido anterior confirmado. Inicie uma nova sessão de compra autorizada.");
   marker={key:m["key"],reference:m["reference"],digest:m["digest"]};
  }else marker={key:crypto.randomUUID(),reference:nonce(),digest:""};
  const body=JSON.stringify({p_order:{...payload,idempotency_key:marker.key,client_cart_reference:marker.reference}});
  const fingerprint=await digest(body);
  if(saved!==null&&marker.digest!==fingerprint)throw Error("Pedido anterior sem confirmação. Preserve os dados ou solicite reconciliação à loja.");
  marker.digest=fingerprint;
  const encoded=JSON.stringify(marker);
  storage.setItem(slot,encoded);
  if(storage.getItem(slot)!==encoded)throw Error("Não foi possível preservar a tentativa.");
  let response:Response;
  try{response=await fetcher(new URL("/api/commercial/checkout",url),{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json","X-Neroxa-Request-Nonce":nonce()},body,signal:AbortSignal.timeout(20000)});}catch{throw Error("Confirmação incerta. Preserve o carrinho e os dados originais ou solicite reconciliação à loja.");}
  if(!response.ok)throw Error("Pedido não confirmado. Preserve a tentativa original e solicite reconciliação à loja.");
  const r:unknown=await response.json().catch(()=>null);
  if(!object(r)||typeof r["order_id"]!=="string"||!UUID.test(r["order_id"])||typeof r["order_number"]!=="number"||!Number.isSafeInteger(r["order_number"])||r["order_number"]<1||typeof r["total"]!=="number"||!Number.isFinite(r["total"])||r["total"]!==payload["expected_total"]||typeof r["tracking_token"]!=="string"||!TOKEN.test(r["tracking_token"])||typeof r["amendment_token"]!=="string"||!TOKEN.test(r["amendment_token"])||r["tracking_token"]===r["amendment_token"])throw Error("Pedido pode já existir. Confirmação ou capacidade ausente; solicite reconciliação à loja.");
  await accept({order_id:r["order_id"],order_number:r["order_number"],total:r["total"],tracking_token:r["tracking_token"],amendment_token:r["amendment_token"]});
  // Keep the intent on disk even after a confirmed result until a separate
  // explicit new-order lifecycle clears it; prevents queued-tab double purchase.
  storage.setItem(slot,JSON.stringify({...marker,confirmed:true}));
 });
}
