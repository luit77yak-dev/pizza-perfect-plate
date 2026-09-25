import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Clock3, LogOut, Package, RefreshCw, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import type { OrderStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/painel")({
  component: StaffPanel,
});

type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  payment_method: "CASH" | "PIX" | "CARD_ON_DELIVERY" | "CARD_ON_SITE";
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_complement: string | null;
  notes: string | null;
  created_at: string;
  order_items: Array<{
    id: string;
    product_name: string;
    second_product_name: string | null;
    size_name: string | null;
    crust_name: string | null;
    quantity: number;
    unit_price: number;
    notes: string | null;
  }>;
};

const statusFlow: Array<{ value: OrderStatus; label: string }> = [
  { value: "RECEIVED", label: "Recebido" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PREPARING", label: "Preparando" },
  { value: "READY", label: "Pronto" },
  { value: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { value: "DELIVERED", label: "Entregue" },
];

const statusLabel: Record<OrderStatus, string> = {
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const paymentLabel = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CARD_ON_DELIVERY: "Cartão na entrega",
  CARD_ON_SITE: "Cartão no local",
};

function StaffPanel() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSignedIn(Boolean(data.session));
    setSessionChecked(true);
    if (data.session) await loadOrganization(data.session.user.id);
  };

  const loadOrganization = async (userId: string) => {
    const { data, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", userId)
      .eq("active", true)
      .in("role", ["OWNER", "ADMIN", "ATTENDANT", "KITCHEN", "DRIVER"])
      .limit(1)
      .maybeSingle();

    if (memberError) {
      setError(memberError.message);
      return;
    }
    if (!data) {
      setError("Sua conta não possui acesso ao painel de uma loja.");
      return;
    }

    setOrganizationId(data.organization_id);
    const org = data.organizations as { name?: string } | null;
    setOrganizationName(org?.name ?? "Sua loja");
    await loadOrders(data.organization_id);
  };

  const loadOrders = async (orgId = organizationId) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const { data, error: ordersError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (ordersError) setError(ordersError.message);
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSignedIn(Boolean(nextSession));
      if (nextSession) void loadOrganization(nextSession.user.id);
      else {
        setOrganizationId(null);
        setOrders([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setAuthLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else if (data.user) await loadOrganization(data.user.id);
    setAuthLoading(false);
  };

  const updateStatus = async (order: Order, nextStatus: OrderStatus) => {
    if (!organizationId || order.status === nextStatus) return;
    setError(null);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", order.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.from("order_status_history").insert({
      organization_id: organizationId,
      order_id: order.id,
      status: nextStatus,
      note: null,
    });
    await loadOrders();
  };

  const activeOrders = useMemo(
    () => orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status)),
    [orders],
  );

  if (!sessionChecked) {
    return <PanelShell><div className="p-8 text-sm text-muted-foreground">Carregando painel...</div></PanelShell>;
  }

  if (!signedIn) {
    return (
      <PanelShell>
        <div className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
          <section className="w-full rounded-[2rem] border bg-card p-7 shadow-lifted">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Package className="size-7" />
            </div>
            <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[.18em] text-primary">Pizza Perfect Plate</p>
            <h1 className="mt-1 text-center text-3xl">Painel da loja</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Entre para acompanhar e atualizar os pedidos.</p>
            <div className="mt-6 space-y-3">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail" className="h-12 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" onKeyDown={(e) => e.key === "Enter" && void signIn()} className="h-12 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
              {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button onClick={() => void signIn()} disabled={authLoading || !email || !password} className="h-12 w-full rounded-full">
                {authLoading ? "Entrando..." : "Entrar no painel"}
              </Button>
            </div>
          </section>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Painel</p>
            <h1 className="truncate text-xl font-semibold">{organizationName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={loading} className="rounded-full">
              <RefreshCw className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void supabase.auth.signOut()} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{activeOrders.length} pedido(s) em andamento</p>
            <h2 className="mt-1 text-3xl">Pedidos</h2>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Clock3 className="size-4" /> Atualização manual
          </div>
        </div>

        {error && <div className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {activeOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Nenhum pedido em andamento</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando chegar um pedido, ele aparecerá aqui.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} onStatus={updateStatus} />
            ))}
          </div>
        )}
      </main>
    </PanelShell>
  );
}

function OrderCard({ order, onStatus }: { order: Order; onStatus: (order: Order, status: OrderStatus) => void }) {
  const nextIndex = statusFlow.findIndex((item) => item.value === order.status) + 1;
  const next = statusFlow[nextIndex];

  return (
    <article className="overflow-hidden rounded-[1.5rem] border bg-card shadow-soft">
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">#{order.order_number}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{statusLabel[order.status]}</span>
          </div>
          <h3 className="mt-3 text-xl">{order.customer_name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><UserRound className="size-3.5" />{order.customer_phone}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{formatCurrency(order.total)}</p>
          <p className="text-xs text-muted-foreground">{paymentLabel[order.payment_method]}</p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {order.order_items.map((item) => (
          <div key={item.id} className="rounded-xl bg-muted/60 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <p className="font-semibold">{item.quantity}× {item.product_name}{item.second_product_name ? ` + ${item.second_product_name}` : ""}</p>
              <span className="font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{[item.size_name, item.crust_name].filter(Boolean).join(" · ")}</p>
            {item.notes && <p className="mt-1 text-xs">Obs.: {item.notes}</p>}
          </div>
        ))}

        {order.fulfillment === "DELIVERY" && (
          <div className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">Entrega</p>
            <p className="mt-1 text-muted-foreground">
              {order.address_street}, {order.address_number} · {order.address_neighborhood}
              {order.address_complement ? ` · ${order.address_complement}` : ""}
            </p>
          </div>
        )}

        {order.notes && <p className="text-sm"><strong>Observação:</strong> {order.notes}</p>}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          {next && (
            <Button onClick={() => onStatus(order, next.value)} className="h-11 flex-1 rounded-full">
              <Check className="mr-2 size-4" /> {next.label}
            </Button>
          )}
          {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
            <Button variant="outline" onClick={() => onStatus(order, "CANCELLED")} className="h-11 rounded-full">
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
