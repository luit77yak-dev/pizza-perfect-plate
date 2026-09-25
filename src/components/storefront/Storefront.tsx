import { useMemo, useState, type CSSProperties } from "react";
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
  DeliveryZone,
  FulfillmentType,
  PaymentMethod,
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
    deliveryZones: (deliveryZonesResult.data ?? []) as DeliveryZone[],
  };
}

function getPrice(product: Product, sizeId: string | null, prices: ProductPrice[]) {
  if (!sizeId) return Number(product.base_price) || 0;
  const row = prices.find((price) => price.product_id === product.id && price.size_id === sizeId);
  return row ? Number(row.price) : Number(product.base_price) || 0;
}

function getStoreStatus(hours: StoreHour[]) {
  const weekday = new Date().getDay();
  const today = hours.find((hour) => hour.weekday === weekday);
  if (!today || today.closed || !today.opens_at || !today.closes_at) {
    return { open: false, label: "Fechada hoje" };
  }

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = today.opens_at.slice(0, 5).split(":").map(Number);
  const [closeHour, closeMinute] = today.closes_at.slice(0, 5).split(":").map(Number);
  const open = minutes >= openHour * 60 + openMinute && minutes < closeHour * 60 + closeMinute;

  return {
    open,
    label: open ? `Aberta até ${today.closes_at.slice(0, 5)}` : `Abre às ${today.opens_at.slice(0, 5)}`,
  };
}

export function Storefront({ slug }: { slug?: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["public-store", slug ?? "demo"],
    queryFn: () => loadStore(slug),
    staleTime: 60_000,
  });
  const cart = useLocalCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    if (selectedCategory === "all") return data.products;
    return data.products.filter((product) => product.category_id === selectedCategory);
  }, [data, selectedCategory]);

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

  const status = getStoreStatus(data.hours);
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
      <header className="sticky top-0 z-40 border-b bg-background/90 shadow-[0_1px_0_rgba(0,0,0,.03)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#inicio" className="flex min-w-0 items-center gap-3">
            {data.settings.logo_url ? (
              <img src={data.settings.logo_url} alt="" className="size-10 rounded-xl object-cover" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground">
                {data.organization.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">{data.organization.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`size-1.5 rounded-full ${status.open ? "bg-success" : "bg-muted-foreground"}`} />
                {status.label}
              </div>
            </div>
          </a>
          <Button variant="outline" size="sm" className="gap-2 rounded-full px-3 sm:px-4" onClick={() => setCartOpen(true)}>
            <ShoppingBag className="size-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {itemCount > 0 && <Badge className="rounded-full px-2">{itemCount}</Badge>}
          </Button>
        </div>
      </header>

      <main id="inicio">
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 pt-4 sm:gap-6 sm:px-6 sm:pb-10 sm:pt-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-8">
          <div className="overflow-hidden rounded-[2rem] bg-secondary text-secondary-foreground shadow-lifted">
            <div className="relative min-h-[360px] p-6 sm:min-h-[390px] sm:p-10">
              {data.settings.hero_image_url && (
                <img
                  src={data.settings.hero_image_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-45"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/95 via-secondary/80 to-secondary/45" />
              <div className="relative flex min-h-[320px] max-w-xl flex-col justify-end sm:min-h-[330px]">
                <Badge className="mb-4 w-fit border-0 bg-primary/15 text-primary-foreground backdrop-blur">
                  Delivery artesanal
                </Badge>
                <h1 className="max-w-2xl text-[2.65rem] leading-[.96] sm:text-6xl">
                  {data.settings.hero_title || `O sabor que chega até você`}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-secondary-foreground/75 sm:text-base">
                  {data.settings.hero_subtitle || data.settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos."}
                </p>
                <a
                  href="#cardapio"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  {data.settings.hero_cta_label || "Ver cardápio"}
                  <ChevronRight className="size-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock3 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Hoje</p>
                  <p className="text-sm text-muted-foreground">{status.label}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Store className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Entrega e retirada</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {data.settings.delivery_enabled && data.settings.pickup_enabled
                      ? "Escolha como quer receber"
                      : data.settings.delivery_enabled
                        ? "Entrega disponível"
                        : "Retirada disponível"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cardapio" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Cardápio</p>
              <h2 className="mt-1 text-3xl sm:text-4xl">Escolha seu pedido</h2>
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">{data.products.length} opções</span>
          </div>

          <div className="scrollbar-none -mx-1 mb-7 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selectedCategory === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              Todos
            </button>
            {data.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selectedCategory === category.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              >
                {category.name}
                <span className="ml-1.5 opacity-60">{categoryProducts.get(category.id) ?? 0}</span>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
              <p className="font-medium">Nenhum produto nesta categoria.</p>
              <p className="mt-1 text-sm text-muted-foreground">Tente outra categoria.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const firstSize = data.sizes[0];
                const displayPrice = getPrice(product, firstSize?.id ?? null, data.prices);
                const categoryImage = data.categories.find((category) => category.id === product.category_id)?.image_url;
                const productImage = product.image_url || categoryImage;
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="group overflow-hidden rounded-[1.5rem] border bg-card text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted active:scale-[.99]"
                  >
                    <div className="relative aspect-[1.42] overflow-hidden bg-muted sm:aspect-[1.35]">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={product.name}
                          loading="lazy"
                          className="size-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-accent to-secondary/15">
                          <div className="absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
                          <div className="absolute -bottom-12 -left-8 size-36 rounded-full bg-secondary/15 blur-2xl" />
                          <div className="relative flex flex-col items-center gap-2 text-primary/55">
                            <div className="flex size-20 items-center justify-center rounded-full border border-primary/15 bg-background/55 shadow-sm backdrop-blur-sm">
                              <Pizza className="size-10" strokeWidth={1.5} />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[.18em]">Imagem em breve</span>
                          </div>
                        </div>
                      )}
                      {product.featured && (
                        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">
                          Destaque
                        </span>
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div>
                          <h3 className="text-[1.2rem] leading-tight sm:text-xl">{product.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                            {product.description || "Uma opção preparada para você."}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">{formatCurrency(displayPrice)}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm font-semibold">
                        <span>{product.allow_half ? "Aceita meio a meio" : "Personalize seu pedido"}</span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
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
          onSuccess={() => {
            cart.clear();
          }}
        />
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
    crustPrice: crust?.price,
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
  onCheckout,
}: {
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onUpdate: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
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
          <Button disabled={items.length === 0} className="mt-4 h-12 w-full rounded-full" onClick={onCheckout}>
            Continuar para checkout
          </Button>
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
}: {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: () => void;
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
  const [successNumber, setSuccessNumber] = useState<number | null>(null);

  const selectedZone =
    fulfillment === "DELIVERY"
      ? deliveryZones.find((zone) =>
          zone.neighborhoods.some(
            (item) => item.trim().toLowerCase() === neighborhood.trim().toLowerCase(),
          ),
        ) ?? null
      : null;
  const deliveryFee = selectedZone?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const availablePayments = settings.payment_methods.length
    ? settings.payment_methods
    : (["PIX"] as PaymentMethod[]);

  const submitOrder = async () => {
    setError(null);

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
        address_neighborhood: fulfillment === "DELIVERY" ? neighborhood.trim() : null,
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
      if (!order?.order_number) throw new Error("Não foi possível criar o pedido.");
      setSuccessNumber(Number(order.order_number));
      onSuccess();
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

  if (successNumber != null) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-[2rem] bg-background p-7 text-center shadow-lifted">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="size-8" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-primary">Pedido recebido</p>
          <h2 className="mt-1 text-3xl">Tudo certo! 🎉</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Seu pedido <strong>#{successNumber}</strong> foi enviado para {organization.name}.
          </p>
          <div className="mt-6 rounded-2xl bg-muted p-4 text-left text-sm">
            <p className="font-semibold">{fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}</p>
            <p className="mt-1 text-muted-foreground">
              {fulfillment === "DELIVERY"
                ? "A loja recebeu seu endereço e começará a preparar o pedido."
                : settings.pickup_instructions || "A loja avisará quando o pedido estiver pronto."}
            </p>
          </div>
          <Button className="mt-6 h-12 w-full rounded-full" onClick={onClose}>
            Voltar ao cardápio
          </Button>
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
                    <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Seu bairro" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
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
                      : "Digite um bairro atendido para calcular a taxa de entrega."}
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
            <Button disabled={submitting || items.length === 0} onClick={submitOrder} className="mt-5 h-12 w-full rounded-full">
              {submitting ? "Enviando pedido..." : `Enviar pedido · ${formatCurrency(total)}`}
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
