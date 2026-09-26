import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
    supabase.from("organization_settings").select("*").eq("organization_id", organization.id).maybeSingle(),
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
  if (!settingsResult.data) throw new Error("As configurações da loja ainda não foram cadastradas.");

  return {
    organization: organization as Organization,
    settings: settingsResult.data as OrganizationSettings,
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

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return data.products.filter((product) => {
      const matchesCategory = selectedCategory === "all" || product.category_id === selectedCategory;
      const categoryName = data.categories.find((category) => category.id === product.category_id)?.name ?? "";
      const haystack = [product.name, product.description, categoryName].join(" ").toLocaleLowerCase("pt-BR");
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [data, selectedCategory, searchTerm]);

  const categoryProducts = useMemo(() => {
    if (!data) return new Map<string, number>();
    return new Map(
      data.categories.map((category) => [
        category.id,
        data.products.filter((product) => product.category_id === category.id).length,
      ]),
    );
  }, [data]);

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
  const secondary = data.settings.secondary_color?.includes("%")
    ? `hsl(${data.settings.secondary_color})`
    : undefined;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          ...(primary ? { "--primary": primary } : {}),
          ...(secondary ? { "--secondary": secondary } : {}),
        } as CSSProperties
      }
    >
      <div className="overflow-hidden bg-secondary text-secondary-foreground" aria-hidden="true"><div className="ppp-ticker-run flex min-w-max items-center gap-8 py-2 font-display text-[11px] uppercase tracking-[.16em]">{[data.organization.name, "Pizza artesanal", status.label, "Delivery e retirada", "Peça online"].map((item, index) => <span key={index} className="inline-flex items-center gap-8">{item}<span className="text-primary">✦</span></span>)}{[data.organization.name, "Pizza artesanal", status.label, "Delivery e retirada", "Peça online"].map((item, index) => <span key={`repeat-${index}`} className="inline-flex items-center gap-8">{item}<span className="text-primary">✦</span></span>)}</div></div>

      <header className="sticky top-0 z-40 border-b-2 border-secondary bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#inicio" className="flex min-w-0 items-center gap-3">
            {data.settings.logo_url ? (
              <img src={data.settings.logo_url} alt="" className="size-10 rounded-sm border-2 border-secondary object-cover" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border-2 border-secondary bg-primary font-display text-lg font-semibold text-primary-foreground">
                {data.organization.name.charAt(0)}
              </div>
            )}
            <p className="truncate font-display text-xl font-semibold uppercase tracking-tight">{data.organization.name}</p>
          </a>
          <nav className="hidden items-center gap-6 text-xs font-bold uppercase tracking-[.14em] md:flex">
            <a href="#cardapio" className="transition-opacity hover:opacity-60">Cardápio</a>
            <a href="#sobre" className="transition-opacity hover:opacity-60">A casa</a>
            <a href="#contato" className="transition-opacity hover:opacity-60">Contato</a>
          </nav>
          <Button size="sm" className="gap-2 rounded-sm border-2 border-secondary px-4 font-display uppercase shadow-[3px_3px_0_rgba(0,0,0,.8)] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5" onClick={() => setCartOpen(true)}>
            <ShoppingBag className="size-4" />
            <span>Pedir agora</span>
            {itemCount > 0 && <Badge className="rounded-sm bg-background px-2 text-foreground">{itemCount}</Badge>}
          </Button>
        </div>
      </header>

      <main id="inicio">
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
          <div className="relative overflow-hidden rounded-sm border-2 border-secondary bg-background shadow-[8px_8px_0_rgba(0,0,0,.9)]">
            <div className="grid min-h-0 lg:min-h-[560px] lg:grid-cols-[1.05fr_.95fr]">
              <div className="relative z-10 flex min-w-0 flex-col justify-center p-7 sm:p-10 lg:p-14">
                <p className="mb-4 w-fit bg-secondary px-3 py-1 font-display text-xs uppercase tracking-[.18em] text-secondary-foreground">Pizza artesanal</p>
                <h1 className="w-full max-w-3xl text-[2.35rem] uppercase leading-[.9] tracking-normal sm:text-6xl sm:leading-[.86] lg:text-[clamp(3.6rem,8vw,7.4rem)] lg:leading-[.82]">{data.settings.hero_title && !/MASSA DE FERMENTA/i.test(data.settings.hero_title) ? data.settings.hero_title : "PIZZA DE VERDADE."}</h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{data.settings.hero_subtitle || data.settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos."}</p>
                <a href="#cardapio" className="mt-8 inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-6 py-4 font-display text-sm uppercase text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.85)] transition-transform hover:-translate-y-1">{data.settings.hero_cta_label || "Pedir agora"}<ChevronRight className="size-5" /></a>
              </div>
              <div className="relative min-h-[360px] overflow-hidden bg-secondary lg:min-h-full">
                {data.settings.hero_image_url ? <img src={data.settings.hero_image_url} alt="" className="absolute inset-5 size-[calc(100%-2.5rem)] rotate-[2.5deg] object-cover shadow-[10px_10px_0_rgba(0,0,0,.65)] sm:inset-8 sm:size-[calc(100%-4rem)]" /> : <div className="absolute inset-0 grid place-items-center text-secondary-foreground/50"><Pizza className="size-28" strokeWidth={1} /></div>}
                <div className="absolute bottom-6 left-5 z-10 flex size-28 rotate-[-8deg] items-center justify-center rounded-full border-2 border-secondary bg-primary p-4 text-center font-display text-[10px] uppercase leading-3 text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.7)] sm:left-8">{data.organization.name}<br />feito na hora<br />pizza artesanal</div>
              </div>
            </div>
          </div>
        </section>

        <div className="ppp-product-ticker mb-12 overflow-hidden border-y-2 border-secondary bg-secondary text-secondary-foreground" aria-hidden="true">
          <div className="ppp-ticker-run flex min-w-max items-center gap-8 py-4 font-display text-sm uppercase tracking-[.08em]">
            {data.products.slice(0, 8).map((product) => <span key={product.id} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
            {data.products.slice(0, 8).map((product) => <span key={`ticker-${product.id}`} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
          </div>
        </div>

        <section id="cardapio" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Cardápio</p>
              <h2 className="mt-1 text-4xl uppercase leading-[.9] sm:text-6xl">Escolha seu pedido</h2>
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">{data.products.length} opções</span>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-sm border-2 border-secondary px-4 py-2 text-sm font-semibold uppercase transition-colors ${selectedCategory === "all" ? "bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]" : "bg-card hover:-translate-y-0.5"}`}
            >
              Todos
            </button>
            {data.categories.map((category) => (
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
        <section id="sobre" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="overflow-hidden rounded-[.75rem] border-2 border-secondary bg-secondary text-secondary-foreground shadow-lifted"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="p-7 sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">A casa</p><h2 className="mt-3 text-4xl uppercase leading-[.9] sm:text-6xl">Feita para quem ama pizza.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-secondary-foreground/75 sm:text-base">{data.settings.description || "Massa, molho, queijo e ingredientes escolhidos para transformar um pedido comum em uma experiência que dá vontade de repetir."}</p><a href="#cardapio" className="mt-7 inline-flex rounded-sm bg-primary px-5 py-3 font-display uppercase text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.5)]">Ver o cardápio</a></div><div className="grid grid-cols-2 gap-3 bg-primary p-3 sm:p-5">{[data.settings.hero_image_url, ...data.categories.slice(0, 3).map((category) => category.image_url)].filter(Boolean).slice(0, 3).map((image, index) => <div key={`about-${index}`} className={`overflow-hidden rounded-sm border-2 border-secondary shadow-[5px_5px_0_rgba(0,0,0,.6)] ${index === 0 ? "col-span-2 aspect-[2/1] rotate-[-1.5deg]" : "aspect-square rotate-[1.5deg]"}`}><img src={image!} alt="" className="size-full object-cover" loading="lazy" /></div>)}</div></div></div></section>

        <section id="contato" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6"><div className="rounded-[.75rem] border-2 border-secondary bg-primary p-7 text-primary-foreground shadow-lifted sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] opacity-75">Contato</p><h2 className="mt-2 text-[clamp(4.5rem,15vw,10rem)] uppercase leading-[.75]">Bora pedir?</h2><div className="mt-10 grid gap-3 sm:grid-cols-3"><a href="#cardapio" className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)] transition-transform hover:-translate-y-1"><span className="block text-xs uppercase tracking-widest opacity-60">Cardápio</span><span className="mt-1 block font-semibold">Escolher agora</span></a><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">Atendimento</span><span className="mt-1 block font-semibold">{data.settings.delivery_enabled && data.settings.pickup_enabled ? "Delivery e retirada" : data.settings.delivery_enabled ? "Delivery" : "Retirada"}</span></div><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">WhatsApp</span><span className="mt-1 block font-semibold">{data.settings.whatsapp_phone || "Consulte a loja"}</span></div></div></div></section>

      </main>

      {selectedProduct && (
        <ProductConfigurator
          product={selectedProduct}
          data={data}
          onClose={() => setSelectedProduct(null)}
          onAdded={(item) => {
            cart.addItem(item);
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
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[calc(100%-2rem)] max-w-md">
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
  onAdded: (item: CartItem) => void;
}) {
  const [sizeId, setSizeId] = useState<string | null>(data.sizes[0]?.id ?? null);
  const [secondProductId, setSecondProductId] = useState<string | null>(null);
  const [crustId, setCrustId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const secondProduct = data.products.find((item) => item.id === secondProductId) ?? null;
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
  const unitPrice = calculateProductUnitPrice({
    basePrice,
    secondBasePrice,
    isHalf: Boolean(secondProductId),
    halfRule: data.settings.half_pizza_pricing_rule,
    halfFixedPrice: data.settings.half_pizza_fixed_price,
    crustPrice: crust?.price ?? 0,
    addonPrices: addons.map((item) => item.price),
  });

  const toggleAddon = (id: string) => {
    setAddonIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const addToCart = () => {
    const item: CartItem = {
      lineId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      secondProductId: secondProduct?.id ?? null,
      secondProductName: secondProduct?.name ?? null,
      isHalf: Boolean(secondProduct),
      sizeId,
      sizeName: selectedSize?.name ?? null,
      crustId,
      crustName: crust?.name ?? null,
      crustPrice: Number(crust?.price ?? 0),
      addons: addons.map((addon) => ({ id: addon.id, name: addon.name, price: Number(addon.price) })),
      quantity,
      notes: notes.trim() || null,
      unitPrice,
    };
    onAdded(item);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Configurar ${product.name}`}>
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-background shadow-lifted sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Personalizar</p>
            <h2 className="text-2xl">{product.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-5 py-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">Tamanho</p>
              <div className="grid gap-2">
                {data.sizes.map((size) => {
                  const price = getPrice(product, size.id, data.prices);
                  return (
                    <button
                      key={size.id}
                      onClick={() => setSizeId(size.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${sizeId === size.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{size.name}</span>
                        {size.slices ? <span className="text-xs text-muted-foreground">{size.slices} fatias</span> : null}
                      </span>
                      <span className="text-sm font-semibold">{formatCurrency(price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {product.allow_half && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Meio a meio</p>
                  {secondProduct && <button onClick={() => setSecondProductId(null)} className="text-xs text-primary">Remover</button>}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {data.products
                    .filter((item) => item.kind === "PIZZA" && item.id !== product.id)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSecondProductId(item.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${secondProductId === item.id ? "border-primary bg-primary/5" : "bg-card"}`}
                      >
                        <span>{item.name}</span>
                        {secondProductId === item.id ? <Check className="size-4 text-primary" /> : null}
                      </button>
                    ))}
                </div>
                {secondProduct && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Regra de preço: {data.settings.half_pizza_pricing_rule === "highest_half" ? "maior metade" : data.settings.half_pizza_pricing_rule === "average_halves" ? "média das metades" : "preço fixo"}.
                  </p>
                )}
              </div>
            )}
          </div>

          {data.crusts.length > 0 && (
            <div className="mt-7">
              <p className="mb-2 text-sm font-semibold">Borda</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.crusts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCrustId(crustId === item.id ? null : item.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${crustId === item.id ? "border-primary bg-primary/5" : "bg-card"}`}
                  >
                    <span>{item.name}</span>
                    <span className="font-semibold">{Number(item.price) > 0 ? `+${formatCurrency(Number(item.price))}` : "Grátis"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableAddons.length > 0 && (
            <div className="mt-7">
              <p className="mb-2 text-sm font-semibold">Adicionais</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableAddons.map((item) => {
                  const checked = addonIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleAddon(item.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${checked ? "border-primary bg-primary/5" : "bg-card"}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`flex size-5 items-center justify-center rounded-md border ${checked ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                          {checked ? <Check className="size-3.5" /> : null}
                        </span>
                        {item.name}
                      </span>
                      <span className="font-semibold">+{formatCurrency(Number(item.price))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-7">
            <label htmlFor="product-notes" className="mb-2 block text-sm font-semibold">Observações</label>
            <Textarea id="product-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Alguma observação para este item?" maxLength={300} />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t bg-card px-5 py-4">
          <div className="flex items-center rounded-full border bg-background">
            <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="p-3" aria-label="Diminuir quantidade"><Minus className="size-4" /></button>
            <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
            <button onClick={() => setQuantity((value) => Math.min(99, value + 1))} className="p-3" aria-label="Aumentar quantidade"><Plus className="size-4" /></button>
          </div>
          <Button className="h-12 flex-1 rounded-full" onClick={addToCart}>
            Adicionar · {formatCurrency(unitPrice * quantity)}
          </Button>
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
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Carrinho">
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
                            {[item.sizeName, item.crustName, item.addons.length ? `${item.addons.length} adicional(is)` : null].filter(Boolean).join(" · ")}
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
          <Button disabled={items.length === 0 || !storeOpen} className="mt-4 h-12 w-full rounded-full" onClick={onCheckout}>
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
    if (subtotal < Number(settings.min_order_amount ?? 0)) {
      setError(
        `O pedido mínimo é ${formatCurrency(Number(settings.min_order_amount))}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organization_id: organization.id,
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
        subtotal,
        idempotency_key: crypto.randomUUID(),
        items: items.map((item) => ({
          product_id: item.productId,
          product_name: item.productName,
          second_product_id: item.secondProductId,
          second_product_name: item.secondProductName,
          is_half: item.isHalf,
          size_id: item.sizeId,
          size_name: item.sizeName,
          crust_id: item.crustId,
          crust_name: item.crustName,
          crust_price: item.crustPrice,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          notes: item.notes,
          addons: item.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            price: addon.price,
          })),
        })),
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar o pedido.",
      );
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
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
        <section className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
          <div className="rounded-[2rem] border bg-card p-6 shadow-lifted sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Check className="size-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Pedido recebido</p>
                <h2 className="mt-1 text-3xl">Pedido #{successNumber}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{organization.name}</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold">Acompanhe seu pedido</p>
              <div className="mt-4 space-y-3">
                {[
                  ["RECEIVED", "Pedido recebido"],
                  ["CONFIRMED", "Pedido confirmado"],
                  ["PREPARING", "Em preparo"],
                  ["READY", fulfillment === "DELIVERY" ? "Pedido pronto" : "Pronto para retirada"],
                  ["OUT_FOR_DELIVERY", "Saiu para entrega"],
                  ["DELIVERED", fulfillment === "DELIVERY" ? "Entregue" : "Retirado"],
                ].map(([value, label], index, steps) => {
                  const currentIndex = steps.findIndex(([step]) => step === successStatus);
                  const isDone = currentIndex >= 0 && index <= currentIndex;
                  const isCurrent = value === successStatus;
                  if (fulfillment === "PICKUP" && value === "OUT_FOR_DELIVERY") return null;
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${isDone ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                        {isDone ? <Check className="size-4" /> : index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : ""}`}>{label}</p>
                        {isCurrent && <p className="text-xs text-muted-foreground">Status atualizado automaticamente.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-muted p-4 text-sm">
              <p className="font-semibold">
                {successStatus === "CANCELLED" ? "Pedido cancelado" :
                  successStatus === "DELIVERED" ? "Pedido finalizado" :
                  successStatus === "READY" && fulfillment === "PICKUP" ? "Pode retirar seu pedido" :
                  successStatus === "OUT_FOR_DELIVERY" ? "Seu pedido está a caminho!" :
                  "A loja está preparando seu pedido."}
              </p>
              <p className="mt-1 text-muted-foreground">
                {trackingError ?? "Esta tela verifica automaticamente se a loja atualizou o pedido."}
              </p>
            </div>

            <Button className="mt-6 h-12 w-full rounded-full" onClick={onClose}>
              Voltar ao cardápio
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto min-h-screen max-w-3xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Finalizar pedido</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">Quase lá</h1>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Fechar checkout">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Como você quer receber?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {settings.delivery_enabled && (
                  <button
                    onClick={() => setFulfillment("DELIVERY")}
                    className={`rounded-2xl border p-4 text-left transition-colors ${fulfillment === "DELIVERY" ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">Entrega</p>
                    <p className="mt-1 text-xs text-muted-foreground">Receba no seu endereço</p>
                  </button>
                )}
                {settings.pickup_enabled && (
                  <button
                    onClick={() => setFulfillment("PICKUP")}
                    className={`rounded-2xl border p-4 text-left transition-colors ${fulfillment === "PICKUP" ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">Retirada</p>
                    <p className="mt-1 text-xs text-muted-foreground">Retire na loja</p>
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Seus dados</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Telefone *</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
              </div>
            </section>

            {fulfillment === "DELIVERY" && (
              <section className="rounded-3xl border bg-card p-5 shadow-soft">
                <p className="text-sm font-semibold">Endereço de entrega</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Rua *</span>
                    <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, avenida..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Número *</span>
                    <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Bairro *</span>
                    <input
                      list="delivery-neighborhoods"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Seu bairro"
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                    {availableNeighborhoods.length > 0 && (
                      <datalist id="delivery-neighborhoods">
                        {availableNeighborhoods.map((item) => <option key={item} value={item} />)}
                      </datalist>
                    )}
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Complemento</span>
                    <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, casa..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Ponto de referência</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Próximo a..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
                {deliveryZones.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedZone
                      ? `Taxa de entrega: ${formatCurrency(deliveryFee)} · ${selectedZone.estimated_minutes ?? settings.estimated_delivery_minutes} min`
                      : availableNeighborhoods.length > 0 ? "Selecione ou digite um dos bairros atendidos para calcular a taxa." : "A loja ainda não cadastrou áreas de entrega."}
                  </p>
                )}
              </section>
            )}

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Pagamento</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {availablePayments.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-2xl border p-4 text-left ${paymentMethod === method ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">
                      {method === "PIX" ? "PIX" : method === "CASH" ? "Dinheiro" : method === "CARD_ON_DELIVERY" ? "Cartão na entrega" : "Cartão no local"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {method === "PIX" ? "Pagamento via PIX" : "Pagamento combinado com a loja"}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <label htmlFor="checkout-notes" className="text-sm font-semibold">Observações do pedido</label>
              <Textarea id="checkout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-3" placeholder="Ex.: tocar a campainha, tirar cebola..." maxLength={500} />
            </section>
          </div>

          <aside className="h-fit rounded-3xl border bg-card p-5 shadow-soft lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Resumo</p>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.quantity}× {item.productName}{item.secondProductName ? ` + ${item.secondProductName}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{[item.sizeName, item.crustName].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {fulfillment === "DELIVERY" && (
                <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>{selectedZone ? formatCurrency(deliveryFee) : "—"}</span></div>
              )}
              <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
            {error && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button disabled={submitting || items.length === 0 || !storeOpen} onClick={submitOrder} className="mt-5 h-12 w-full rounded-full">
              {!storeOpen ? "Loja fechada" : submitting ? "Enviando pedido..." : `Enviar pedido · ${formatCurrency(total)}`}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              Ao enviar, o pedido será encaminhado diretamente para a loja.
            </p>
          </aside>
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
