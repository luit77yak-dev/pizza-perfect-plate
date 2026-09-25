import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Check, ChevronUp, Clock3, ImagePlus, LogOut, Menu, Package, Pencil, Plus, RefreshCw, Save, Settings2, ShoppingBag, Tag, Trash2, Upload, UserRound, X } from "lucide-react";
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
  kind: "PIZZA" | "SIMPLE";
  base_price: number;
  allow_half: boolean;
  active: boolean;
  featured: boolean;
  available: boolean;
  sort_order: number;
};

type Category = { id: string; name: string; active: boolean; sort_order: number };
type ProductSize = { id: string; name: string; slices: number | null; active: boolean; sort_order: number };
type ProductPrice = { id: string; product_id: string; size_id: string; price: number };
type Addon = { id: string; name: string; price: number; active: boolean; sort_order: number };

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([]);
  const [productAddonIds, setProductAddonIds] = useState<Record<string, string[]>>({});
  const [imageUploading, setImageUploading] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [savingAddonId, setSavingAddonId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "management" | "orders">("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      const { data: claimed } = await supabase.rpc("claim_first_owner" as never);
      if (claimed) return loadOrganization(userId);
      setError("Sua conta não possui acesso ao painel de uma loja.");
      return;
    }

    setOrganizationId(data.organization_id);
    setRole(data.role);
    const org = data.organizations as { name?: string } | null;
    setOrganizationName(org?.name ?? "Sua loja");
    await Promise.all([loadOrders(data.organization_id), loadProducts(data.organization_id), loadAddons(data.organization_id)]);
  };

  const loadProducts = async (orgId: string) => {
    const [productsResult, categoriesResult, sizesResult, pricesResult, productAddonsResult] = await Promise.all([
      supabase.from("products").select("id, category_id, name, description, image_url, kind, base_price, allow_half, active, featured, available, sort_order").eq("organization_id", orgId).order("sort_order", { ascending: true }).order("name", { ascending: true }),
      supabase.from("categories").select("id, name, active, sort_order").eq("organization_id", orgId).order("sort_order", { ascending: true }).order("name", { ascending: true }),
      supabase.from("product_sizes").select("id, name, slices, active, sort_order").eq("organization_id", orgId).order("sort_order", { ascending: true }),
      supabase.from("product_prices").select("id, product_id, size_id, price").eq("organization_id", orgId),
      supabase.from("product_addon_links").select("product_id, addon_id, sort_order").eq("organization_id", orgId).order("sort_order", { ascending: true }),
    ]);
    const firstError = productsResult.error ?? categoriesResult.error ?? sizesResult.error ?? pricesResult.error ?? productAddonsResult.error;
    if (firstError) { setError(firstError.message); return; }
    const addonMap: Record<string, string[]> = {};
    for (const row of productAddonsResult.data ?? []) {
      (addonMap[row.product_id] ??= []).push(row.addon_id);
    }
    setProducts((productsResult.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setSizes((sizesResult.data ?? []) as ProductSize[]);
    setProductPrices((pricesResult.data ?? []) as ProductPrice[]);
    setProductAddonIds(addonMap);
  };

  const loadAddons = async (orgId: string) => {
    const { data, error: addonsError } = await supabase
      .from("product_addons")
      .select("id, name, price, active, sort_order")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (addonsError) setError(addonsError.message);
    else setAddons((data ?? []) as Addon[]);
  };

  const saveAddon = async (draft: Addon) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!draft.name.trim()) { setError("Informe o nome do adicional."); return; }
    const price = Number(String(draft.price).replace(",", "."));
    if (!Number.isFinite(price) || price < 0) { setError("Informe um preço válido."); return; }
    setSavingAddonId(draft.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("product_addons")
      .update({ name: draft.name.trim(), price, active: draft.active })
      .eq("id", draft.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else await loadAddons(organizationId);
    setSavingAddonId(null);
  };

  const createAddon = async () => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    setError(null);
    const { data, error: createError } = await supabase
      .from("product_addons")
      .insert({ organization_id: organizationId, name: "Novo adicional", price: 0, active: true, sort_order: addons.length })
      .select("id, name, price, active, sort_order")
      .single();
    if (createError) { setError(createError.message); return; }
    setAddons((current) => [...current, data as Addon]);
    setSavingAddonId(null);
  };

  const toggleAddon = async (addon: Addon) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const next = !addon.active;
    const { error: updateError } = await supabase
      .from("product_addons")
      .update({ active: next })
      .eq("id", addon.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else setAddons((current) => current.map((item) => item.id === addon.id ? { ...item, active: next } : item));
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
    setAuthLoading(true);    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else if (data.user) await loadOrganization(data.user.id);
    setAuthLoading(false);
  };

  const signUp = async () => {
    setAuthLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/painel` },
    });
    if (signUpError) setError(signUpError.message);
    else if (data.session && data.user) await loadOrganization(data.user.id);
    else setError("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre aqui.");
    setAuthLoading(false);
  };

  const saveProduct = async (draft: Product, sizePrices: Record<string, string>, addonIds: string[]) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!draft.name.trim()) { setError("Informe o nome do produto."); return; }
    const basePrice = Number(String(draft.base_price).replace(",", "."));
    if (!Number.isFinite(basePrice) || basePrice < 0) { setError("Informe um preço base válido."); return; }
    setSavingProductId(draft.id);
    setError(null);
    const { error: productError } = await supabase.from("products").update({
      name: draft.name.trim(), description: draft.description?.trim() || null, category_id: draft.category_id || null,
      kind: draft.kind, base_price: basePrice, allow_half: draft.allow_half, active: draft.active,
      featured: draft.featured, available: draft.available,
    }).eq("id", draft.id).eq("organization_id", organizationId);
    if (productError) { setError(productError.message); setSavingProductId(null); return; }

    const { error: deletePricesError } = await supabase.from("product_prices").delete()
      .eq("organization_id", organizationId).eq("product_id", draft.id);
    if (deletePricesError) { setError(deletePricesError.message); setSavingProductId(null); return; }

    const priceRows = sizes
      .map((size) => ({ size, raw: sizePrices[size.id]?.trim() ?? "" }))
      .filter(({ raw }) => raw !== "")
      .map(({ size, raw }) => ({ organization_id: organizationId, product_id: draft.id, size_id: size.id, price: Number(raw.replace(",", ".")) }))
      .filter((row) => Number.isFinite(row.price) && row.price >= 0);
    if (priceRows.length) {
      const { error: pricesError } = await supabase.from("product_prices").insert(priceRows);
      if (pricesError) { setError(pricesError.message); setSavingProductId(null); return; }
    }

    const { error: deleteAddonsError } = await supabase.from("product_addon_links").delete()
      .eq("organization_id", organizationId).eq("product_id", draft.id);
    if (deleteAddonsError) { setError(deleteAddonsError.message); setSavingProductId(null); return; }

    const addonRows = [...new Set(addonIds)]
      .map((addonId, index) => ({
        organization_id: organizationId,
        product_id: draft.id,
        addon_id: addonId,
        sort_order: index,
      }));
    if (addonRows.length) {
      const { error: addonsError } = await supabase.from("product_addon_links").insert(addonRows);
      if (addonsError) { setError(addonsError.message); setSavingProductId(null); return; }
    }

    await loadProducts(organizationId);
    setEditingProductId(null);
    setSavingProductId(null);
  };

  const createProduct = async () => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    setError(null);
    const { data, error: createError } = await supabase.from("products").insert({
      organization_id: organizationId, name: "Novo produto", description: "", kind: "SIMPLE",
      base_price: 0, active: true, available: true, featured: false, allow_half: false, sort_order: products.length,
    }).select("id, category_id, name, description, image_url, kind, base_price, allow_half, active, featured, available, sort_order").single();
    if (createError) { setError(createError.message); return; }
    const created = data as Product;
    setProducts((current) => [...current, created]);
    setEditingProductId(created.id);
  };

  const toggleProduct = async (product: Product, field: "active" | "available" | "featured") => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const next = !product[field];
    const patch: { active?: boolean; available?: boolean; featured?: boolean } = { [field]: next };
    const { error: updateError } = await supabase.from("products").update(patch)
      .eq("id", product.id).eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else setProducts((current) => current.map((item) => item.id === product.id ? { ...item, [field]: next } : item));
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

  const todayHighlights = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayOrders = orders.filter((order) => {
      const createdAt = new Date(order.created_at);
      return createdAt >= start && createdAt < end;
    });
    const completed = todayOrders.filter((order) => order.status === "DELIVERED");
    const inProgress = todayOrders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status));
    const cancelled = todayOrders.filter((order) => order.status === "CANCELLED");
    const revenue = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageTicket = completed.length ? revenue / completed.length : 0;
    return { todayOrders, completed, inProgress, cancelled, revenue, averageTicket };
  }, [orders]);

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
              <Button variant="outline" onClick={() => void signUp()} disabled={authLoading || !email || password.length < 6} className="h-12 w-full rounded-full">
                Criar conta
              </Button>
            </div>
          </section>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Painel</p>
            <h1 className="truncate text-xl font-semibold">{organizationName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={loading} className="rounded-full">
              <RefreshCw className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void supabase.auth.signOut()} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full sm:hidden" onClick={() => setMobileMenuOpen((current) => !current)} aria-label="Abrir menu" aria-expanded={mobileMenuOpen}>
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 px-4 pb-3 sm:flex sm:px-6" aria-label="Navegação do painel">
          <PanelNavButton active={activeView === "overview"} icon={BarChart3} label="Visão geral" onClick={() => setActiveView("overview")} />
          {["OWNER", "ADMIN"].includes(role ?? "") && (
            <PanelNavButton active={activeView === "management"} icon={Settings2} label="Gestão" onClick={() => setActiveView("management")} />
          )}
          <PanelNavButton active={activeView === "orders"} icon={ShoppingBag} label="Pedidos" onClick={() => setActiveView("orders")} />
        </nav>
        {mobileMenuOpen && (
          <nav className="border-t px-4 py-3 sm:hidden" aria-label="Navegação do painel">
            <div className="grid gap-2">
              <PanelNavButton active={activeView === "overview"} icon={BarChart3} label="Visão geral" onClick={() => { setActiveView("overview"); setMobileMenuOpen(false); }} />
              {["OWNER", "ADMIN"].includes(role ?? "") && (
                <PanelNavButton active={activeView === "management"} icon={Settings2} label="Gestão" onClick={() => { setActiveView("management"); setMobileMenuOpen(false); }} />
              )}
              <PanelNavButton active={activeView === "orders"} icon={ShoppingBag} label="Pedidos" onClick={() => { setActiveView("orders"); setMobileMenuOpen(false); }} />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <section className={`mb-5 rounded-[1.5rem] border bg-card p-4 shadow-soft sm:p-5 ${activeView === "overview" ? "" : "hidden"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Resumo de hoje</p>
              <h2 className="mt-1 text-2xl sm:text-3xl">Destaques do dia</h2>
              <p className="mt-1 text-sm text-muted-foreground">Uma visão rápida do movimento da sua loja hoje.</p>
            </div>
            <p className="text-xs text-muted-foreground">{todayHighlights.todayOrders.length} pedido(s) registrados hoje</p>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <HighlightCard label="Pedidos hoje" value={String(todayHighlights.todayOrders.length)} hint="Todos os pedidos recebidos" />
            <HighlightCard label="Em andamento" value={String(todayHighlights.inProgress.length)} hint="Pedidos que ainda não foram concluídos" />
            <HighlightCard label="Faturamento" value={formatCurrency(todayHighlights.revenue)} hint="Pedidos entregues hoje" />
            <HighlightCard label="Ticket médio" value={formatCurrency(todayHighlights.averageTicket)} hint="Média dos pedidos entregues" />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Status do dia</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">{todayHighlights.completed.length} entregues</span>
                <span className="rounded-full bg-muted px-3 py-1.5 font-medium">{todayHighlights.inProgress.length} em andamento</span>
                <span className="rounded-full bg-destructive/10 px-3 py-1.5 font-medium text-destructive">{todayHighlights.cancelled.length} cancelados</span>
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Cardápio</p>
              <p className="mt-2 text-2xl font-semibold">{products.filter((product) => product.active && product.available).length}</p>
              <p className="text-sm text-muted-foreground">produtos ativos e disponíveis para venda</p>
            </div>
          </div>
        </section>

        <div className={activeView === "overview" ? "" : "hidden"}>
          <SectionHeading
          eyebrow="Operação"
          title="Acompanhamento dos pedidos"
          description="Consulte rapidamente os últimos pedidos e avance o atendimento."
          />
          <RecentOrdersSection orders={orders.slice(0, 6)} onStatus={updateStatus} />
          <QuickActionsSection />
        </div>

        {["OWNER", "ADMIN"].includes(role ?? "") && activeView === "management" && (
          <SectionHeading
            eyebrow="Gestão"
            title="Catálogo da loja"
            description="Organize produtos, adicionais e fotos em um único espaço."
          />
        )}

        {["OWNER", "ADMIN"].includes(role ?? "") && activeView === "management" && (
          <div className="space-y-5 rounded-[1.5rem] border bg-muted/20 p-1.5 sm:p-2">
            <ProductCatalogManager
            products={products}
            categories={categories}
            sizes={sizes}
            prices={productPrices}
            addons={addons}
            productAddonIds={productAddonIds}
            editingProductId={editingProductId}
            savingProductId={savingProductId}
            onCreate={createProduct}
            onEdit={setEditingProductId}
            onSave={saveProduct}
            onToggle={toggleProduct}
          />
            <AddonManager
            addons={addons}
            savingAddonId={savingAddonId}
            onCreate={createAddon}
            onSave={saveAddon}
            onToggle={toggleAddon}
          />
            <ProductImageManager
            products={products}
            uploadingProductId={imageUploading}
            onUpload={uploadProductImage}
            onRemove={removeProductImage}
          />
          </div>
        )}

        <div className={activeView === "orders" ? "" : "hidden"}>
          <SectionHeading
          eyebrow="Atendimento"
          title="Fila de pedidos"
          description="Pedidos que ainda precisam de alguma ação da equipe."
          />

        <div id="pedidos" className="mb-5 mt-6 scroll-mt-24 flex items-end justify-between gap-4">
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
        </div>
      </main>
    </PanelShell>
  );
}

function PanelNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BarChart3;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-3 mt-7 flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function HighlightCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-background p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickActionsSection() {
  const actions = [
    { label: "Ver pedidos", description: "Acompanhe pedidos e atualize os status.", icon: ShoppingBag, target: "pedidos" },
    { label: "Gerenciar produtos", description: "Edite preços, disponibilidade e destaques.", icon: Package, target: "produtos" },
    { label: "Gerenciar adicionais", description: "Configure os extras disponíveis no cardápio.", icon: Tag, target: "adicionais" },
    { label: "Fotos do cardápio", description: "Troque ou envie fotos dos produtos.", icon: ImagePlus, target: "fotos-produtos" },
  ];

  const goTo = (target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mb-5 rounded-[1.25rem] border bg-card p-4 shadow-soft sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Acesso rápido</p>
        <h2 className="mt-1 text-2xl">Atalhos do painel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chegue às tarefas mais usadas em um toque.</p>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.target}
              type="button"
              onClick={() => goTo(action.target)}
              className="group rounded-xl border bg-background p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <p className="mt-3 font-semibold">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RecentOrdersSection({
  orders,
  onStatus,
}: {
  orders: Order[];
  onStatus: (order: Order, status: OrderStatus) => void;
}) {
  return (
    <section className="mb-5 rounded-[1.25rem] border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Acompanhamento</p>
          <h2 className="mt-1 text-2xl">Pedidos recentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Os últimos pedidos recebidos aparecem aqui para consulta rápida.</p>
        </div>
        <span className="text-xs text-muted-foreground">Últimos {orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ainda não há pedidos registrados.
        </div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {orders.map((order) => {
            const nextIndex = statusFlow.findIndex((item) => item.value === order.status) + 1;
            const next = statusFlow[nextIndex];
            return (
              <div key={order.id} className="flex flex-col gap-3 rounded-xl border bg-background p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">#{order.order_number}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{statusLabel[order.status]}</span>
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="truncate font-semibold">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className="font-bold">{formatCurrency(order.total)}</p>
                  {next && order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                    <Button size="sm" onClick={() => onStatus(order, next.value)} className="rounded-full">
                      {next.label}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProductCatalogManager({
  products, categories, sizes, prices, addons, productAddonIds, editingProductId, savingProductId, onCreate, onEdit, onSave, onToggle,}: {
  products: Product[]; categories: Category[]; sizes: ProductSize[]; prices: ProductPrice[]; addons: Addon[];
  productAddonIds: Record<string, string[]>;
  editingProductId: string | null; savingProductId: string | null; onCreate: () => void; onEdit: (id: string | null) => void;
  onSave: (product: Product, sizePrices: Record<string, string>, addonIds: string[]) => void;
  onToggle: (product: Product, field: "active" | "available" | "featured") => void;
}) {
  return (
    <section id="produtos" className="rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Cardápio</p>
          <h2 className="mt-1 text-2xl">Produtos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Edite nomes, preços, categorias e disponibilidade sem mexer no código.</p>
        </div>
        <Button onClick={onCreate} className="rounded-full"><Plus className="mr-2 size-4" /> Novo produto</Button>
      </div>
      <div className="mt-4 space-y-1.5">
        {products.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</div> :
          products.map((product) => <ProductEditorRow key={product.id} product={product} categories={categories} sizes={sizes} prices={prices}
            addons={addons} addonIds={productAddonIds[product.id] ?? []}
            expanded={editingProductId === product.id} saving={savingProductId === product.id} onEdit={() => onEdit(editingProductId === product.id ? null : product.id)}
            onSave={onSave} onToggle={onToggle} />)}
      </div>
    </section>
  );
}

function ProductEditorRow({
  product, categories, sizes, prices, addons, addonIds, expanded, saving, onEdit, onSave, onToggle,
}: {
  product: Product; categories: Category[]; sizes: ProductSize[]; prices: ProductPrice[]; addons: Addon[]; addonIds: string[];
  expanded: boolean; saving: boolean; onEdit: () => void; onSave: (product: Product, sizePrices: Record<string, string>, addonIds: string[]) => void;
  onToggle: (product: Product, field: "active" | "available" | "featured") => void;
}) {
  const [draft, setDraft] = useState(product);
  const [sizePrices, setSizePrices] = useState<Record<string, string>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(addonIds);

  useEffect(() => {
    setDraft(product);
    const initial: Record<string, string> = {};
    sizes.forEach((size) => {
      const row = prices.find((item) => item.product_id === product.id && item.size_id === size.id);
      initial[size.id] = row ? String(row.price) : "";
    });
    setSizePrices(initial);
    setSelectedAddonIds(addonIds);
  }, [product, prices, sizes, addonIds]);

  const categoryName = categories.find((category) => category.id === product.category_id)?.name;

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
            {product.image_url ? <img src={product.image_url} alt="" className="size-full object-cover" /> :
              <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">{product.name.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div className="min-w-0"><p className="truncate font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{categoryName || "Sem categoria"} · {formatCurrency(Number(product.base_price))}{!product.active ? " · oculto" : ""}{!product.available ? " · indisponível" : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onEdit}>{expanded ? <ChevronUp className="mr-1.5 size-4" /> : <Pencil className="mr-1.5 size-4" />}{expanded ? "Fechar" : "Editar"}</Button>
          <Button variant={product.available ? "outline" : "secondary"} size="sm" className="rounded-full" onClick={() => onToggle(product, "available")}>{product.available ? "Disponível" : "Indisponível"}</Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome *</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
            </label>
            <label className="text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Preço base *</span>
              <input value={draft.base_price} onChange={(e) => setDraft({ ...draft, base_price: Number(e.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
            </label>
          </div>
          <label className="mt-3 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span>
            <textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={300} className="w-full rounded-xl border bg-background px-3 py-2 outline-none focus:border-primary" />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Categoria</span>
              <select value={draft.category_id ?? ""} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })} className="h-11 w-full rounded-xl border bg-background px-3">
                <option value="">Sem categoria</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo</span>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Product["kind"] })} className="h-11 w-full rounded-xl border bg-background px-3">
                <option value="PIZZA">Pizza</option><option value="SIMPLE">Produto simples</option>
              </select>
            </label>
          </div>
          {sizes.length > 0 && (
            <div className="mt-4 rounded-xl border bg-background p-3.5">
              <p className="text-sm font-semibold">Preços por tamanho</p><p className="mt-1 text-xs text-muted-foreground">Deixe vazio para usar o preço base.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sizes.filter((size) => size.active).map((size) => <label key={size.id} className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{size.name}{size.slices ? ` · ${size.slices} fatias` : ""}</span>
                  <input value={sizePrices[size.id] ?? ""} onChange={(e) => setSizePrices((current) => ({ ...current, [size.id]: e.target.value }))} inputMode="decimal" placeholder={String(draft.base_price)} className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>)}
              </div>
            </div>
          )}
          {addons.length > 0 && (
            <div className="mt-4 rounded-xl border bg-background p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Adicionais deste produto</p>
                  <p className="mt-1 text-xs text-muted-foreground">Escolha quais extras aparecem para o cliente ao montar este produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAddonIds((current) => current.length === addons.length ? [] : addons.filter((addon) => addon.active).map((addon) => addon.id))}
                  className="text-xs font-semibold text-primary"
                >
                  {selectedAddonIds.length > 0 ? "Limpar" : "Selecionar ativos"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {addons.filter((addon) => addon.active || selectedAddonIds.includes(addon.id)).map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => setSelectedAddonIds((current) => checked ? current.filter((id) => id !== addon.id) : [...current, addon.id])}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${checked ? "border-primary bg-primary/5" : "bg-card"}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                          {checked ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="truncate">{addon.name}</span>
                      </span>
                      <span className="ml-2 shrink-0 text-xs font-semibold">{formatCurrency(Number(addon.price))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setDraft({ ...draft, active: !draft.active })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${draft.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>No cardápio</button>
            <button type="button" onClick={() => setDraft({ ...draft, available: !draft.available })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${draft.available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>Disponível</button>
            <button type="button" onClick={() => setDraft({ ...draft, featured: !draft.featured })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${draft.featured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>Destaque</button>
            {draft.kind === "PIZZA" && <button type="button" onClick={() => setDraft({ ...draft, allow_half: !draft.allow_half })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${draft.allow_half ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>Meio a meio</button>}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onEdit} className="rounded-full"><X className="mr-1.5 size-4" /> Fechar</Button>
            <Button onClick={() => onSave(draft, sizePrices, selectedAddonIds)} disabled={saving} className="rounded-full"><Save className="mr-1.5 size-4" />{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddonManager({
  addons, savingAddonId, onCreate, onSave, onToggle,
}: {
  addons: Addon[];
  savingAddonId: string | null;
  onCreate: () => void;
  onSave: (addon: Addon) => void;
  onToggle: (addon: Addon) => void;
}) {
  return (
    <section id="adicionais" className="mt-5 rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Personalização</p>
          <h2 className="mt-1 text-2xl">Adicionais</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre extras que o cliente poderá escolher ao montar o pedido.</p>
        </div>
        <Button onClick={onCreate} className="rounded-full">
          <Plus className="mr-2 size-4" /> Novo adicional
        </Button>
      </div>

      <div className="mt-4 space-y-1.5">
        {addons.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum adicional cadastrado.
          </div>
        ) : (
          addons.map((addon) => (
            <AddonEditorRow
              key={addon.id}
              addon={addon}
              saving={savingAddonId === addon.id}
              onSave={onSave}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AddonEditorRow({
  addon, saving, onSave, onToggle,
}: {
  addon: Addon;
  saving: boolean;
  onSave: (addon: Addon) => void;
  onToggle: (addon: Addon) => void;
}) {
  const [draft, setDraft] = useState(addon);

  useEffect(() => {
    setDraft(addon);
  }, [addon]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <label className="block text-xs font-medium text-muted-foreground">Nome</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
          placeholder="Ex.: Bacon"
        />
      </div>
      <div className="w-full sm:w-32">
        <label className="block text-xs font-medium text-muted-foreground">Preço</label>
        <input
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: Number(e.target.value.replace(",", ".")) || 0 })}
          inputMode="decimal"
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
          placeholder="0,00"
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:pt-5">
        <Button
          variant={draft.active ? "outline" : "secondary"}
          size="sm"
          className="rounded-full"
          onClick={() => setDraft({ ...draft, active: !draft.active })}
        >
          {draft.active ? "Ativo" : "Inativo"}
        </Button>
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => onSave(draft)}
          disabled={saving}
        >
          <Save className="mr-1.5 size-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
function PanelShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
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
    <section id="fotos" className="mt-5 rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Vitrine</p>
          <h2 className="mt-1 text-2xl">Fotos dos produtos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Envie ou remova a imagem exibida no cardápio de cada produto.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhum produto cadastrado.
          </div>
        ) : (
          products.map((product) => {
            const uploading = uploadingProductId === product.id;
            return (
              <div key={product.id} className="overflow-hidden rounded-2xl border bg-background">
                <div className="flex h-36 items-center justify-center bg-muted/40">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="size-7 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
                      <Upload className="size-3.5" />
                      {uploading ? "Enviando..." : product.image_url ? "Trocar foto" : "Enviar foto"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(product, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {product.image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full text-destructive"
                        disabled={uploading}
                        onClick={() => onRemove(product)}
                      >
                        <Trash2 className="mr-1 size-3.5" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  onStatus,
}: {
  order: Order;
  onStatus: (order: Order, nextStatus: OrderStatus) => void;
}) {
  const currentIndex = statusFlow.findIndex((step) => step.value === order.status);
  const nextStep = currentIndex >= 0 ? statusFlow[currentIndex + 1] : undefined;
  const address = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const neighborhood = order.address_neighborhood;

  return (
    <article className="rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
            Pedido #{order.order_number} · {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{order.customer_name}</h3>
          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          {statusLabel[order.status]}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3">
            <span>
              {item.quantity}× {item.product_name}
              {item.second_product_name ? ` + ${item.second_product_name}` : ""}
              {item.size_name ? ` · ${item.size_name}` : ""}
              {item.crust_name ? ` · borda ${item.crust_name}` : ""}
              {item.notes ? <span className="block text-xs text-muted-foreground">Obs.: {item.notes}</span> : null}
            </span>
            <span className="shrink-0 font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {(address || order.notes) && (
        <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm">
          {address && (
            <p>
              {address}
              {neighborhood ? ` · ${neighborhood}` : ""}
              {order.address_complement ? ` · ${order.address_complement}` : ""}
            </p>
          )}
          {order.notes && <p className="mt-1 text-muted-foreground">Obs. do cliente: {order.notes}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <p className="text-muted-foreground">{paymentLabel[order.payment_method]}</p>
        <p className="text-base font-semibold">{formatCurrency(order.total)}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {nextStep && (
          <Button size="sm" className="rounded-full" onClick={() => onStatus(order, nextStep.value)}>
            <Check className="mr-1.5 size-4" /> Marcar como {nextStep.label}
          </Button>
        )}
        {currentIndex > 0 && statusFlow[currentIndex - 1] && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => onStatus(order, statusFlow[currentIndex - 1]!.value)}
          >
            Voltar para {statusFlow[currentIndex - 1]!.label}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive"
          onClick={() => onStatus(order, "CANCELLED")}
        >
          <X className="mr-1 size-4" /> Cancelar
        </Button>
      </div>
    </article>
  );
}
