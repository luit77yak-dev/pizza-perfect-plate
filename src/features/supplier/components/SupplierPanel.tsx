import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, LogIn, MapPin, Palette, RefreshCw, ShoppingBag, Store, Tags } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import { loadSupplierPanelContext, type SupplierPanelContext } from "@/core/delivery/services/load-supplier-panel";
import { canManageCatalog, canOperateOrders } from "@/core/delivery/tenant-access";
import type { SupplierModule } from "@/core/delivery/modules";
import { SupplierDashboard } from "@/features/supplier/components/SupplierDashboard";

type View = "dashboard" | "catalog" | "orders" | "delivery" | "store" | "appearance";

type Product = {
  id: string;
  instance_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  active: boolean;
  sort_order: number;
};

type Category = { id: string; instance_id: string; name: string; slug: string; active: boolean; sort_order: number };
type Order = { id: string; order_number: number; customer_name: string; customer_phone: string; fulfillment: string; payment_method: string; status: string; total: number; created_at: string };
type Zone = { id: string; name: string; neighborhoods: string[]; minimum_order: number; delivery_fee: number; estimated_minutes: number | null; active: boolean };

const nav: Array<{ view: View; module: SupplierModule; label: string; icon: typeof Store }> = [
  { view: "dashboard", module: "dashboard", label: "Visão geral", icon: BarChart3 },
  { view: "catalog", module: "catalog", label: "Catálogo", icon: Boxes },
  { view: "orders", module: "orders", label: "Pedidos", icon: ShoppingBag },
  { view: "delivery", module: "delivery", label: "Entrega", icon: MapPin },
  { view: "store", module: "store", label: "Loja", icon: Store },
  { view: "appearance", module: "appearance", label: "Aparência", icon: Palette },
];

function SupplierPanel() {
  const [context, setContext] = useState<SupplierPanelContext | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const access = useMemo(() => {
    const enabled = new Set((context?.modules ?? []).filter((item) => item.enabled).map((item) => item.key));
    return (module: SupplierModule) => enabled.has(module);
  }, [context]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    let loaded: SupplierPanelContext;
    try { loaded = await loadSupplierPanelContext(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar sua loja."); setContext(null); setLoading(false); return; }
    if (!loaded.organizationId) { setError("Sua conta não possui acesso a uma empresa ativa."); setContext(null); setLoading(false); return; }
    setContext(loaded);
    const orgId = loaded.organizationId;
    const instanceId = loaded.instance?.id;
    const [productsResult, categoriesResult, ordersResult, zonesResult, settingsResult] = await Promise.all([
      instanceId ? supabase.from("neroxa_storefront_products").select("id, instance_id, category_id, name, slug, description, image_url, price, active, sort_order").eq("instance_id", instanceId).order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      instanceId ? supabase.from("neroxa_storefront_categories").select("id, instance_id, name, slug, active, sort_order").eq("instance_id", instanceId).order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      supabase.from("neroxa_orders").select("id, order_number, customer_name, customer_phone, fulfillment, payment_method, status, total, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
      supabase.from("neroxa_storefront_delivery_zones").select("id, name, neighborhoods, minimum_order, delivery_fee, estimated_minutes, active").eq("organization_id", orgId).order("sort_order").order("name"),
      supabase.from("neroxa_storefront_settings").select("*").eq("organization_id", orgId).maybeSingle(),
    ]);
    const firstError = productsResult.error ?? categoriesResult.error ?? ordersResult.error ?? zonesResult.error ?? settingsResult.error;
    if (firstError) setError(firstError.message);
    setProducts((productsResult.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setOrders((ordersResult.data ?? []) as Order[]);
    setZones((zonesResult.data ?? []) as Zone[]);
    setSettings((settingsResult.data ?? null) as Record<string, unknown> | null);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionChecked(true);
      if (data.session) await refresh();
    })();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setContext(null);
        setProducts([]);
        setCategories([]);
        setOrders([]);
        return;
      }
      void refresh();
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = async () => {
    setAuthLoading(true); setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else await refresh();
    setAuthLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); setContext(null); };

  if (!sessionChecked) return <PanelLoading />;
  if (!context) return <LoginScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} onSignIn={signIn} loading={authLoading} error={error} />;

  const visibleNav = nav.filter((item) => access(item.module));
  const safeView = visibleNav.some((item) => item.view === view) ? view : "dashboard";

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Painel da empresa</p>
            <h1 className="truncate text-lg font-bold sm:text-xl">{context.organization.name}</h1>
            <p className="truncate text-xs text-muted-foreground">{context.plan?.name ?? "Plano"} · {context.instance?.name ?? "Instância"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void signOut()}>Sair</Button>
          </div>
        </div>
        <nav className="border-t px-2 py-2" aria-label="Módulos da empresa">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto scrollbar-none">
            {visibleNav.map((item) => {
              const Icon = item.icon; const active = item.view === safeView;
              return <button key={item.view} type="button" onClick={() => setView(item.view)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold sm:text-sm ${active ? "bg-[#0a292d] text-[#f4efe5]" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="size-4" />{item.label}
              </button>;
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {error && <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
        {safeView === "dashboard" && <SupplierDashboard context={context} metrics={{ ordersToday: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length, pendingOrders: orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length, products: products.filter((p) => p.active).length, customers: new Set(orders.map((o) => o.customer_phone)).size revenueToday: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + Number(o.total), 0), products: products.filter((p) => p.active).length, customers: new Set(orders.map((o) => o.customer_phone)).size }} />}
        {safeView === "catalog" && <CatalogView products={products} categories={categories} canManage={canManageCatalog(context.role)} refresh={refresh} setError={setError} />}
        {safeView === "orders" && <OrdersView orders={orders} canOperate={canOperateOrders(context.role)} refresh={refresh} setError={setError} />}
        {safeView === "delivery" && <DeliveryView zones={zones} canManage={canManageCatalog(context.role)} orgId={context.organizationId} refresh={refresh} setError={setError} />}
        {safeView === "store" && <StoreView settings={settings} canManage={canManageCatalog(context.role)} orgId={context.organizationId} refresh={refresh} setError={setError} />}
        {safeView === "appearance" && <AppearanceView settings={settings} canManage={canManageCatalog(context.role)} orgId={context.organizationId} refresh={refresh} setError={setError} />}
      </main>
    </div>
  );
}

function LoginScreen({ email, password, setEmail, setPassword, onSignIn, loading, error }: any) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
    <form className="w-full max-w-md rounded-[1.75rem] border bg-card p-6 shadow-soft sm:p-8" onSubmit={(e) => { e.preventDefault(); void onSignIn(); }}>
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Neroxa</p><h1 className="mt-2 text-3xl font-bold">Painel da empresa</h1><p className="mt-2 text-sm text-muted-foreground">Entre para administrar sua operação.</p></div>
      {error && <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <label className="block text-sm font-medium">E-mail<input className="mt-1 h-11 w-full rounded-xl border bg-background px-3" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label className="mt-4 block text-sm font-medium">Senha<input className="mt-1 h-11 w-full rounded-xl border bg-background px-3" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <Button className="mt-5 h-11 w-full rounded-full" disabled={loading}>{loading ? "Entrando..." : <><LogIn className="mr-2 size-4"/>Entrar</>}</Button>
    </form>
  </div>;
}

function PanelLoading(){ return <div className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">Carregando painel...</div>; }

function CatalogView({products,categories,canManage,refresh,setError}:any){
  const [tab,setTab]=useState<"products"|"categories">("products");
  const [saving,setSaving]=useState(false);
  const [draft,setDraft]=useState<any>(null);
  const createProduct=async()=>{if(!canManage)return; setSaving(true); const p={instance_id:products[0]?.instance_id,name:"Novo produto",slug:`novo-produto-${Date.now()}`,description:null,price:0,active:true,sort_order:products.length}; if(!p.instance_id){setError("A instância da loja não foi encontrada.");setSaving(false);return;} const {error}=await supabase.from("neroxa_storefront_products").insert(p); if(error)setError(error.message); else await refresh(); setSaving(false);};
  const createCategory=async()=>{if(!canManage)return; const instanceId=products[0]?.instance_id; if(!instanceId){setError("Cadastre a primeira categoria/produto após a instância estar ativa.");return;} const {error}=await supabase.from("neroxa_storefront_categories").insert({instance_id:instanceId,name:"Nova categoria",slug:`nova-categoria-${Date.now()}`,sort_order:categories.length,active:true});if(error)setError(error.message);else await refresh();};
  return <section><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Catálogo</p><h2 className="mt-1 text-2xl font-bold">Produtos e categorias</h2><p className="mt-1 text-sm text-muted-foreground">A empresa administra seu próprio cardápio.</p></div>{canManage&&<Button className="rounded-full" onClick={()=>void(tab==="products"?createProduct():createCategory())}>{tab==="products"?"Novo produto":"Nova categoria"}</Button>}</div>
    <div className="mt-5 flex gap-2 overflow-x-auto"><Button variant={tab==="products"?"default":"outline"} className="rounded-full" onClick={()=>setTab("products")}><Boxes className="mr-2 size-4"/>Produtos</Button><Button variant={tab==="categories"?"default":"outline"} className="rounded-full" onClick={()=>setTab("categories")}><Tags className="mr-2 size-4"/>Categorias</Button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tab==="products"?products.map((p:Product)=><article key={p.id} className="rounded-2xl border bg-card p-4"><div className="flex gap-3">{p.image_url?<img src={p.image_url} className="size-16 rounded-xl object-cover" alt=""/>:<div className="size-16 rounded-xl bg-muted"/>}<div className="min-w-0 flex-1"><h3 className="font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground">{p.description||"Sem descrição"}</p><p className="mt-2 font-bold">{p.price==null?"Preço não definido":formatCurrency(Number(p.price))}</p></div></div><div className="mt-3 flex items-center justify-between text-xs"><span className={p.active?"text-emerald-600":"text-muted-foreground"}>{p.active?"Ativo":"Inativo"}</span>{canManage&&<Button size="sm" variant="outline" className="rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_products").update({active:!p.active}).eq("id",p.id);if(error)setError(error.message);else void refresh();}}>Alternar</Button>}</div></article>):categories.map((c:Category)=><article key={c.id} className="rounded-2xl border bg-card p-4"><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-sm text-muted-foreground">{c.active?"Categoria ativa":"Categoria inativa"}</p></article>)}</div>
    {tab==="products"&&products.length===0&&<EmptyState text="Nenhum produto cadastrado ainda."/>}{tab==="categories"&&categories.length===0&&<EmptyState text="Nenhuma categoria cadastrada ainda."/>}
  </section>
}

function OrdersView({orders,canOperate,refresh,setError}:any){
 const next=(status:string)=>({RECEIVED:"CONFIRMED",CONFIRMED:"PREPARING",PREPARING:"READY",READY:"OUT_FOR_DELIVERY",OUT_FOR_DELIVERY:"DELIVERED"} as Record<string,string>)[status];
 return <section><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operação</p><h2 className="mt-1 text-2xl font-bold">Pedidos</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe e atualize os pedidos da loja.</p></div><div className="mt-5 space-y-3">{orders.map((o:Order)=><article key={o.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Pedido #{o.order_number} · {o.fulfillment}</p><h3 className="mt-1 font-semibold">{o.customer_name}</h3><p className="text-sm text-muted-foreground">{o.customer_phone}</p></div><p className="font-bold">{formatCurrency(Number(o.total))}</p></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">{o.status}</span>{canOperate&&next(o.status)&&<Button size="sm" className="rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_orders").update({status:next(o.status)}).eq("id",o.id);if(error)setError(error.message);else void refresh();}}>Avançar pedido</Button>}</div></article>)}{orders.length===0&&<EmptyState text="Nenhum pedido encontrado."/>}</div></section>
}

function DeliveryView({zones,canManage,orgId,refresh,setError}:any){return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operação</p><h2 className="mt-1 text-2xl font-bold">Áreas de entrega</h2><div className="mt-5 space-y-3">{zones.map((z:Zone)=><article key={z.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{z.name}</h3><p className="mt-1 text-sm text-muted-foreground">{z.neighborhoods?.join(", ")||"Sem bairros definidos"}</p></div><p className="font-semibold">{formatCurrency(Number(z.delivery_fee))}</p></div>{canManage&&<Button className="mt-3 rounded-full" size="sm" variant="outline" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_delivery_zones").update({active:!z.active}).eq("id",z.id).eq("organization_id",orgId);if(error)setError(error.message);else void refresh();}}>{z.active?"Desativar":"Ativar"}</Button>}</article>)}{zones.length===0&&<EmptyState text="Nenhuma área de entrega cadastrada."/>}</div></section>}

function StoreView({settings,canManage,orgId,refresh,setError}:any){return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Loja</p><h2 className="mt-1 text-2xl font-bold">Configurações operacionais</h2><div className="mt-5 rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">Entrega</p><p className="mt-1 font-semibold">{settings?.delivery_enabled?"Ativa":"Desativada"}</p><p className="mt-4 text-sm text-muted-foreground">Retirada</p><p className="mt-1 font-semibold">{settings?.pickup_enabled?"Ativa":"Desativada"}</p>{canManage&&<Button className="mt-5 rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_settings").upsert({organization_id:orgId,delivery_enabled:!settings?.delivery_enabled},{onConflict:"organization_id"});if(error)setError(error.message);else void refresh();}}>Alternar entrega</Button>}</div></section>}

function AppearanceView({settings,canManage,orgId,refresh,setError}:any){const theme=String(settings?.storefront_theme||"neroxa-classic");const [value,setValue]=useState(theme);return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Personalização</p><h2 className="mt-1 text-2xl font-bold">Aparência da loja</h2><div className="mt-5 max-w-xl rounded-2xl border bg-card p-5"><label className="text-sm font-medium">Tema<select value={value} onChange={e=>setValue(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3"><option value="neroxa-classic">Neroxa Classic</option><option value="neroxa-horizontal">Neroxa Horizontal</option><option value="neroxa-accordion">Neroxa Accordion</option><option value="burger-club">Burger Club</option></select></label>{canManage&&<Button className="mt-4 rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_settings").upsert({organization_id:orgId,storefront_theme:value},{onConflict:"organization_id"});if(error)setError(error.message);else void refresh();}}>Salvar aparência</Button>}</div></section>}

function EmptyState({text}:{text:string}){return <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>}

export default SupplierPanel;
