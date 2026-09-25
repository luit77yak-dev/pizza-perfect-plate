import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, ImagePlus, LogOut, Package, RefreshCw, Trash2, Upload, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import type { OrderStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/painel")({
  component: StaffPanel,
});

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  available: boolean;
  sort_order: number;
};

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
  const [role, setRole] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [imageUploading, setImageUploading] = useState<string | null>(null);
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
    setRole(data.role);
    const org = data.organizations as { name?: string } | null;
    setOrganizationName(org?.name ?? "Sua loja");
    await Promise.all([loadOrders(data.organization_id), loadProducts(data.organization_id)]);
  };

  const loadProducts = async (orgId: string) => {
    const { data, error: productsError } = await supabase
      .from("products")
      .select("id, category_id, name, description, image_url, active, available, sort_order")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (productsError) setError(productsError.message);
    else setProducts((data ?? []) as Product[]);
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

  const uploadProductImage = async (product: Product, file: File) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setImageUploading(product.id);
    setError(null);

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${organizationId}/${product.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      setError(uploadError.message);
      setImageUploading(null);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: publicUrl.publicUrl })
      .eq("id", product.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, image_url: publicUrl.publicUrl } : item));
    }

    setImageUploading(null);
  };

  const removeProductImage = async (product: Product) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "") || !product.image_url) return;
    setImageUploading(product.id);
    setError(null);

    const marker = "/storage/v1/object/public/product-images/";
    const index = product.image_url.indexOf(marker);
    const path = index >= 0 ? decodeURIComponent(product.image_url.slice(index + marker.length)) : null;

    if (path) {
      await supabase.storage.from("product-images").remove([path]);
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: null })
      .eq("id", product.id)
      .eq("organization_id", organizationId);

    if (updateError) setError(updateError.message);
    else setProducts((current) => current.map((item) => item.id === product.id ? { ...item, image_url: null } : item));
    setImageUploading(null);
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
        {["OWNER", "ADMIN"].includes(role ?? "") && (
          <ProductImageManager
            products={products}
            uploadingProductId={imageUploading}
            onUpload={uploadProductImage}
            onRemove={removeProductImage}
          />
        )}

        <div className="mb-5 mt-8 flex items-end justify-between gap-4">
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

function ProductImageManager({
  products,
  uploadingProductId,
  onUpload,
  onRemove,
}: {
  products: Product[];
  uploadingProductId: string | null;
  onUpload: (product: Product, file: File) => void;
  onRemove: (product: Product) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Cardápio visual</p>
          <h2 className="mt-1 text-2xl">Fotos dos produtos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Envie fotos de até 5 MB. Elas aparecem automaticamente na vitrine.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImagePlus className="size-4" />
          {products.filter((product) => product.image_url).length}/{products.length} com foto
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-2xl border bg-background">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImagePlus className="size-8" />
                    <span className="text-xs">Sem foto</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-semibold">{product.name}</p>
                <div className="mt-3 flex gap-2">
                  <label className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                    <Upload className="mr-2 size-4" />
                    {uploadingProductId === product.id ? "Enviando..." : product.image_url ? "Trocar foto" : "Enviar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingProductId === product.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void onUpload(product, file);
                      }}
                    />
                  </label>
                  {product.image_url && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-full"
                      title="Remover foto"
                      disabled={uploadingProductId === product.id}
                      onClick={() => void onRemove(product)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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

function PanelShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
