import {createHash,createPublicKey,verify} from 'node:crypto';
export const PROJECT='iefaoaqzltvpfabyeelj';
export const RELEASE='6611843683eeade08d666b51b8bf4a476e3a7442d20d7f91fe84f70ded0437c1';
export const HOSTED_TRUST=Object.freeze({publicKeyPem:null,keySha256:null,maxValidityMs:null,allowedDomains:null});
export class AdmissionBlocked extends Error {constructor(reason){super(reason);this.name='AdmissionBlocked';}}
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const block=s=>{throw new AdmissionBlocked(s);};
/** Signature is verified over private original bytes, not callback-owned objects. */
export function verifyGrant(input,trust,scope,now=Date.now()){
 const original=Buffer.from(input??'');if(!original.length||original.length>16384)block('Approval size');
 if(!trust?.publicKeyPem||!trust.keySha256||!Number.isFinite(trust.maxValidityMs)||trust.maxValidityMs<=0)block('Authority/policy not admitted');
 const key=createPublicKey(trust.publicKeyPem),der=key.export({type:'spki',format:'der'});if(key.asymmetricKeyType!=='ed25519'||sha256(der)!==trust.keySha256)block('Unpinned authority');
 let e,payload,p;try{e=JSON.parse(original.toString('utf8'));if(canonical(e)!==original.toString('utf8')||Object.keys(e).sort().join(',')!=='payload,signature')block('Envelope encoding');payload=Buffer.from(e.payload,'base64');if(payload.toString('base64')!==e.payload||!verify(null,payload,key,Buffer.from(e.signature,'base64')))block('Approval signature');p=JSON.parse(payload.toString('utf8'));if(canonical(p)!==payload.toString('utf8'))block('Payload encoding');}catch(err){if(err instanceof AdmissionBlocked)throw err;block('Malformed approval');}
 if(p.version!==1||p.scope!==scope||p.project!==PROJECT||p.release!==RELEASE||typeof p.founder!=='string'||!p.founder.trim()||typeof p.operator!=='string'||!p.operator.trim()||!Number.isFinite(p.notBefore)||!Number.isFinite(p.expires)||p.notBefore>now||p.expires<=now||p.expires-p.notBefore>trust.maxValidityMs||!/^[0-9a-f]{64}$/.test(p.nonce??''))block('Approval scope/window');
 return Object.freeze({payload:freeze(p),receiptSha256:sha256(original),expires:p.expires});
}
export function serverConfiguration(env,trust=HOSTED_TRUST,now=Date.now()){
 if(env.NEROXA_BACKEND_MODE!=='hosted-release')block('Hosted mode required');
 const a=verifyGrant(env.NEROXA_HOSTED_ADMISSION,trust,'HOSTED_SERVER',now),p=a.payload;
 if(env.SUPABASE_URL!==`https://${PROJECT}.supabase.co`||env.NEROXA_DELIVERY_BACKEND_URL!==env.SUPABASE_URL||!p.deployment||p.deployment!==env.VERCEL_DEPLOYMENT_ID)block('Server/backend binding');
 if(!Array.isArray(p.domains)||!p.domains.length||new Set(p.domains).size!==p.domains.length||!Array.isArray(trust.allowedDomains)||p.domains.some(d=>typeof d!=='string'||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(d)||!trust.allowedDomains.includes(d)))block('Canonical domains not admitted');
 const domains=(env.NEROXA_TRACKING_CANONICAL_DOMAINS??'').split(',');if(canonical([...domains].sort())!==canonical([...p.domains].sort())||Buffer.byteLength(env.NEROXA_TRACKING_QUOTA_SECRET??'')<32)block('Domain/quota configuration');
 return Object.freeze({domains:Object.freeze([...domains]),secret:env.NEROXA_TRACKING_QUOTA_SECRET,receiptSha256:a.receiptSha256,expires:a.expires});
}
/** No callback receives mutable canonical approval or response buffers. */
export function gateHostedRpc(env,backend,trust=HOSTED_TRUST,now=Date.now){
 if(env.NEROXA_BACKEND_MODE!=='hosted-release')return backend;
 return {async rpc(name,args){const before=serverConfiguration(env,trust,now());const witness=await backend.rpc('neroxa_capability_release_readiness',{});const after=serverConfiguration(env,trust,now());if(before.receiptSha256!==after.receiptSha256)block('Approval changed during readiness');const w=structuredClone(witness?.data);if(witness?.error||w?.ready!==true||w?.project!==PROJECT||w?.release!==RELEASE||!Number.isFinite(Date.parse(w?.checked_at))||Math.abs(Date.parse(w.checked_at)-now())>5000)block('Live backend readiness not verified');serverConfiguration(env,trust,now());const response=await backend.rpc(name,structuredClone(args));serverConfiguration(env,trust,now());return response;}};
}

/** Network sink: bind destination and disable redirects in the actual fetch adapter. */
export function assertHostedRequest(env,input,trust=HOSTED_TRUST,now=Date.now()) {
 serverConfiguration(env,trust,now);const u=new URL(input instanceof Request?input.url:String(input));
 if(u.origin!==`https://${PROJECT}.supabase.co`||u.username||u.password||u.hash||!u.pathname.startsWith('/rest/v1/rpc/'))block('Hosted request destination/path');
}
