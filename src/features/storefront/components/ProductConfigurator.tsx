import { useCustomerDialog } from "@/features/storefront/hooks/use-customer-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, Product } from "@/lib/domain/types";
import type { StoreData } from "@/features/storefront/services/load-store";
import { linkedGroups, groupSelectionError, canAddAddon, prepareGroupedItem, productOptionGroups } from "@/features/storefront/domain/grouped-cart";

export function ProductConfigurator({product,data,onClose,onAdded}:{
 product:Product;data:StoreData;onClose:()=>void;onAdded:(items:CartItem[])=>void;
}){
 const dialogRef=useCustomerDialog(onClose);
 const [selections,setSelections]=useState<Record<string,string|null>>({});
 const [addonIds,setAddonIds]=useState<string[]>([]);
 const [quantity,setQuantity]=useState(1);
 const [notes,setNotes]=useState("");
 const [error,setError]=useState<string|null>(null);
 const groups=linkedGroups(data.addonGroups,product.id);
 let optionGroups:ReturnType<typeof productOptionGroups>=[];
 let configurationError:string|null=null;
 try{optionGroups=productOptionGroups(product);}catch(e){configurationError=e instanceof Error?e.message:"Produto indisponível.";}
 const size=optionGroups.find(g=>g.id==="tamanho")?.choices.find(c=>c.id===selections["tamanho"]);
 const crust=optionGroups.find(g=>g.id==="borda")?.choices.find(c=>c.id===selections["borda"]);
 const addons=groups.flatMap(g=>g.addons).filter(a=>addonIds.includes(a.id));
 const unitPrice=Math.round((Number(product.base_price)+(size?.price??0)+(crust?.price??0)+addons.reduce((n,a)=>n+a.price_delta,0))*100)/100;
 const validationError=configurationError || (!product.active||!product.available||product.kind==="COMBO"?"Produto indisponível para pedidos.":null) || groupSelectionError(groups,addonIds) || (optionGroups.some(g=>g.required&&!g.choices.some(c=>c.id===selections[g.id]))?"Selecione as opções obrigatórias.":null);
 const add=()=>{
  if(validationError)return;
  const item:CartItem={lineId:crypto.randomUUID(),productId:product.id,productName:product.name,imageUrl:product.image_url,
   secondProductId:null,secondProductName:null,isHalf:false,sizeId:size?.id??null,sizeName:size?.name??null,
   crustId:crust?.id??null,crustName:crust?.name??null,crustPrice:crust?.price??0,
   addons:addons.map(a=>({id:a.id,name:a.name,price:a.price_delta})),complements:[],quantity,notes:notes.trim()||null,unitPrice};
  try{prepareGroupedItem(item,data);}catch(e){setError(e instanceof Error?e.message:"Seleção inválida.");return;}
  onAdded([item]);
 };
 return <div className="ppp-order-builder fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-6" ref={dialogRef} data-customer-dialog tabIndex={-1} role="dialog" aria-modal="true" aria-label={"Personalizar "+product.name}>
  <section data-order-surface className="flex max-h-[95dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-card text-card-foreground shadow-lifted sm:rounded-3xl">
   <header className="flex items-start justify-between gap-4 border-b p-5">
    <div><p className="text-xs font-semibold text-muted-foreground">Personalizar produto</p><h2 className="text-xl font-bold">{product.name}</h2></div>
    <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2"><X className="size-5"/></button>
   </header>
   <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
    {product.image_url&&<img src={product.image_url} alt={product.name} className="max-h-44 w-full rounded-2xl object-cover"/>}
    {product.description&&<p className="text-sm text-muted-foreground">{product.description}</p>}
    {optionGroups.map(g=><fieldset key={g.id} className="space-y-2">
     <legend className="font-semibold">{g.name}</legend><p className="text-xs text-muted-foreground">{g.required?"Escolha uma opção":"Opcional"}</p>
     {!g.required&&<button type="button" aria-pressed={!selections[g.id]} onClick={()=>{setError(null);setSelections(s=>({...s,[g.id]:null}));}} className="w-full rounded-xl border p-3 text-left">Sem seleção</button>}
     {g.choices.map(c=><button key={c.id} type="button" aria-pressed={selections[g.id]===c.id} onClick={()=>{setError(null);setSelections(s=>({...s,[g.id]:c.id}));}} className={"flex w-full justify-between rounded-xl border p-3 text-left "+(selections[g.id]===c.id?"border-primary bg-primary/10":"")}><span>{c.name}</span><span>+ {formatCurrency(c.price)}</span></button>)}
    </fieldset>)}
    {groups.map(g=><fieldset key={g.id} className="space-y-2">
     <legend className="font-semibold">{g.name}</legend>
     <p className="text-xs text-muted-foreground">Selecione de {Math.max(g.min_selections,g.required?1:0)} a {g.max_selections} · {g.addons.filter(a=>addonIds.includes(a.id)).length} selecionado(s)</p>
     {g.addons.filter(a=>a.active).map(a=><button key={a.id} type="button" aria-pressed={addonIds.includes(a.id)} disabled={!canAddAddon(groups,addonIds,a.id)} onClick={()=>{setError(null);setAddonIds(ids=>ids.includes(a.id)?ids.filter(id=>id!==a.id):canAddAddon(groups,ids,a.id)?[...ids,a.id]:ids);}} className={"flex w-full justify-between rounded-xl border p-3 text-left disabled:opacity-40 "+(addonIds.includes(a.id)?"border-primary bg-primary/10":"")}><span>{a.name}</span><span>+ {formatCurrency(a.price_delta)}</span></button>)}
    </fieldset>)}
    <label className="block space-y-2 text-sm font-semibold">Observações<Textarea value={notes} maxLength={500} onChange={e=>setNotes(e.target.value)} placeholder="Observações opcionais"/></label>
    <div className="flex items-center justify-between"><span>Quantidade</span><div className="flex items-center gap-4"><button type="button" aria-label="Diminuir quantidade" disabled={quantity<=1} onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="rounded-xl border px-3 py-2">−</button><span>{quantity}</span><button type="button" aria-label="Aumentar quantidade" disabled={quantity>=10} onClick={()=>setQuantity(q=>Math.min(10,q+1))} className="rounded-xl border px-3 py-2">+</button></div></div>
   </div>
   <footer data-order-footer className="space-y-3 border-t p-5">
    {(error||validationError)&&<p role="alert" className="text-sm text-destructive">{error||validationError}</p>}
    <div className="flex justify-between text-sm"><span>Total</span><strong>{formatCurrency(unitPrice*quantity)}</strong></div>
    <button type="button" disabled={Boolean(validationError)} onClick={add} className="w-full rounded-full bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50">Adicionar ao carrinho</button>
   </footer>
  </section>
 </div>;
}
