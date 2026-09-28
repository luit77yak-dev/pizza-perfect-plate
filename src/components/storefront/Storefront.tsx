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
import { loadStore, type StoreData } from "@/features/storefront/services/load-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StorefrontSkeleton } from "@/components/storefront/StorefrontSkeleton";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { StorefrontTicker } from "@/components/storefront/StorefrontTicker";
import { ProductTicker } from "@/components/storefront/ProductTicker";
import { MenuImageAccordion } from "@/components/storefront/MenuImageAccordion";
import { MenuFilters } from "@/components/storefront/MenuFilters";
import { StorefrontAbout } from "@/components/storefront/StorefrontAbout";
import { StorefrontContact } from "@/components/storefront/StorefrontContact";
import { useLocalCart } from "@/features/cart/hooks/use-local-cart";
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

import { getPrice, getStoreStatus, normalizeNeighborhood } from "@/features/storefront/domain/storefront-utils";
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
        .replace(/[\u0300-\u036f]/g, "")
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
      <StorefrontTicker organizationName={data.organization.name} statusLabel={status.label} />

      <StorefrontHeader
        organizationName={data.organization.name}
        logoUrl={data.settings.logo_url ?? null}
        itemCount={itemCount}
        selectedTrackedOrdersCount={trackedOrder ? 1 : 0}
        onOpenCart={() => setCartOpen(true)}
      />

      <main id="inicio" className="ppp-reference-storefront">
        <StorefrontHero organizationName={data.organization.name} settings={data.settings} products={mainProducts} />

        <ProductTicker products={mainProducts} />

        <section id="cardapio" className="ppp-reference-menu mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
          <div className="ppp-reference-menu-heading mb-8 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[.35em] text-primary">Cardápio</p>
            <h2 className="mt-1 max-w-3xl text-4xl leading-[.95] sm:text-6xl">Escolha sua <em>pizza.</em></h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Escolha uma categoria e encontre seu próximo sabor.</p>
          </div>

          <MenuImageAccordion categories={data.categories} products={mainProducts} />

          <MenuFilters
            categories={data.categories}
            mainProducts={mainProducts}
            categoryProducts={categoryProducts}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />

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
        <StorefrontAbout settings={data.settings} categories={data.categories} />

        <StorefrontContact settings={data.settings} />

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

  const secondProduct = data.products.find((item) => item.id === secondProductId) ?? null;
  const comboProducts = data.products.filter((item) => {
    const categoryName = data.categories.find((category) => category.id === item.category_id)?.name ?? "";
    const normalizedCategory = categoryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
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
    <div className="ppp-order-builder fixed inset-0 z-50 flex items-end justify-center bg-foreground/55 p-0 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={"Montar " + product.name}>
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {step === 1 && (
            <section className="space-y-6">
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Produto principal</p>
                <p className="mt-1 text-lg font-semibold">{product.name}</p>
                {product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">01 · Escolha o tamanho</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">Qual vai ser o tamanho?</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Toque para escolher</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
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
            <section className="space-y-7">
              {data.crusts.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Borda</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.crusts.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setCrustId(crustId === item.id ? null : item.id)}
                        className={"flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm " + (crustId === item.id ? "border-primary bg-primary/5" : "bg-card")}
                      >
                        <span>{item.name}</span>
                        <span className="font-semibold">{Number(item.price) > 0 ? "+" + formatCurrency(Number(item.price)) : "Grátis"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableAddons.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Adicionais</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableAddons.map((item) => {
                      const checked = addonIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleAddon(item.id)}
                          className={"flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm " + (checked ? "border-primary bg-primary/5" : "bg-card")}
                        >
                          <span className="flex items-center gap-2">
                            <span className={"flex size-5 items-center justify-center rounded-md border " + (checked ? "border-primary bg-primary text-primary-foreground" : "")}>
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

              <div>
                <label htmlFor="product-notes" className="mb-2 block text-sm font-semibold">Observações</label>
                <Textarea id="product-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Alguma observação para este item?" maxLength={300} />
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
    <div className="ppp-cart-panel fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Carrinho">
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
    return (
      <div className="ppp-checkout-panel fixed inset-0 z-[60] overflow-y-auto bg-background">
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
                    {(item.complements ?? []).length > 0 && <p className="mt-1 text-xs text-primary">+ {(item.complements ?? []).map((complement) => complement.productName).join(", ")}</p>}
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
