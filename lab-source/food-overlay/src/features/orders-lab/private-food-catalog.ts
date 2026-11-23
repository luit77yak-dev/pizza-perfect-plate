/** Private Food catalog for the LAB-only overlay. No legacy RPC fallback. */
import { LabApiError, nonceHex } from './private-api';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type LabFoodCatalog = {
 context: {
  domain:string;instance_id:string;instance_slug:string;instance_name:string;
  instance_status:string;organization_id:string;organization_name:string;
  system_id:string|null;system_slug:string|null;system_name:string|null;system_type:string|null;
 };
 categories:unknown[];
 products:Array<{id:string;name:string;price:number|string;active:boolean;metadata?:Record<string,unknown>}>;
 settings:Record<string,unknown>;
 delivery_zones:unknown[];
};
export async function getLabFoodCatalog(domain:string):Promise<LabFoodCatalog>{
 if(typeof window==='undefined'||window.location.protocol!=='https:'||domain!==window.location.hostname)
  throw new LabApiError(403,'Catálogo LAB exige origem privada HTTPS.');
 let response:Response;
 try{response=await fetch(new URL('/__neroxa_lab/catalog',window.location.origin),{
  method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json','X-Neroxa-Lab-Nonce':nonceHex()},
  body:JSON.stringify({domain}),
 });}
 catch{throw new LabApiError(503,'Catálogo privado indisponível.');}
 const payload:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new LabApiError(response.status,'Catálogo privado negado.');
 const p=payload as {project?:string;lab?:boolean;catalog?:LabFoodCatalog}|null;
 const c=p?.catalog;
 if(!p||p.project!=='gomexvhvecvvfbdzhjct'||p.lab!==true||!c||
    c.context.domain!==domain||c.context.instance_status!=='ACTIVE'||
    !UUID.test(c.context.instance_id)||!UUID.test(c.context.organization_id)||
    !Array.isArray(c.products)||!Array.isArray(c.categories)||!Array.isArray(c.delivery_zones)||
    c.products.some(x=>!UUID.test(String(x.id))||!Number.isFinite(Number(x.price))||Number(x.price)<0))
   throw new LabApiError(502,'Catálogo fora do contrato LAB.');
 return c;
}
