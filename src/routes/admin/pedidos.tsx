import { sameDeliveryBackend } from "@/core/delivery/backend-binding";
import { STOREFRONT_URL } from "@/integrations/storefront-backend/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, LogIn, LogOut, RefreshCw, ShoppingBag, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  size_name: string | null;
  crust_name: string | null;
  selection_snapshot: { contract_version?: string; groups?: unknown[] } | null;
  addons: Array<{ name?: string; quantity?: number }>;
};
type OrderDetail = {
  order: Order;
  items: OrderItem[];
  history: Array<{ id: string; to_status: string }>;
};
type StoreContext = { instance_id: string; instance_name?: string; organization_name?: string };
type AdminRpcResults = {
  get_public_storefront_context: StoreContext | StoreContext[];
  get_admin_orders: Order[];
  get_admin_order_detail: OrderDetail;
  update_admin_order_status: Order | Order[];
};
type AdminRpcTransport = <K extends keyof AdminRpcResults>(
  fn: K,
  args?: Record<string, unknown>,
) => Promise<{ data: AdminRpcResults[K] | null; error: { message: string; code?: string } | null }>;
const adminRpc: AdminRpcTransport = supabase.rpc.bind(supabase) as unknown as AdminRpcTransport;

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
  const [requestedInstance, setRequestedInstance] = useState("");
  const backendMatches = sameDeliveryBackend(import.meta.env["VITE_SUPABASE_URL"], STOREFRONT_URL);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Pedidos");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSequence = useRef(0);
  const detailSequence = useRef(0);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const statusBusy = useRef(false);
  const invalidate = useCallback(() => {
    requestSequence.current++;
    detailSequence.current++;
  }, []);
  const invalidateDetail = useCallback(() => {
    detailSequence.current++;
  }, []);
  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange((_event, next) => {
      if (!next) {
        setLoading(false);
        statusBusy.current = false;
        requestSequence.current++;
        detailSequence.current++;
        setSession(false);
        setOrders([]);
        setSelected(null);
        setDetail(null);
        setInstanceId(null);
      }
    });
    return () => {
      subscription.data.subscription.unsubscribe();
      invalidate();
    };
  }, [invalidate]);
  useEffect(() => {
    const sequence = ++detailSequence.current;
    setDetail(null);
    if (!selected || !instanceId || selected.instance_id !== instanceId) return;
    void adminRpc("get_admin_order_detail", { p_instance_id: instanceId, p_order_id: selected.id })
      .then(({ data, error: detailError }) => {
        if (sequence !== detailSequence.current) return;
        if (
          detailError ||
          !data ||
          data.order.instance_id !== instanceId ||
          data.order.id !== selected.id
        ) {
          setError("Não foi possível obter detalhes autorizados.");
          return;
        }
        setDetail(data);
      })
      .catch(() => {
        if (sequence === detailSequence.current) setError("Detalhes indisponíveis.");
      });
    return () => {
      invalidateDetail();
    };
  }, [selected, instanceId, invalidateDetail]);
  const loadOrders = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      if (!backendMatches)
        throw new Error("O painel e o catálogo devem usar o mesmo backend autorizado.");
      const { data: userData } = await supabase.auth.getUser();
      if (sequence !== requestSequence.current) return;
      if (!userData.user) {
        setOrders([]);
        setSelected(null);
        setDetail(null);
        setInstanceId(null);
        setSession(false);
        return;
      }
      setSession(true);

      if (
        requestedInstance &&
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          requestedInstance,
        )
      )
        throw new Error("Informe um identificador de instância válido.");
      const domain = window.location.hostname.replace(/\.$/, "").toLowerCase();
      const { data: context, error: contextError } = requestedInstance
        ? { data: { instance_id: requestedInstance } as StoreContext, error: null }
        : await adminRpc("get_public_storefront_context", { p_domain: domain });
      if (contextError) throw contextError;
      const current = Array.isArray(context) ? context[0] : context;
      if (!current?.instance_id)
        throw new Error("Nenhuma loja ativa foi encontrada neste domínio.");

      const { data, error: ordersError } = await adminRpc("get_admin_orders", {
        p_instance_id: current.instance_id,
        p_status: filter === "ALL" ? null : filter,
      });
      if (ordersError) throw ordersError;

      if (sequence !== requestSequence.current) return;
      setInstanceId(current.instance_id);
      setStoreName(current.instance_name || current.organization_name || "Pedidos");
      const next = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        order_number: Number(item.order_number),
        subtotal: Number(item.subtotal),
        delivery_fee: Number(item.delivery_fee),
        total: Number(item.total),
      })) as Order[];
      setOrders(next);
      setSelected((currentSelected) =>
        currentSelected ? (next.find((item) => item.id === currentSelected.id) ?? null) : null,
      );
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      setOrders([]);
      setSelected(null);
      setInstanceId(null);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os pedidos.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [backendMatches, requestedInstance, filter]);

  useEffect(() => {
    if (!backendMatches) {
      setSession(false);
      setError("Backend do painel incompatível com o catálogo.");
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
  }, [backendMatches]);

  useEffect(() => {
    if (session) void loadOrders();
  }, [session, loadOrders]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(timer);
  }, [session, loadOrders]);

  const pendingCount = useMemo(
    () =>
      orders.filter((order) => ["RECEIVED", "CONFIRMED", "PREPARING"].includes(order.status))
        .length,
    [orders],
  );

  const signIn = async () => {
    setLoading(true);
    setError(null);
    if (!backendMatches) {
      setError("Backend do painel incompatível com o catálogo.");
      setLoading(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) setError(authError.message);
    else {
      setPassword("");
      setSession(true);
    }
    setLoading(false);
  };

  const signOut = async () => {
    requestSequence.current++;
    setInstanceId(null);
    setRequestedInstance("");
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(false);
      setLoading(false);
      statusBusy.current = false;
      setPassword("");
      setDetail(null);
    }
    setSession(false);
    setOrders([]);
    setSelected(null);
  };

  const changeStatus = async (status: OrderStatus) => {
    if (!selected || selected.instance_id !== instanceId || statusBusy.current) return;
    statusBusy.current = true;
    const sequence = requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await adminRpc("update_admin_order_status", {
        p_order_id: selected.id,
        p_status: status,
        p_note: null,
      });
      if (sequence !== requestSequence.current) {
        statusBusy.current = false;
        return;
      }
      if (updateError) setError(updateError.message);
      else {
        const updated = (Array.isArray(data) ? data[0] : data) as Order;
        if (updated?.instance_id !== instanceId || updated.id !== selected.id) {
          setError("Resposta incompatível com a instância.");
          statusBusy.current = false;
          setLoading(false);
          return;
        }
        setSelected(updated);
        await loadOrders();
      }
      statusBusy.current = false;
      setLoading(false);
    } catch {
      if (sequence === requestSequence.current)
        setError("Operação indisponível. Atualize o pedido antes de repetir.");
    } finally {
      statusBusy.current = false;
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  if (session === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0e0c0b] text-[#f7efe6]">
        Carregando painel...
      </div>
    );
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0e0c0b] px-4 text-[#f7efe6]">
        <section className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1614] p-6 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[14px] bg-[#ff6a3d] text-[#0e0c0b]">
              <ShoppingBag className="size-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[.18em] text-white/50">Painel</p>
              <h1 className="font-display text-2xl">Pedidos da loja</h1>
            </div>
          </div>
          <div className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="E-mail"
              type="email"
              placeholder="E-mail"
              className="h-12 w-full rounded-[14px] border border-white/10 bg-black/20 px-4 outline-none focus:border-[#ff6a3d]"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Senha"
              type="password"
              placeholder="Senha"
              onKeyDown={(e) => {
                if (e.key === "Enter") void signIn();
              }}
              className="h-12 w-full rounded-[14px] border border-white/10 bg-black/20 px-4 outline-none focus:border-[#ff6a3d]"
            />
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              onClick={() => void signIn()}
              disabled={loading || !email || !password}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff6a3d] font-bold text-[#0e0c0b] disabled:opacity-50"
            >
              <LogIn className="size-4" /> Entrar
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0e0c0b] text-[#f7efe6]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0e0c0b]/95 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-[#ff6a3d]">{storeName}</p>
            <h1 className="font-display text-2xl">Pedidos</h1>
            <p className="text-xs text-white/45">{pendingCount} em andamento</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadOrders()}
              className="grid size-10 place-items-center rounded-[14px] border border-white/10 bg-white/[.04]"
              aria-label="Atualizar"
            >
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            </button>
            <button
              onClick={() => void signOut()}
              className="grid size-10 place-items-center rounded-[14px] border border-white/10 bg-white/[.04]"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <label className="mb-4 block text-sm">
          Instância (vazio utiliza o domínio atual; a RPC verifica sua autorização)
          <input
            aria-label="Instância"
            value={requestedInstance}
            onChange={(event) => {
              requestSequence.current++;
              setOrders([]);
              setSelected(null);
              setInstanceId(null);
              setRequestedInstance(event.target.value.trim());
            }}
            className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 p-3"
            placeholder="UUID da loja autorizada"
          />
        </label>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter("ALL")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === "ALL" ? "bg-[#ff6a3d] text-[#0e0c0b]" : "bg-white/[.06] text-white/65"}`}
          >
            Todos
          </button>
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === status.value ? "bg-[#ff6a3d] text-[#0e0c0b]" : "bg-white/[.06] text-white/65"}`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-[14px] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-[14px] border border-white/10 bg-[#1a1614] p-10 text-center text-sm text-white/45">
                Nenhum pedido encontrado.
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className={`w-full rounded-[14px] border p-4 text-left transition ${selected?.id === order.id ? "border-[#ff6a3d] bg-[#1a1614]" : "border-white/10 bg-[#1a1614]/80 hover:border-white/20"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[.14em] text-white/45">
                        Pedido #{order.order_number}
                      </p>
                      <h2 className="mt-1 text-base font-bold">{order.customer_name}</h2>
                      <p className="mt-1 text-xs text-white/50">
                        {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"} ·{" "}
                        {order.customer_phone}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#ff6a3d]/10 px-2.5 py-1 text-[10px] font-bold text-[#ff9a7b]">
                      {statuses.find((s) => s.value === order.status)?.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/45">
                      <Clock3 className="size-3.5" />
                      {new Date(order.created_at).toLocaleString("pt-BR")}
                    </span>
                    <strong>{formatCurrency(order.total)}</strong>
                  </div>
                </button>
              ))
            )}
          </section>

          <aside className="h-fit rounded-[14px] border border-white/10 bg-[#1a1614] p-5 lg:sticky lg:top-24">
            {!selected ? (
              <div className="py-12 text-center text-sm text-white/40">
                <UserRound className="mx-auto mb-3 size-7" />
                Selecione um pedido para ver os detalhes.
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[.18em] text-[#ff6a3d]">
                      Pedido #{selected.order_number}
                    </p>
                    <h2 className="mt-1 font-display text-2xl">{selected.customer_name}</h2>
                  </div>
                  <Check className="size-5 text-[#ff6a3d]" />
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  <p>
                    <span className="text-white/40">Telefone:</span> {selected.customer_phone}
                  </p>
                  <p>
                    <span className="text-white/40">Pagamento:</span> {selected.payment_method}
                  </p>
                  {selected.fulfillment === "DELIVERY" && (
                    <p>
                      <span className="text-white/40">Endereço:</span> {selected.address_street},{" "}
                      {selected.address_number}, {selected.address_neighborhood}
                      {selected.address_complement ? `, ${selected.address_complement}` : ""}
                    </p>
                  )}
                  {selected.notes && (
                    <p>
                      <span className="text-white/40">Observações:</span> {selected.notes}
                    </p>
                  )}
                </div>
                <section aria-label="Itens do pedido" className="mt-4 space-y-2">
                  {detail?.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/10 p-3 text-sm">
                      <p>
                        {item.quantity} × {item.product_name}
                      </p>
                      <p>
                        {item.size_name} {item.crust_name}
                      </p>
                      <p>
                        {item.addons
                          ?.map((a) => a.name)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p>{formatCurrency(Number(item.line_total))}</p>
                    </div>
                  ))}
                  {!detail && <p role="status">Carregando detalhes autorizados...</p>}
                </section>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-white/40">
                    Atualizar status
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {statuses.map((status) => (
                      <button
                        key={status.value}
                        onClick={() => void changeStatus(status.value)}
                        disabled={loading || selected.status === status.value}
                        className={`rounded-[14px] border px-3 py-2.5 text-xs font-bold disabled:opacity-40 ${selected.status === status.value ? "border-[#ff6a3d] bg-[#ff6a3d]/10 text-[#ff9a7b]" : "border-white/10 bg-white/[.03]"}`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex justify-between text-sm text-white/55">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selected.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm text-white/55">
                    <span>Entrega</span>
                    <span>{formatCurrency(selected.delivery_fee)}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(selected.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
