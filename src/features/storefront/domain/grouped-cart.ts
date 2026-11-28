// Commercial GROUP_ADDONS_V1 browser preflight. SQL remains authoritative.
import type { CartItem, Product } from "../../../lib/domain/types";
import type { CommercialAddonGroup } from "../services/commercial-catalog";
type Catalog = { products: Product[]; addonGroups: CommercialAddonGroup[] };
type Row = Record<string, unknown>;
const asRow=(v:unknown):Row=>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Opção de produto inválida.");return v as Row;};
const cents=(v:unknown):number=>{if(typeof v!=="number"&&typeof v!=="string")throw Error("Preço inválido.");if(typeof v==="string"&&!/^\d+(?:\.\d{1,2})?$/.test(v))throw Error("Preço inválido.");const n=Number(v),c=Math.round(n*100);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(c)||Math.abs(n*100-c)>0.000001)throw Error("Preço inválido.");return c;};
export function linkedGroups(groups: CommercialAddonGroup[], productId:string) {
 return groups.filter(g=>g.products.some(p=>p.product_id===productId));
}
export function groupSelectionError(groups: CommercialAddonGroup[], selected: readonly string[]):string|null {
 if(selected.length>50||new Set(selected).size!==selected.length)return "Adicionais duplicados ou em excesso.";
 const allowed=new Set(groups.flatMap(g=>g.addons.filter(a=>a.active).map(a=>a.id)));
 if(selected.some(id=>!allowed.has(id)))return "Adicional indisponível para este produto.";
 for(const g of groups){
  const n=g.addons.filter(a=>selected.includes(a.id)).length;
  const min=Math.max(g.min_selections,g.required?1:0);
  if(!g.active||n<min||n>g.max_selections)return g.name+": escolha de "+min+" a "+g.max_selections+" opções.";
 }
 return null;
}
export function canAddAddon(groups:CommercialAddonGroup[], selected:readonly string[], id:string){
 if(selected.includes(id))return true;
 const g=groups.find(g=>g.active&&g.addons.some(a=>a.id===id&&a.active));
 return !!g&&selected.length<50&&g.addons.filter(a=>selected.includes(a.id)).length<g.max_selections;
}
export function productOptionGroups(p:Product) {
 const raw=p.metadata?.["options"]??[];
 if(!Array.isArray(raw))throw Error("Opções de produto inválidas.");
 const seen=new Set<string>();
 return raw.flatMap(value=>{
  const opt=asRow(value),id=opt["id"];
  if((id!=="tamanho"&&id!=="borda")||seen.has(id))throw Error("Opção de preparo ainda não admitida.");
  seen.add(id);
  if(opt["active"]===false){if(opt["required"]===true)throw Error("Opção obrigatória inativa.");return [];}
  if(!Array.isArray(opt["choices"]))throw Error("Opções inválidas.");
  const choices=opt["choices"].map(asRow).filter(c=>c["active"]!==false&&c["available"]!==false).map(c=>{
    if(typeof c["id"]!=="string"||!c["id"]||typeof c["name"]!=="string"||!c["name"])throw Error("Opção inválida.");
    return {id:c["id"],name:c["name"],price:cents(c["price"]??0)/100};
  });
  if(new Set(choices.map(c=>c.id)).size!==choices.length)throw Error("Opções duplicadas.");
  if(opt["required"]===true&&!choices.length)throw Error("Opção obrigatória indisponível.");
  return [{id:id as "tamanho"|"borda",name:typeof opt["name"]==="string"&&opt["name"]?opt["name"]:id==="tamanho"?"Tamanho":"Borda",required:opt["required"]===true,choices}];
 });
}
export function commercialMenuProducts(products:Product[],categoryIds:readonly string[]){
 const active=new Set(categoryIds);
 return products.filter(p=>p.active&&(p.category_id===null||active.has(p.category_id)));
}
export function commercialProductNeedsConfiguration(p:Product,groups:CommercialAddonGroup[]){
 return linkedGroups(groups,p.id).length>0 || (p.metadata?.["options"]!==undefined && p.metadata["options"]!==null && (!Array.isArray(p.metadata["options"])||p.metadata["options"].length>0));
}
function options(p:Product,size:string|null,crust:string|null):number{
 const raw=p.metadata?.["options"]??[];
 if(!Array.isArray(raw))throw Error("Opções de produto inválidas.");
 const found=new Set<string>();let total=0;
 for(const value of raw){
  const opt=asRow(value),id=opt["id"];
  if((id!=="tamanho"&&id!=="borda")||found.has(id))throw Error("Opção de preparo ainda não admitida.");
  found.add(id);const choice=id==="tamanho"?size:crust;
  if(opt["active"]===false){if(choice||opt["required"]===true)throw Error("Opção inativa.");continue;}
  if(!choice){if(opt["required"]===true)throw Error("Escolha uma opção obrigatória.");continue;}
  if(!Array.isArray(opt["choices"]))throw Error("Opções inválidas.");
  const matches=opt["choices"].map(asRow).filter(c=>c["id"]===choice&&c["active"]!==false&&c["available"]!==false);
  if(matches.length!==1)throw Error("Opção indisponível.");
  total+=cents(matches[0]!["price"]??0);
 }
 if((size&&!found.has("tamanho"))||(crust&&!found.has("borda")))throw Error("Opção não pertence ao produto.");
 return total;
}
export function prepareGroupedItem(item:CartItem,catalog:Catalog){
 const p=catalog.products.find(p=>p.id===item.productId);
 if(!p||!p.active||!p.available||p.kind==="COMBO")throw Error("Produto indisponível no contrato comercial.");
 if(item.isHalf||item.secondProductId||item.complements?.length)throw Error("Meia pizza e complementos ainda não são aceitos.");
 if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10)throw Error("Quantidade por item deve estar entre 1 e 10.");
 const groups=linkedGroups(catalog.addonGroups,p.id),ids=item.addons.map(a=>a.id);
 const error=groupSelectionError(groups,ids);if(error)throw Error(error);
 const unit=cents(p.base_price)+options(p,item.sizeId??null,item.crustId??null)+groups.flatMap(g=>g.addons).filter(a=>ids.includes(a.id)).reduce((n,a)=>n+cents(a.price_delta),0);
 if(unit!==cents(item.unitPrice))throw Error("Preço mudou. Revise o carrinho.");
 if((item.notes?.length??0)>500)throw Error("Observações extensas demais.");
 return {product_id:p.id,selection_contract:"GROUP_ADDONS_V1" as const,quantity:item.quantity,expected_unit_price:unit/100,group_addon_ids:ids,size_id:item.sizeId??null,crust_id:item.crustId??null,notes:item.notes?.trim()||null};
}
export function prepareGroupedCart(items:CartItem[],catalog:Catalog,subtotal:number,total:number,fee:number){
 if(items.length<1||items.length>40)throw Error("Carrinho deve ter de 1 a 40 itens.");
 const prepared=items.map(item=>prepareGroupedItem(item,catalog));
 const sum=prepared.reduce((n,i)=>n+cents(i.expected_unit_price)*i.quantity,0);
 if(sum!==cents(subtotal)||sum+cents(fee)!==cents(total))throw Error("Total mudou. Revise o carrinho.");
 return prepared;
}
