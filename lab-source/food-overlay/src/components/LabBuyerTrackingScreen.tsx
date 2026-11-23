import { useRef, useState } from 'react';
import {checkoutLabFixture,prepareLabFixtureCheckout,LAB_FICTITIOUS_PICKUP,type LabCheckoutInput} from '../features/orders-lab/private-api';
import { LabBuyerTracking } from './LabBuyerTracking';

/** Session-only entry for a buyer capability received from the real LAB checkout. */
export function LabBuyerTrackingScreen() {
  const [instance, setInstance] = useState('');
  const [customerName,setCustomerName]=useState('NEROXA LAB FICTICIO');
  const [customerPhone,setCustomerPhone]=useState('00000000000');
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [checkoutError,setCheckoutError]=useState<string|null>(null);
  // Preserve the original idempotency key if a response is uncertain.
  const pendingCheckout=useRef<LabCheckoutInput|null>(null);
  const [order, setOrder] = useState('');
  const [capability, setCapability] = useState('');
  const [current, setCurrent] = useState<{instance:string;order:string;capability:string}|null>(null);
  return <main className="mx-auto max-w-xl space-y-4 p-5" data-neroxa-private-lab="buyer-tracking">
    <h1 className="text-2xl font-bold">Acompanhar pedido LAB</h1>
    <p className="text-sm">Somente dados fictícios. Capability apenas em memória: nunca em URL, logs ou armazenamento.</p>
    {!current && <section className="space-y-3 rounded-xl border p-4" aria-label="Checkout privado LAB">
      <h2 className="font-semibold">Criar pedido fictício de retirada</h2>
      <p className="text-sm">Produto LAB já homologado · 1 unidade · R$ 10,00 · sem cobrança.</p>
      <label className="block">Nome fictício<input required value={customerName} onChange={e=>{setCustomerName(e.target.value);pendingCheckout.current=null;}} className="block w-full rounded border p-2" /></label>
      <label className="block">Telefone fictício<input required value={customerPhone} onChange={e=>{setCustomerPhone(e.target.value);pendingCheckout.current=null;}} className="block w-full rounded border p-2" /></label>
      <button type="button" className="rounded border px-4 py-2" disabled={checkoutBusy} onClick={()=>{
        if(checkoutBusy)return;
        setCheckoutBusy(true);setCheckoutError(null);
        try{pendingCheckout.current??=prepareLabFixtureCheckout(customerName,customerPhone);}catch(e){setCheckoutError(e instanceof Error?e.message:'Dados inválidos.');setCheckoutBusy(false);return;}
        const request=pendingCheckout.current;
        if(!request){setCheckoutError('Pedido privado não preparado.');setCheckoutBusy(false);return;}
        void checkoutLabFixture(request).then(result=>{
          pendingCheckout.current=null;
          setCurrent({instance:LAB_FICTITIOUS_PICKUP.instance_id,order:result.order_id,capability:result.tracking_token});
        }).catch(e=>setCheckoutError(e instanceof Error?e.message:'Não foi possível confirmar o pedido.'))
          .finally(()=>setCheckoutBusy(false));
      }}>{checkoutBusy?'Enviando...':pendingCheckout.current?'Retentar com a MESMA chave':'Criar pedido fictício'}</button>
      {checkoutError && <p role="alert" className="text-sm text-red-600">{checkoutError}</p>}
    </section>}
    {!current && <h2 className="font-semibold">Ou acompanhar pedido já criado</h2>}
    {!current ? <form className="space-y-3" onSubmit={(e)=>{
      e.preventDefault();setCurrent({instance:instance.trim(),order:order.trim(),capability:capability.trim()});setCapability('');
    }}>
      <label className="block">Loja<input required autoComplete="off" value={instance} onChange={e=>setInstance(e.target.value)} className="block w-full rounded border p-2" /></label>
      <label className="block">Pedido<input required autoComplete="off" value={order} onChange={e=>setOrder(e.target.value)} className="block w-full rounded border p-2" /></label>
      <label className="block">Capability privada<input required type="password" autoComplete="off" value={capability} onChange={e=>setCapability(e.target.value)} className="block w-full rounded border p-2" /></label>
      <button type="submit" className="rounded border px-4 py-2">Acompanhar</button>
    </form> : <>
      <button type="button" className="rounded border px-4 py-2" onClick={()=>{setCurrent(null);setCapability('');}}>Encerrar acompanhamento</button>
      <LabBuyerTracking instanceId={current.instance} orderId={current.order} trackingToken={current.capability}/>
    </>}
  </main>;
}
