import { useCallback, useEffect, useState } from 'react';
import { getLabOrderState, type LabOrderState, type LabStatus } from '../features/orders-lab/private-api';

const labels: Record<LabStatus, string> = {
  RECEIVED: 'Recebido', CONFIRMED: 'Confirmado', PREPARING: 'Em preparo',
  READY: 'Pronto', OUT_FOR_DELIVERY: 'Saiu para entrega', DELIVERED: 'Entregue',
};

/** For buyer, requires exactly the buyer capability returned by the real checkout. */
export function LabBuyerTracking({instanceId, orderId, trackingToken}: {
  instanceId: string; orderId: string; trackingToken: string;
}) {
  const [order, setOrder] = useState<LabOrderState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const state = await getLabOrderState({instance_id:instanceId, order_id:orderId, tracking_token:trackingToken});
      setOrder(state);setError(null);
    } catch (e) {setError(e instanceof Error?e.message:'Falha na consulta.');}
  }, [instanceId, orderId, trackingToken]);
  useEffect(() => {
    void refresh();const timer=window.setInterval(() => {void refresh();}, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return <section aria-label="Acompanhamento privado do pedido" className="space-y-3 rounded-xl border p-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Acompanhar pedido</h3>
      <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => void refresh()}>Atualizar</button></div>
    <p role="status" className="text-sm">{order ? `Situação: ${labels[order.status]}` : 'Consultando pedido...'}</p>
    {order && <ol className="space-y-1 text-sm" aria-label="Histórico do pedido">
      {order.history.map((h,i)=><li key={`${h.changed_at}-${i}`}>{labels[h.to_status]} · {new Date(h.changed_at).toLocaleString('pt-BR')}</li>)}
    </ol>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
