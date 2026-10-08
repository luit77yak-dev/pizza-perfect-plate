import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, LogIn, LogOut, RefreshCw, ShoppingBag, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminRpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }>)(fn, args);
import { formatCurrency } from "@/lib/domain/money";
import type { OrderStatus } from "@/lib/domain/types";

type Order = {
  id: string;
  instance_id: string;
  organization_id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  payment_method: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_complement?: string | null;
  address_reference?: string | null;
  notes?: string | null;
  created_at: string;
};

const statuses: Array<{ value: OrderStatus; label: string }> = [
  { value: "RECEIVED", label: "Recebido" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PREPARING", label: "Em preparo" },
  { value: "READY", label: "Pronto" },
  { value: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Pedidos");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSession(false);
        return;
      }
      setSession(true);

      const domain = window.location.hostname.replace(/\.$/, "").toLowerCase();
      const { data: context, error: contextError } = await adminRpc(
        "get_public_storefront_context",
        { p_domain: domain },
      );
      if (contextError) throw contextError;
      const current = Array.isArray(context) ? context[0] : context;
      if (!current?.instance_id) throw new Error("Nenhuma loja ativa foi encontrada neste domínio.");

      setInstanceId(current.instance_id);
      setStoreName(current.instance_name || current.organization_name || "Pedidos");

      const { data, error: ordersError } = await adminRpc("get_admin_orders", {
        p_instance_id: current.instance_id,
        p_status: filter === "ALL" ? null : filter,
      });
      if (ordersError) throw ordersError;

      const next = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        order_number: Number(item.order_number),
        subtotal: Number(item.subtotal),
        delivery_fee: Number(item.delivery_fee),
        total: Number(item.total),
      })) as Order[];
      setOrders(next);
      setSelected((currentSelected) =>
        currentSelected ? next.find((item) => item.id === currentSelected.id) ?? null : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
  }, []);

  useEffect(() => {
    if (session) void loadOrders();
  }, [session, filter]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(timer);
  }, [session, filter]);

  const pendingCount = useMemo(
    () => orders.filter((order) => ["RECEIVED", "CONFIRMED", "PREPARING"].includes(order.status)).length,
    [orders],
  );

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    else setSession(true);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(false);
    setOrders([]);
    setSelected(null);
  };

  const changeStatus = async (status: OrderStatus) => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const { data, error: updateError } = await adminRpc("update_admin_order_status", {
      p_order_id: selected.id,
      p_status: status,
      p_note: null,
    });
    if (updateError) setError(updateError.message);
    else {
      const updated = (Array.isArray(data) ? data[0] : data) as Order;
      setSelected(updated);
      await loadOrders();
    }
    setLoading(false);
  };

  if (session === null) {
    return <div className="grid min-h-screen place-items-center bg-[#0e0c0b] text-[#f7efe6]">Carregando painel...</div>;
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0e0c0b] px-4 text-[#f7efe6]">
        <section className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1614] p-6 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[14px] bg-[#ff6a3d] text-[#0e0c0b]"><ShoppingBag className="size-5" /></span>
            <div><p className="text-xs uppercase tracking-[.18em] text-white/50">Painel</p><h1 className="font-display text-2xl">Pedidos da loja</h1></div>
          </div>
          <div className="space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail" className="h-12 w-full rounded-[14px] border border-white/10 bg-black/20 px-4 outline-none focus:border-[#ff6a3d]" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" onKeyDown={(e) => { if (e.key === "Enter") void signIn(); }} className="h-12 w-full rounded-[14px] border border-white/10 bg-black/20 px-4 outline-none focus:border-[#ff6a3d]" />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button onClick={() => void signIn()} disabled={loading || !email || !password} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff6a3d] font-bold text-[#0e0c0b] disabled:opacity-50"><LogIn className="size-4" /> Entrar</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0e0c0b] text-[#f7efe6]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0e0c0b]/95 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[.2em] text-[#ff6a3d]">{storeName}</p><h1 className="font-display text-2xl">Pedidos</h1><p className="text-xs text-white/45">{pendingCount} em andamento</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadOrders()} className="grid size-10 place-items-center rounded-[14px] border border-white/10 bg-white/[.04]" aria-label="Atualizar"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /></button>
            <button onClick={() => void signOut()} className="grid size-10 place-items-center rounded-[14px] border border-white/10 bg-white/[.04]" aria-label="Sair"><LogOut className="size-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilter("ALL")} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === "ALL" ? "bg-[#ff6a3d] text-[#0e0c0b]" : "bg-white/[.06] text-white/65"}`}>Todos</button>
          {statuses.map((status) => <button key={status.value} onClick={() => setFilter(status.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === status.value ? "bg-[#ff6a3d] text-[#0e0c0b]" : "bg-white/[.06] text-white/65"}`}>{status.label}</button>)}
        </div>

        {error && <div className="mb-4 rounded-[14px] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-[14px] border border-white/10 bg-[#1a1614] p-10 text-center text-sm text-white/45">Nenhum pedido encontrado.</div>
            ) : orders.map((order) => (
              <button key={order.id} onClick={() => setSelected(order)} className={`w-full rounded-[14px] border p-4 text-left transition ${selected?.id === order.id ? "border-[#ff6a3d] bg-[#1a1614]" : "border-white/10 bg-[#1a1614]/80 hover:border-white/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs uppercase tracking-[.14em] text-white/45">Pedido #{order.order_number}</p><h2 className="mt-1 text-base font-bold">{order.customer_name}</h2><p className="mt-1 text-xs text-white/50">{order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"} · {order.customer_phone}</p></div>
                  <span className="rounded-full bg-[#ff6a3d]/10 px-2.5 py-1 text-[10px] font-bold text-[#ff9a7b]">{statuses.find((s) => s.value === order.status)?.label}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-white/45"><Clock3 className="size-3.5" />{new Date(order.created_at).toLocaleString("pt-BR")}</span><strong>{formatCurrency(order.total)}</strong></div>
              </button>
            ))}
          </section>

          <aside className="h-fit rounded-[14px] border border-white/10 bg-[#1a1614] p-5 lg:sticky lg:top-24">
            {!selected ? <div className="py-12 text-center text-sm text-white/40"><UserRound className="mx-auto mb-3 size-7" />Selecione um pedido para ver os detalhes.</div> : (
              <div>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.18em] text-[#ff6a3d]">Pedido #{selected.order_number}</p><h2 className="mt-1 font-display text-2xl">{selected.customer_name}</h2></div><Check className="size-5 text-[#ff6a3d]" /></div>
                <div className="mt-5 space-y-2 text-sm">
                  <p><span className="text-white/40">Telefone:</span> {selected.customer_phone}</p>
                  <p><span className="text-white/40">Pagamento:</span> {selected.payment_method}</p>
                  {selected.fulfillment === "DELIVERY" && <p><span className="text-white/40">Endereço:</span> {selected.address_street}, {selected.address_number}, {selected.address_neighborhood}{selected.address_complement ? `, ${selected.address_complement}` : ""}</p>}
                  {selected.notes && <p><span className="text-white/40">Observações:</span> {selected.notes}</p>}
                </div>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-white/40">Atualizar status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {statuses.map((status) => <button key={status.value} onClick={() => void changeStatus(status.value)} disabled={loading || selected.status === status.value} className={`rounded-[14px] border px-3 py-2.5 text-xs font-bold disabled:opacity-40 ${selected.status === status.value ? "border-[#ff6a3d] bg-[#ff6a3d]/10 text-[#ff9a7b]" : "border-white/10 bg-white/[.03]"}`}>{status.label}</button>)}
                  </div>
                </div>
                <div className="mt-5 border-t border-white/10 pt-5"><div className="flex justify-between text-sm text-white/55"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div><div className="mt-1 flex justify-between text-sm text-white/55"><span>Entrega</span><span>{formatCurrency(selected.delivery_fee)}</span></div><div className="mt-3 flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(selected.total)}</span></div></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
