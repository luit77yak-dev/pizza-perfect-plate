import { useEffect, useRef, useState } from 'react';
import { getLabFoodCatalog } from '../features/orders-lab/private-food-catalog';
import {
  checkoutLabFoodCart, prepareLabFoodCheckout,
  type LabFoodOrderInput, type LabPreparedFoodCheckout,
  type LabFoodCheckoutReceipt,
} from '../features/orders-lab/private-food-cart';

type FoodLines = LabFoodOrderInput['items'];
export type LabCheckoutSuccess = LabFoodCheckoutReceipt & { instance_id: string };
export type LabCheckoutProgress = 'editing'|'submitting'|'uncertain'|'completed';

/**
 * Drop-in LAB-only checkout step for the actual Food CartItem[] values.
 * The host Food route must pass its *real* current cart here. Production
 * checkout/append-order routes are deliberately untouched.
 */
export function LabFoodOrderCheckout({items,onCreated,onProgress}: {
  items:FoodLines;
  onCreated:(receipt:LabCheckoutSuccess)=>void;
  onProgress?:(progress:LabCheckoutProgress)=>void;
}) {
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [completed,setCompleted]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const pending=useRef<LabPreparedFoodCheckout|null>(null);
  const fingerprint=items.map(x=>[x.productId,x.quantity,x.unitPrice,
    x.secondProductId,x.isHalf,x.sizeId,x.crustId,x.addons?.map(a=>a.id),x.complements?.length,x.notes]).join('|');
  useEffect(()=>{pending.current=null;setCompleted(false);setUncertain(false);},[fingerprint]);

  const submit=async()=>{
    if (busy||completed||uncertain)return;
    setBusy(true);setError(null);onProgress?.('submitting');
    try{
      const domain=window.location.hostname;
      const catalog=await getLabFoodCatalog(domain);
      const ids=new Set(catalog.products.map(p=>p.id));
      if(items.some(item=>!ids.has(item.productId)))
        throw new Error('O carrinho não corresponde ao catálogo ativo do LAB.');
      pending.current??=prepareLabFoodCheckout({
        instance_id:catalog.context.instance_id,
        organization_id:catalog.context.organization_id,
        store_domain:domain,customer_name:name,customer_phone:phone,items,
      });
      const result=await checkoutLabFoodCart(pending.current);
      setCompleted(true);onProgress?.('completed');
      // Capability passes only to the buyer tracking component in memory.
      onCreated({...result,instance_id:catalog.context.instance_id});
    }catch(e){
      if (e instanceof Error && (/Confirmação incerta|possivelmente registrado|fora do contrato LAB/.test(e.message))) {
        setUncertain(true);onProgress?.('uncertain');
      } else onProgress?.('editing');
      setError(e instanceof Error?e.message:'Não foi possível confirmar o pedido LAB.');
    }finally{setBusy(false);}
  };
  return <section data-neroxa-lab-food-checkout className="space-y-4 rounded-xl border p-5">
    <h2 className="font-semibold text-lg">Finalizar pedido — LAB privado</h2>
    <p className="text-sm">Retirada fictícia, pagamento em dinheiro sem cobrança. O servidor confere os preços e a disponibilidade.</p>
    <label className="block">Nome
      <input className="block w-full rounded border p-2" value={name} disabled={busy||completed}
        onChange={e=>{setName(e.target.value);pending.current=null;}} required maxLength={120} />
    </label>
    <label className="block">Telefone de teste
      <input className="block w-full rounded border p-2" value={phone} disabled={busy||completed}
        onChange={e=>{setPhone(e.target.value);pending.current=null;}} required inputMode="tel" />
    </label>
    <p className="text-sm">Itens do carrinho: {items.reduce((sum,i)=>sum+i.quantity,0)}</p>
    <button type="button" className="rounded bg-orange-600 px-4 py-2 text-white" disabled={busy||completed||uncertain||items.length===0}
      onClick={()=>void submit()}>{completed?'Pedido registrado':uncertain?'Conferência manual necessária':busy?'Confirmando...':'Enviar pedido de teste'}</button>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
