import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Pizza, ShoppingBag, Store } from "lucide-react";
import { loadStore } from "@/features/storefront/services/load-store";
import { Button } from "@/components/ui/button";
import { StorefrontSkeleton } from "@/components/storefront/StorefrontSkeleton";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { StorefrontTicker } from "@/components/storefront/StorefrontTicker";
import { ProductTicker } from "@/components/storefront/ProductTicker";
import { MenuImageAccordion } from "@/components/storefront/MenuImageAccordion";
import { MenuFilters } from "@/components/storefront/MenuFilters";
import { StorefrontAbout } from "@/components/storefront/StorefrontAbout";
import { StorefrontContact } from "@/components/storefront/StorefrontContact";
import { ProductConfigurator } from "@/features/storefront/components/ProductConfigurator";
import { CartPanel } from "@/features/cart/components/CartPanel";
import { CheckoutPanel } from "@/features/storefront/components/CheckoutPanel";
import { TrackedOrderPanel } from "@/components/storefront/TrackedOrderPanel";
import { useLocalCart } from "@/features/cart/hooks/use-local-cart";
import { calculateCartSubtotal } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, OrderStatus, Product } from "@/lib/domain/types";

import { getPrice, getStoreStatus } from "@/features/storefront/domain/storefront-utils";
export type TrackedOrder = {
  id: string;
  number: number;
  phone: string;
  items?: CartItem[];
  subtotal?: number;
  total?: number;
  fulfillment?: "DELIVERY" | "PICKUP";
  status?: OrderStatus;
};

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
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([]);
  const [selectedTrackedOrderId, setSelectedTrackedOrderId] = useState<string | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [complementPickerOpen, setComplementPickerOpen] = useState(false);
  const [selectedComplementIds, setSelectedComplementIds] = useState<string[]>([]);
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
            const { data: tracking, error } = await supabase.rpc("get_public_order_status", {
              p_order_id: stored.id,
              p_customer_phone: stored.phone,
            });
            const current = Array.isArray(tracking) ? tracking[0] : tracking;
            return {
              stored,
              current,
              error,
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
        selectedTrackedOrdersCount={trackedOrders.length}
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
        />

        <ProductTicker products={mainProducts} />

        <section
          id="cardapio"
          className="ppp-reference-menu mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6"
        >
          <div className="ppp-reference-menu-heading mb-8 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[.35em] text-primary">
              Cardápio
            </p>
            <h2 className="mt-1 max-w-3xl text-4xl leading-[.95] sm:text-6xl">
              Escolha sua <em>pizza.</em>
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Escolha uma categoria e encontre seu próximo sabor.
            </p>
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
                const categoryImage = data.categories.find(
                  (category) => category.id === product.category_id,
                )?.image_url;
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
                            <span className="text-[11px] font-semibold uppercase tracking-[.18em]">
                              Imagem em breve
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-12">
                        <p className="font-display text-xl uppercase leading-none text-white drop-shadow-sm sm:text-2xl">
                          {product.name}
                        </p>
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
                          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                            {data.categories.find((category) => category.id === product.category_id)
                              ?.name || "Pizza"}
                          </p>
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

      {complementPickerOpen && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Adicionar itens">
          <button type="button" className="absolute inset-0" onClick={() => setComplementPickerOpen(false)} aria-label="Fechar seleção de adicionais" />
          <section className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-background shadow-2xl sm:rounded-[2rem]">
            <header className="shrink-0 border-b bg-card px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Pedido em andamento</p>
                  <h2 className="mt-1 text-2xl font-display">Esqueceu alguma coisa?</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Escolha bebidas, acompanhamentos ou sobremesas para fazer um novo pedido.</p>
                </div>
                <button type="button" onClick={() => setComplementPickerOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Fechar">
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {complementProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum adicional disponível no momento.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {complementProducts.map((item) => {
                    const selected = selectedComplementIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedComplementIds((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])}
                        className={"flex items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:border-primary/40")}
                      >
                        <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {item.image_url ? <img src={item.image_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-lg font-display text-primary/40">{item.name.charAt(0)}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(item.base_price) || 0)}</p>
                        </div>
                        {selected && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><span className="text-xs">✓</span></span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <footer className="shrink-0 border-t bg-card p-4">
              <Button
                disabled={selectedComplementIds.length === 0}
                onClick={() => {
                  selectedComplementIds.forEach((id) => {
                    const item = complementProducts.find((product) => product.id === id);
                    if (!item) return;
                    cart.addItem({
                      lineId: crypto.randomUUID(),
                      productId: item.id,
                      productName: item.name,
                      imageUrl: item.image_url,
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
                      unitPrice: Number(item.base_price) || 0,
                    });
                  });
                  setSelectedComplementIds([]);
                  setComplementPickerOpen(false);
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="h-12 w-full rounded-full"
              >
                Adicionar à sacola
              </Button>
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
              setSelectedComplementIds([]);
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
          items={cart.items}
          subtotal={subtotal}
          onClose={() => {
            setCheckoutOpen(false);
            setComplementOrderId(null);
          }}
          existingOrder={
            complementOrderId
              ? (trackedOrders.find((order) => order.id === complementOrderId) ?? null)
              : null
          }
          storeOpen={status.open}
          storeStatusLabel={status.label}
          onSuccess={async (order) => {
            cart.clear();
            setComplementOrderId(null);

            // Refresh the complete public snapshot immediately so the tracking panel
            // shows the real items and total after both a new order and an addition.
            let snapshot: Record<string, unknown> | null = null;
            try {
              const { data: tracking } = await supabase.rpc("get_public_order_status", {
                p_order_id: order.id,
                p_customer_phone: order.phone,
              });
              const current = Array.isArray(tracking) ? tracking[0] : tracking;
              if (current && typeof current === "object") {
                snapshot = current as Record<string, unknown>;
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
                status: snapshotStatus ?? order.status ?? previous?.status ?? "RECEIVED",
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
            try {
              localStorage.setItem(
                `ppp:last-order:${data.organization.id}`,
                JSON.stringify(order),
              );
            } catch {
              // Ignore storage failures.
            }
          }}
          onOrderFinished={() => {
            setTrackedOrders((current) => {
              const next = current.filter((item) => item.id !== selectedTrackedOrderId);
              try {
                if (next.length > 0) {
                  localStorage.setItem(
                    `ppp:tracked-orders:${data.organization.id}`,
                    JSON.stringify(next),
                  );
                } else {
                  localStorage.removeItem(`ppp:tracked-orders:${data.organization.id}`);
                }
              } catch {
                // Ignore storage failures.
              }
              return next;
            });
            setSelectedTrackedOrderId(null);
            try {
              localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
            } catch {
              // Ignore storage failures.
            }
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
