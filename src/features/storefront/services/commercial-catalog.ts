// Commercial catalog contract, checked before legacy presentation mapping.
export type CommercialAddonGroup = {
  id: string; name: string; required: boolean; min_selections: number; max_selections: number;
  active: boolean; sort_order: number;
  products: Array<{ product_id: string; sort_order: number }>;
  addons: Array<{ id: string; name: string; price_delta: number; active: boolean; sort_order: number }>;
};
export type CommercialAvailability = { contract: "INSTANCE_AVAILABILITY_V1"; instance_id: string; configured: boolean; open: boolean; checked_at: string };
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (x: unknown): x is string => typeof x === "string" && UUID.test(x);
const record = (x: unknown): Row => {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Catálogo comercial inválido.");
  return x as Row;
};
const array = (x: unknown): unknown[] => {
  if (!Array.isArray(x)) throw new Error("Lista do catálogo inválida.");
  return x;
};
const integer = (x: unknown): number => {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0) throw new Error("Seleção inválida.");
  return x;
};
const id = (x: unknown): string => {
  if (!validId(x)) throw new Error("Identidade do catálogo inválida.");
  return x;
};
const name = (x: unknown): string => {
  if (typeof x !== "string" || !x.trim()) throw new Error("Nome do catálogo inválido.");
  return x;
};
const money = (x: unknown): number => {
  if ((typeof x !== "number" && typeof x !== "string") || (typeof x === "string" && !/^\d+(?:\.\d{1,2})?$/.test(x))) throw new Error("Preço inválido.");
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0 || Math.abs(n*100-Math.round(n*100)) > 0.000001) throw new Error("Preço inválido.");
  return n;
};
export function validateCommercialCatalog(value: unknown, host: string) {
  const c=record(value),ctx=record(c["context"]);
  if(c["selection_contract"]!=="GROUP_ADDONS_V1"||ctx["domain"]!==host||ctx["instance_status"]!=="ACTIVE"||!validId(ctx["organization_id"])) throw new Error("Loja não admitida.");
  const instance=id(ctx["instance_id"]);
  const products=array(c["products"]).map(record);
  const productIds=new Set<string>();
  for(const p of products) {
    const pid=id(p["id"]);
    if(productIds.has(pid)||p["active"]!==true) throw new Error("Produto inválido.");
    productIds.add(pid);
    name(p["name"]); money(p["price"]); record(p["metadata"]);
  }
  array(c["categories"]).forEach(record);
  array(c["delivery_zones"]).forEach(record);
  record(c["settings"]);
  const a=record(c["availability"]);
  if(a["contract"]!=="INSTANCE_AVAILABILITY_V1"||a["instance_id"]!==instance||typeof a["configured"]!=="boolean"||typeof a["open"]!=="boolean"||typeof a["checked_at"]!=="string"||!Number.isFinite(Date.parse(a["checked_at"]))) throw new Error("Disponibilidade inválida.");
  const availability: CommercialAvailability={contract:"INSTANCE_AVAILABILITY_V1",instance_id:instance,configured:a["configured"],open:a["open"],checked_at:a["checked_at"]};
  const groupIds=new Set<string>(), addonIds=new Set<string>();
  const addonGroups: CommercialAddonGroup[]=array(c["addon_groups"]).map(value=>{
    const g=record(value),gid=id(g["id"]),min=integer(g["min_selections"]),max=integer(g["max_selections"]);
    if(groupIds.has(gid)||g["active"]!==true||typeof g["required"]!=="boolean"||min>max)throw new Error("Grupo inválido.");
    groupIds.add(gid);
    const linked=new Set<string>();
    const products=array(g["products"]).map(value=>{
      const p=record(value),pid=id(p["product_id"]);
      if(!productIds.has(pid)||linked.has(pid))throw new Error("Vínculo de produto inválido.");
      linked.add(pid);return {product_id:pid,sort_order:integer(p["sort_order"])};
    });
    const addons=array(g["addons"]).map(value=>{
      const x=record(value),aid=id(x["id"]);
      if(addonIds.has(aid)||x["active"]!==true)throw new Error("Adicional inválido.");
      addonIds.add(aid);return {id:aid,name:name(x["name"]),price_delta:money(x["price_delta"]),active:true,sort_order:integer(x["sort_order"])};
    });
    return {id:gid,name:name(g["name"]),required:g["required"],min_selections:min,max_selections:max,active:true,sort_order:integer(g["sort_order"]),products,addons};
  });
  return {catalog:c,addonGroups,availability};
}
export function commercialStoreStatus(a: CommercialAvailability, nowMs: number) {
  const age=nowMs-Date.parse(a.checked_at);
  if(!a.configured||!Number.isFinite(age)||age < -30000||age > 90000)return {open:false,label:"Disponibilidade não confirmada"};
  return a.open?{open:true,label:"Aberta agora"}:{open:false,label:"Fechada agora"};
}
export async function fetchCommercialCatalog(origin: string, fetcher: typeof fetch = fetch) {
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.origin!==origin||url.hostname==="localhost"||/\.(workers\.dev|lovable\.app|lovableproject\.com|vercel\.app|invalid)$/.test(url.hostname))throw new Error("Origem comercial inválida.");
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
  const response=await fetcher(new URL("/api/commercial/catalog",url),{method:"POST",credentials:"same-origin",redirect:"error",cache:"no-store",headers:{"Content-Type":"application/json","X-Neroxa-Request-Nonce":nonce},body:"{}",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("Catálogo comercial indisponível.");
  const result=record(await response.json());
  return validateCommercialCatalog(result["catalog"],url.hostname);
}
