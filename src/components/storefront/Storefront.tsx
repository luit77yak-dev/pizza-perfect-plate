import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  Pizza,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImageAccordion } from "@/components/ui/image-accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useLocalCart } from "@/hooks/use-local-cart";
import { calculateCartSubtotal, calculateProductUnitPrice } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/domain/money";
import type {
  Addon,
  CartItem,
  Category,
  Crust,
  Organization,
  OrganizationSettings,
  Product,
  ProductPrice,
  ProductSize,
  StoreHour,
  SpecialHour,
  DeliveryZone,
  FulfillmentType,
  PaymentMethod,
  OrderStatus,
} from "@/lib/domain/types";

type ProductAddonLink = {
  product_id: string;
  addon_id: string;
  sort_order: number;
};

type StoreData = {
  organization: Organization;
  settings: OrganizationSettings;
  categories: Category[];
  sizes: ProductSize[];
  products: Product[];
  prices: ProductPrice[];
  crusts: Crust[];
  addons: Addon[];
  productAddonLinks: ProductAddonLink[];
  hours: StoreHour[];
  specialHours: SpecialHour[];
  deliveryZones: DeliveryZone[];
};

async function loadStore(slug?: string): Promise<StoreData> {
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .eq("active", true)
    .eq("demo_mode", slug ? false : true)
    .is("deleted_at", null)
    .match(slug ? { slug } : {})
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (organizationError) throw organizationError;
  if (!organization) throw new Error("Nenhuma pizzaria de demonstração foi configurada.");

  const [
    settingsResult,
    categoriesResult,
    sizesResult,
    productsResult,
    pricesResult,
    crustsResult,
    addonsResult,
    productAddonLinksResult,
    hoursResult,
    specialHoursResult,
    deliveryZonesResult,
  ] = await Promise.all([
    supabase.rpc("get_public_storefront_settings", { p_org: organization.id }),
    supabase.from("categories").select("*").eq("organization_id", organization.id).eq("active", true).is("deleted_at", null).order("sort_order"),
    supabase.from("product_sizes").select("*").eq("organization_id", organization.id).eq("active", true).order("sort_order"),
    supabase.from("products").select("*").eq("organization_id", organization.id).eq("active", true).eq("available", true).is("deleted_at", null).order("sort_order"),
    supabase.from("product_prices").select("*").eq("organization_id", organization.id),
    supabase.from("product_crusts").select("*").eq("organization_id", organization.id).eq("active", true).order("sort_order"),
    supabase.from("product_addons").select("*").eq("organization_id", organization.id).eq("active", true).order("sort_order"),
    supabase.from("product_addon_links").select("product_id, addon_id, sort_order").eq("organization_id", organization.id).order("sort_order"),
    supabase.from("store_hours").select("*").eq("organization_id", organization.id).order("weekday"),
    supabase.from("special_hours").select("*").eq("organization_id", organization.id).order("date"),
    supabase.from("delivery_zones").select("*").eq("organization_id", organization.id).eq("active", true).order("name"),
  ]);

  const error =
    settingsResult.error ??
    categoriesResult.error ??
    sizesResult.error ??
    productsResult.error ??
    pricesResult.error ??
    crustsResult.error ??
    addonsResult.error ??
    productAddonLinksResult.error ??
    hoursResult.error ??
    specialHoursResult.error ??
    deliveryZonesResult.error;
  if (error) throw error;
  if (!settingsResult.data) throw new Error("As configurações públicas da loja ainda não foram cadastradas.");

  return {
    organization: organization as Organization,
    settings: settingsResult.data as unknown as OrganizationSettings,
    categories: (categoriesResult.data ?? []) as Category[],
    sizes: (sizesResult.data ?? []) as ProductSize[],
    products: (productsResult.data ?? []) as Product[],
    prices: (pricesResult.data ?? []) as ProductPrice[],
    crusts: (crustsResult.data ?? []) as Crust[],
    addons: (addonsResult.data ?? []) as Addon[],
    productAddonLinks: (productAddonLinksResult.data ?? []) as ProductAddonLink[],
    hours: (hoursResult.data ?? []) as StoreHour[],
    specialHours: (specialHoursResult.data ?? []) as SpecialHour[],
    deliveryZones: (deliveryZonesResult.data ?? []) as DeliveryZone[],
  };
}

function normalizeNeighborhood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getPrice(product: Product, sizeId: string | null, prices: ProductPrice[]) {
  if (!sizeId) return Number(product.base_price) || 0;
  const row = prices.find((price) => price.product_id === product.id && price.size_id === sizeId);
  return row ? Number(row.price) : Number(product.base_price) || 0;
}

function getStoreStatus(hours: StoreHour[], specialHours: SpecialHour[], now = new Date()) {
  const dateKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const special = specialHours.find((item) => item.date === dateKey);
  const weekday = now.getDay();
  const today = special ?? hours.find((hour) => hour.weekday === weekday);
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (!today || today.closed || !today.opens_at || !today.closes_at) {
    return { open: false, label: special?.note ? `Fechada hoje · ${special.note}` : "Fechada hoje" };
  }

  const [openHour = 0, openMinute = 0] = today.opens_at.slice(0, 5).split(":").map(Number);
  const [closeHour = 0, closeMinute = 0] = today.closes_at.slice(0, 5).split(":").map(Number);
  const opening = openHour * 60 + openMinute;
  const closing = closeHour * 60 + closeMinute;
  const overnight = closing <= opening;
  const open = overnight ? minutes >= opening || minutes < closing : minutes >= opening && minutes < closing;

  if (open) return { open: true, label: `Aberta até ${today.closes_at.slice(0, 5)}` };
  if (minutes < opening) return { open: false, label: `Abre às ${today.opens_at.slice(0, 5)}` };
  return { open: false, label: "Fechada agora" };
}

export function Storefront({ slug }: { slug?: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["public-store", slug ?? "demo"],
    queryFn: () => loadStore(slug),
    staleTime: 60_000,
  });
  const cart = useLocalCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<{ id: string; number: number; phone: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!data?.organization?.id) return;

    let cancelled = false;

    const loadTrackedOrder = async () => {
      try {
        const raw = localStorage.getItem(`ppp:last-order:${data.organization.id}`);
        if (!raw) {
          if (!cancelled) setTrackedOrder(null);
          return;
        }

        const stored = JSON.parse(raw) as { id: string; number: number; phone: string };
        if (!stored?.id || !stored?.phone) {
          localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
          if (!cancelled) setTrackedOrder(null);
          return;
        }

        const { data: tracking, error } = await supabase.rpc("get_public_order_status", {
          p_order_id: stored.id,
          p_customer_phone: stored.phone,
        });

        if (cancelled) return;

        const current = Array.isArray(tracking) ? tracking[0] : tracking;
        const status = current?.status as OrderStatus | undefined;
        const finished = status === "DELIVERED" || status === "CANCELLED";

        if (!error && finished) {
          localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
          setTrackedOrder(null);
          return;
        }

        // If the status lookup fails, keep the stored order so the customer can
        // still try to track it instead of silently losing the tracking reference.
        setTrackedOrder(stored);
      } catch {
        if (!cancelled) setTrackedOrder(null);
      }
    };

    void loadTrackedOrder();
    return () => {
      cancelled = true;
    };
  }, [data?.organization?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const complementProducts = useMemo(() => {
    if (!data) return [];
    return data.products.filter((product) => {
      const categoryName = data.categories.find((category) => category.id === product.category_id)?.name ?? "";
      const normalizedCategory = categoryName
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      return (
        product.kind === "SIMPLE" ||
        /(bebida|bebidas|doce|doces|sobremesa|sobremesas|acompanhamento|acompanhamentos)/i.test(normalizedCategory)
      );
    });
  }, [data]);

  const mainProducts = useMemo(() => {
    if (!data) return [];
    const complementIds = new Set(complementProducts.map((product) => product.id));
    const pizzas = data.products.filter((product) => product.kind === "PIZZA" && !complementIds.has(product.id));
    return pizzas.length > 0 ? pizzas : data.products.filter((product) => !complementIds.has(product.id));
  }, [data, complementProducts]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return mainProducts.filter((product) => {
      const matchesCategory = selectedCategory === "all" || product.category_id === selectedCategory;
      const categoryName = data.categories.find((category) => category.id === product.category_id)?.name ?? "";
      const haystack = [product.name, product.description, categoryName].join(" ").toLocaleLowerCase("pt-BR");
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [data, mainProducts, selectedCategory, searchTerm]);

  const categoryProducts = useMemo(() => {
    if (!data) return new Map<string, number>();
    return new Map(
      data.categories.map((category) => [
        category.id,
        mainProducts.filter((product) => product.category_id === category.id).length,
      ]),
    );
  }, [data, mainProducts]);

  const subtotal = calculateCartSubtotal(cart.items);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) return <StorefrontSkeleton />;
  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-muted">
            <Store className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl">A loja ainda não está pronta</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error instanceof Error ? error.message : "Não foi possível carregar o cardápio."}
          </p>
          <Button className="mt-6" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </section>

      </main>
    );
  }


  const status = getStoreStatus(data.hours, data.specialHours, now);
  const primary = data.settings.primary_color?.includes("%")
    ? `hsl(${data.settings.primary_color})`
    : undefined;
  const secondary = "hsl(145 28% 32%)";
  const secondaryForeground = "hsl(42 35% 96%)";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          ...(primary ? { "--primary": primary } : {}),
          "--secondary": secondary,
          "--secondary-foreground": secondaryForeground,
        } as CSSProperties
      }
    >
      <div className="ppp-top-ticker overflow-hidden bg-secondary text-secondary-foreground" aria-hidden="true"><div className="ppp-ticker-run flex min-w-max items-center gap-8 py-2 font-display text-[11px] uppercase tracking-[.16em] text-white">{[data.organization.name, "Pizza artesanal", status.label, "Delivery e retirada", "Peça online"].map((item, index) => <span key={index} className="inline-flex items-center gap-8">{item}<span className="text-primary">✦</span></span>)}{[data.organization.name, "Pizza artesanal", status.label, "Delivery e retirada", "Peça online"].map((item, index) => <span key={`repeat-${index}`} className="inline-flex items-center gap-8">{item}<span className="text-primary">✦</span></span>)}</div></div>

      <header className="ppp-reference-header absolute inset-x-0 top-0 z-[100] isolate border-b border-white/15 bg-black/55 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-[5.5rem] max-w-[1400px] items-center justify-between gap-6 px-5 sm:h-[6rem] sm:px-8 lg:px-12">
          <a href="#inicio" className="group flex min-w-0 items-center gap-3 text-white">
            {data.settings.logo_url ? (
              <img src={data.settings.logo_url} alt="" className="size-9 rounded-full border border-white/35 object-cover sm:size-10" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40 bg-black/20 font-display text-lg sm:size-10">{data.organization.name.charAt(0)}</span>
            )}
            <span className="truncate font-display text-xl font-medium tracking-[-.03em] sm:text-2xl">{data.organization.name}</span>
          </a>

          <nav className="hidden items-center gap-10 text-[10px] font-medium uppercase tracking-[.38em] text-white/75 md:flex">
            <a href="#cardapio" className="transition-colors hover:text-white">Cardápio</a>
            <a href="#sobre" className="transition-colors hover:text-white">A casa</a>
            <a href="#contato" className="transition-colors hover:text-white">Contato</a>
          </nav>

          <Button size="sm" style={{ backgroundColor: "#f97316", borderColor: "#f97316", color: "#ffffff" }} className="relative z-[110] gap-2 rounded-none px-4 font-body text-[10px] font-medium uppercase tracking-[.22em] text-white shadow-[3px_3px_0_rgba(0,0,0,.45)] transition-transform hover:-translate-y-0.5" onClick={() => setCartOpen(true)}>
            <span>Pedir</span>
            {itemCount > 0 && <Badge className="rounded-full bg-primary px-1.5 text-primary-foreground">{itemCount}</Badge>}
          </Button>
        </div>
      </header>

      <main id="inicio" className="ppp-reference-storefront">
        <section className="ppp-reference-hero mx-auto max-w-none px-0 pb-0 pt-0 sm:px-0 sm:pb-0 sm:pt-0">
          <div className="ppp-reference-hero-frame relative isolate overflow-hidden">
            <div className="ppp-reference-hero-grid grid min-h-0 lg:min-h-[760px] lg:grid-cols-1">
              <div className="ppp-reference-hero-copy relative z-20 flex min-w-0 flex-col justify-end p-7 sm:p-10 lg:p-14">
                <p className="mb-5 w-fit bg-transparent px-0 font-body text-[10px] uppercase tracking-[.42em] text-white/75">Feita na hora · Est. 2026</p>
                <h1 className="w-full max-w-4xl text-[2.35rem] leading-[.86] tracking-[-.045em] sm:text-6xl lg:text-[clamp(4rem,8.5vw,8rem)]">{data.settings.hero_title && !/MASSA DE FERMENTA/i.test(data.settings.hero_title) ? data.settings.hero_title : "Pizza que fica na memória."}</h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{data.settings.hero_subtitle || data.settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos."}</p>
                <a href="#cardapio" className="mt-8 inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-6 py-4 font-display text-sm uppercase text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.85)] transition-transform hover:-translate-y-1">{data.settings.hero_cta_label || "Pedir agora"}<ChevronRight className="size-5" /></a>
              </div>
              <div className="ppp-reference-hero-media pointer-events-none absolute inset-0 z-0 min-h-[560px] overflow-hidden bg-secondary p-0 sm:min-h-[680px] lg:min-h-[760px]">
                <div className="relative h-full min-h-[560px] overflow-hidden bg-background/10 p-0 sm:min-h-[680px] lg:min-h-[760px]">
                  {data.settings.hero_image_url ? (
                    <img src={data.settings.hero_image_url} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" />
                  ) : mainProducts.find((product) => Boolean(product.image_url)) ? (
                    <img src={mainProducts.find((product) => Boolean(product.image_url))?.image_url ?? ""} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full min-h-[560px] place-items-center text-secondary-foreground/50"><Pizza className="size-28" strokeWidth={1} /></div>
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex size-24 rotate-[-8deg] items-center justify-center rounded-full border-2 border-secondary bg-primary p-3 text-center font-display text-[9px] uppercase leading-3 text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.7)] sm:bottom-4 sm:left-4 sm:size-28 sm:text-[10px]">{data.organization.name}<br />feito na hora<br />pizza artesanal</div>
              </div>
            </div>
          </div>
        </section>

        <div className="ppp-product-ticker mb-12 overflow-hidden border-y-2 border-secondary bg-secondary text-secondary-foreground" aria-hidden="true">
          <div className="ppp-ticker-run flex min-w-max items-center gap-8 py-4 font-display text-sm uppercase tracking-[.08em] text-white">
            {mainProducts.slice(0, 8).map((product) => <span key={product.id} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
            {mainProducts.slice(0, 8).map((product) => <span key={`ticker-${product.id}`} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
          </div>
        </div>

        <section id="cardapio" className="ppp-reference-menu mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
          <div className="ppp-reference-menu-heading mb-8 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[.35em] text-primary">Cardápio</p>
            <h2 className="mt-1 max-w-3xl text-4xl leading-[.95] sm:text-6xl">Escolha sua <em>pizza.</em></h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Escolha uma categoria e encontre seu próximo sabor.</p>
          </div>

          <div className="ppp-reference-category-accordion mb-8">
            <ImageAccordion
              items={[
                ...data.categories
                  .filter((category) => Boolean(category.image_url))
                  .slice(0, 6)
                  .map((category) => ({ image: category.image_url!, title: category.name, subtitle: "Confira os sabores" })),
                ...mainProducts
                  .filter((product) => Boolean(product.image_url))
                  .slice(0, 6)
                  .map((product) => ({ image: product.image_url!, title: product.name, subtitle: "Feito na hora" })),
              ]}
              className="h-[330px] sm:h-[410px] lg:h-[460px]"
            />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-sm border-2 border-secondary px-4 py-2 text-sm font-semibold uppercase transition-colors ${selectedCategory === "all" ? "bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]" : "bg-card hover:-translate-y-0.5"}`}
            >
              Todos
            </button>
            {data.categories.filter((category) => mainProducts.some((product) => product.category_id === category.id)).map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`shrink-0 rounded-sm border-2 border-secondary px-4 py-2 text-sm font-semibold uppercase transition-colors ${selectedCategory === category.id ? "bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]" : "bg-card hover:-translate-y-0.5"}`}
              >
                {category.name}
                <span className="ml-1.5 opacity-60">{categoryProducts.get(category.id) ?? 0}</span>
              </button>
            ))}
            </div>
            <label className="relative block shrink-0 sm:w-64">
              <span className="sr-only">Buscar no cardápio</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar no cardápio"
                className="h-11 w-full rounded-sm border-2 border-secondary bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:shadow-[3px_3px_0_rgba(0,0,0,.7)]"
              />
            </label>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
              <p className="font-medium">Nenhum produto nesta categoria.</p>
              <p className="mt-1 text-sm text-muted-foreground">Tente outra categoria.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product, index) => {
                const firstSize = data.sizes[0];
                const displayPrice = getPrice(product, firstSize?.id ?? null, data.prices);
                const categoryImage = data.categories.find((category) => category.id === product.category_id)?.image_url;
                const productImage = product.image_url || categoryImage;
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`group relative overflow-visible rounded-sm border-2 border-secondary bg-card text-left shadow-[7px_7px_0_rgba(0,0,0,.82)] transition-all duration-200 hover:-translate-y-1.5 hover:rotate-[-.45deg] hover:shadow-[11px_11px_0_rgba(0,0,0,.82)] active:translate-x-1 active:translate-y-1 active:shadow-[3px_3px_0_rgba(0,0,0,.82)] ${index % 5 === 2 ? "lg:rotate-[.35deg]" : ""}`}
                  >
                    <div className="relative aspect-[1.18] overflow-hidden border-b-2 border-secondary bg-muted">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={product.name}
                          loading="lazy"
                          className="size-full object-cover transition duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-accent to-secondary/15">
                          <div className="absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
                          <div className="absolute -bottom-12 -left-8 size-36 rounded-full bg-secondary/15 blur-2xl" />
                          <div className="relative flex flex-col items-center gap-2 text-primary/55">
                            <div className="flex size-20 items-center justify-center rounded-full border-2 border-secondary/15 bg-background/55 shadow-sm backdrop-blur-sm">
                              <Pizza className="size-10" strokeWidth={1.5} />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[.18em]">Imagem em breve</span>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-12">
                        <p className="font-display text-xl uppercase leading-none text-white drop-shadow-sm sm:text-2xl">{product.name}</p>
                      </div>
                      {product.featured && (
                        <span className="absolute left-3 top-3 border-2 border-secondary bg-primary px-3 py-1 font-display text-[10px] uppercase tracking-[.12em] text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]">
                          Destaque
                        </span>
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-1">
                          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{data.categories.find((category) => category.id === product.category_id)?.name || "Pizza"}</p>
                          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                            {product.description || "Uma opção preparada para você."}
                          </p>
                        </div>
                        <span className="relative -mr-1 -mt-2 shrink-0 -rotate-3 border-2 border-secondary bg-primary px-3 py-2 font-display text-sm font-bold text-primary-foreground shadow-[4px_4px_0_rgba(0,0,0,.78)] sm:px-3.5">
                          {formatCurrency(displayPrice)}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t-2 border-secondary pt-3 text-xs font-bold uppercase tracking-[.08em]">
                        <span>{product.allow_half ? "Meio a meio" : "Personalizar"}</span>
                        <span className="inline-flex size-8 items-center justify-center border-2 border-secondary bg-background transition-transform group-hover:translate-x-1">
                          <ChevronRight className="size-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        <section id="sobre" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="overflow-hidden rounded-[.75rem] border-2 border-secondary bg-secondary text-secondary-foreground shadow-lifted"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="p-7 sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">A casa</p><h2 className="mt-3 text-4xl uppercase leading-[.9] sm:text-6xl">Feita para quem ama pizza.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-secondary-foreground/75 sm:text-base">{data.settings.description || "Massa, molho, queijo e ingredientes escolhidos para transformar um pedido comum em uma experiência que dá vontade de repetir."}</p><a href="#cardapio" className="mt-7 inline-flex rounded-sm bg-primary px-5 py-3 font-display uppercase text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.5)]">Ver o cardápio</a></div><div className="grid grid-cols-2 gap-3 bg-primary p-4 sm:p-6">{[data.settings.hero_image_url, ...data.categories.slice(0, 3).map((category) => category.image_url)].filter(Boolean).slice(0, 3).map((image, index) => <div key={`about-${index}`} className={`overflow-hidden rounded-sm border-2 border-secondary shadow-[5px_5px_0_rgba(0,0,0,.6)] ${index === 0 ? "col-span-2 aspect-[2/1] rotate-[-1.5deg]" : "aspect-square rotate-[1.5deg]"}`}><img src={image!} alt="" className="size-full object-cover transition duration-500 hover:scale-105" loading="lazy" /></div>)}</div></div></div></section>

        <section id="contato" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6"><div className="rounded-[.75rem] border-2 border-secondary bg-primary p-7 text-primary-foreground shadow-lifted sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] opacity-75">Contato</p><h2 className="mt-2 text-[clamp(4.5rem,15vw,10rem)] uppercase leading-[.75]">Bora pedir?</h2><div className="mt-10 grid gap-3 sm:grid-cols-3"><a href="#cardapio" className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)] transition-transform hover:-translate-y-1"><span className="block text-xs uppercase tracking-widest opacity-60">Cardápio</span><span className="mt-1 block font-semibold">Escolher agora</span></a><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">Atendimento</span><span className="mt-1 block font-semibold">{data.settings.delivery_enabled && data.settings.pickup_enabled ? "Delivery e retirada" : data.settings.delivery_enabled ? "Delivery" : "Retirada"}</span></div><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">WhatsApp</span><span className="mt-1 block font-semibold">{data.settings.whatsapp_phone || "Consulte a loja"}</span></div></div></div></section>

      </main>

      {selectedProduct && (
        <ProductConfigurator
          product={selectedProduct}
          data={data}
          onClose={() => setSelectedProduct(null)}
          onAdded={(items) => {
            items.forEach((item) => cart.addItem(item));
            setSelectedProduct(null);
            setCartOpen(true);
          }}
        />
      )}

      {cartOpen && (
        <CartPanel
          items={cart.items}
          subtotal={subtotal}
          onClose={() => setCartOpen(false)}
          onUpdate={cart.updateQuantity}
          onRemove={cart.removeItem}
          onClear={cart.clear}
          storeOpen={status.open}
          storeStatusLabel={status.label}
          minOrderAmount={Number(data.settings.min_order_amount ?? 0)}
          pickupEnabled={Boolean(data.settings.pickup_enabled)}
          deliveryEnabled={Boolean(data.settings.delivery_enabled)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutPanel
          organization={data.organization}
          settings={data.settings}
          deliveryZones={data.deliveryZones}
          items={cart.items}
          subtotal={subtotal}
          onClose={() => setCheckoutOpen(false)}
          storeOpen={status.open}
          storeStatusLabel={status.label}
          trackedOrder={trackedOrder}
          onSuccess={(order) => {
            cart.clear();
            setTrackedOrder(order);
            try {
              localStorage.setItem(`ppp:last-order:${data.organization.id}`, JSON.stringify(order));
            } catch {
              // Ignore storage failures; tracking still works for the current session.
            }
          }}
          onOrderFinished={() => {
            setTrackedOrder(null);
            try {
              localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
            } catch {
              // Ignore storage failures.
            }
          }}
        />
      )}

      {trackedOrder && !checkoutOpen && !cartOpen && itemCount === 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[120] mx-auto w-[calc(100%-2rem)] max-w-md">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border bg-card px-5 py-4 text-left shadow-lifted"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[.12em] text-primary">Pedido em andamento</span>
              <span className="mt-1 block text-sm font-semibold">Acompanhar pedido #{trackedOrder.number}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      )}

      {itemCount > 0 && !cartOpen && !checkoutOpen && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[calc(100%-2rem)] max-w-md">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-secondary px-5 py-4 text-secondary-foreground shadow-lifted"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="size-4" />
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
            <span className="font-bold">{formatCurrency(subtotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}


function ProductConfigurator({
  product,
  data,
  onClose,
  onAdded,
}: {
  product: Product;
  data: StoreData;
  onClose: () => void;
  onAdded: (items: CartItem[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [sizeId, setSizeId] = useState<string | null>(data.sizes[0]?.id ?? null);
  const [secondProductId, setSecondProductId] = useState<string | null>(null);
  const [halfMode, setHalfMode] = useState(false);
  const [crustId, setCrustId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [comboProductIds, setComboProductIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const personalizationScrollRef = useRef<HTMLDivElement | null>(null);
  const stepScrollRef = useRef<HTMLDivElement | null>(null);

  const secondProduct = data.products.find((item) => item.id === secondProductId) ?? null;
  const comboProducts = data.products.filter((item) => {
    const categoryName = data.categories.find((category) => category.id === item.category_id)?.name ?? "";
    const normalizedCategory = categoryName
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return (
      item.kind === "SIMPLE" ||
      /(bebida|bebidas|doce|doces|sobremesa|sobremesas|acompanhamento|acompanhamentos)/i.test(normalizedCategory)
    );
  });
  const selectedSize = data.sizes.find((size) => size.id === sizeId) ?? null;
  const basePrice = getPrice(product, sizeId, data.prices);
  const secondBasePrice = secondProduct ? getPrice(secondProduct, sizeId, data.prices) : basePrice;
  const crust = data.crusts.find((item) => item.id === crustId);
  const productAddonIds = (data.productAddonLinks ?? [])
    .filter((link) => link.product_id === product.id || link.product_id === secondProduct?.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => link.addon_id);
  const availableAddonIds = new Set(productAddonIds);
  const availableAddons = data.addons.filter((item) => availableAddonIds.has(item.id));
  const addons = availableAddons.filter((item) => addonIds.includes(item.id));
  const halfBasePrice = secondProduct
    ? calculateProductUnitPrice({
        basePrice,
        secondBasePrice,
        isHalf: true,
        halfRule: data.settings.half_pizza_pricing_rule,
        halfFixedPrice: data.settings.half_pizza_fixed_price,
      })
    : basePrice;
  const unitPrice = calculateProductUnitPrice({
    basePrice,
    secondBasePrice,
    isHalf: halfMode && Boolean(secondProductId),
    halfRule: data.settings.half_pizza_pricing_rule,
    halfFixedPrice: data.settings.half_pizza_fixed_price,
    crustPrice: crust?.price ?? 0,
    addonPrices: addons.map((item) => item.price),
  });

  const totalSteps = 3;
  const nextStep = () => setStep((current) => Math.min(totalSteps, current + 1));
  const previousStep = () => setStep((current) => Math.max(1, current - 1));

  useEffect(() => {
    requestAnimationFrame(() => {
      stepScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [step]);

  useEffect(() => {
    if (!halfMode) return;
    requestAnimationFrame(() => {
      personalizationScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [halfMode]);

  const toggleAddon = (id: string) => {
    setAddonIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleCombo = (id: string) => {
    setComboProductIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const addToCart = () => {
    const mainItem: CartItem = {
      lineId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      secondProductId: secondProduct?.id ?? null,
      secondProductName: secondProduct?.name ?? null,
      isHalf: halfMode && Boolean(secondProduct),
      sizeId,
      sizeName: selectedSize?.name ?? null,
      crustId,
      crustName: crust?.name ?? null,
      crustPrice: Number(crust?.price ?? 0),
      addons: addons.map((addon) => ({ id: addon.id, name: addon.name, price: Number(addon.price) })),
      complements: comboProductIds
        .map((id) => data.products.find((item) => item.id === id))
        .filter((item): item is Product => Boolean(item))
        .map((item) => ({ productId: item.id, productName: item.name, imageUrl: item.image_url, price: Number(item.base_price) || 0 })),
      quantity,
      notes: notes.trim() || null,
      unitPrice: unitPrice + comboProductIds.reduce((sum, id) => {
        const item = data.products.find((product) => product.id === id);
        return sum + (Number(item?.base_price) || 0);
      }, 0),
    };

    onAdded([mainItem]);
  };

  const stepTitle =
    step === 1
      ? "Escolha"
      : step === 2
        ? "Personalize"
        : "Finalize";

  return (
    <div className="ppp-order-builder fixed inset-0 z-[140] flex items-end justify-center bg-foreground/55 p-0 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={"Montar " + product.name}>
      <div className="flex h-[95dvh] max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:h-[92vh] sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="relative shrink-0 overflow-hidden border-b bg-foreground px-5 pb-5 pt-4 text-background sm:px-6">
          <div className="absolute -right-10 -top-16 size-40 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-2xl border border-background/15 bg-background/10 shadow-lg">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center font-display text-2xl text-background/40"><Pizza className="size-8" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-background/60">Montar pedido · {step}/{totalSteps}</p>
                <button onClick={onClose} aria-label="Fechar" className="rounded-full border border-background/15 p-2 text-background/80 transition hover:bg-background/10 hover:text-background">
                  <X className="size-5" />
                </button>
              </div>
              <h2 className="mt-1 truncate font-display text-2xl tracking-[-.03em]">{product.name}</h2>
              <p className="mt-1 text-xs text-background/60">{stepTitle} · personalize do seu jeito</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b bg-card px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            {["Escolha", "Personalize", "Finalize"].map((label, index) => {
              const active = index + 1 === step;
              const complete = index + 1 < step;
              return (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <div className={"grid size-8 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-all " + (active ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/.12)]" : complete ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground")}>
                    {complete ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={"truncate text-[10px] font-semibold uppercase tracking-[.14em] " + (active || complete ? "text-foreground" : "text-muted-foreground")}>{label}</p>
                    <div className={"mt-1 h-1 rounded-full " + (complete || active ? "bg-primary" : "bg-muted")} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={stepScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {step === 1 && (
            <section className="space-y-6">
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Produto principal</p>
                <p className="mt-1 text-lg font-semibold">{product.name}</p>
                {product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">01 · Escolha o tamanho</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">Qual vai ser o tamanho?</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Toque para escolher</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.sizes.map((size, index) => {
                    const price = getPrice(product, size.id, data.prices);
                    const selected = sizeId === size.id;
                    return (
                      <button
                        key={size.id}
                        onClick={() => setSizeId(size.id)}
                        className={"group relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 " + (selected ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.16)] ring-1 ring-primary/20" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md")}
                      >
                        <div className="flex items-center gap-3">
                          <div className={"grid size-11 shrink-0 place-items-center rounded-xl border text-xl transition-transform group-hover:scale-105 " + (selected ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-muted")}>
                            <span aria-hidden="true">{index === 0 ? "🍕" : index === 1 ? "🍕" : "🍕"}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">{size.name}</span>
                            {size.slices ? <span className={"mt-0.5 block text-[11px] " + (selected ? "text-primary-foreground/70" : "text-muted-foreground")}>{size.slices} fatias</span> : null}
                          </div>
                          <div className="text-right">
                            <span className="block text-sm font-bold">{formatCurrency(price)}</span>
                            {selected && <span className="text-[8px] font-bold uppercase tracking-widest opacity-70">Selecionado</span>}
                          </div>
                        </div>
                        <div className={"absolute -right-8 -top-8 size-20 rounded-full blur-2xl " + (selected ? "bg-primary-foreground/15" : "bg-primary/5")} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {product.allow_half && (
                <div>
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">02 · Formato</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">Como você quer sua pizza?</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHalfMode(false);
                        setSecondProductId(null);
                      }}
                      className={"group relative overflow-hidden rounded-2xl border p-4 text-left transition-all " + (!halfMode ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-2 ring-primary/20" : "bg-card hover:border-primary/50 hover:shadow-md")}
                      aria-pressed={!halfMode}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className={"relative grid size-11 place-items-center overflow-hidden rounded-xl border text-lg " + (!halfMode ? "border-primary-foreground/15 bg-primary-foreground/10" : "border-border bg-muted")}>
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-background/15" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/30" />
                          <Pizza className="relative z-10 size-5" />
                        </div>
                        {!halfMode && <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest">✓ Selecionado</span>}
                      </div>
                      <p className="font-bold">Pizza inteira</p>
                      <p className={"mt-1 text-xs " + (!halfMode ? "text-primary-foreground/70" : "text-muted-foreground")}>1 sabor · {product.name}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHalfMode(true);
                        requestAnimationFrame(() => {
                          personalizationScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                      className={"group relative overflow-hidden rounded-2xl border p-4 text-left transition-all " + (halfMode ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-2 ring-primary/20" : "bg-card hover:border-primary/50 hover:shadow-md")}
                      aria-pressed={halfMode}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className={"relative grid size-11 place-items-center overflow-hidden rounded-xl border " + (halfMode ? "border-primary-foreground/15 bg-primary-foreground/10" : "border-border bg-muted")}>
                          <div className={"absolute inset-y-0 left-0 w-1/2 " + (halfMode ? "bg-primary-foreground/15" : "bg-muted-foreground/10")} />
                          <div className={"absolute inset-y-0 right-0 w-1/2 " + (halfMode ? "bg-primary-foreground/35" : "bg-primary/10")} />
                          <span className="relative z-10 text-lg">◐</span>
                        </div>
                        {halfMode && <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest">✓ Selecionado</span>}
                      </div>
                      <p className="font-bold">Meio a meio</p>
                      <p className={"mt-1 text-xs " + (halfMode ? "text-primary-foreground/75" : "text-muted-foreground")}>2 sabores · metade de cada</p>
                    </button>
                  </div>

                  {halfMode && (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-3">
                      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <span className="text-sm font-bold">2</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Você escolheu meio a meio</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          Agora escolha o <strong>segundo sabor</strong>. O primeiro já é <strong>{product.name}</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {product.allow_half && halfMode && (
                <div ref={personalizationScrollRef} className="scroll-mt-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <span className="text-base">◐</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">Escolha o segundo sabor</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Primeiro sabor: <strong>{product.name}</strong>. Agora escolha a outra metade.
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-primary">
                        {selectedSize?.name ? selectedSize.name + " · " + formatCurrency(basePrice) : "Escolha um tamanho primeiro"}
                      </p>
                    </div>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {data.products
                      .filter((item) => item.kind === "PIZZA" && item.id !== product.id)
                      .map((item) => {
                        const price = getPrice(item, sizeId, data.prices);
                        const selected = secondProductId === item.id;
                        const previewPrice = calculateProductUnitPrice({
                          basePrice,
                          secondBasePrice: price,
                          isHalf: true,
                          halfRule: data.settings.half_pizza_pricing_rule,
                          halfFixedPrice: data.settings.half_pizza_fixed_price,
                        });
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSecondProductId(item.id)}
                            className={"flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left " + (selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background")}
                          >
                            <span>
                              <span className="block text-sm font-semibold">{item.name}</span>
                              <span className="text-xs text-muted-foreground">Segunda metade · {formatCurrency(price)}</span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-bold">{formatCurrency(previewPrice)}</span>
                              <span className="text-[11px] text-muted-foreground">total da pizza</span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {secondProduct && (
                    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/20 bg-background">
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/45" />
                          <span className="relative z-10 text-xs">🍕</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Pizza montada</p>
                          <p className="truncate text-sm font-semibold">{product.name} + {secondProduct.name}</p>
                          <p className="text-xs text-muted-foreground">½ {product.name} · ½ {secondProduct.name}</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">{formatCurrency(halfBasePrice)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-secondary p-3 text-secondary-foreground shadow-[0_14px_35px_hsl(var(--primary)/.10)] sm:p-6">
                <div className="absolute -right-12 -top-12 size-32 rounded-full bg-primary/20 blur-3xl" />
                <div className="relative">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">03 · Personalização</p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg tracking-[-.03em] sm:text-xl">Do seu jeito.</h3>
                      <p className="mt-0.5 max-w-md text-[10px] leading-4 text-secondary-foreground/65">Escolha os detalhes que deixam sua pizza ainda mais especial.</p>
                    </div>
                    {(crustId || addonIds.length > 0 || notes.trim()) && (
                      <div className="hidden shrink-0 rounded-full bg-primary px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground sm:block">
                        Personalizada
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {data.crusts.length > 0 && (
                <div className="rounded-xl border bg-card p-2.5 shadow-sm sm:p-3">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">01 · Borda</p>
                      <p className="mt-0.5 text-sm font-semibold tracking-tight">Qual borda você prefere?</p>
                    </div>
                    {crustId && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">Escolhida</span>}
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {data.crusts.map((item) => {
                      const selected = crustId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setCrustId(selected ? null : item.id)}
                          aria-pressed={selected}
                          className={"group flex min-h-[44px] items-center justify-between rounded-lg border p-2 text-left transition-all duration-200 " + (selected ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-1 ring-primary/20" : "bg-background hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md")}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={"grid size-7 shrink-0 place-items-center rounded-lg border text-[11px] " + (selected ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-muted")}>✦</span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">{item.name}</span>
                              <span className={"mt-0 block text-[8px] " + (selected ? "text-primary-foreground/70" : "text-muted-foreground")}>{Number(item.price) > 0 ? "Adicional" : "Inclusa"}</span>
                            </span>
                          </span>
                          <span className="ml-2 shrink-0 text-right text-[10px] font-bold">{Number(item.price) > 0 ? "+" + formatCurrency(Number(item.price)) : "Grátis"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableAddons.length > 0 && (
                <div className="rounded-[1.5rem] border bg-card p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">02 · Adicionais</p>
                      <p className="mt-0.5 text-sm font-semibold tracking-tight">Quer deixar ainda melhor?</p>
                    </div>
                    {addonIds.length > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{addonIds.length} {addonIds.length === 1 ? "selecionado" : "selecionados"}</span>}
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {availableAddons.map((item) => {
                      const checked = addonIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleAddon(item.id)}
                          aria-pressed={checked}
                          className={"group flex min-h-[52px] items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-200 " + (checked ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-1 ring-primary/20" : "bg-background hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md")}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={"grid size-7 shrink-0 place-items-center rounded-lg border " + (checked ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-muted")}>
                              {checked ? <Check className="size-4" /> : <Plus className="size-4 text-muted-foreground" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{item.name}</span>
                              <span className={"mt-0.5 block text-[10px] " + (checked ? "text-primary-foreground/70" : "text-muted-foreground")}>Adicionar ao pedido</span>
                            </span>
                          </span>
                          <span className="ml-2 shrink-0 text-[10px] font-bold">+{formatCurrency(Number(item.price))}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-[1.5rem] border bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">03 · Observações</p>
                  <label htmlFor="product-notes" className="mt-1 block text-lg font-semibold tracking-tight">Algum detalhe especial?</label>
                </div>
                <Textarea id="product-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola, pouco molho..." maxLength={300} className="min-h-16 resize-none rounded-lg bg-background" />
                <p className="mt-2 text-right text-[10px] text-muted-foreground">{notes.length}/300</p>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="mb-5 rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Últimos detalhes</p>
                <p className="mt-1 text-sm text-muted-foreground">Escolha bebidas e acompanhamentos para adicionar junto com esta pizza.</p>
              </div>

              {comboProducts.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {comboProducts.map((item) => {
                    const checked = comboProductIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleCombo(item.id)}
                        className={"flex items-center gap-3 rounded-2xl border p-3 text-left " + (checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card")}
                      >
                        <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {item.image_url ? <img src={item.image_url} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center font-display text-lg text-primary/40">{item.name.charAt(0)}</div>}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{item.name}</span>
                          <span className="text-xs text-muted-foreground">Adicionar ao pedido</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold">{formatCurrency(Number(item.base_price) || 0)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum acompanhamento ou bebida disponível no momento.
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.name}{secondProduct ? " + " + secondProduct.name : ""}</p>
                    <p className="text-xs text-muted-foreground">{selectedSize?.name ?? "Sem tamanho"} · {addons.length} adicional(is){crust ? " · " + crust.name : ""}</p>
                  </div>
                  <p className="font-bold">{formatCurrency(unitPrice * quantity)}</p>
                </div>
                {comboProductIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    + {comboProductIds.length} complemento(s) serão adicionados ao carrinho.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t border-primary/10 bg-card px-3 pb-[calc(.35rem+env(safe-area-inset-bottom))] pt-1.5 sm:px-4 sm:py-2.5 shadow-[0_-8px_20px_rgba(0,0,0,.12)]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[8px] font-bold text-primary-foreground">{quantity} {quantity === 1 ? "pizza" : "pizzas"}</span>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">{step < totalSteps ? "Seu pedido" : "Total"}</span>
              <span className="whitespace-nowrap text-xs font-black tracking-tight text-foreground">{formatCurrency(unitPrice * quantity)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="flex h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-full border border-foreground bg-foreground px-2 text-xs font-semibold text-background shadow-sm transition active:scale-[.98] hover:bg-foreground/90"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <span className="truncate">
                  {step === 1 && product.allow_half && halfMode && !secondProductId ? "Escolha o segundo sabor" : "Próxima etapa"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && <ChevronRight className="size-3.5 shrink-0" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-9 w-full min-w-0 items-center justify-center overflow-hidden rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 sm:px-4"
              >
                <span className="truncate">Adicionar ao carrinho · {formatCurrency(unitPrice * quantity)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartPanel({
  items,
  subtotal,
  onClose,
  onUpdate,
  onRemove,
  onClear,
  storeOpen,
  storeStatusLabel,
  minOrderAmount,
  pickupEnabled,
  deliveryEnabled,
  onCheckout,
}: {
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onUpdate: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  minOrderAmount: number;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="ppp-cart-panel fixed inset-0 z-[150] bg-foreground/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Carrinho">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar carrinho" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-lifted">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Seu pedido</p>
            <h2 className="text-2xl">Carrinho</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 hover:bg-muted"><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted"><ShoppingBag className="size-7 text-muted-foreground" /></div>
              <p className="mt-4 font-semibold">Seu carrinho está vazio</p>
              <p className="mt-1 text-sm text-muted-foreground">Adicione uma pizza para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="rounded-2xl border bg-card p-4">
                  <div className="flex gap-3">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center font-display text-xl text-primary/40">{item.productName.charAt(0)}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.productName}{item.secondProductName ? ` + ${item.secondProductName}` : ""}</p>
                          <p className="text-xs text-muted-foreground">
                            {[item.sizeName, item.crustName, item.addons.length ? `${item.addons.length} adicional(is)` : null, (item.complements ?? []).length ? `${(item.complements ?? []).length} complemento(s)` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button onClick={() => onRemove(item.lineId)} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${item.productName}`}><X className="size-4" /></button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-full border">
                          <button onClick={() => onUpdate(item.lineId, item.quantity - 1)} className="p-2" aria-label="Diminuir"><Minus className="size-3.5" /></button>
                          <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                          <button onClick={() => onUpdate(item.lineId, item.quantity + 1)} className="p-2" aria-label="Aumentar"><Plus className="size-3.5" /></button>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-card p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A taxa de entrega e descontos serão calculados no checkout.
          </p>
          {deliveryEnabled && minOrderAmount > 0 && subtotal < minOrderAmount && (
            <div className="mt-3 rounded-2xl bg-primary/5 p-3 text-sm">
              <p className="font-semibold text-primary">
                Pedido mínimo para entrega: {formatCurrency(minOrderAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Faltam {formatCurrency(minOrderAmount - subtotal)} para atingir o mínimo.
                {pickupEnabled ? " Para retirada, não há pedido mínimo." : ""}
              </p>
            </div>
          )}
          <Button
            disabled={
              items.length === 0 ||
              !storeOpen ||
              (deliveryEnabled && !pickupEnabled && minOrderAmount > 0 && subtotal < minOrderAmount)
            }
            className="mt-4 h-12 w-full rounded-full"
            onClick={onCheckout}
          >
            {storeOpen ? "Continuar para checkout" : "Loja fechada"}
          </Button>
          {!storeOpen && <p className="mt-2 text-center text-xs font-medium text-primary">{storeStatusLabel}</p>}
          {items.length > 0 && (
            <button onClick={onClear} className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-destructive">
              Limpar carrinho
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function CheckoutPanel({
  organization,
  settings,
  deliveryZones,
  items,
  subtotal,
  onClose,
  onSuccess,
  trackedOrder,
  storeOpen,
  storeStatusLabel,
  onOrderFinished,
}: {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: (order: { id: string; number: number; phone: string }) => void;
  trackedOrder?: { id: string; number: number; phone: string } | null;
  storeOpen: boolean;
  storeStatusLabel: string;
  onOrderFinished: () => void;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    settings.delivery_enabled ? "DELIVERY" : "PICKUP",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.payment_methods[0] ?? "PIX",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<number | null>(null);
  const [successStatus, setSuccessStatus] = useState<OrderStatus>("RECEIVED");
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackedOrder) return;
    setSuccessOrderId(trackedOrder.id);
    setSuccessNumber(trackedOrder.number);
    setSuccessStatus("RECEIVED");
    setPhone(trackedOrder.phone);
  }, [trackedOrder]);

  const selectedZone =
    fulfillment === "DELIVERY"
      ? deliveryZones.find((zone) =>
          zone.neighborhoods.some(
            (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
          ),
        ) ?? null
      : null;

  const matchedNeighborhood =
    selectedZone?.neighborhoods.find(
      (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
    ) ?? null;

  const availableNeighborhoods = Array.from(
    new Set(
      deliveryZones.flatMap((zone) => zone.neighborhoods.map((item) => item.trim()).filter(Boolean)),
    ),
  );
  const deliveryFee = selectedZone?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const availablePayments = settings.payment_methods.length
    ? settings.payment_methods
    : (["PIX"] as PaymentMethod[]);

  const submitOrder = async () => {
    setError(null);

    if (!storeOpen) {
      setError(`A loja está fechada. ${storeStatusLabel}.`);
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setError("Informe seu nome e telefone.");
      return;
    }
    if (fulfillment === "DELIVERY") {
      if (!street.trim() || !number.trim() || !neighborhood.trim()) {
        setError("Para entrega, informe rua, número e bairro.");
        return;
      }
      if (deliveryZones.length > 0 && !selectedZone) {
        setError("Não encontramos uma área de entrega para esse bairro.");
        return;
      }
    }
    const minOrderAmount = Number(settings.min_order_amount ?? 0);
    if (
      fulfillment === "DELIVERY" &&
      minOrderAmount > 0 &&
      subtotal < minOrderAmount
    ) {
      setError(
        `Para entrega, o pedido mínimo é ${formatCurrency(minOrderAmount)}. Faltam ${formatCurrency(minOrderAmount - subtotal)}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organization_id: organization.id,
        subtotal,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        fulfillment,
        payment_method: paymentMethod,
        address_street: fulfillment === "DELIVERY" ? street.trim() : null,
        address_number: fulfillment === "DELIVERY" ? number.trim() : null,
        address_neighborhood: fulfillment === "DELIVERY" ? (matchedNeighborhood ?? neighborhood.trim()) : null,
        address_complement: fulfillment === "DELIVERY" ? complement.trim() || null : null,
        address_reference: fulfillment === "DELIVERY" ? reference.trim() || null : null,
        notes: notes.trim() || null,
        idempotency_key: crypto.randomUUID(),
        items: items.flatMap((item) => [
          {
            product_id: item.productId,
            second_product_id: item.secondProductId,
            is_half: item.isHalf,
            size_id: item.sizeId,
            crust_id: item.crustId,
            quantity: item.quantity,
            notes: item.notes,
            addons: item.addons.map((addon) => ({ id: addon.id })),
          },
          ...(item.complements ?? []).map((complement) => ({
            product_id: complement.productId,
            second_product_id: null,
            is_half: false,
            size_id: null,
            crust_id: null,
            quantity: 1,
            notes: "Complemento do pedido: " + item.productName,
            addons: [],
          })),
        ]),
      };

      const { data: created, error: createError } = await supabase.rpc(
        "create_public_order",
        { p_order: payload },
      );
      if (createError) throw createError;

      const order = Array.isArray(created) ? created[0] : created;
      if (!order?.order_number || !order?.order_id) throw new Error("Não foi possível criar o pedido.");
      setSuccessOrderId(String(order.order_id));
      setSuccessNumber(Number(order.order_number));
      setSuccessStatus("RECEIVED");
      onSuccess({ id: String(order.order_id), number: Number(order.order_number), phone: phone.trim() });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : typeof submitError === "object" && submitError !== null && "message" in submitError
            ? String((submitError as { message?: unknown }).message ?? "Não foi possível enviar o pedido.")
            : "Não foi possível enviar o pedido.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!successOrderId) return;

    let cancelled = false;
    const loadStatus = async () => {
      const { data: tracking, error: trackingQueryError } = await supabase.rpc(
        "get_public_order_status",
        { p_order_id: successOrderId, p_customer_phone: phone.trim() },
      );

      if (cancelled) return;
      if (trackingQueryError) {
        setTrackingError("Não foi possível atualizar o status agora.");
        return;
      }

      const current = Array.isArray(tracking) ? tracking[0] : tracking;
      if (current?.status) {
        const currentStatus = current.status as OrderStatus;
        setSuccessStatus(currentStatus);
        setTrackingError(null);

        if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED") {
          onOrderFinished();
        }
      }
    };

    void loadStatus();
    const interval = window.setInterval(loadStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [successOrderId, phone, onOrderFinished]);

  if (successNumber != null && successOrderId != null) {
    const trackingSteps: [OrderStatus, string, string][] = [
      ["RECEIVED", "Pedido recebido", "Seu pedido chegou até a loja."],
      ["CONFIRMED", "Pedido confirmado", "A cozinha já confirmou o pedido."],
      ["PREPARING", "Em preparo", "Estamos preparando tudo com cuidado."],
      ["READY", fulfillment === "DELIVERY" ? "Pedido pronto" : "Pronto para retirada", fulfillment === "DELIVERY" ? "Seu pedido está pronto para sair." : "Seu pedido já pode ser retirado."],
      ...(fulfillment === "DELIVERY"
        ? ([["OUT_FOR_DELIVERY", "Saiu para entrega", "Seu pedido está a caminho."]] as [OrderStatus, string, string][])
        : []),
      ["DELIVERED", fulfillment === "DELIVERY" ? "Entregue" : "Retirado", "Pedido finalizado com sucesso."],
    ];
    const currentIndex = trackingSteps.findIndex(([step]) => step === successStatus);
    const isCancelled = successStatus === "CANCELLED";
    const progress = currentIndex >= 0 ? ((currentIndex + 1) / trackingSteps.length) * 100 : 0;

    return (
      <div className="ppp-checkout-panel fixed inset-0 z-[200] overflow-y-auto bg-[#f4f1eb] text-foreground">
        <div className="min-h-screen">
          <header className="bg-foreground text-background">
            <div className="mx-auto max-w-5xl px-5 pb-7 pt-5 sm:px-8 sm:pb-9 sm:pt-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                    <Pizza className="size-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.24em] text-background/45">Acompanhamento</p>
                    <p className="mt-0.5 font-display text-lg tracking-tight">{organization.name}</p>
                  </div>
                </div>
                <button onClick={onClose} className="rounded-full border border-background/15 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-background/70 transition hover:bg-background/10 hover:text-background">
                  Cardápio
                </button>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-primary-foreground">
                      Pedido #{successNumber}
                    </span>
                    <span className="rounded-full border border-background/15 px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-background/55">
                      Atualização automática
                    </span>
                  </div>
                  <h1 className="mt-4 max-w-2xl font-display text-[clamp(2.6rem,7vw,5.5rem)] leading-[.86] tracking-[-.05em]">
                    {isCancelled ? "Pedido cancelado." : successStatus === "DELIVERED" ? "Pedido concluído." : "Seu pedido está a caminho."}
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-background/55 sm:text-base">
                    {isCancelled ? "Confira a mensagem abaixo para mais detalhes." : successStatus === "DELIVERED" ? "Obrigado por pedir com a gente. Esperamos que aproveite." : "Fique tranquilo: esta tela se atualiza automaticamente conforme a loja avança o pedido."}
                  </p>
                </div>
                <div className="hidden text-right lg:block">
                  <p className="text-[9px] font-bold uppercase tracking-[.2em] text-background/35">Status atual</p>
                  <p className="mt-1 font-display text-2xl text-primary">
                    {isCancelled ? "Cancelado" : trackingSteps[currentIndex]?.[1] ?? "Em atualização"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 pb-12 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-[0_14px_40px_rgba(0,0,0,.06)]">
              <div className="border-b border-black/7 px-5 py-5 sm:px-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">Progresso do pedido</p>
                    <h2 className="mt-1 font-display text-2xl tracking-tight">Estamos por aqui</h2>
                  </div>
                  {!isCancelled && <span className="text-xs font-semibold text-muted-foreground">{Math.round(progress)}% concluído</span>}
                </div>
                {!isCancelled && (
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: \`\${progress}%\` }} />
                  </div>
                )}
              </div>

              <div className="px-5 py-5 sm:px-7 sm:py-7">
                {isCancelled ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex gap-4">
                      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"><X className="size-5" /></div>
                      <div>
                        <p className="font-bold">Pedido cancelado</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{trackingError ?? "A loja cancelou este pedido."}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute bottom-8 left-[18px] top-8 w-px bg-border sm:left-[20px]" />
                    <div className="space-y-1">
                      {trackingSteps.map(([value, label, description], index) => {
                        const isDone = currentIndex >= 0 && index <= currentIndex;
                        const isCurrent = value === successStatus;
                        return (
                          <div key={value} className="relative flex gap-4 rounded-2xl p-3 transition sm:p-4">
                            <div className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 transition-all sm:size-10 ${isDone ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_hsl(var(--primary)/.08)]" : "border-border bg-white text-muted-foreground"}`}>
                              {isDone ? <Check className="size-4" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                            </div>
                            <div className="min-w-0 flex-1 pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-sm font-bold sm:text-base ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                                {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-primary">Agora</span>}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-2xl bg-[#f8f6f2] p-4 sm:p-5">
                  <div className="flex gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 className="size-4" /></div>
                    <div>
                      <p className="text-xs font-bold">{trackingError ?? (isCancelled ? "O acompanhamento foi encerrado." : "O status é atualizado automaticamente a cada poucos segundos.")}</p>
                      {!isCancelled && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Você pode deixar esta tela aberta enquanto aguarda.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-[1.75rem] bg-foreground p-5 text-background shadow-[0_18px_45px_rgba(0,0,0,.12)] sm:p-6">
                <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">Pedido</p>
                <p className="mt-1 font-display text-3xl tracking-tight">#{successNumber}</p>
                <div className="mt-5 border-t border-background/10 pt-4">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-background/45">Recebimento</span>
                    <span className="font-bold">{fulfillment === "DELIVERY" ? "Delivery" : "Retirada"}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-background/45">Situação</span>
                    <span className="font-bold text-primary">{isCancelled ? "Cancelado" : trackingSteps[currentIndex]?.[1] ?? "Atualizando"}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,.05)] sm:p-6">
                <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">Precisa sair?</p>
                <h3 className="mt-1 font-display text-2xl tracking-tight">Voltar ao cardápio</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Você pode continuar navegando. O pedido segue sendo acompanhado automaticamente.</p>
                <Button className="mt-5 h-11 w-full rounded-xl text-xs font-black" onClick={onClose}>Voltar ao cardápio</Button>
              </section>
            </aside>
          </main>
        </div>
      </div>
    );
  }
  return (
    <div className="ppp-checkout-panel fixed inset-0 z-[60] overflow-y-auto bg-[#f7f4ef] text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-6xl px-3 pb-28 pt-3 sm:px-6 sm:pb-12 sm:pt-6">
        <header className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-foreground text-background shadow-[0_18px_45px_rgba(0,0,0,.12)] sm:rounded-[2rem]">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-11">
                <Pizza className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-[.22em] text-primary">Finalização</p>
                <h1 className="truncate font-display text-xl tracking-tight sm:text-2xl">Seu pedido</h1>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-background/15 bg-background/5 text-background/80 transition hover:bg-background/10 hover:text-background"
              aria-label="Fechar checkout"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 border-t border-background/10 bg-background/[.04]">
            {[
              ["01", "Receber"],
              ["02", "Dados"],
              ["03", "Pagamento"],
            ].map(([number, label], index) => (
              <div key={number} className={`flex items-center justify-center gap-2 px-2 py-2.5 ${index === 0 ? "text-background" : "text-background/45"}`}>
                <span className={`grid size-5 place-items-center rounded-full text-[8px] font-black ${index === 0 ? "bg-primary text-primary-foreground" : "border border-background/20"}`}>{number}</span>
                <span className="hidden text-[9px] font-semibold uppercase tracking-[.14em] sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="space-y-3">
            <section className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Store className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">01 · Entrega</p>
                  <h2 className="mt-0.5 text-base font-bold tracking-tight sm:text-lg">Como você quer receber?</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Escolha a forma mais conveniente para você.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {settings.delivery_enabled && (
                  <button
                    onClick={() => setFulfillment("DELIVERY")}
                    className={`group rounded-2xl border p-3.5 text-left transition-all active:scale-[.99] sm:p-4 ${fulfillment === "DELIVERY" ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.18)] ring-1 ring-primary" : "border-black/8 bg-[#faf9f7] hover:border-primary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">Entrega</span>
                      <span className={`grid size-6 place-items-center rounded-full ${fulfillment === "DELIVERY" ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
                        {fulfillment === "DELIVERY" ? <Check className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </span>
                    </div>
                    <p className={`mt-1 text-[11px] ${fulfillment === "DELIVERY" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Receba no endereço informado</p>
                  </button>
                )}
                {settings.pickup_enabled && (
                  <button
                    onClick={() => setFulfillment("PICKUP")}
                    className={`group rounded-2xl border p-3.5 text-left transition-all active:scale-[.99] sm:p-4 ${fulfillment === "PICKUP" ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.18)] ring-1 ring-primary" : "border-black/8 bg-[#faf9f7] hover:border-primary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">Retirada</span>
                      <span className={`grid size-6 place-items-center rounded-full ${fulfillment === "PICKUP" ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
                        {fulfillment === "PICKUP" ? <Check className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </span>
                    </div>
                    <p className={`mt-1 text-[11px] ${fulfillment === "PICKUP" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Retire diretamente na loja</p>
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <span className="text-xs font-black">02</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">Seus dados</p>
                  <h2 className="mt-0.5 text-base font-bold tracking-tight sm:text-lg">Onde podemos encontrar você?</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Usaremos estes dados apenas para identificar o pedido.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Nome *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Telefone *</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                </label>
              </div>
            </section>

            {fulfillment === "DELIVERY" && (
              <section className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                    <span className="text-xs font-black">03</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">Endereço</p>
                    <h2 className="mt-0.5 text-base font-bold tracking-tight sm:text-lg">Onde vamos entregar?</h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Rua *</span>
                    <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, avenida..." className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Número *</span>
                    <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Bairro *</span>
                    <input list="delivery-neighborhoods" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Seu bairro" className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                    {availableNeighborhoods.length > 0 && (
                      <datalist id="delivery-neighborhoods">
                        {availableNeighborhoods.map((item) => <option key={item} value={item} />)}
                      </datalist>
                    )}
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Complemento</span>
                    <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, casa..." className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Referência</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Próximo a..." className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                </label>
                {deliveryZones.length > 0 && (
                  <div className={`mt-3 rounded-xl px-3.5 py-2.5 text-[11px] ${selectedZone ? "bg-primary/8 text-foreground" : "bg-muted text-muted-foreground"}`}>
                    {selectedZone
                      ? <span><strong>Entrega:</strong> {formatCurrency(deliveryFee)} · aproximadamente {selectedZone.estimated_minutes ?? settings.estimated_delivery_minutes} min</span>
                      : availableNeighborhoods.length > 0 ? "Informe um bairro atendido para calcular a taxa." : "A loja ainda não cadastrou áreas de entrega."}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <span className="text-xs font-black">04</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">Pagamento</p>
                  <h2 className="mt-0.5 text-base font-bold tracking-tight sm:text-lg">Como você vai pagar?</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {availablePayments.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-2xl border p-3.5 text-left transition-all active:scale-[.99] ${paymentMethod === method ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.16)] ring-1 ring-primary" : "border-black/8 bg-[#faf9f7] hover:border-primary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{method === "PIX" ? "PIX" : method === "CASH" ? "Dinheiro" : method === "CARD_ON_DELIVERY" ? "Cartão na entrega" : "Cartão no local"}</span>
                      <span className={`grid size-6 place-items-center rounded-full ${paymentMethod === method ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
                        {paymentMethod === method ? <Check className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </span>
                    </div>
                    <p className={`mt-1 text-[10px] ${paymentMethod === method ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {method === "PIX" ? "Pagamento via PIX" : "Pagamento combinado com a loja"}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/8 bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">Opcional</p>
                  <label htmlFor="checkout-notes" className="mt-0.5 block text-base font-bold tracking-tight">Observações do pedido</label>
                </div>
                <span className="text-[9px] text-muted-foreground">{notes.length}/500</span>
              </div>
              <Textarea id="checkout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-3 min-h-20 resize-none rounded-xl border-black/10 bg-[#faf9f7]" placeholder="Ex.: tocar a campainha, tirar cebola..." maxLength={500} />
            </section>
          </main>

          <aside className="lg:sticky lg:top-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-foreground text-background shadow-[0_18px_45px_rgba(0,0,0,.14)] sm:rounded-[2rem]">
              <div className="border-b border-background/10 px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">Seu pedido</p>
                    <h2 className="mt-0.5 font-display text-xl tracking-tight">Resumo</h2>
                  </div>
                  <div className="grid size-9 place-items-center rounded-xl bg-background/8">
                    <ShoppingBag className="size-4" />
                  </div>
                </div>
              </div>

              <div className="max-h-[42vh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                {items.map((item) => (
                  <div key={item.lineId} className="rounded-xl border border-background/10 bg-background/[.04] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{item.quantity}× {item.productName}{item.secondProductName ? ` + ${item.secondProductName}` : ""}</p>
                        <p className="mt-1 text-[10px] text-background/55">{[item.sizeName, item.crustName].filter(Boolean).join(" · ")}</p>
                        {(item.complements ?? []).length > 0 && <p className="mt-1 text-[10px] text-primary">+ {(item.complements ?? []).map((complement) => complement.productName).join(", ")}</p>}
                      </div>
                      <span className="shrink-0 text-sm font-bold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-background/10 px-4 py-4 sm:px-5">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3 text-background/60"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {fulfillment === "DELIVERY" && (
                    <div className="flex justify-between gap-3 text-background/60"><span>Entrega</span><span>{selectedZone ? formatCurrency(deliveryFee) : "A calcular"}</span></div>
                  )}
                  <div className="my-3 border-t border-background/10" />
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[.16em] text-background/45">Total do pedido</p>
                      <p className="mt-0.5 font-display text-3xl tracking-tight">{formatCurrency(total)}</p>
                    </div>
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold text-primary-foreground">{items.reduce((sum, item) => sum + item.quantity, 0)} itens</span>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-xs leading-5 text-red-100">
                    {error}
                  </div>
                )}

                <Button
                  disabled={submitting || items.length === 0 || !storeOpen}
                  onClick={submitOrder}
                  className="mt-4 h-13 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.28)] transition hover:brightness-105"
                >
                  {!storeOpen ? "Loja fechada" : submitting ? "Enviando pedido..." : `Confirmar pedido · ${formatCurrency(total)}`}
                </Button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-background/45">
                  <Clock3 className="size-3" />
                  <span>{storeOpen ? storeStatusLabel : "A loja está fechada no momento."}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-black/10 bg-white/95 px-3 py-2.5 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Total</p>
              <p className="text-lg font-black leading-none">{formatCurrency(total)}</p>
            </div>
            <Button
              disabled={submitting || items.length === 0 || !storeOpen}
              onClick={submitOrder}
              className="h-11 shrink-0 rounded-full px-5 text-xs font-black shadow-[0_8px_20px_hsl(var(--primary)/.2)]"
            >
              {!storeOpen ? "Loja fechada" : submitting ? "Enviando..." : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

}

function StorefrontSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Skeleton className="h-[390px] rounded-[2rem]" />
          <div className="grid gap-3"><Skeleton className="h-28 rounded-3xl" /><Skeleton className="h-28 rounded-3xl" /></div>
        </div>
        <Skeleton className="mt-10 h-10 w-56 rounded-xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-80 rounded-3xl" />)}
        </div>
      </div>
    </main>
  );
}
