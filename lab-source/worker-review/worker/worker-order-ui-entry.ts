// REVIEW SNAPSHOT: host/project/DB role are non-operational placeholders.
// Not deployable; requires protected re-composition and independent gates.
import foodSsr from './index.mjs';
// Temporary LAB-only API. Original immutable version/modules/assets remain the rollback.
// Production/Master release gates and the public checkout source are unchanged.
import {Client} from 'pg';
import {commercialHyperdrivePorts} from '../../go03r/food/src/server/commercial-hyperdrive.server.ts';
import {handlePreparedCommercialCheckout} from '../../go03r/food/src/server/commercial-checkout.server.ts';
import {verifyAccess} from './access-jwt.ts';
import {parseTransition,operatorBearer,lifecycleHttpStatus} from './order-lifecycle.ts';
const HOST='unconfigured.invalid';
const PROJECT='NOT_CONFIGURED';
const ROLE='NOT_CONFIGURED';
// Missing/invalid deadline fails closed. The future authorized version must set it.
const ROUTES=['/__neroxa_lab/order-state','/__neroxa_lab/order-transition','/__neroxa_lab/order-list','/__neroxa_lab/checkout','/__neroxa_lab/catalog'];
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
type Env={HYPERDRIVE:{connectionString:string};ASSETS?:{fetch(request:Request):Promise<Response>};WORKER_VERSION:{id:string};LAB_LIFECYCLE_DEADLINE:string;LAB_QUOTA_SECRET:string;[k:string]:unknown};
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function connect(env:Env){
 const c=new Client({connectionString:env.HYPERDRIVE.connectionString,connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000,application_name:'neroxa-lab-e2e-01'});
 try{await c.connect();const r=await c.query("SELECT current_user AS actor,session_user AS session_actor,current_database() AS db,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl");const x=r.rows[0];if(r.rows.length!==1||x.actor!==ROLE||x.session_actor!==ROLE||x.db!=='postgres'||x.ssl!==true)throw Error(x.ssl!==true?'LAB_DB_SSL_REQUIRED':'LAB_DB_IDENTITY_DENIED');return c;}catch(e){await c.end().catch(()=>{});throw e;}
}
async function body(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('Body required');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>8192){await reader.cancel();throw Error('Body too large');}chunks.push(r.value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let n=0;for(const c of chunks){all.set(c,n);n+=c.length;}return JSON.parse(new TextDecoder().decode(all));
}
export default {async fetch(request:Request,env:Env,ctx:unknown){
 const url=new URL(request.url);
 if(!ROUTES.includes(url.pathname)){
  if(url.pathname==='/api/checkout')
    return reply(503,{error:'Checkout closed in lifecycle session'});
  if(url.pathname.startsWith('/__neroxa_lab/')||url.pathname.startsWith('/api/'))
    return reply(404,{error:'Private LAB route not found'});
  // IMPORTANT: all requests MUST hit Worker first (assets.run_worker_first=true).
  // Access also guards the entire host at the edge; verify JWT again before
  // returning private LAB assets. Never use this entrypoint on a public domain.
  if(url.protocol!=='https:'||url.hostname!==HOST||url.search)return reply(403,{error:'LAB destination denied'});
  if(request.method!=='GET'&&request.method!=='HEAD')return reply(405,{error:'Read-only assets'});
  const assetDeadline=Date.parse(env.LAB_LIFECYCLE_DEADLINE);
  if(!Number.isFinite(assetDeadline)||Date.now()>=assetDeadline||assetDeadline-Date.now()>15*60000)
    return reply(503,{error:'LAB UI window closed'});
  if(!env.ASSETS||!uuid(env.WORKER_VERSION?.id))return reply(503,{error:'Private LAB assets unavailable'});
  try{await verifyAccess(request.headers.get('cf-access-jwt-assertion'));}
  catch{return reply(401,{error:'Access authentication required'});}
  const staticAsset=await env.ASSETS.fetch(request);
  // TanStack Start has SSR routes, not an index.html SPA fallback.
  const asset=staticAsset.status===404?await foodSsr.fetch(request,env,ctx):staticAsset;
  const headers=new Headers(asset.headers);
  headers.set('Cache-Control','private, no-store');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(request.method==='HEAD'||asset.status===204||asset.status===304?null:asset.body,{status:asset.status,headers});
 }
 if(url.protocol!=='https:'||url.hostname!==HOST||url.search)return reply(403,{error:'LAB destination denied'});
 const deadline=Date.parse(env.LAB_LIFECYCLE_DEADLINE);
 if(!Number.isFinite(deadline)||Date.now()>=deadline||deadline-Date.now()>15*60000)return reply(503,{error:'LAB lifecycle window closed'});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 if(request.headers.get('origin')!==url.origin)return reply(403,{error:'LAB Origin denied'});
 if(!uuid(env.WORKER_VERSION?.id))return reply(503,{error:'Platform version metadata required'});
 let identity:Awaited<ReturnType<typeof verifyAccess>>;
 try{identity=await verifyAccess(request.headers.get('cf-access-jwt-assertion'));}catch(e){const reason=e instanceof Error&&['Access authentication required','Access JWT malformed','JWT encoding','Access JWT scope/window invalid','Access JWT algorithm invalid','Access JWT issuer invalid','Access JWT audience invalid','Access JWT lifetime invalid','Access signing keys unavailable','Access key transport failed','Access key response not JSON','Access JWK import failed','Access signature runtime failed','Access key response limit','Access signing keys invalid','Access signing key not found','Access signature denied'].includes(e.message)?e.message:'JWT verification failed';return reply(401,{error:'Access authentication required',reason});}
 const nonce=request.headers.get('x-neroxa-lab-nonce');if(!nonce||!/^[0-9a-f]{64}$/.test(nonce))return reply(400,{error:'One-use LAB request nonce required'});
 const expires=Math.min(identity.expiresAtMs,Date.now()+5*60000,deadline);
 const assertAdmission=()=>{if(Date.now()>=expires||url.hostname!==HOST||!uuid(env.WORKER_VERSION.id))throw Error('LAB admission expired');};
 // JWT signature + pinned app/issuer + platform metadata + durable nonce form the
 // LAB admission; no env/header boolean, synthetic backend or TRUE helper is used.
 let client:Client|undefined;
 try{
  assertAdmission();client=await connect(env);
  const binding=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([PROJECT,env.WORKER_VERSION.id,HOST,identity.subject])))).toString('hex');
  const claim=await client.query('SELECT public.neroxa_claim_cloudflare_grant($1,$2::timestamptz,$3) AS claimed',[nonce,new Date(expires).toISOString(),binding]);
  if(claim.rows.length!==1||claim.rows[0].claimed!==true)return reply(409,{error:'LAB nonce already consumed'});
  assertAdmission();
  if(url.pathname==='/__neroxa_lab/catalog'){
   let req:unknown;
   try{req=await body(request);}catch{return reply(400,{error:'Invalid private catalog request'});}
   if(!req||typeof req!=='object'||Array.isArray(req))return reply(400,{error:'Invalid private catalog request'});
   const args=req as Record<string,unknown>;
   if(Object.keys(args).length!==1||args.domain!==HOST)return reply(403,{error:'LAB catalog domain denied'});
   const got=await client.query('SELECT public.neroxa_lab_food_catalog($1) AS catalog',[HOST]);
   assertAdmission();
   if(got.rows.length!==1||!got.rows[0].catalog)return reply(503,{error:'LAB catalog unavailable'});
   return reply(200,{lab:true,project:PROJECT,version:env.WORKER_VERSION.id,catalog:got.rows[0].catalog});
  }
  if(url.pathname==='/__neroxa_lab/checkout'){
   // The original LAB_CHECKOUT_E2E=PASS handler is reused, not rewritten.
   // Its GROUP_ADDONS_V1 request and authoritative price remain server-owned.
   if(typeof env.LAB_QUOTA_SECRET!=='string'||env.LAB_QUOTA_SECRET.length<32)
     return reply(503,{error:'LAB quota secret unavailable'});
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.LAB_QUOTA_SECRET),'HKDF',false,['deriveBits']);
   const quotaSecret=Buffer.from(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode(PROJECT),info:new TextEncoder().encode('NEROXA_LAB_CHECKOUT_QUOTA_V1')},key,256)).toString('hex');
   const ports=commercialHyperdrivePorts({allowedDomains:[HOST],hyperdrive:env.HYPERDRIVE,quotaSecret,assertAdmission});
   const response=await handlePreparedCommercialCheckout(request,ports);
   assertAdmission();
   const headers=new Headers(response.headers);
   headers.set('X-Neroxa-Lab-Version',env.WORKER_VERSION.id);
   headers.set('X-Neroxa-Lab-Project',PROJECT);
   headers.set('Cache-Control','no-store');
   return new Response(response.body,{status:response.status,headers});
  }
  if(url.pathname==='/__neroxa_lab/order-list'){
   // Access JWT, one-use nonce, database identity, deadline and origin were
   // already validated by the shared entrypoint above.
   let token:string;
   try{token=operatorBearer(request.headers.get('authorization'));}
   catch{return reply(401,{error:'Operational authorization required'});}
   let p:unknown;
   try{p=await body(request);}catch{return reply(400,{error:'Invalid order-list request'});}
   if(!p||typeof p!=='object'||Array.isArray(p))return reply(400,{error:'Invalid order-list request'});
   const args=p as Record<string,unknown>;
   if(Object.keys(args).some(k=>!['instance_id','limit'].includes(k))||
      !uuid(args.instance_id)||
      (args.limit!==undefined&&(typeof args.limit!=='number'||!Number.isInteger(args.limit)||
       (args.limit as number)<1||(args.limit as number)>50)))return reply(400,{error:'Invalid order-list request'});
   const context=await client.query('SELECT instance_id FROM public.get_public_storefront_context($1)',[HOST]);
   if(context.rows.length!==1||context.rows[0].instance_id!==args.instance_id)
     return reply(403,{error:'LAB instance denied'});
   const list=await client.query('SELECT public.neroxa_lab_list_orders($1::uuid,$2,$3::integer) AS orders',
      [args.instance_id,token,args.limit??30]);
   assertAdmission();return reply(200,{orders:list.rows[0]?.orders,lab:true,project:PROJECT,version:env.WORKER_VERSION.id});
  }
  if(url.pathname==='/__neroxa_lab/order-state'){
   let p;try{p=await body(request);}catch{return reply(400,{error:'Invalid state request'});}
   if(!p||typeof p!=='object'||Array.isArray(p)||!uuid(p.order_id)||!uuid(p.instance_id)||typeof p.tracking_token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(p.tracking_token))return reply(400,{error:'State capability required'});
   const c=await client.query('SELECT instance_id FROM public.get_public_storefront_context($1)',[HOST]);
   if(c.rows.length!==1||c.rows[0].instance_id!==p.instance_id)return reply(403,{error:'LAB instance denied'});
   const state=await client.query('SELECT public.neroxa_lab_order_state_history($1::uuid,$2::uuid,$3) AS state',[p.instance_id,p.order_id,p.tracking_token]);assertAdmission();
   return reply(200,{state:state.rows[0]?.state,lab:true,project:PROJECT,version:env.WORKER_VERSION.id});
  }
  let token:string;try{token=operatorBearer(request.headers.get('authorization'));}catch{return reply(401,{error:'Operational authorization required'});}
  let p;try{p=parseTransition(await body(request));}catch{return reply(400,{error:'Invalid transition request'});}
  const context=await client.query('SELECT instance_id FROM public.get_public_storefront_context($1)',[HOST]);
  if(context.rows.length!==1||context.rows[0].instance_id!==p.instance_id)return reply(403,{error:'LAB instance denied'});
  const applied=await client.query('SELECT public.neroxa_lab_transition_order($1::uuid,$2::uuid,$3,$4,$5,$6::uuid) AS operation',[p.instance_id,p.order_id,token,p.expected_status,p.next_status,p.operation_id]);
  assertAdmission();return reply(200,{operation:applied.rows[0]?.operation,lab:true,project:PROJECT,version:env.WORKER_VERSION.id});
 }catch(e){const code=typeof (e as any)?.code==='string'&&/^[A-Z0-9]{5}$/.test((e as any).code)?(e as any).code:undefined;const message=e instanceof Error?e.message:'';const reason=message==='LAB_DB_SSL_REQUIRED'||message==='LAB_DB_IDENTITY_DENIED'?message:/timeout/i.test(message)?'CONNECT_TIMEOUT':/cert|self.signed/i.test(message)?'TLS_CERTIFICATE':/Socket|socket/i.test(message)?'SOCKET_RUNTIME':/require|module/i.test(message)?'MODULE_RUNTIME':/connect|network/i.test(message)?'CONNECTION_RUNTIME':'UNCLASSIFIED';return reply(lifecycleHttpStatus(code),{error:'LAB operation denied or unavailable',sqlstate:code});}finally{await client?.end().catch(()=>{});}
}};
