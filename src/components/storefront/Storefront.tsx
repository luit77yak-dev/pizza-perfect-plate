import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getPublicOrderStatus } from "@/core/delivery/services/order-tracking";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ShoppingBag, Store, X } from "lucide-react";
import { loadStore } from "@/core/delivery/services/load-public-store";
import { Button } from "@/components/ui/button";
import { StorefrontSkeleton } from "@/components/storefront/StorefrontSkeleton";
import { StorefrontHeader } from "@/features/storefront/components/StorefrontHeader";
import { StorefrontHero } from "@/features/storefront/components/StorefrontHero";
import { StorefrontTicker } from "@/components/storefront/StorefrontTicker";
import { ProductTicker } from "@/components/storefront/ProductTicker";
import { MenuImageAccordion } from "@/components/storefront/MenuImageAccordion";
import { StorefrontMenu } from "@/features/storefront/components/StorefrontMenu";
import { StorefrontAbout } from "@/features/storefront/components/StorefrontAbout";
import { StorefrontFooter } from "@/features/storefront/components/StorefrontFooter";
import { ProductConfigurator } from "@/features/storefront/components/ProductConfigurator";
import { CartPanel } from "@/features/cart/components/CartPanel";
import { CheckoutPanel } from "@/features/storefront/components/CheckoutPanel";
import { TrackedOrderPanel } from "@/components/storefront/TrackedOrderPanel";
import { useLocalCart } from "@/features/cart/hooks/use-local-cart";
import { calculateCartSubtotal } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, OrderStatus, Product } from "@/lib/domain/types";

import { getPrice, getStoreStatus } from "@/core/delivery/services/store-rules";
import { resolveStorefrontTheme } from "@/features/storefront/themes/resolve";
export type TrackedOrder = {
  id: string;
  number: number;
  phone: string;
  items?: CartItem[] | undefined;
  subtotal?: number | undefined;
  total?: number | undefined;
  fulfillment?: "DELIVERY" | "PICKUP" | undefined;
  status?: OrderStatus | undefined;
};

export function Storefront() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["public-store", mounted ? window.location.hostname.toLowerCase() : "server"],
    queryFn: () => loadStore(),
    enabled: mounted,
    staleTime: 60_000,
  });
  const cart = useLocalCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addingToExistingOrder, setAddingToExistingOrder] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([]);
  const [selectedTrackedOrderId, setSelectedTrackedOrderId] = useState<string | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [complementPickerOpen, setComplementPickerOpen] = useState(false);
  const [selectedComplementIds, setSelectedComplementIds] = useState<string[]>([]);
  const [quickAddQuantities, setQuickAddQuantities] = useState<Record<string, number>>({});
  const [complementItems, setComplementItems] = useState<CartItem[]>([]);
  const [complementOrderId, setComplementOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!data?.organization?.id) return;
    let cancelled = false;

    const loadTrackedOrders = async () => {
      try {
        const raw = localStorage.getItem(`ppp:tracked-orders:${data.organization.id}`) ?? localStorage.getItem(`ppp:last-order:${data.organization.id}`);
        if (!raw) {
          if (!cancelled) {
            setTrackedOrders([]);
            setSelectedTrackedOrderId(null);
          }
          return;
        }

        const parsed = JSON.parse(raw);
        const storedOrders = (Array.isArray(parsed) ? parsed : [parsed]).filter(
          (item): item is TrackedOrder =>
            Boolean(item?.id && item?.phone),
        );

        if (storedOrders.length === 0) {
          if (!cancelled) {
            setTrackedOrders([]);
            setSelectedTrackedOrderId(null);
          }
          return;
        }

        // Local snapshots are the source of truth for showing the order immediately.
        // The RPC only enriches/updates the snapshot; a temporary RPC/schema-cache
        // failure must never make the tracking UI disappear.
        const storedActiveOrders: TrackedOrder[] = storedOrders
          .map((stored) => ({
            ...stored,
            status: stored.status ?? "RECEIVED",
          }))
          .filter(
            (stored) =>
              stored.status !== "DELIVERED" &&
              stored.status !== "CANCELLED",
          );

        if (!cancelled) {
          setTrackedOrders(storedActiveOrders);
          setSelectedTrackedOrderId((current) =>
            current && storedActiveOrders.some((order) => order.id === current)
              ? current
              : storedActiveOrders[0]?.id ?? null,
          );
        }

        const results = await Promise.all(
          storedActiveOrders.map(async (stored) => {
            const tracking = await getPublicOrderStatus(stored.id, stored.phone);
            const current = (Array.isArray(tracking) ? tracking[0] : tracking) as ({ order_number?: unknown; items?: unknown; subtotal?: unknown; total?: unknown; fulfillment?: "DELIVERY" | "PICKUP"; status?: string }) | null | undefined;
            return {
              stored,
              current,
              status: current?.status as OrderStatus | undefined,
            };
          }),
        );

        if (cancelled) return;

        const activeOrders: TrackedOrder[] = results
          .map(({ stored, current, status }) => ({
            ...stored,
            number:
              Number.isFinite(Number(current?.order_number)) &&
              Number(current?.order_number) > 0
                ? Number(current?.order_number)
                : stored.number,
            items: Array.isArray(current?.items)
              ? (current.items as unknown as CartItem[])
              : stored.items,
            subtotal: Number.isFinite(Number(current?.subtotal))
              ? Number(current?.subtotal)
              : stored.subtotal,
            total: Number.isFinite(Number(current?.total))
              ? Number(current?.total)
              : stored.total,
            fulfillment: current?.fulfillment ?? stored.fulfillment,
            status: status ?? stored.status ?? "RECEIVED",
          }))
          .filter(
            (order) =>
              order.status !== "DELIVERED" &&
              order.status !== "CANCELLED",
          );

        setTrackedOrders(activeOrders);
        setSelectedTrackedOrderId((current) =>
          current && activeOrders.some((order) => order.id === current)
            ? current
            : activeOrders[0]?.id ?? null,
        );

        if (activeOrders.length > 0) {
          localStorage.setItem(
            `ppp:tracked-orders:${data.organization.id}`,
            JSON.stringify(activeOrders),
          );
        } else {
          localStorage.removeItem(`ppp:tracked-orders:${data.organization.id}`);
          localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
        }
      } catch {
        if (!cancelled) {
          setTrackedOrders([]);
          setSelectedTrackedOrderId(null);
        }
      }
    };

    void loadTrackedOrders();
    const interval = window.setInterval(() => {
      void loadTrackedOrders();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [data?.organization?.id]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const complementProducts = useMemo(() => {
    if (!data) return [];
    return data.products.filter((product) => {
      const categoryName =
        data.categories.find((category) => category.id === product.category_id)?.name ?? "";
      const normalizedCategory = categoryName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      return (
        product.kind === "SIMPLE" ||
        /(bebida|bebidas|doce|doces|sobremesa|sobremesas|acompanhamento|acompanhamentos)/i.test(
          normalizedCategory,
        )
      );
    });
  }, [data]);

  const mainProducts = useMemo(() => {
    if (!data) return [];
    const complementIds = new Set(complementProducts.map((product) => product.id));
    const pizzas = data.products.filter(
      (product) => product.kind === "PIZZA" && !complementIds.has(product.id),
    );
    return pizzas.length > 0
      ? pizzas
      : data.products.filter((product) => !complementIds.has(product.id));
  }, [data, complementProducts]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return mainProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.category_id === selectedCategory;
      const categoryName =
        data.categories.find((category) => category.id === product.category_id)?.name ?? "";
      const haystack = [product.name, product.description, categoryName]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [data, mainProducts, selectedCategory, searchTerm]);

  const storefrontTheme = data?.visualConfig.theme ?? resolveStorefrontTheme(data?.settings?.storefront_theme);
  const isBurgerTheme = storefrontTheme.id === "burger-club";
  const isPizzaTheme = storefrontTheme.id === "neroxa-classic";
  const themeTokens = storefrontTheme.tokens;

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
  const complementSubtotal = calculateCartSubtotal(complementItems);
  const activeComplementOrderId =
    complementOrderId && complementItems.length > 0 ? complementOrderId : null;
  const complementOrder = complementOrderId
    ? trackedOrders.find((order) => order.id === complementOrderId) ?? null
    : null;

  const clearComplementFlow = () => {
    setComplementPickerOpen(false);
    setSelectedComplementIds([]);
    setQuickAddQuantities({});
    setComplementItems([]);
    setComplementOrderId(null);
    setAddingToExistingOrder(false);
  };

  const updateComplementQuantity = (lineId: string, quantity: number) => {
    setComplementItems((current) =>
      current
        .map((item) =>
          item.lineId === lineId
            ? { ...item, quantity: Math.max(0, quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const addQuickSimpleProduct = (product: Product) => {
    const quantity = Math.max(1, quickAddQuantities[product.id] ?? 1);

    setComplementItems((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.productId === product.id &&
          !item.secondProductId &&
          !item.isHalf &&
          !item.sizeId &&
          !item.crustId &&
          item.addons.length === 0 &&
          item.complements.length === 0,
      );

      if (existingIndex < 0) {
        return [
          ...current,
          {
            lineId: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            imageUrl: product.image_url,
            secondProductId: null,
            secondProductName: null,
            isHalf: false,
            sizeId: null,
            sizeName: null,
            crustId: null,
            crustName: null,
            crustPrice: 0,
            addons: [],
            complements: [],
            quantity,
            notes: null,
            unitPrice: Number(product.base_price) || 0,
          },
        ];
      }

      return current.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + quantity }
          : item,
      );
    });

    setQuickAddQuantities((current) => ({ ...current, [product.id]: 1 }));
  };

  const addSimpleProductToCart = (product: Product) => {
    cart.addItem({
      lineId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      secondProductId: null,
      secondProductName: null,
      isHalf: false,
      sizeId: null,
      sizeName: null,
      crustId: null,
      crustName: null,
      crustPrice: 0,
      addons: [],
      complements: [],
      quantity: 1,
      notes: null,
      unitPrice: Number(product.base_price) || 0,
    });
    setCartOpen(true);
  };

  const scrollToAddOrderCatalog = () => {
    document
      .getElementById("ppp-add-order-catalog")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!mounted || isLoading) return <StorefrontSkeleton />;
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
  const secondary = themeTokens.secondaryColor ? `hsl(${themeTokens.secondaryColor})` : "hsl(42 35% 96%)";
  const secondaryForeground = "hsl(42 35% 96%)";

  return (
    <div
      className={`ppp-customer-shell min-h-screen bg-background text-foreground ${isPizzaTheme ? "ppp-pizza-theme" : isBurgerTheme ? "ppp-burger-theme" : ""}`}
      style={
        {
          ...(primary ? { "--primary": primary } : {}),
          ...(themeTokens.primaryColor ? { "--primary": `hsl(${themeTokens.primaryColor})` } : {}),
          "--secondary": themeTokens.secondaryColor ? `hsl(${themeTokens.secondaryColor})` : secondary,
          "--secondary-foreground": secondaryForeground,
          ...(themeTokens.fontFamily ? { "--font-family": themeTokens.fontFamily } : {}),
        } as CSSProperties
      }
    >
      {!isPizzaTheme && !isBurgerTheme && <StorefrontTicker organizationName={data.organization.name} statusLabel={status.label} />}

      {isBurgerTheme && (
        <style>{` .ppp-customer-shell.ppp-burger-theme { background:#090807 !important; color:#f7efe6 !important; } .ppp-customer-shell.ppp-burger-theme .ppp-reference-header { background:linear-gradient(180deg,rgba(9,8,7,.96),rgba(9,8,7,.28) 72%,transparent) !important; } .ppp-customer-shell.ppp-burger-theme .hc-hero { background:#090807 !important; } .ppp-customer-shell.ppp-burger-theme #cardapio,.ppp-customer-shell.ppp-burger-theme #sobre,.ppp-customer-shell.ppp-burger-theme #contato { background:#090807 !important; } .ppp-customer-shell.ppp-burger-theme .hc-footer { background:#050403 !important; }`}</style>
      )}

      <div className={isBurgerTheme ? "burger-club-page" : ""}>
      <StorefrontHeader
        organizationName={data.organization.name}
        logoUrl={data.visualConfig.overrides?.content?.logoUrl ?? data.settings.logo_url ?? null}
        itemCount={itemCount}
        selectedTrackedOrdersCount={trackedOrders.length}
        theme={storefrontTheme}
        onOpenCart={() => setCartOpen(true)}
        onOpenTracking={() => {
          setSelectedTrackedOrderId((current) => current ?? trackedOrders[0]?.id ?? null);
          setTrackingOpen(true);
        }}
      />

      <main id="inicio" className="ppp-reference-storefront">
        <StorefrontHero
          organizationName={data.organization.name}
          settings={data.settings}
          products={mainProducts}
          theme={storefrontTheme}
          statusLabel={status.label}
          content={data.visualConfig.overrides?.content}
        />

        {!isPizzaTheme && !isBurgerTheme && <ProductTicker products={mainProducts} />}

                <StorefrontMenu
          theme={storefrontTheme}
          categories={data.categories}
          products={filteredProducts}
          sizes={data.sizes}
          prices={data.prices}
          categoryProducts={categoryProducts}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSelectProduct={setSelectedProduct}
          onAddSimpleProduct={addSimpleProductToCart}
          imageFallbacks={{}}
        />

        <StorefrontAbout theme={storefrontTheme} settings={data.settings} categories={data.categories} organizationName={data.organization.name} content={data.visualConfig.overrides?.content} />

        <StorefrontFooter theme={storefrontTheme} settings={data.settings} organizationName={data.organization.name} content={data.visualConfig.overrides?.content} />
      </main>
      </div>

      {selectedProduct && (
        <ProductConfigurator
          product={selectedProduct}
          data={data}
          onClose={() => {
            setSelectedProduct(null);
            if (addingToExistingOrder && complementOrderId) {
              setAddingToExistingOrder(false);
              setComplementPickerOpen(true);
            }
          }}
          onAdded={(items) => {
            if (addingToExistingOrder && complementOrderId) {
              setComplementItems((current) => [...current, ...items]);
              setSelectedProduct(null);
              setAddingToExistingOrder(false);
              setComplementPickerOpen(true);
              return;
            }

            setComplementPickerOpen(false);
            setSelectedComplementIds([]);
            setQuickAddQuantities({});
            setComplementItems([]);
            setComplementOrderId(null);
            setAddingToExistingOrder(false);
            items.forEach((item) => cart.addItem(item));
            setSelectedProduct(null);
            setCartOpen(true);
          }}
        />
      )}

      {complementPickerOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Adicionar itens ao pedido"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={clearComplementFlow}
            aria-label="Fechar adição ao pedido"
          />
          <section className="ppp-complement-picker relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-[#06282d] text-[#f4eee2] shadow-2xl sm:rounded-[2rem]">
            <header className="shrink-0 border-b border-white/10 bg-[#06282d] px-5 py-4 text-[#f4eee2] sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#f3ad4b]">Pedido em andamento</p>
                  <h2 className="mt-1 font-display text-2xl text-[#f4eee2]">
                    Adicionar ao pedido #{complementOrder?.number ?? "sem número"}
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    Escolha pizzas, bebidas ou outros itens. Você pode acrescentar quantos quiser.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearComplementFlow}
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.06] text-white transition hover:bg-white/10"
                  aria-label="Fechar"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {complementItems.length > 0 && (
                <section className="mb-5 rounded-2xl border border-[#f3ad4b]/25 bg-[#f3ad4b]/[.07] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#f3ad4b]">Acréscimos selecionados</p>
                      <p className="mt-1 text-sm font-bold text-[#f4eee2]">
                        {complementItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                        {complementItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <span className="font-display text-xl text-[#f4eee2]">{formatCurrency(complementSubtotal)}</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {complementItems.map((item) => (
                      <div key={item.lineId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a3035] p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[#f4eee2]">
                            {item.productName}{item.secondProductName ? " + " + item.secondProductName : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/45">
                            {item.sizeName ?? "Item simples"}{item.crustName ? " · " + item.crustName : ""}
                          </p>
                        </div>
                        <div className="flex items-center rounded-full border border-white/10 bg-[#06282d]">
                          <button type="button" onClick={() => updateComplementQuantity(item.lineId, item.quantity - 1)} className="grid size-8 place-items-center text-white/70 transition hover:text-white" aria-label={"Diminuir " + item.productName}>−</button>
                          <span className="w-7 text-center text-[11px] font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => updateComplementQuantity(item.lineId, item.quantity + 1)} className="grid size-8 place-items-center text-white/70 transition hover:text-white" aria-label={"Aumentar " + item.productName}>+</button>
                        </div>
                        <span className="w-20 text-right text-xs font-bold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section id="ppp-add-order-catalog">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/45">Cardápio</p>
                    <h3 className="mt-1 text-lg font-black text-[#f4eee2]">
                      {complementItems.length > 0 ? "Adicionar mais itens" : "Escolha o que deseja adicionar"}
                    </h3>
                  </div>
                  {complementItems.length > 0 && (
                    <button type="button" onClick={scrollToAddOrderCatalog} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-bold text-white/70 transition hover:bg-white/[.08] hover:text-white">
                      Adicionar mais
                    </button>
                  )}
                </div>

                {data.products.filter((product) => product.active && product.available).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                    Nenhum item disponível no momento.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.products.filter((product) => product.active && product.available).map((item) => {
                      const displayPrice =
                        item.kind === "PIZZA"
                          ? getPrice(item, data.sizes[0]?.id ?? null, data.prices)
                          : Number(item.base_price) || 0;
                      const categoryName =
                        data.categories.find((category) => category.id === item.category_id)?.name ??
                        (item.kind === "PIZZA" ? "Pizza" : "Item");
                      const quickQuantity = Math.max(1, quickAddQuantities[item.id] ?? 1);

                      return (
                        <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0a3035] p-3 transition hover:border-white/20">
                          <div className="flex gap-3">
                            <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#06282d]">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="grid size-full place-items-center text-lg font-display text-primary/40">{item.name.charAt(0)}</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-[#f4eee2]">{item.name}</p>
                                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[.12em] text-[#f3ad4b]">{categoryName}</p>
                                </div>
                                <span className="shrink-0 text-xs font-bold text-[#f4eee2]">{formatCurrency(displayPrice)}</span>
                              </div>

                              {item.kind === "PIZZA" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComplementPickerOpen(false);
                                    setAddingToExistingOrder(true);
                                    setSelectedProduct(item);
                                  }}
                                  className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-[#f3ad4b] px-3 text-[10px] font-black uppercase tracking-[.12em] text-[#06282d] transition hover:brightness-105"
                                >
                                  Personalizar pizza
                                  <ChevronRight className="size-3.5" />
                                </button>
                              ) : (
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="flex items-center rounded-full border border-white/10 bg-[#06282d]">
                                    <button type="button" onClick={() => setQuickAddQuantities((current) => ({ ...current, [item.id]: Math.max(1, quickQuantity - 1) }))} className="grid size-9 place-items-center text-white/70 transition hover:text-white" aria-label={"Diminuir quantidade de " + item.name}>−</button>
                                    <span className="w-8 text-center text-[11px] font-bold">{quickQuantity}</span>
                                    <button type="button" onClick={() => setQuickAddQuantities((current) => ({ ...current, [item.id]: quickQuantity + 1 }))} className="grid size-9 place-items-center text-white/70 transition hover:text-white" aria-label={"Aumentar quantidade de " + item.name}>+</button>
                                  </div>
                                  <button type="button" onClick={() => addQuickSimpleProduct(item)} className="flex h-9 flex-1 items-center justify-center rounded-full border border-[#f3ad4b]/40 bg-[#f3ad4b]/10 px-3 text-[10px] font-black uppercase tracking-[.12em] text-[#f3ad4b] transition hover:bg-[#f3ad4b]/15">
                                    Adicionar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-[#041e22] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button type="button" onClick={scrollToAddOrderCatalog} className="h-11 flex-1 rounded-full border border-white/10 bg-white/[.04] px-4 text-xs font-bold text-white/75 transition hover:bg-white/[.08] hover:text-white">
                  Adicionar mais itens
                </button>
                <button
                  type="button"
                  disabled={complementItems.length === 0}
                  onClick={() => {
                    setComplementPickerOpen(false);
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  className="h-11 flex-1 rounded-full bg-[#f3ad4b] px-4 text-xs font-black text-[#06282d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar{complementItems.length > 0 ? " · " + formatCurrency(complementSubtotal) : ""}
                </button>
              </div>
            </footer>
          </section>
        </div>
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
            // Opening checkout from the normal cart always starts a new order.
            setComplementItems([]);
            setSelectedComplementIds([]);
            setComplementOrderId(null);
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {trackingOpen && trackedOrders.length > 0 && selectedTrackedOrderId && (() => {
        const selectedOrder = trackedOrders.find((order) => order.id === selectedTrackedOrderId);
        if (!selectedOrder) return null;
        return (
          <TrackedOrderPanel
            order={selectedOrder}
            availableOrders={trackedOrders}
            onSelectOrder={setSelectedTrackedOrderId}
            onClose={() => setTrackingOpen(false)}
            onAddToOrder={() => {
              setTrackingOpen(false);
              setSelectedProduct(null);
              setAddingToExistingOrder(false);
              setSelectedComplementIds([]);
              setQuickAddQuantities({});
              setComplementItems([]);
              setComplementOrderId(selectedOrder.id);
              setComplementPickerOpen(true);
            }}
          />
        );
      })()}

      {checkoutOpen && (
        <CheckoutPanel
          organization={data.organization}
          settings={data.settings}
          deliveryZones={data.deliveryZones}
          items={activeComplementOrderId ? complementItems : cart.items}
          subtotal={activeComplementOrderId ? complementSubtotal : subtotal}
          onClose={() => {
            setCheckoutOpen(false);
            setComplementItems([]);
            setSelectedComplementIds([]);
            setComplementOrderId(null);
          }}
          existingOrder={
            activeComplementOrderId
              ? (trackedOrders.find((order) => order.id === activeComplementOrderId) ?? null)
              : null
          }
          storeOpen={status.open}
          storeStatusLabel={status.label}
          onSuccess={async (order) => {
            if (!activeComplementOrderId) cart.clear();
            setComplementItems([]);
            setSelectedComplementIds([]);
            setComplementOrderId(null);

            // Refresh the complete public snapshot immediately so the tracking panel
            // shows the real items and total after both a new order and an addition.
            let snapshot = null as { items?: unknown; status?: string; order_number?: unknown; subtotal?: unknown; total?: unknown; fulfillment?: unknown } | null;
            try {
              const tracking = await getPublicOrderStatus(order.id, order.phone);
              const current = Array.isArray(tracking) ? tracking[0] : tracking;
              if (current && typeof current === "object") {
                snapshot = current as NonNullable<typeof snapshot>;
              }
            } catch {
              // The normal tracking refresh will retry shortly.
            }

            setTrackedOrders((current) => {
              const previous = current.find((item) => item.id === order.id);
              const snapshotItems = Array.isArray(snapshot?.items)
                ? (snapshot?.items as unknown as CartItem[])
                : undefined;
              const snapshotStatus = snapshot?.status as OrderStatus | undefined;
              const nextOrder: TrackedOrder = {
                ...(previous ?? {}),
                ...order,
                number:
                  Number.isFinite(Number(snapshot?.order_number)) &&
                  Number(snapshot?.order_number) > 0
                    ? Number(snapshot?.order_number)
                    : order.number,
                // Prefer the fresh RPC snapshot, then the checkout payload, then
                // the previous tracked snapshot. This keeps new orders populated even
                // when the tracking RPC has not been refreshed yet.
                items: snapshotItems ?? order.items ?? previous?.items,
                subtotal: Number.isFinite(Number(snapshot?.subtotal))
                  ? Number(snapshot?.subtotal)
                  : Number.isFinite(Number(order.subtotal))
                    ? Number(order.subtotal)
                    : previous?.subtotal,
                total: Number.isFinite(Number(snapshot?.total))
                  ? Number(snapshot?.total)
                  : Number.isFinite(Number(order.total))
                    ? Number(order.total)
                    : previous?.total,
                fulfillment:
                  (snapshot?.fulfillment as TrackedOrder["fulfillment"] | undefined) ??
                  order.fulfillment ??
                  previous?.fulfillment,
                status: snapshotStatus ?? (order.status as OrderStatus | undefined) ?? previous?.status ?? "RECEIVED",
              };
              const next = [nextOrder, ...current.filter((item) => item.id !== order.id)];
              try {
                localStorage.setItem(
                  `ppp:tracked-orders:${data.organization.id}`,
                  JSON.stringify(next),
                );
              } catch {
                // Ignore storage failures; tracking still works for the current session.
              }
              return next;
            });

            setSelectedTrackedOrderId(order.id);
            setCheckoutOpen(false);
            setTrackingOpen(true);
            try {
              localStorage.setItem(
                `ppp:last-order:${data.organization.id}`,
                JSON.stringify(order),
              );
            } catch {
              // Ignore storage failures.
            }
          }}

        />
      )}

      {itemCount > 0 && !cartOpen && !checkoutOpen && (
        <div className="ppp-floating-cart fixed inset-x-0 bottom-4 z-30 mx-auto w-[calc(100%-2rem)] max-w-md">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-full border border-secondary-foreground/10 bg-secondary/90 px-5 py-4 text-secondary-foreground shadow-lifted backdrop-blur-xl"
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
