import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LabApiError, listLabOrders, type LabListedOrder,
} from '../features/orders-lab/private-api';
import { LabOperatorActions } from './LabOperatorActions';

/**
 * PRIVATE LAB ONLY. Access protects the HTTPS origin; the temporary operational
 * grant is entered during the permitted window and held only in React memory.
 * Production staff authentication must be integrated separately.
 */
export function LabOrdersDashboard() {
  const [instanceDraft, setInstanceDraft] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [session, setSession] = useState<{ instanceId: string; token: string } | null>(null);
  const [orders, setOrders] = useState<LabListedOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);


  const refresh = useCallback(async (current: { instanceId: string; token: string }) => {
    const ticket = ++generation.current;
    try {
      const data = await listLabOrders({ instance_id: current.instanceId, operator_token: current.token });
      if (ticket !== generation.current) return false;
      setOrders(data);
      setSelectedId((id) => id && data.some((o) => o.id === id) ? id : (data[0]?.id ?? null));
      setError(null);
      return true;
    } catch (e) {
      if (ticket !== generation.current) return false;
      setOrders([]);
      setSelectedId(null);
      setError(e instanceof Error ? e.message : 'Falha ao atualizar pedidos LAB.');
      if (e instanceof LabApiError && (e.status === 401 || e.status === 403)) setSession(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void refresh(session);
    const timer = window.setInterval(() => void refresh(session), 5000);
    return () => { generation.current += 1; window.clearInterval(timer); };
  }, [session, refresh]);

  const order = orders.find((o) => o.id === selectedId);
  return (
    <main className="min-h-screen bg-[#0e0c0b] px-4 py-8 text-[#f7efe6]" data-neroxa-private-lab="order-dashboard">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div><p className="text-xs text-[#ff9a7b]">LAB privado · sem operações comerciais</p>
            <h1 className="text-2xl font-bold">Pedidos da loja</h1></div>
          {session && <button type="button" className="rounded-lg border px-3 py-2" onClick={() => {
            generation.current += 1; setSession(null); setTokenDraft(''); setOrders([]); setSelectedId(null); setError(null);
          }}>Encerrar sessão</button>}
        </header>
        {!session ? (
          <form className="max-w-lg space-y-3 rounded-xl border border-white/15 bg-white/5 p-5"
            onSubmit={(e) => {
              e.preventDefault(); setError(null);
              const next = {instanceId:instanceDraft.trim(),token:tokenDraft.trim()};
              setTokenDraft(''); setSession(next);
            }}>
            <p className="text-sm text-white/70">Usar somente a credencial operacional temporária, entregue por canal privado.</p>
            <label className="block text-sm">Identificador da loja
              <input autoComplete="off" required value={instanceDraft} onChange={(e) => setInstanceDraft(e.target.value)}
                className="mt-1 w-full rounded-md border bg-transparent p-2" placeholder="UUID da instância LAB" />
            </label>
            <label className="block text-sm">Credencial operacional LAB
              <input type="password" autoComplete="off" required value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)}
                className="mt-1 w-full rounded-md border bg-transparent p-2" placeholder="Credencial temporária" />
            </label>
            <button type="submit" className="rounded-lg bg-[#ff6a3d] px-4 py-2 font-semibold text-black">Abrir painel privado</button>
          </form>
        ) : (
          <>
            <button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={loading} onClick={() => {
              setLoading(true); void refresh(session).finally(() => setLoading(false));
            }}>Atualizar pedidos</button>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section aria-label="Pedidos da loja" className="space-y-2">
                {orders.length === 0 && !error && <p className="rounded-xl border p-4 text-sm">Nenhum pedido disponível.</p>}
                {orders.map((o) => (
                  <button type="button" key={o.id} onClick={() => setSelectedId(o.id)}
                    className={`block w-full rounded-xl border p-4 text-left ${selectedId===o.id?'border-[#ff6a3d]':'border-white/15'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <strong>#{o.order_number} · {o.customer_name}</strong>
                      <span className="text-xs">{o.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/65">{o.fulfillment==='PICKUP'?'Retirada':'Entrega'} · R$ {Number(o.total).toFixed(2).replace('.',',')}</p>
                  </button>
                ))}
              </section>
              <aside className="h-fit rounded-xl border border-white/15 p-4">
                {!order ? <p className="text-sm text-white/60">Selecione um pedido.</p> : (
                  <div className="space-y-4">
                    <h2 className="font-semibold">Pedido #{order.order_number}</h2>
                    <ul aria-label="Itens do pedido" className="list-disc pl-5 text-sm">
                      {order.items.map((item,i)=><li key={i}>{item.quantity} × {item.product_name}</li>)}
                    </ul>
                    <LabOperatorActions instanceId={session.instanceId} orderId={order.id}
                      status={order.status} fulfillment={order.fulfillment} operatorToken={session.token}
                      onUpdated={() => void refresh(session)} />
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-400 p-3 text-sm text-red-200">{error}</p>}
      </div>
    </main>
  );
}
