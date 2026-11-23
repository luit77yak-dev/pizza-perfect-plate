// REVIEW SNAPSHOT: issuer and audience are non-operational placeholders.
import {PINNED_ACCESS_KEYS} from './access-keys.ts';
const ISSUER='https://unconfigured.invalid';
const AUDIENCE='NOT_CONFIGURED';
type Jwk=JsonWebKey & {kid?:string};
function bytes(s:string){if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('JWT encoding');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function keys():Promise<Jwk[]>{return PINNED_ACCESS_KEYS as Jwk[];}
export async function verifyAccess(assertion:string|null,now=Date.now()){
 if(!assertion||assertion.length>16384)throw Error('Access authentication required');
 const p=assertion.split('.');if(p.length!==3)throw Error('Access JWT malformed');
 const h=JSON.parse(new TextDecoder().decode(bytes(p[0]!))),c=JSON.parse(new TextDecoder().decode(bytes(p[1]!)));
 if(h.alg!=='RS256'||typeof h.kid!=='string'||h.kid.length>256)throw Error('Access JWT algorithm invalid');
 if(c.iss!==ISSUER)throw Error('Access JWT issuer invalid');
 if(c.aud!==AUDIENCE&&(!Array.isArray(c.aud)||!c.aud.includes(AUDIENCE)))throw Error('Access JWT audience invalid');
 if(!Number.isFinite(c.exp)||c.exp*1000<=now||(c.nbf!==undefined&&(!Number.isFinite(c.nbf)||c.nbf*1000>now)))throw Error('Access JWT lifetime invalid');
 const jwk=(await keys()).find(k=>k.kid===h.kid&&k.kty==='RSA');if(!jwk||!jwk.n||bytes(jwk.n).length<256)throw Error('Access signing key not found');
 let k:CryptoKey;try{k=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);}catch{throw Error('Access JWK import failed');}
 let valid:boolean;try{valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',k,bytes(p[2]!),new TextEncoder().encode(p[0]+'.'+p[1]));}catch{throw Error('Access signature runtime failed');}if(!valid)throw Error('Access signature denied');
 return Object.freeze({expiresAtMs:c.exp*1000,subject:typeof c.sub==='string'?c.sub:'service-auth'});
}
