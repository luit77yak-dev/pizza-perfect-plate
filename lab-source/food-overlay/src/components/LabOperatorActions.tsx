import { useState } from 'react';
import { allowedNext, transitionLabOrder, type LabFulfillment, type LabStatus } from '../features/orders-lab/private-api';

const labels: Record<LabStatus,string> = {
  RECEIVED:'Recebido', CONFIRMED:'Confirmado',PREPARING:'Em preparo',READY:'Pronto',
  OUT_FOR_DELIVERY:'Saiu para entrega',DELIVERED:'Entregue',
};

/**
 * Operator receives state from a *separately authorized* tenant-scoped list route.
 * NEVER require or pass a buyer tracking capability to the operator.
 * Operator grant exists only in memory and must be created through private LAB admission.
 */
export function LabOperatorActions({instanceId,orderId,status,fulfillment,operatorToken,onUpdated}: {
  instanceId:string;orderId:string;status:LabStatus;fulfillment:LabFulfillment;
  operatorToken:string;onUpdated:(status:LabStatus)=>void;
}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function perform(next:LabStatus) {
    if(busy)return;
    setBusy(true);setError(null);
    try {
      const r=await transitionLabOrder({instance_id:instanceId,order_id:orderId,
        expected_status:status,next_status:next,operator_token:operatorToken,
        operation_id:crypto.randomUUID()});
      onUpdated(r.status);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o pedido.');}
    finally{setBusy(false);}
  }
  return <section aria-label="Operações de pedido LAB" className="space-y-2">
    <p className="text-sm">Situação: <strong>{labels[status]}</strong></p>
    <div className="flex flex-wrap gap-2">
      {allowedNext(status,fulfillment).map(next => <button key={next} type="button" disabled={busy || !operatorToken}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void perform(next)}>
        Marcar: {labels[next]}
      </button>)}
    </div>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
