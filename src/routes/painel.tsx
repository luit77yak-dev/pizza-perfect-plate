import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Check, ChevronUp, Clock3, ImagePlus, LogOut, MapPin, Menu, Package, Pencil, Plus, RefreshCw, Save, Settings2, ShoppingBag, Tag, Trash2, Upload, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import type { Addon as DomainAddon, Crust, DeliveryZone, OrderStatus, SpecialHour, StoreHour, PaymentMethod } from "@/lib/domain/types";

export const Route = createFileRoute("/painel")({
  component: StaffPanel,
});

type BusinessType = "PIZZERIA" | "RESTAURANT" | "RETAIL" | "SERVICES" | "BEAUTY";
type PanelView = "overview" | "catalog" | "operations" | "settings" | "orders";

type StoreSettings = {
  description: string | null;
  whatsapp_phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_cta_label: string | null;
  primary_color: string;
  secondary_color: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  min_order_amount: number;
  estimated_delivery_minutes: number;
  estimated_pickup_minutes: number;
  payment_methods: PaymentMethod[];
};

type BusinessProfile = {
  type: BusinessType;
  displayName: string;
  modules: { catalog: boolean; orders: boolean; delivery: boolean };
};

// The pizzaria is the first business module; capabilities stay reusable for future niches.
const businessProfile: BusinessProfile = {
  type: "PIZZERIA",
  displayName: "Pizzaria",
  modules: { catalog: true, orders: true, delivery: true },
};

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
    order_item_addons: Array<{
      id: string;
      addon_id: string | null;
      name: string;
      price: number;
      quantity: number;
    }>;
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
  const [creatingCatalogItem, setCreatingCatalogItem] = useState<string | null>(null);
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [savingCrustId, setSavingCrustId] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [savingDeliveryZoneId, setSavingDeliveryZoneId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PanelView>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [storeHours, setStoreHours] = useState<StoreHour[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [savingHour, setSavingHour] = useState<number | null>(null);
  const [savingSpecialHour, setSavingSpecialHour] = useState<string | null>(null);

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
    await Promise.all([loadOrders(data.organization_id), loadProducts(data.organization_id), loadAddons(data.organization_id), loadCrusts(data.organization_id), loadDeliveryZones(data.organization_id), loadSettings(data.organization_id), loadHours(data.organization_id)]);
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

  const deleteCategory = async (category: Category) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir a categoria "${category.name}"? Produtos dessa categoria ficarão sem categoria.`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from("categories").delete()
      .eq("id", category.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else await loadProducts(organizationId);
  };

  const deleteSize = async (size: ProductSize) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir o tamanho "${size.name}"? Os preços vinculados a ele também serão removidos.`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from("product_sizes").delete()
      .eq("id", size.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else await loadProducts(organizationId);
  };

  const deleteProduct = async (product: Product) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir o produto "${product.name}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    setEditingProductId(null);

    if (product.image_url) {
      const marker = "/storage/v1/object/public/product-images/";
      const index = product.image_url.indexOf(marker);
      const imagePath = index >= 0 ? decodeURIComponent(product.image_url.slice(index + marker.length)) : null;
      if (imagePath) await supabase.storage.from("product-images").remove([imagePath]);
    }

    const { error: deleteError } = await supabase.from("products").delete()
      .eq("id", product.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else await loadProducts(organizationId);
  };

  const deleteAddon = async (addon: Addon) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir o adicional "${addon.name}"?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from("product_addons").delete()
      .eq("id", addon.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else await loadAddons(organizationId);
    if (!deleteError) await loadProducts(organizationId);
  };

  const deleteCrust = async (crust: Crust) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir a borda "${crust.name}"?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from("product_crusts").delete()
      .eq("id", crust.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else await loadCrusts(organizationId);
  };

  const deleteDeliveryZone = async (zone: DeliveryZone) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!window.confirm(`Excluir a área "${zone.name}"? Pedidos antigos continuarão registrados.`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from("delivery_zones").delete()
      .eq("id", zone.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else setDeliveryZones((current) => current.filter((item) => item.id !== zone.id));
  };

  const loadHours = async (orgId: string) => {
    const [weekly, special] = await Promise.all([
      supabase.from("store_hours").select("id, organization_id, weekday, opens_at, closes_at, closed").eq("organization_id", orgId).order("weekday"),
      supabase.from("special_hours").select("id, organization_id, date, opens_at, closes_at, closed, note").eq("organization_id", orgId).order("date", { ascending: true }),
    ]);
    const firstError = weekly.error ?? special.error;
    if (firstError) { setError(firstError.message); return; }
    setStoreHours((weekly.data ?? []) as StoreHour[]);
    setSpecialHours((special.data ?? []) as SpecialHour[]);
  };

  const saveStoreHour = async (hour: StoreHour) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    setSavingHour(hour.weekday);
    setError(null);
    const payload = {
      organization_id: organizationId,
      weekday: hour.weekday,
      opens_at: hour.closed ? null : (hour.opens_at || null),
      closes_at: hour.closed ? null : (hour.closes_at || null),
      closed: hour.closed,
    };
    const { error: saveError } = await supabase.from("store_hours").upsert(payload, { onConflict: "organization_id,weekday" });
    if (saveError) setError(saveError.message);
    else await loadHours(organizationId);
    setSavingHour(null);
  };

  const createSpecialHour = async () => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const { data, error: createError } = await supabase.from("special_hours").upsert({
      organization_id: organizationId, date: dateValue, opens_at: "18:00", closes_at: "23:00", closed: false, note: "",
    }, { onConflict: "organization_id,date" }).select("id, organization_id, date, opens_at, closes_at, closed, note").single();
    if (createError) setError(createError.message);
    else if (data) setSpecialHours((current) => [...current.filter((item) => item.date !== data.date), data as SpecialHour].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const saveSpecialHour = async (hour: SpecialHour) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!hour.date) { setError("Informe a data."); return; }
    setSavingSpecialHour(hour.id);
    setError(null);
    const { error: saveError } = await supabase.from("special_hours").upsert({
      organization_id: organizationId, date: hour.date, opens_at: hour.closed ? null : (hour.opens_at || null), closes_at: hour.closed ? null : (hour.closes_at || null), closed: hour.closed, note: hour.note?.trim() || null,
    }, { onConflict: "organization_id,date" });
    if (saveError) setError(saveError.message);
    else await loadHours(organizationId);
    setSavingSpecialHour(null);
  };

  const removeSpecialHour = async (hour: SpecialHour) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const { error: deleteError } = await supabase.from("special_hours").delete().eq("id", hour.id).eq("organization_id", organizationId);
    if (deleteError) setError(deleteError.message);
    else setSpecialHours((current) => current.filter((item) => item.id !== hour.id));
  };

  const loadSettings = async (orgId: string) => {
    const { data, error: settingsError } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (settingsError) setError(settingsError.message);
    else if (data) setSettings(data as StoreSettings);
  };

  const saveSettings = async (draft: StoreSettings) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    setSavingSettings(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("organization_settings")
      .update({
        description: draft.description?.trim() || null,
        whatsapp_phone: draft.whatsapp_phone?.trim() || null,
        address_street: draft.address_street?.trim() || null,
        address_number: draft.address_number?.trim() || null,
        address_neighborhood: draft.address_neighborhood?.trim() || null,
        address_city: draft.address_city?.trim() || null,
        address_state: draft.address_state?.trim() || null,
        address_zip: draft.address_zip?.trim() || null,
        hero_title: draft.hero_title?.trim() || null,
        hero_subtitle: draft.hero_subtitle?.trim() || null,
        hero_cta_label: draft.hero_cta_label?.trim() || null,
        logo_url: draft.logo_url?.trim() || null,
        hero_image_url: draft.hero_image_url?.trim() || null,
        primary_color: draft.primary_color,
        secondary_color: draft.secondary_color,
        delivery_enabled: draft.delivery_enabled,
        pickup_enabled: draft.pickup_enabled,
        pickup_instructions: draft.pickup_instructions?.trim() || null,
        min_order_amount: Number(draft.min_order_amount) || 0,
        estimated_delivery_minutes: Number(draft.estimated_delivery_minutes) || 0,
        estimated_pickup_minutes: Number(draft.estimated_pickup_minutes) || 0,
        payment_methods: draft.payment_methods,
      })
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else await loadSettings(organizationId);
    setSavingSettings(false);
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

  const loadCrusts = async (orgId: string) => {
    const { data, error: crustsError } = await supabase
      .from("product_crusts")
      .select("id, organization_id, name, price, sort_order, active")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (crustsError) setError(crustsError.message);
    else setCrusts((data ?? []) as Crust[]);
  };

  const createCrust = async () => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (creatingCatalogItem === "crust") return;
    if (crusts.some((item) => item.name.trim().toLowerCase() === "nova borda")) {
      setError("Você já tem uma borda em criação. Edite a existente antes de criar outra.");
      return;
    }
    setCreatingCatalogItem("crust");
    setError(null);
    const { data, error: createError } = await supabase
      .from("product_crusts")
      .insert({ organization_id: organizationId, name: "Nova borda", price: 0, active: true, sort_order: crusts.length })
      .select("id, organization_id, name, price, sort_order, active")
      .single();
    if (createError) setError(createError.message);
    else if (data) setCrusts((current) => [...current, data as Crust]);
    setCreatingCatalogItem(null);
  };

  const saveCrust = async (draft: Crust) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!draft.name.trim()) { setError("Informe o nome da borda."); return; }
    const price = Number(String(draft.price).replace(",", "."));
    if (!Number.isFinite(price) || price < 0) { setError("Informe um preço válido."); return; }
    setSavingCrustId(draft.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("product_crusts")
      .update({ name: draft.name.trim(), price, active: draft.active, sort_order: draft.sort_order })
      .eq("id", draft.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else await loadCrusts(organizationId);
    setSavingCrustId(null);
  };

  const toggleCrust = async (crust: Crust) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const next = !crust.active;
    const { error: updateError } = await supabase
      .from("product_crusts")
      .update({ active: next })
      .eq("id", crust.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else setCrusts((current) => current.map((item) => item.id === crust.id ? { ...item, active: next } : item));
  };

  const loadDeliveryZones = async (orgId: string) => {
    const { data, error: zonesError } = await supabase
      .from("delivery_zones")
      .select("id, organization_id, name, neighborhoods, minimum_order, delivery_fee, estimated_minutes, active")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });
    if (zonesError) setError(zonesError.message);
    else setDeliveryZones((data ?? []) as DeliveryZone[]);
  };

  const createDeliveryZone = async () => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    setError(null);
    const { data, error: createError } = await supabase
      .from("delivery_zones")
      .insert({
        organization_id: organizationId,
        name: "Nova área",
        neighborhoods: [],
        minimum_order: 0,
        delivery_fee: 0,
        estimated_minutes: 40,
        active: true,
      })
      .select("id, organization_id, name, neighborhoods, minimum_order, delivery_fee, estimated_minutes, active")
      .single();
    if (createError) setError(createError.message);
    else if (data) setDeliveryZones((current) => [...current, data as DeliveryZone]);
  };

  const saveDeliveryZone = async (draft: DeliveryZone) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    if (!draft.name.trim()) {
      setError("Informe o nome da área de entrega.");
      return;
    }
    setSavingDeliveryZoneId(draft.id);
    setError(null);
    const neighborhoods = draft.neighborhoods
      .map((item) => item.trim())
      .filter(Boolean);
    const { error: updateError } = await supabase
      .from("delivery_zones")
      .update({
        name: draft.name.trim(),
        neighborhoods,
        minimum_order: Number(draft.minimum_order) || 0,
        delivery_fee: Number(draft.delivery_fee) || 0,
        estimated_minutes: draft.estimated_minutes == null ? null : Number(draft.estimated_minutes) || null,
        active: draft.active,
      })
      .eq("id", draft.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else await loadDeliveryZones(organizationId);
    setSavingDeliveryZoneId(null);
  };

  const toggleDeliveryZone = async (zone: DeliveryZone) => {
    if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
    const next = !zone.active;
    const { error: updateError } = await supabase
      .from("delivery_zones")
      .update({ active: next })
      .eq("id", zone.id)
      .eq("organization_id", organizationId);
    if (updateError) setError(updateError.message);
    else setDeliveryZones((current) => current.map((item) => item.id === zone.id ? { ...item, active: next } : item));
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
    if (creatingCatalogItem === "addon") return;
    if (addons.some((item) => item.name.trim().toLowerCase() === "novo adicional")) {
      setError("Você já tem um adicional em criação. Edite o existente antes de criar outro.");
      return;
    }
    setCreatingCatalogItem("addon");
    setError(null);
    const { data, error: createError } = await supabase
      .from("product_addons")
      .insert({ organization_id: organizationId, name: "Novo adicional", price: 0, active: true, sort_order: addons.length })
      .select("id, name, price, active, sort_order")
      .single();
    if (createError) { setError(createError.message); setCreatingCatalogItem(null); return; }
    setAddons((current) => [...current, data as Addon]);
    setSavingAddonId(null);
    setCreatingCatalogItem(null);
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
      .select("*, order_items(*, order_item_addons(*))")
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
    if (creatingCatalogItem === "product") return;
    if (products.some((item) => item.name.trim().toLowerCase() === "novo produto")) {
      setError("Você já tem um produto em criação. Edite o existente antes de criar outro.");
      return;
    }
    setCreatingCatalogItem("product");
    setError(null);
    const { data, error: createError } = await supabase.from("products").insert({
      organization_id: organizationId, name: "Novo produto", description: "", kind: "SIMPLE",
      base_price: 0, active: true, available: true, featured: false, allow_half: false, sort_order: products.length,
    }).select("id, category_id, name, description, image_url, kind, base_price, allow_half, active, featured, available, sort_order").single();
    if (createError) { setError(createError.message); setCreatingCatalogItem(null); return; }
    const created = data as Product;
    setProducts((current) => [...current, created]);
    setEditingProductId(created.id);
    setCreatingCatalogItem(null);
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
        {mobileMenuOpen && (
          <nav className="border-t px-4 py-3 sm:hidden" aria-label="Navegação do painel">
            <div className="flex flex-col gap-1.5">
              <PanelNavButton active={activeView === "overview"} icon={BarChart3} label="Visão geral" onClick={() => { setActiveView("overview"); setMobileMenuOpen(false); }} />
              {["OWNER", "ADMIN"].includes(role ?? "") && (
                <>
                  <PanelNavButton active={activeView === "catalog"} icon={Package} label="Cardápio" onClick={() => { setActiveView("catalog"); setMobileMenuOpen(false); }} />
                  <PanelNavButton active={activeView === "operations"} icon={MapPin} label="Operação" onClick={() => { setActiveView("operations"); setMobileMenuOpen(false); }} />
                  <PanelNavButton active={activeView === "settings"} icon={Settings2} label="Configurações" onClick={() => { setActiveView("settings"); setMobileMenuOpen(false); }} />
                </>
              )}
              <PanelNavButton active={activeView === "orders"} icon={ShoppingBag} label="Pedidos" onClick={() => { setActiveView("orders"); setMobileMenuOpen(false); }} />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <section className={`mb-4 rounded-[1.35rem] border bg-card p-4 shadow-soft sm:p-5 ${activeView === "overview" ? "" : "hidden"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Painel</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Visão geral</h2>
              <p className="mt-1 text-sm text-muted-foreground">O essencial da operação de hoje, em um só lugar.</p>
            </div>
            <p className="text-xs text-muted-foreground">{todayHighlights.todayOrders.length} pedido(s) hoje</p>
          </div>

          <InlineViewNav activeView={activeView} onChange={setActiveView} role={role} />

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HighlightCard label="Pedidos hoje" value={String(todayHighlights.todayOrders.length)} hint="Recebidos hoje" />
            <HighlightCard label="Em andamento" value={String(todayHighlights.inProgress.length)} hint="Aguardando atendimento" />
            <HighlightCard label="Faturamento" value={formatCurrency(todayHighlights.revenue)} hint="Pedidos entregues" />
            <HighlightCard label="Ticket médio" value={formatCurrency(todayHighlights.averageTicket)} hint="Por pedido entregue" />
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Status do dia</p>
                <span className="text-xs text-muted-foreground">{todayHighlights.todayOrders.length} pedidos</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{todayHighlights.completed.length} entregues</span>
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{todayHighlights.inProgress.length} em andamento</span>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">{todayHighlights.cancelled.length} cancelados</span>
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Cardápio</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-xl font-semibold">{products.filter((product) => product.active && product.available).length}</p>
                <p className="text-xs text-muted-foreground">produtos disponíveis</p>
              </div>
            </div>
          </div>
        </section>

        <div className={activeView === "overview" ? "" : "hidden"}>
          <RecentOrdersSection orders={orders.slice(0, 6)} onStatus={updateStatus} onDetails={setSelectedOrder} />
        </div>

        {["OWNER", "ADMIN"].includes(role ?? "") && activeView === "catalog" && (
          <>
            <SectionHeading
              eyebrow="Cardápio"
              title="Catálogo da loja"
              description="Organize categorias, tamanhos, produtos, adicionais, bordas e fotos."
            />
            <InlineViewNav activeView={activeView} onChange={setActiveView} role={role} />
            <div className="mb-4 rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Itens excluídos não voltam. Produtos já usados em pedidos mantêm o histórico do pedido.
            </div>
            <div className="space-y-5">
              <CategoryManager
                categories={categories}
                onCreate={async () => {
                  if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
                  const { error: createError } = await supabase.from("categories").insert({ organization_id: organizationId, name: "Nova categoria", active: true, sort_order: categories.length });
                  if (createError) setError(createError.message); else await loadProducts(organizationId);
                }}
                onDelete={deleteCategory}
                onSave={async (category) => {
                  if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
                  if (!category.name.trim()) { setError("Informe o nome da categoria."); return; }
                  const { error: updateError } = await supabase.from("categories").update({ name: category.name.trim(), active: category.active, sort_order: category.sort_order }).eq("id", category.id).eq("organization_id", organizationId);
                  if (updateError) setError(updateError.message); else await loadProducts(organizationId);
                }}
              />
              <SizeManager
                sizes={sizes}
                onCreate={async () => {
                  if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
                  const { error: createError } = await supabase.from("product_sizes").insert({ organization_id: organizationId, name: "Novo tamanho", slices: null, active: true, sort_order: sizes.length });
                  if (createError) setError(createError.message); else await loadProducts(organizationId);
                }}
                onDelete={deleteSize}
                onSave={async (size) => {
                  if (!organizationId || !["OWNER", "ADMIN"].includes(role ?? "")) return;
                  if (!size.name.trim()) { setError("Informe o nome do tamanho."); return; }
                  const { error: updateError } = await supabase.from("product_sizes").update({ name: size.name.trim(), slices: size.slices == null ? null : Number(size.slices) || null, active: size.active, sort_order: size.sort_order }).eq("id", size.id).eq("organization_id", organizationId);
                  if (updateError) setError(updateError.message); else await loadProducts(organizationId);
                }}
              />
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
                onDelete={deleteProduct}
              />
              <AddonManager
                addons={addons}
                savingAddonId={savingAddonId}
                onCreate={createAddon}
                onSave={saveAddon}
                onToggle={toggleAddon}
                onDelete={deleteAddon}
              />
              <CrustManager
                crusts={crusts}
                savingCrustId={savingCrustId}
                onCreate={createCrust}
                onSave={saveCrust}
                onToggle={toggleCrust}
                onDelete={deleteCrust}
              />
              <ProductImageManager
                products={products}
                uploadingProductId={imageUploading}
                onUpload={uploadProductImage}
                onRemove={removeProductImage}
              />
            </div>
          </>
        )}

        {["OWNER", "ADMIN"].includes(role ?? "") && activeView === "operations" && (
          <>
            <SectionHeading
              eyebrow="Operação"
              title="Funcionamento e entrega"
              description="Defina horários da loja e as áreas atendidas pela entrega."
            />
            <InlineViewNav activeView={activeView} onChange={setActiveView} role={role} />
            <OperationsManager
              hours={storeHours}
              specialHours={specialHours}
              savingHour={savingHour}
              savingSpecialHour={savingSpecialHour}
              onSaveHour={saveStoreHour}
              onCreateSpecial={createSpecialHour}
              onSaveSpecial={saveSpecialHour}
              onRemoveSpecial={removeSpecialHour}
              zones={deliveryZones}
              savingZoneId={savingDeliveryZoneId}
              onCreateZone={createDeliveryZone}
              onSaveZone={saveDeliveryZone}
              onToggleZone={toggleDeliveryZone}
              onDeleteZone={deleteDeliveryZone}
            />
          </>
        )}

        {["OWNER", "ADMIN"].includes(role ?? "") && activeView === "settings" && (
          <>
            <SectionHeading
              eyebrow="Configurações"
              title="Configurações da loja"
              description="Personalize a identidade, os canais e as regras de atendimento."
            />
            <InlineViewNav activeView={activeView} onChange={setActiveView} role={role} />
            {settings && <StoreSettingsManager settings={settings} saving={savingSettings} onSave={saveSettings} />}
          </>
        )}

        <div className={activeView === "orders" ? "" : "hidden"}>
          <SectionHeading
          eyebrow="Atendimento"
          title="Fila de pedidos"
          description="Pedidos que ainda precisam de alguma ação da equipe."
          />
          <InlineViewNav activeView={activeView} onChange={setActiveView} role={role} />

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

        {selectedOrder && (
          <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        )}
      </main>
    </PanelShell>
  );
}

function InlineViewNav({
  activeView,
  onChange,
  role,
}: {
  activeView: PanelView;
  onChange: (view: PanelView) => void;
  role: string | null;
}) {
  const items: Array<{ view: PanelView; icon: typeof BarChart3; label: string }> = [
    { view: "overview", icon: BarChart3, label: "Visão geral" },
    ...(["OWNER", "ADMIN"].includes(role ?? "") ? [
      { view: "catalog" as PanelView, icon: Package, label: "Cardápio" },
      { view: "operations" as PanelView, icon: MapPin, label: "Operação" },
      { view: "settings" as PanelView, icon: Settings2, label: "Configurações" },
    ] : []),
    { view: "orders", icon: ShoppingBag, label: "Pedidos" },
  ];

  return (
    <nav className="mt-3 flex flex-wrap gap-1 rounded-xl border bg-background p-1" aria-label="Navegação desta página">
      {items.filter((item) => item.view !== activeView).map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => onChange(item.view)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 sm:text-sm"
          >
            <Icon className="size-3.5 sm:size-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
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
      className={`flex w-full items-center justify-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
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

function RecentOrdersSection({
  orders,
  onStatus,
  onDetails,
}: {
  orders: Order[];
  onStatus: (order: Order, status: OrderStatus) => void;
  onDetails?: (order: Order) => void;
}) {
  return (
    <section className="mb-5 rounded-[1.25rem] border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Atendimento</p>
          <h2 className="mt-1 text-xl font-semibold">Pedidos recentes</h2>
        </div>
        <span className="text-xs text-muted-foreground">{orders.length} exibido(s)</span>
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
                  {onDetails && (
                    <Button size="sm" variant="outline" onClick={() => onDetails(order)} className="rounded-full">
                      Detalhes
                    </Button>
                  )}
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

function CategoryManager({
  categories,
  onCreate,
  onDelete,
  onSave,
}: {
  categories: Category[];
  onCreate: () => void;
  onDelete: (category: Category) => void;
  onSave: (category: Category) => void;
}) {
  return <section className="rounded-[1.5rem] border bg-card p-5 shadow-soft">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Organização</p><h2 className="mt-1 text-2xl">Categorias</h2><p className="mt-1 text-sm text-muted-foreground">Crie e organize as seções do cardápio.</p></div><Button onClick={onCreate} className="rounded-full"><Plus className="mr-2 size-4" /> Nova categoria</Button></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.map((category) => <CategoryRow key={category.id} category={category} onSave={onSave} onDelete={onDelete} />)}</div>
  </section>;
}

function CategoryRow({ category, onSave, onDelete }: { category: Category; onSave: (category: Category) => void; onDelete: (category: Category) => void }) {
  const [draft, setDraft] = useState(category);
  useEffect(() => setDraft(category), [category]);
  return <div className="flex flex-col gap-2 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 outline-none focus:border-primary" /><input value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} type="number" className="h-11 w-full rounded-xl border bg-background px-3 sm:w-24" aria-label="Ordem" /><Button variant={draft.active ? "outline" : "secondary"} size="sm" className="rounded-full" onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? "Ativa" : "Inativa"}</Button><Button size="sm" className="rounded-full" onClick={() => onSave(draft)}><Save className="mr-1.5 size-4" />Salvar</Button><Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => onDelete(draft)} aria-label="Excluir categoria"><Trash2 className="size-4" /></Button></div>;
}

function SizeManager({ sizes, onCreate, onDelete, onSave }: { sizes: ProductSize[]; onCreate: () => void; onDelete: (size: ProductSize) => void; onSave: (size: ProductSize) => void }) {
  return <section className="rounded-[1.5rem] border bg-card p-5 shadow-soft"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Cardápio</p><h2 className="mt-1 text-2xl">Tamanhos</h2><p className="mt-1 text-sm text-muted-foreground">Defina os tamanhos e a quantidade de fatias.</p></div><Button onClick={onCreate} className="rounded-full"><Plus className="mr-2 size-4" /> Novo tamanho</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{sizes.map((size) => <SizeRow key={size.id} size={size} onSave={onSave} onDelete={onDelete} />)}</div></section>;
}

function SizeRow({ size, onSave, onDelete }: { size: ProductSize; onSave: (size: ProductSize) => void; onDelete: (size: ProductSize) => void }) {
  const [draft, setDraft] = useState(size);
  useEffect(() => setDraft(size), [size]);
  return <div className="flex flex-col gap-2 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 outline-none focus:border-primary" /><input value={draft.slices ?? ""} onChange={(e) => setDraft({ ...draft, slices: e.target.value ? Number(e.target.value) : null })} type="number" min="1" className="h-11 w-full rounded-xl border bg-background px-3 sm:w-28" placeholder="Fatias" aria-label="Fatias" /><input value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} type="number" className="h-11 w-full rounded-xl border bg-background px-3 sm:w-24" aria-label="Ordem" /><Button variant={draft.active ? "outline" : "secondary"} size="sm" className="rounded-full" onClick={() => setDraft({ ...draft, active: !draft.active })}>{draft.active ? "Ativo" : "Inativo"}</Button><Button size="sm" className="rounded-full" onClick={() => onSave(draft)}><Save className="mr-1.5 size-4" />Salvar</Button><Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => onDelete(draft)} aria-label="Excluir tamanho"><Trash2 className="size-4" /></Button></div>;
}

function OperationsManager({
  hours, specialHours, savingHour, savingSpecialHour, onSaveHour, onCreateSpecial, onSaveSpecial, onRemoveSpecial,
  zones, savingZoneId, onCreateZone, onSaveZone, onToggleZone,
}: {
  hours: StoreHour[]; specialHours: SpecialHour[]; savingHour: number | null; savingSpecialHour: string | null;
  onSaveHour: (hour: StoreHour) => void; onCreateSpecial: () => void; onSaveSpecial: (hour: SpecialHour) => void; onRemoveSpecial: (hour: SpecialHour) => void;
  zones: DeliveryZone[]; savingZoneId: string | null; onCreateZone: () => void; onSaveZone: (zone: DeliveryZone) => void; onToggleZone: (zone: DeliveryZone) => void; onDeleteZone: (zone: DeliveryZone) => void;
}) {
  const [section, setSection] = useState<"hours" | "delivery">("hours");

  return (
    <div className="mt-4">
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border bg-card p-1.5">
        <button
          type="button"
          onClick={() => setSection("hours")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${section === "hours" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          <Clock3 className="size-4" /> Horários
        </button>
        <button
          type="button"
          onClick={() => setSection("delivery")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${section === "delivery" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          <MapPin className="size-4" /> Entrega
        </button>
      </div>

      {section === "hours" ? (
        <HoursManager
          hours={hours}
          specialHours={specialHours}
          savingHour={savingHour}
          savingSpecialHour={savingSpecialHour}
          onSaveHour={onSaveHour}
          onCreateSpecial={onCreateSpecial}
          onSaveSpecial={onSaveSpecial}
          onRemoveSpecial={onRemoveSpecial}
        />
      ) : (
        <DeliveryZoneManager
          zones={zones}
          savingZoneId={savingZoneId}
          onCreate={onCreateZone}
          onSave={onSaveZone}
          onToggle={onToggleZone}
          onDelete={onDeleteZone}
        />
      )}
    </div>
  );
}

function HoursManager({
  hours, specialHours, savingHour, savingSpecialHour, onSaveHour, onCreateSpecial, onSaveSpecial, onRemoveSpecial,
}: {
  hours: StoreHour[]; specialHours: SpecialHour[]; savingHour: number | null; savingSpecialHour: string | null;
  onSaveHour: (hour: StoreHour) => void; onCreateSpecial: () => void; onSaveSpecial: (hour: SpecialHour) => void; onRemoveSpecial: (hour: SpecialHour) => void;
}) {
  const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const normalized = weekdays.map((name, weekday) => hours.find((hour) => hour.weekday === weekday) ?? ({ id: `new-${weekday}`, organization_id: "", weekday, opens_at: "18:00", closes_at: "23:00", closed: weekday === 0 } as StoreHour));
  return <section className="rounded-[1.5rem] border bg-card p-5 shadow-soft">
    <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operação</p><h2 className="mt-1 text-2xl">Horários de funcionamento</h2><p className="mt-1 text-sm text-muted-foreground">Defina quando a loja aceita pedidos. Você também pode cadastrar exceções para feriados e datas especiais.</p></div>
    <div className="mt-5 grid gap-2">{normalized.map((hour) => <HourRow key={hour.weekday} hour={hour} label={weekdays[hour.weekday] ?? ""} saving={savingHour === hour.weekday} onSave={onSaveHour} />)}</div>
    <div className="mt-8 border-t pt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Exceções</p><h3 className="mt-1 text-xl">Datas especiais</h3><p className="mt-1 text-sm text-muted-foreground">Feche a loja ou use horários diferentes em uma data específica.</p></div><Button onClick={onCreateSpecial} className="rounded-full"><Plus className="mr-2 size-4" />Adicionar data</Button></div><div className="mt-4 grid gap-3">{specialHours.map((hour) => <SpecialHourRow key={hour.id} hour={hour} saving={savingSpecialHour === hour.id} onSave={onSaveSpecial} onRemove={onRemoveSpecial} />)}{specialHours.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma data especial cadastrada.</div>}</div></div>
  </section>;
}

function HourRow({ hour, label, saving, onSave }: { hour: StoreHour; label: string; saving: boolean; onSave: (hour: StoreHour) => void }) {
  const [draft, setDraft] = useState(hour);
  useEffect(() => setDraft(hour), [hour]);
  return <div className="grid gap-3 rounded-2xl border bg-background p-3 sm:grid-cols-[1fr_150px_150px_auto_auto] sm:items-center"><div className="font-medium">{label}</div><label className="text-xs text-muted-foreground">Abre<input type="time" disabled={draft.closed} value={draft.opens_at?.slice(0,5) ?? ""} onChange={(e) => setDraft({ ...draft, opens_at: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Fecha<input type="time" disabled={draft.closed} value={draft.closes_at?.slice(0,5) ?? ""} onChange={(e) => setDraft({ ...draft, closes_at: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label><Button variant={draft.closed ? "secondary" : "outline"} size="sm" className="rounded-full" onClick={() => setDraft({ ...draft, closed: !draft.closed })}>{draft.closed ? "Fechado" : "Aberto"}</Button><Button size="sm" className="rounded-full" disabled={saving} onClick={() => onSave(draft)}><Save className="mr-1.5 size-4" />{saving ? "Salvando" : "Salvar"}</Button></div>;
}

function SpecialHourRow({ hour, saving, onSave, onRemove }: { hour: SpecialHour; saving: boolean; onSave: (hour: SpecialHour) => void; onRemove: (hour: SpecialHour) => void }) {
  const [draft, setDraft] = useState(hour);
  useEffect(() => setDraft(hour), [hour]);
  return <div className="grid gap-3 rounded-2xl border bg-background p-3 sm:grid-cols-[150px_130px_130px_1fr_auto_auto] sm:items-end"><label className="text-xs text-muted-foreground">Data<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Abre<input type="time" disabled={draft.closed} value={draft.opens_at?.slice(0,5) ?? ""} onChange={(e) => setDraft({ ...draft, opens_at: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Fecha<input type="time" disabled={draft.closed} value={draft.closes_at?.slice(0,5) ?? ""} onChange={(e) => setDraft({ ...draft, closes_at: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Observação<input value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" placeholder="Feriado, evento..." /></label><Button variant={draft.closed ? "secondary" : "outline"} size="sm" className="rounded-full" onClick={() => setDraft({ ...draft, closed: !draft.closed })}>{draft.closed ? "Fechado" : "Aberto"}</Button><div className="flex gap-2"><Button size="sm" className="rounded-full" disabled={saving} onClick={() => onSave(draft)}><Save className="mr-1.5 size-4" />Salvar</Button><Button variant="ghost" size="sm" className="rounded-full" onClick={() => onRemove(draft)}><Trash2 className="size-4" /></Button></div></div>;
}

function StoreSettingsManager({ settings, saving, onSave }: { settings: StoreSettings; saving: boolean; onSave: (settings: StoreSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const field = (key: keyof StoreSettings, label: string, placeholder = "") => <label className="text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span><input value={String(draft[key] ?? "")} onChange={(e) => setDraft({ ...draft, [key]: typeof draft[key] === "number" ? Number(e.target.value) || 0 : e.target.value })} placeholder={placeholder} className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" /></label>;
  const paymentOptions: { value: PaymentMethod; label: string; description: string }[] = [
    { value: "PIX", label: "PIX", description: "Pagamento via PIX" },
    { value: "CASH", label: "Dinheiro", description: "Pagamento em dinheiro" },
    { value: "CARD_ON_DELIVERY", label: "Cartão na entrega", description: "Maquininha na entrega" },
    { value: "CARD_ON_SITE", label: "Cartão no local", description: "Cartão na retirada" },
  ];
  const togglePayment = (method: PaymentMethod) => setDraft({ ...draft, payment_methods: draft.payment_methods.includes(method) ? draft.payment_methods.filter((item) => item !== method) : [...draft.payment_methods, method] });
  return <section className="rounded-[1.5rem] border bg-card p-5 shadow-soft"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Configurações</p><h2 className="mt-1 text-2xl">Identidade e operação</h2><p className="mt-1 text-sm text-muted-foreground">Edite as informações que aparecem no cardápio e no checkout.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{field("hero_title","Título principal","Pizza de verdade.")}{field("hero_subtitle","Subtítulo","Pizzas artesanais feitas na hora.")}{field("hero_cta_label","Texto do botão","Ver cardápio")}{field("whatsapp_phone","WhatsApp","5562999999999")}{field("address_street","Rua")}{field("address_number","Número")}{field("address_neighborhood","Bairro")}{field("address_city","Cidade")}{field("address_state","Estado")}{field("address_zip","CEP")}{field("logo_url","URL da logo")}{field("hero_image_url","URL da imagem principal")}<label className="text-sm sm:col-span-2"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span><textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="w-full rounded-xl border bg-background px-3 py-2 outline-none focus:border-primary" /></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm"><input type="checkbox" checked={draft.delivery_enabled} onChange={(e) => setDraft({ ...draft, delivery_enabled: e.target.checked })} /> Delivery ativo</label><label className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm"><input type="checkbox" checked={draft.pickup_enabled} onChange={(e) => setDraft({ ...draft, pickup_enabled: e.target.checked })} /> Retirada ativa</label>{field("min_order_amount","Pedido mínimo","0")}{field("estimated_delivery_minutes","Tempo delivery","40")}</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{field("estimated_pickup_minutes","Tempo retirada","20")}{field("pickup_instructions","Instruções de retirada")}</div><div className="mt-5 rounded-2xl border bg-background p-4"><div><p className="text-sm font-semibold">Formas de pagamento</p><p className="mt-1 text-xs text-muted-foreground">Escolha quais opções aparecem no checkout da sua loja.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{paymentOptions.map((option) => <button type="button" key={option.value} onClick={() => togglePayment(option.value)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${draft.payment_methods.includes(option.value) ? "border-primary bg-primary/5" : "bg-card"}`}><span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${draft.payment_methods.includes(option.value) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>{draft.payment_methods.includes(option.value) ? "✓" : ""}</span><span><span className="block text-sm font-semibold">{option.label}</span><span className="block text-xs text-muted-foreground">{option.description}</span></span></button>)}</div>{draft.payment_methods.length === 0 && <p className="mt-3 text-xs font-medium text-primary">Selecione pelo menos uma forma de pagamento.</p>}</div><div className="mt-4 flex justify-end"><Button onClick={() => onSave(draft)} disabled={saving || draft.payment_methods.length === 0} className="rounded-full"><Save className="mr-1.5 size-4" />{saving ? "Salvando..." : "Salvar configurações"}</Button></div></section>;
}
function ProductCatalogManager({
  products, categories, sizes, prices, addons, productAddonIds, editingProductId, savingProductId, onCreate, onEdit, onSave, onToggle, onDelete }: {
  products: Product[]; categories: Category[]; sizes: ProductSize[]; prices: ProductPrice[]; addons: Addon[];
  productAddonIds: Record<string, string[]>;
  editingProductId: string | null; savingProductId: string | null; onCreate: () => void; onEdit: (id: string | null) => void;
  onSave: (product: Product, sizePrices: Record<string, string>, addonIds: string[]) => void;
  onToggle: (product: Product, field: "active" | "available" | "featured") => void;
  onDelete: (product: Product) => void;
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
            onSave={onSave} onToggle={onToggle} onDelete={onDelete} />)}
      </div>
    </section>
  );
}

function ProductEditorRow({
  product, categories, sizes, prices, addons, addonIds, expanded, saving, onEdit, onSave, onToggle, onDelete,
}: {
  product: Product; categories: Category[]; sizes: ProductSize[]; prices: ProductPrice[]; addons: Addon[]; addonIds: string[];
  expanded: boolean; saving: boolean; onEdit: () => void; onSave: (product: Product, sizePrices: Record<string, string>, addonIds: string[]) => void;
  onToggle: (product: Product, field: "active" | "available" | "featured") => void;
  onDelete: (product: Product) => void;
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
          <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => onDelete(product)} aria-label="Excluir produto"><Trash2 className="size-4" /></Button>
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

function CrustManager({
  crusts,
  savingCrustId,
  onCreate,
  onSave,
  onToggle,
  onDelete,
}: {
  crusts: Crust[];
  savingCrustId: string | null;
  onCreate: () => void;
  onSave: (crust: Crust) => void;
  onToggle: (crust: Crust) => void;
  onDelete: (crust: Crust) => void;
}) {
  return (
    <section id="bordas" className="mt-5 rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Personalização</p>
          <h2 className="mt-1 text-2xl">Bordas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre as opções de borda e o adicional cobrado no pedido.</p>
        </div>
        <Button onClick={onCreate} className="rounded-full">
          <Plus className="mr-2 size-4" /> Nova borda
        </Button>
      </div>

      <div className="mt-4 space-y-1.5">
        {crusts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma borda cadastrada.
          </div>
        ) : (
          crusts.map((crust) => (
            <CrustEditorRow
              key={crust.id}
              crust={crust}
              saving={savingCrustId === crust.id}
              onSave={onSave}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CrustEditorRow({
  crust,
  saving,
  onSave,
  onToggle,
  onDelete,
}: {
  crust: Crust;
  saving: boolean;
  onSave: (crust: Crust) => void;
  onToggle: (crust: Crust) => void;
  onDelete: (crust: Crust) => void;
}) {
  const [draft, setDraft] = useState(crust);

  useEffect(() => {
    setDraft(crust);
  }, [crust]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <label className="block text-xs font-medium text-muted-foreground">Nome</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
          placeholder="Ex.: Catupiry"
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
          {draft.active ? "Ativa" : "Inativa"}
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
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => onToggle(draft)}
        >
          {draft.active ? "Desativar" : "Ativar"}
        </Button>
      </div>
    </div>
  );
}

function DeliveryZoneManager({
  zones,
  savingZoneId,
  onCreate,
  onSave,
  onToggle,
  onDelete,
}: {
  zones: DeliveryZone[];
  savingZoneId: string | null;
  onCreate: () => void;
  onSave: (zone: DeliveryZone) => void;
  onToggle: (zone: DeliveryZone) => void;
  onDelete: (zone: DeliveryZone) => void;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Logística</p>
          <h2 className="mt-1 text-2xl">Áreas de entrega</h2>
          <p className="mt-1 text-sm text-muted-foreground">Defina os bairros atendidos, a taxa e o tempo estimado de cada área.</p>
        </div>
        <Button onClick={onCreate} className="rounded-full">
          <Plus className="mr-2 size-4" /> Nova área
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {zones.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma área cadastrada. Crie uma área para liberar a entrega por bairro.
          </div>
        ) : (
          zones.map((zone) => (
            <DeliveryZoneEditorRow
              key={zone.id}
              zone={zone}
              saving={savingZoneId === zone.id}
              onSave={onSave}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DeliveryZoneEditorRow({
  zone,
  saving,
  onSave,
  onToggle,
  onDelete,
}: {
  zone: DeliveryZone;
  saving: boolean;
  onSave: (zone: DeliveryZone) => void;
  onToggle: (zone: DeliveryZone) => void;
  onDelete: (zone: DeliveryZone) => void;
}) {
  const [draft, setDraft] = useState(zone);

  useEffect(() => {
    setDraft(zone);
  }, [zone]);

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px_120px]">
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome da área</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" placeholder="Ex.: Centro" />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Taxa</span>
          <input value={draft.delivery_fee} onChange={(e) => setDraft({ ...draft, delivery_fee: Number(e.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" placeholder="0,00" />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Pedido mínimo</span>
          <input value={draft.minimum_order} onChange={(e) => setDraft({ ...draft, minimum_order: Number(e.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" placeholder="0,00" />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Tempo (min)</span>
          <input value={draft.estimated_minutes ?? ""} onChange={(e) => setDraft({ ...draft, estimated_minutes: e.target.value ? Number(e.target.value) : null })} inputMode="numeric" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" placeholder="40" />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Bairros atendidos</span>
        <input
          value={draft.neighborhoods.join(", ")}
          onChange={(e) => setDraft({ ...draft, neighborhoods: e.target.value.split(",") })}
          className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
          placeholder="Ex.: Centro, Setor Oeste, Jardim América"
        />
        <span className="mt-1.5 block text-xs text-muted-foreground">Separe os bairros por vírgula.</span>
      </label>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant={draft.active ? "outline" : "secondary"} size="sm" className="rounded-full" onClick={() => setDraft({ ...draft, active: !draft.active })}>
          {draft.active ? "Área ativa" : "Área inativa"}
        </Button>
        <Button size="sm" className="rounded-full" disabled={saving} onClick={() => onSave(draft)}>
          <Save className="mr-1.5 size-4" /> {saving ? "Salvando..." : "Salvar área"}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onToggle(draft)}>
          <MapPin className="mr-1.5 size-4" /> {draft.active ? "Desativar" : "Ativar"}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => onDelete(draft)} aria-label="Excluir área"><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}

function AddonManager({
  addons, savingAddonId, onCreate, onSave, onToggle, onDelete,
}: {
  addons: Addon[];
  savingAddonId: string | null;
  onCreate: () => void;
  onSave: (addon: Addon) => void;
  onToggle: (addon: Addon) => void;
  onDelete: (addon: Addon) => void;
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
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AddonEditorRow({
  addon, saving, onSave, onToggle, onDelete,
}: {
  addon: Addon;
  saving: boolean;
  onSave: (addon: Addon) => void;
  onToggle: (addon: Addon) => void;
  onDelete: (addon: Addon) => void;
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
        <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => onDelete(draft)} aria-label="Excluir adicional"><Trash2 className="size-4" /></Button>
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


function OrderDetailsModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const address = [order.address_street, order.address_number].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Detalhes do pedido #" + order.order_number}>
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar detalhes" />
      <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] border bg-background p-5 shadow-lifted sm:rounded-[1.75rem] sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Detalhes do pedido</p>
            <h2 className="mt-1 text-3xl">Pedido #{order.order_number}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(order.created_at).toLocaleString("pt-BR")} · {statusLabel[order.status]}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="size-5" /></Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Cliente</p>
            <p className="mt-2 font-semibold">{order.customer_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{order.customer_phone}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Pagamento</p>
            <p className="mt-2 font-semibold">{paymentLabel[order.payment_method]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Itens do pedido</p>
              <p className="mt-1 text-sm text-muted-foreground">{order.order_items.length} item(ns)</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(order.total)}</p>
          </div>

          <div className="mt-4 divide-y">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{item.quantity}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {item.product_name}{item.second_product_name ? " + " + item.second_product_name : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    {item.size_name && <span>Tamanho: {item.size_name}</span>}
                    {item.crust_name && <span>Borda: {item.crust_name}</span>}
                  </div>
                  {item.order_item_addons?.length > 0 && (
                    <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground">Adicionais</p>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {item.order_item_addons.map((addon) => (
                          <li key={addon.id}>
                            + {addon.name}{addon.quantity > 1 ? " (" + addon.quantity + "x)" : ""}
                            {Number(addon.price) > 0 ? " · " + formatCurrency(Number(addon.price) * Number(addon.quantity)) : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.notes && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">Observação: {item.notes}</p>}
                </div>
                <p className="shrink-0 font-semibold">{formatCurrency(Number(item.unit_price) * Number(item.quantity))}</p>
              </div>
            ))}
          </div>
        </div>

        {(address || order.address_neighborhood || order.address_complement || order.notes) && (
          <div className="mt-4 rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Entrega e observações</p>
            {address && <p className="mt-2 text-sm">{address}</p>}
            {order.address_neighborhood && <p className="mt-1 text-sm text-muted-foreground">Bairro: {order.address_neighborhood}</p>}
            {order.address_complement && <p className="mt-1 text-sm text-muted-foreground">Complemento: {order.address_complement}</p>}
            {order.notes && <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">Obs. do cliente: {order.notes}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-end"><Button onClick={onClose} className="rounded-full">Fechar</Button></div>
      </section>
    </div>
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
              {item.order_item_addons?.length > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  Adicionais: {item.order_item_addons.map((addon) => addon.name + (addon.quantity > 1 ? " (" + addon.quantity + "x)" : "")).join(", ")}
                </span>
              ) : null}
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