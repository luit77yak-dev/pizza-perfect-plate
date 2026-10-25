export const PROJECT: string;
export const RELEASE: string;
export type Trust = {publicKeyPem: string|null; keySha256: string|null; maxValidityMs:number|null; allowedDomains:readonly string[]|null};
export const HOSTED_TRUST: Readonly<Trust>;
export class AdmissionBlocked extends Error {}
export function canonical(v:unknown): string;
export function sha256(b: string|Uint8Array): string;
export function verifyGrant(input:string|Uint8Array,trust:Trust,scope:string,now?:number):Readonly<{payload:Readonly<Record<string,any>>;receiptSha256:string;expires:number}>;
export function serverConfiguration(env:Record<string,string|undefined>,trust?:Trust,now?:number):Readonly<{domains:readonly string[];secret:string;receiptSha256:string;expires:number}>;
export function gateHostedRpc<T extends {rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>}>(env:Record<string,string|undefined>,backend:T,trust?:Trust,now?:()=>number):T;

export function assertHostedRequest(env:Record<string,string|undefined>,input:RequestInfo|URL,trust?:Trust,now?:number):void;
