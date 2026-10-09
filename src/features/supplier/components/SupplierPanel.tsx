import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, LogIn, MapPin, Palette, RefreshCw, ShoppingBag, Store, Tags, ListPlus } from "lucide-react";
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
type AddonGroup = { id: string; instance_id: string; name: string; required: boolean; min_selections: number; max_selections: number; active: boolean; sort_order: number };
type Addon = { id: string; group_id: string; name: string; price_delta: number; active: boolean; sort_order: number };
type ProductAddonGroup = { product_id: string; group_id: string; sort_order: number };
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
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [productAddonGroups, setProductAddonGroups] = useState<ProductAddonGroup[]>([]);
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
    const [productsResult, categoriesResult, addonGroupsResult, addonsResult, ordersResult, zonesResult, settingsResult] = await Promise.all([
      instanceId ? supabase.from("neroxa_storefront_products").select("id, instance_id, category_id, name, slug, description, image_url, price, active, sort_order").eq("instance_id", instanceId).order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      instanceId ? supabase.from("neroxa_storefront_categories").select("id, instance_id, name, slug, active, sort_order").eq("instance_id", instanceId).order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      instanceId ? supabase.from("neroxa_storefront_addon_groups").select("id, instance_id, name, required, min_selections, max_selections, active, sort_order").eq("instance_id", instanceId).order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      instanceId ? supabase.from("neroxa_storefront_addons").select("id, group_id, name, price_delta, active, sort_order").order("sort_order").order("name") : Promise.resolve({ data: [], error: null }),
      supabase.from("neroxa_orders").select("id, order_number, customer_name, customer_phone, fulfillment, payment_method, status, total, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
      supabase.from("neroxa_storefront_delivery_zones").select("id, name, neighborhoods, minimum_order, delivery_fee, estimated_minutes, active").eq("organization_id", orgId).order("sort_order").order("name"),
      supabase.from("neroxa_storefront_settings").select("*").eq("organization_id", orgId).maybeSingle(),
    ]);
    const productIds = (productsResult.data ?? []).map((product: { id: string }) => product.id);
    const productAddonGroupsResult = productIds.length
      ? await supabase.from("neroxa_storefront_product_addon_groups").select("product_id, group_id, sort_order").in("product_id", productIds)
      : { data: [], error: null };
    const firstError = productsResult.error ?? categoriesResult.error ?? addonGroupsResult.error ?? addonsResult.error ?? ordersResult.error ?? zonesResult.error ?? settingsResult.error ?? productAddonGroupsResult.error;
    if (firstError) setError(firstError.message);
    setProducts((productsResult.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setAddonGroups((addonGroupsResult.data ?? []) as AddonGroup[]);
    setAddons((addonsResult.data ?? []) as Addon[]);
    setProductAddonGroups((productAddonGroupsResult.data ?? []) as ProductAddonGroup[]);
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
        {safeView === "dashboard" && <SupplierDashboard context={context} metrics={{ ordersToday: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length, pendingOrders: orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length, revenueToday: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + Number(o.total), 0), products: products.filter((p) => p.active).length, customers: new Set(orders.map((o) => o.customer_phone)).size }} />}
        {safeView === "catalog" && <CatalogView products={products} categories={categories} addonGroups={addonGroups} addons={addons} productAddonGroups={productAddonGroups} instanceId={context.instance?.id} canManage={canManageCatalog(context.role)} refresh={refresh} setError={setError} />}
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

function CatalogView({products,categories,addonGroups,addons,productAddonGroups,canManage,instanceId,refresh,setError}:any){
  const [tab,setTab]=useState<"products"|"categories"|"addons">("products");
  const [editing,setEditing]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [draft,setDraft]=useState<any>({name:"",description:"",price:"",category_id:"",active:true});
  const [groupDraft,setGroupDraft]=useState<any>({name:"",required:false,min_selections:0,max_selections:1});
  const [addonDraft,setAddonDraft]=useState<any>({name:"",price_delta:"",active:true,group_id:""});
  const [editingAddon,setEditingAddon]=useState<string|null>(null);
  const [editingGroup,setEditingGroup]=useState<string|null>(null);

  const beginProduct=(p?:Product)=>{setEditing(p?.id ?? "new");setDraft({name:p?.name??"",description:p?.description??"",price:p?.price??"",category_id:p?.category_id??"",active:p?.active??true});};
  const saveProduct=async()=>{
    if(!canManage||!instanceId||!draft.name.trim()){setError("Informe o nome do produto.");return;}
    setSaving(true);
    const payload={instance_id:instanceId,name:draft.name.trim(),slug:(draft.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))||`produto-${Date.now()}`,description:draft.description?.trim()||null,price:draft.price===""?null:Number(draft.price),category_id:draft.category_id||null,active:Boolean(draft.active),sort_order:editing==="new"?products.length:(products.findIndex((p:Product)=>p.id===editing)>=0?products.findIndex((p:Product)=>p.id===editing):products.length)};
    const result=editing==="new"?await supabase.from("neroxa_storefront_products").insert(payload):await supabase.from("neroxa_storefront_products").update(payload).eq("id",editing);
    if(result.error)setError(result.error.message);else{setEditing(null);await refresh();}
    setSaving(false);
  };
  const removeProduct=async(id:string)=>{if(!canManage)return;if(!confirm("Excluir este produto?"))return;const {error}=await supabase.from("neroxa_storefront_products").delete().eq("id",id);if(error)setError(error.message);else void refresh();};
  const beginCategory=(c?:Category)=>{setEditing(c?.id ?? "new");setDraft({name:c?.name??"",description:"",price:"",category_id:"",active:c?.active??true});};
  const saveCategory=async()=>{
    if(!canManage||!instanceId||!draft.name.trim()){setError("Informe o nome da categoria.");return;}
    setSaving(true);
    const payload={instance_id:instanceId,name:draft.name.trim(),slug:(draft.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))||`categoria-${Date.now()}`,description:draft.description?.trim()||null,active:Boolean(draft.active),sort_order:editing==="new"?categories.length:(categories.findIndex((x:Category)=>x.id===editing)>=0?categories.findIndex((x:Category)=>x.id===editing):categories.length)};
    const result=editing==="new"?await supabase.from("neroxa_storefront_categories").insert(payload):await supabase.from("neroxa_storefront_categories").update(payload).eq("id",editing);
    if(result.error)setError(result.error.message);else{setEditing(null);await refresh();}
    setSaving(false);
  };
  const removeCategory=async(id:string)=>{if(!canManage)return;if(!confirm("Excluir esta categoria? Produtos vinculados ficarão sem categoria."))return;const {error}=await supabase.from("neroxa_storefront_categories").delete().eq("id",id);if(error)setError(error.message);else void refresh();};
  const beginGroup=(group?:AddonGroup)=>{setEditingGroup(group?.id??"new");setGroupDraft({name:group?.name??"",required:group?.required??false,min_selections:group?.min_selections??0,max_selections:group?.max_selections??1});};
  const saveAddonGroup=async()=>{if(!canManage||!instanceId||!groupDraft.name.trim()){setError("Informe o nome do grupo.");return;}const min=Math.max(0,Number(groupDraft.min_selections)||0),max=Math.max(1,Number(groupDraft.max_selections)||1);if(max<min){setError("O máximo de escolhas não pode ser menor que o mínimo.");return;}const payload={instance_id:instanceId,name:groupDraft.name.trim(),required:Boolean(groupDraft.required),min_selections:min,max_selections:max,active:true,sort_order:editingGroup==="new"?addonGroups.length:Math.max(0,addonGroups.findIndex((g:AddonGroup)=>g.id===editingGroup))};const result=editingGroup==="new"?await supabase.from("neroxa_storefront_addon_groups").insert(payload):await supabase.from("neroxa_storefront_addon_groups").update(payload).eq("id",editingGroup).eq("instance_id",instanceId);if(result.error)setError(result.error.message);else{setEditingGroup(null);setGroupDraft({name:"",required:false,min_selections:0,max_selections:1});await refresh();}};
  const beginAddon=(groupId:string,addon?:Addon)=>{setEditingAddon(addon?.id??"new");setAddonDraft({group_id:groupId,name:addon?.name??"",price_delta:addon?.price_delta??"",active:addon?.active??true});};
  const saveAddon=async()=>{if(!canManage||!addonDraft.group_id||!addonDraft.name.trim()){setError("Informe grupo e nome do complemento.");return;}const price=addonDraft.price_delta===""?0:Number(addonDraft.price_delta);if(!Number.isFinite(price)||price<0){setError("Informe um preço adicional válido (zero ou maior).");return;}const payload={group_id:addonDraft.group_id,name:addonDraft.name.trim(),price_delta:price,active:Boolean(addonDraft.active),sort_order:editingAddon==="new"?addons.filter((a:Addon)=>a.group_id===addonDraft.group_id).length:Math.max(0,addons.findIndex((a:Addon)=>a.id===editingAddon))};const r=editingAddon==="new"?await supabase.from("neroxa_storefront_addons").insert(payload):await supabase.from("neroxa_storefront_addons").update(payload).eq("id",editingAddon).eq("group_id",addonDraft.group_id);if(r.error)setError(r.error.message);else{setEditingAddon(null);await refresh();}};
  const removeAddon=async(id:string)=>{if(!canManage||!confirm("Excluir este complemento?"))return;const groupId=addons.find((item:Addon)=>item.id===id)?.group_id;if(!groupId||!addonGroups.some((group:AddonGroup)=>group.id===groupId)){setError("Complemento não pertence à instância atual.");return;}const {error}=await supabase.from("neroxa_storefront_addons").delete().eq("id",id).eq("group_id",groupId);if(error)setError(error.message);else await refresh();};
  const removeAddonGroup=async(id:string)=>{if(!canManage||!confirm("Excluir este grupo e seus complementos?"))return;const {error}=await supabase.from("neroxa_storefront_addon_groups").delete().eq("id",id).eq("instance_id",instanceId);if(error)setError(error.message);else{setEditingGroup(null);await refresh();}};
  const toggleProductGroup=async(productId:string,groupId:string,checked:boolean)=>{if(!canManage)return;const existing=productAddonGroups.find((link:ProductAddonGroup)=>link.product_id===productId&&link.group_id===groupId);if(checked&&!existing){const {error}=await supabase.from("neroxa_storefront_product_addon_groups").insert({product_id:productId,group_id:groupId,sort_order:productAddonGroups.filter((link:ProductAddonGroup)=>link.product_id===productId).length});if(error)setError(error.message);else await refresh();}else if(!checked&&existing){const {error}=await supabase.from("neroxa_storefront_product_addon_groups").delete().eq("product_id",productId).eq("group_id",groupId);if(error)setError(error.message);else await refresh();}};
  const filteredProducts=products.filter((p:Product)=>p.name.toLowerCase().includes(search.toLowerCase()));
  return <section>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Catálogo</p><h2 className="mt-1 text-2xl font-bold">Produtos e categorias</h2><p className="mt-1 text-sm text-muted-foreground">Tudo que aparece na loja é administrado aqui.</p></div>{canManage&&<Button className="rounded-full" onClick={()=>tab==="products"?beginProduct():tab==="categories"?beginCategory():beginGroup()}>{tab==="products"?"Novo produto":tab==="categories"?"Nova categoria":"Novo grupo"}</Button>}</div>
    <div className="mt-5 flex flex-wrap gap-2"><Button variant={tab==="products"?"default":"outline"} className="rounded-full" onClick={()=>{setTab("products");setEditing(null)}}><Boxes className="mr-2 size-4"/>Produtos ({products.length})</Button><Button variant={tab==="categories"?"default":"outline"} className="rounded-full" onClick={()=>{setTab("categories");setEditing(null)}}><Tags className="mr-2 size-4"/>Categorias ({categories.length})</Button><Button variant={tab==="addons"?"default":"outline"} className="rounded-full" onClick={()=>{setTab("addons");setEditing(null)}}><ListPlus className="mr-2 size-4"/>Complementos ({addons.length})</Button></div>
    {tab==="products"&&<div className="mt-4"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto..." className="h-11 w-full rounded-xl border bg-background px-3 sm:max-w-md"/>
      <div className="mt-4 space-y-3">{editing==="new"&&<ProductEditor draft={draft} setDraft={setDraft} categories={categories} saving={saving} onCancel={()=>setEditing(null)} onSave={saveProduct}/>}
      {filteredProducts.map((p:Product)=><article key={p.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 gap-3">{p.image_url?<img src={p.image_url} className="size-16 shrink-0 rounded-xl object-cover" alt=""/>:<div className="size-16 shrink-0 rounded-xl bg-muted"/>}<div className="min-w-0"><h3 className="font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground">{p.description||"Sem descrição"}</p><p className="mt-1 font-bold">{p.price==null?"Preço não definido":formatCurrency(Number(p.price))}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={p.active?"rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600":"rounded-full bg-muted px-3 py-1 text-xs"}>{p.active?"Ativo":"Inativo"}</span>{canManage&&<><Button size="sm" variant="outline" className="rounded-full" onClick={()=>beginProduct(p)}>Editar</Button><Button size="sm" variant="outline" className="rounded-full" onClick={()=>void removeProduct(p.id)}>Excluir</Button></>}</div></div>{editing===p.id&&<ProductEditor draft={draft} setDraft={setDraft} categories={categories} saving={saving} onCancel={()=>setEditing(null)} onSave={saveProduct}/>}</article>)}{filteredProducts.length===0&&<EmptyState text="Nenhum produto encontrado."/>}</div>
    </div>}
    {tab==="categories"&&<div className="mt-4 space-y-3">{editing==="new"&&<CategoryEditor draft={draft} setDraft={setDraft} saving={saving} onCancel={()=>setEditing(null)} onSave={saveCategory}/>}
      {categories.map((c:Category)=><article key={c.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-sm text-muted-foreground">{c.active?"Categoria ativa":"Categoria inativa"}</p></div>{canManage&&<div className="flex gap-2"><Button size="sm" variant="outline" className="rounded-full" onClick={()=>beginCategory(c)}>Editar</Button><Button size="sm" variant="outline" className="rounded-full" onClick={()=>void removeCategory(c.id)}>Excluir</Button></div>}</div>{editing===c.id&&<CategoryEditor draft={draft} setDraft={setDraft} saving={saving} onCancel={()=>setEditing(null)} onSave={saveCategory}/>}</article>)}{categories.length===0&&<EmptyState text="Nenhuma categoria cadastrada ainda."/>}</div>}
    {tab==="addons"&&<div className="mt-4 space-y-4">
      {canManage&&<article className="rounded-2xl border bg-card p-4 sm:p-5"><div><h3 className="font-semibold">{editingGroup==="new"?"Novo grupo de complementos":editingGroup?"Editar grupo de complementos":"Criar grupo de complementos"}</h3><p className="mt-1 text-sm text-muted-foreground">Ex.: Tamanho, borda, adicionais. Configure quantas opções o cliente pode escolher.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Nome do grupo<input className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={groupDraft.name} onChange={e=>setGroupDraft({...groupDraft,name:e.target.value})} placeholder="Ex.: Adicionais"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupDraft.required} onChange={e=>setGroupDraft({...groupDraft,required:e.target.checked,min_selections:e.target.checked?Math.max(1,Number(groupDraft.min_selections)||1):0})}/> Escolha obrigatória</label><label className="text-sm font-medium">Mínimo de escolhas<input type="number" min="0" step="1" className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={groupDraft.min_selections} onChange={e=>setGroupDraft({...groupDraft,min_selections:e.target.value})}/></label><label className="text-sm font-medium">Máximo de escolhas<input type="number" min="1" step="1" className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={groupDraft.max_selections} onChange={e=>setGroupDraft({...groupDraft,max_selections:e.target.value})}/></label></div><div className="mt-4 flex flex-wrap justify-end gap-2">{editingGroup&&editingGroup!=="new"&&<Button variant="ghost" className="rounded-full" onClick={()=>{setEditingGroup(null);setGroupDraft({name:"",required:false,min_selections:0,max_selections:1})}}>Cancelar edição</Button>}<Button className="rounded-full" onClick={()=>void saveAddonGroup()}>{editingGroup==="new"?"Salvar grupo":"Atualizar grupo"}</Button></div></article>}
      {addonGroups.map((group:AddonGroup)=><article key={group.id} className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{group.name}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{group.required?"Obrigatório":"Opcional"}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{group.min_selections}–{group.max_selections} escolha(s)</span></div><p className="mt-1 text-sm text-muted-foreground">{addons.filter((addon:Addon)=>addon.group_id===group.id).length} complemento(s) neste grupo</p></div>{canManage&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="rounded-full" onClick={()=>beginGroup(group)}>Editar grupo</Button><Button size="sm" variant="outline" className="rounded-full" onClick={()=>void removeAddonGroup(group.id)}>Excluir grupo</Button></div>}</div>
        {canManage&&<div className="mt-4 rounded-xl bg-muted/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Produtos que usam este grupo</h4><span className="text-xs text-muted-foreground">{productAddonGroups.filter((link:ProductAddonGroup)=>link.group_id===group.id).length} vínculo(s)</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{products.map((product:Product)=><label key={product.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2.5 text-sm"><input type="checkbox" checked={productAddonGroups.some((link:ProductAddonGroup)=>link.product_id===product.id&&link.group_id===group.id)} onChange={e=>void toggleProductGroup(product.id,group.id,e.target.checked)}/><span className="min-w-0 flex-1 truncate">{product.name}</span>{!product.active&&<span className="text-xs text-muted-foreground">Inativo</span>}</label>)}</div>{products.length===0&&<p className="text-sm text-muted-foreground">Cadastre um produto antes de vincular o grupo.</p>}</div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Complementos</h4>{canManage&&<Button size="sm" className="rounded-full" onClick={()=>beginAddon(group.id)}>Adicionar complemento</Button>}</div>
        {editingAddon==="new"&&addonDraft.group_id===group.id&&<div className="mt-3 grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome<input className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={addonDraft.name} onChange={e=>setAddonDraft({...addonDraft,name:e.target.value})} placeholder="Ex.: Queijo extra"/></label><label className="text-sm font-medium">Preço adicional (R$)<input type="number" min="0" step="0.01" className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={addonDraft.price_delta} onChange={e=>setAddonDraft({...addonDraft,price_delta:e.target.value})} placeholder="0,00"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addonDraft.active} onChange={e=>setAddonDraft({...addonDraft,active:e.target.checked})}/> Disponível na loja</label><div className="flex justify-end gap-2"><Button variant="ghost" className="rounded-full" onClick={()=>setEditingAddon(null)}>Cancelar</Button><Button className="rounded-full" onClick={()=>void saveAddon()}>Salvar complemento</Button></div></div>}
        <div className="mt-3 space-y-2">{addons.filter((addon:Addon)=>addon.group_id===group.id).map((addon:Addon)=><div key={addon.id} className="rounded-xl border p-3">{editingAddon===addon.id?<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome<input className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={addonDraft.name} onChange={e=>setAddonDraft({...addonDraft,name:e.target.value})}/></label><label className="text-sm font-medium">Preço adicional (R$)<input type="number" min="0" step="0.01" className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={addonDraft.price_delta} onChange={e=>setAddonDraft({...addonDraft,price_delta:e.target.value})}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addonDraft.active} onChange={e=>setAddonDraft({...addonDraft,active:e.target.checked})}/> Disponível na loja</label><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="ghost" className="rounded-full" onClick={()=>setEditingAddon(null)}>Cancelar</Button><Button size="sm" className="rounded-full" onClick={()=>void saveAddon()}>Salvar</Button></div></div>:<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{addon.name}</p><p className="text-sm font-semibold">{formatCurrency(Number(addon.price_delta))}<span className="ml-2 font-normal text-muted-foreground">{addon.active?"Disponível":"Indisponível"}</span></p></div>{canManage&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="rounded-full" onClick={()=>beginAddon(group.id,addon)}>Editar</Button><Button size="sm" variant="outline" className="rounded-full" onClick={()=>void removeAddon(addon.id)}>Excluir</Button></div>}</div>}</div>)}{addons.filter((addon:Addon)=>addon.group_id===group.id).length===0&&<EmptyState text="Nenhum complemento cadastrado neste grupo."/>}</div>
      </article>)}
      {addonGroups.length===0&&<EmptyState text="Nenhum grupo de complementos cadastrado. Crie um grupo para começar."/>}
    </div>}
  </section>
}

function ProductEditor({draft,setDraft,categories,saving,onCancel,onSave}:any){return <div className="mt-4 rounded-2xl bg-muted/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome<input className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="text-sm font-medium">Preço<input className="mt-1 h-10 w-full rounded-xl border bg-background px-3" type="number" min="0" step="0.01" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label><label className="text-sm font-medium sm:col-span-2">Descrição<textarea className="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><label className="text-sm font-medium">Categoria<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={draft.category_id} onChange={e=>setDraft({...draft,category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map((c:Category)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="flex items-center gap-2 text-sm font-medium sm:pt-7"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Disponível na loja</label></div><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancelar</Button><Button className="rounded-full" disabled={saving} onClick={()=>void onSave()}>{saving?"Salvando...":"Salvar produto"}</Button></div></div>}

function CategoryEditor({draft,setDraft,saving,onCancel,onSave}:any){return <div className="mt-4 rounded-2xl bg-muted/40 p-4"><label className="text-sm font-medium">Nome<input className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="mt-3 block text-sm font-medium">Descrição<textarea className="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Ativa na loja</label><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancelar</Button><Button className="rounded-full" disabled={saving} onClick={()=>void onSave()}>{saving?"Salvando...":"Salvar categoria"}</Button></div></div>}

function OrdersView({orders,canOperate,refresh,setError}:any){
 const next=(status:string)=>({RECEIVED:"CONFIRMED",CONFIRMED:"PREPARING",PREPARING:"READY",READY:"OUT_FOR_DELIVERY",OUT_FOR_DELIVERY:"DELIVERED"} as Record<string,string>)[status];
 return <section><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operação</p><h2 className="mt-1 text-2xl font-bold">Pedidos</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe e atualize os pedidos da loja.</p></div><div className="mt-5 space-y-3">{orders.map((o:Order)=><article key={o.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Pedido #{o.order_number} · {o.fulfillment}</p><h3 className="mt-1 font-semibold">{o.customer_name}</h3><p className="text-sm text-muted-foreground">{o.customer_phone}</p></div><p className="font-bold">{formatCurrency(Number(o.total))}</p></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">{o.status}</span>{canOperate&&next(o.status)&&<Button size="sm" className="rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_orders").update({status:next(o.status)}).eq("id",o.id);if(error)setError(error.message);else void refresh();}}>Avançar pedido</Button>}</div></article>)}{orders.length===0&&<EmptyState text="Nenhum pedido encontrado."/>}</div></section>
}

function DeliveryView({zones,canManage,orgId,refresh,setError}:any){return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operação</p><h2 className="mt-1 text-2xl font-bold">Áreas de entrega</h2><div className="mt-5 space-y-3">{zones.map((z:Zone)=><article key={z.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{z.name}</h3><p className="mt-1 text-sm text-muted-foreground">{z.neighborhoods?.join(", ")||"Sem bairros definidos"}</p></div><p className="font-semibold">{formatCurrency(Number(z.delivery_fee))}</p></div>{canManage&&<Button className="mt-3 rounded-full" size="sm" variant="outline" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_delivery_zones").update({active:!z.active}).eq("id",z.id).eq("organization_id",orgId);if(error)setError(error.message);else void refresh();}}>{z.active?"Desativar":"Ativar"}</Button>}</article>)}{zones.length===0&&<EmptyState text="Nenhuma área de entrega cadastrada."/>}</div></section>}

function StoreView({settings,canManage,orgId,refresh,setError}:any){return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Loja</p><h2 className="mt-1 text-2xl font-bold">Configurações operacionais</h2><div className="mt-5 rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">Entrega</p><p className="mt-1 font-semibold">{settings?.delivery_enabled?"Ativa":"Desativada"}</p><p className="mt-4 text-sm text-muted-foreground">Retirada</p><p className="mt-1 font-semibold">{settings?.pickup_enabled?"Ativa":"Desativada"}</p>{canManage&&<Button className="mt-5 rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_settings").upsert({organization_id:orgId,delivery_enabled:!settings?.delivery_enabled},{onConflict:"organization_id"});if(error)setError(error.message);else void refresh();}}>Alternar entrega</Button>}</div></section>}

function AppearanceView({settings,canManage,orgId,refresh,setError}:any){const theme=String(settings?.storefront_theme||"neroxa-classic");const [value,setValue]=useState(theme);return <section><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Personalização</p><h2 className="mt-1 text-2xl font-bold">Aparência da loja</h2><div className="mt-5 max-w-xl rounded-2xl border bg-card p-5"><label className="text-sm font-medium">Tema<select value={value} onChange={e=>setValue(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3"><option value="neroxa-classic">Neroxa Classic</option><option value="neroxa-horizontal">Neroxa Horizontal</option><option value="neroxa-accordion">Neroxa Accordion</option><option value="burger-club">Burger Club</option></select></label>{canManage&&<Button className="mt-4 rounded-full" onClick={async()=>{const {error}=await supabase.from("neroxa_storefront_settings").upsert({organization_id:orgId,storefront_theme:value},{onConflict:"organization_id"});if(error)setError(error.message);else void refresh();}}>Salvar aparência</Button>}</div></section>}

function EmptyState({text}:{text:string}){return <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>}

export default SupplierPanel;
