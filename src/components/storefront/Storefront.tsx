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
import { MenuFilters } from "@/components/storefront/MenuFilters";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { StorefrontLoadError } from "@/components/storefront/StorefrontLoadError";
import { StorefrontSkeleton } from "@/components/storefront/StorefrontSkeleton";
import { ProductTicker } from "@/components/storefront/ProductTicker";
import { MenuImageAccordion } from "@/components/storefront/MenuImageAccordion";
import { MenuSectionHeading } from "@/components/storefront/MenuSectionHeading";
import { TrackedOrderPanel, type PublicTrackedOrder } from "@/components/storefront/TrackedOrderPanel";
import { StorefrontAbout } from "@/components/storefront/StorefrontAbout";
import { StorefrontContact } from "@/components/storefront/StorefrontContact";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontTicker } from "@/components/storefront/StorefrontTicker";
import { Textarea } from "@/components/ui/textarea";
import { useLocalCart } from "@/carrinho/hooks/use-local-cart";
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
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedTrackedOrders, setTrackedOrders] = useState<PublicTrackedOrder[]>([]);
  const [selectedTrackedOrder, setSelectedTrackedOrder] = useState<PublicTrackedOrder | null>(null);
  const [addingToOrder, setAddingToOrder] = useState(false);
  const [additionModalOpen, setAdditionModalOpen] = useState(false);
  const [additionQuantities, setAdditionQuantities] = useState<Record<string, number>>({});
  const [additionSubmitting, setAdditionSubmitting] = useState(false);
  const [additionError, setAdditionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!data?.organization?.id) return;

    let cancelled = false;

    const persistTrackedOrders = (orders: PublicTrackedOrder[]) => {
      try {
        localStorage.setItem(`ppp:last-orders:${data.organization.id}`, JSON.stringify(orders));
      } catch {
        // Ignore storage failures; the current session still keeps the orders.
      }
    };

    const loadTrackedOrders = async () => {
      try {
        const arrayRaw = localStorage.getItem(`ppp:last-orders:${data.organization.id}`);
        const legacyRaw = localStorage.getItem(`ppp:last-order:${data.organization.id}`);
        const parsed = arrayRaw ? JSON.parse(arrayRaw) : legacyRaw ? JSON.parse(legacyRaw) : [];
        const storedOrders: PublicTrackedOrder[] = Array.isArray(parsed) ? parsed : parsed?.id ? [parsed] : [];
        const validOrders = storedOrders
          .filter((order) => order?.id && order?.phone)
          .map((order) => ({
            ...order,
            id: String(order.id),
            number: Number(order.number) || 0,
            phone: String(order.phone),
            items: Array.isArray(order.items) ? order.items : undefined,
            subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : undefined,
            total: Number.isFinite(Number(order.total)) ? Number(order.total) : undefined,
          }));

        if (validOrders.length === 0) {
          if (!cancelled) setTrackedOrders([]);
          return;
        }

        const results = await Promise.all(
          validOrders.map(async (order) => {
            try {
              const { data: tracking, error } = await supabase.rpc("get_public_order_status", {
                p_order_id: order.id,
                p_customer_phone: order.phone,
              });
              if (error) return order;
              const current = Array.isArray(tracking) ? tracking[0] : tracking;
              const status = current?.status as OrderStatus | undefined;
              const orderNumber = Number(current?.order_number);
              const fulfillment = current?.fulfillment as FulfillmentType | undefined;
              return status === "DELIVERED" || status === "CANCELLED"
                ? null
                : {
                    ...order,
                    // The database is the source of truth. Never keep a stale localStorage order number.
                    number: Number.isFinite(orderNumber) && orderNumber > 0 ? orderNumber : order.number,
                    status,
                    fulfillment: fulfillment ?? order.fulfillment,
                  };
            } catch {
              return order;
            }
          }),
        );

        const activeOrders = results.filter((order): order is PublicTrackedOrder => Boolean(order));
        if (cancelled) return;

        setTrackedOrders(activeOrders);
        persistTrackedOrders(activeOrders);
        setSelectedTrackedOrder((previous) => {
          if (!previous) return previous;
          return activeOrders.find((order) => order.id === previous.id) ?? previous;
        });
        if (legacyRaw) {
          try {
            localStorage.removeItem(`ppp:last-order:${data.organization.id}`);
          } catch {
            // Ignore storage failures.
          }
        }
      } catch {
        if (!cancelled) setTrackedOrders([]);
      }
    };

    void loadTrackedOrders();
    const refreshInterval = window.setInterval(() => {
      void loadTrackedOrders();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [data?.organization?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const mainProducts = useMemo(() => {
    if (!data) return [];
    // O cardápio público deve mostrar todos os produtos. Produtos simples,
    // como bebidas, podem ser adicionados diretamente sem passar pelo montador de pizza.
    return data.products;
  }, [data]);

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

  const addSimpleProduct = (product: Product, openCart = true) => {
    const item: CartItem = {
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
    };

    cart.addItem(item);
    if (openCart) setCartOpen(true);
  };


  const additionProducts = useMemo(() => {
    if (!data) return [];
    const categoryIds = new Set(
      data.categories
        .filter((category) => /(bebida|refrigerante|suco|acompanhamento|acompanhamentos|adicional|adicionais|sobremesa|sobremesas|doce|doces)/i.test(
          category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        ))
        .map((category) => category.id),
    );
    return data.products.filter((product) => product.kind === "SIMPLE" && categoryIds.has(product.category_id));
  }, [data]);

  const trackedItems = Array.isArray(selectedTrackedOrder?.items)
    ? selectedTrackedOrder.items.filter((item): item is CartItem => Boolean(item && typeof item === "object"))
    : [];

  const additionTotal = additionProducts.reduce(
    (sum, product) => sum + (additionQuantities[product.id] ?? 0) * (Number(product.base_price) || 0),
    0,
  );
  const additionCount = Object.values(additionQuantities).reduce((sum, quantity) => sum + quantity, 0);

  const confirmAdditions = async () => {
    if (!selectedTrackedOrder || additionCount === 0 || additionSubmitting) return;
    setAdditionSubmitting(true);
    setAdditionError(null);
    try {
      const selectedItems = additionProducts
        .map((product) => ({ product, quantity: additionQuantities[product.id] ?? 0 }))
        .filter(({ quantity }) => quantity > 0);
      const appendItems = selectedItems.map(({ product, quantity }) => ({
        product_id: product.id,
        second_product_id: null,
        is_half: false,
        size_id: null,
        crust_id: null,
        quantity,
        notes: null,
        addons: [],
      }));
      const { data: appended, error: appendError } = await supabase.rpc("append_public_order_items", {
        p_order_id: selectedTrackedOrder.id,
        p_customer_phone: selectedTrackedOrder.phone,
        p_items: appendItems,
      });
      if (appendError) throw appendError;
      const order = Array.isArray(appended) ? appended[0] : appended;
      if (!order?.order_id || !order?.order_number) throw new Error("O servidor não retornou o pedido atualizado.");

      // Online payments for additions must remain a separate transaction from the original order.
      // The current project only records payment methods; it has no online payment gateway yet.
      // When a gateway is connected, this flow must open a dedicated additional-payment step
      // using additionTotal, without reopening or replacing the original order payment.

      const addedCartItems: CartItem[] = selectedItems.map(({ product, quantity }) => ({
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
      }));

      const updatedOrder: PublicTrackedOrder = {
        ...selectedTrackedOrder,
        id: String(order.order_id),
        number: Number(order.order_number),
        items: [...(selectedTrackedOrder.items ?? []), ...addedCartItems],
        subtotal: Number(order.subtotal ?? selectedTrackedOrder.subtotal ?? 0),
        total: Number(order.total ?? selectedTrackedOrder.total ?? 0),
        status: (order.status as OrderStatus) ?? selectedTrackedOrder.status,
      };
      setSelectedTrackedOrder(updatedOrder);
      setTrackedOrders((previous) => {
        const next = [...previous.filter((item) => item.id !== updatedOrder.id), updatedOrder];
        try { localStorage.setItem("ppp:last-orders:" + data.organization.id, JSON.stringify(next)); } catch {}
        return next;
      });
      setAdditionQuantities({});
      setAdditionModalOpen(false);
      setTrackingOpen(true);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : typeof submitError === "object" && submitError !== null && "message" in submitError
          ? String((submitError as { message?: unknown }).message ?? "Não foi possível adicionar os itens.")
          : "Não foi possível adicionar os itens.";
      setAdditionError(message);
    } finally {
      setAdditionSubmitting(false);
    }
  };

  if (isLoading) return <StorefrontSkeleton />;
  if (isError || !data) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-muted/30 p-6">
        <StorefrontLoadError error={error} onRetry={refetch} />
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
      className="min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground"
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
        logoUrl={data.settings.logo_url}
        itemCount={itemCount}
        selectedTrackedOrdersCount={selectedTrackedOrders.length}
        onOpenCart={() => setCartOpen(true)}
      />

      <main id="inicio" className="ppp-reference-storefront">
        <StorefrontHero
          organizationName={data.organization.name}
          settings={data.settings}
          products={mainProducts}
        />

        <ProductTicker products={mainProducts} />

        <section id="cardapio" className="ppp-reference-menu mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
          <MenuSectionHeading />

          <MenuImageAccordion
            categories={data.categories}
            products={mainProducts}
          />
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
                        <span>{product.kind === "SIMPLE" ? "Adicionar ao pedido" : product.allow_half ? "Meio a meio" : "Personalizar"}</span>
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
          selectedTrackedOrders={selectedTrackedOrders}
          onTrackOrder={(order) => {
            setSelectedTrackedOrder(order);
            setAddingToOrder(false);
            setTrackingOpen(true);
            setCartOpen(false);
            setCheckoutOpen(false);
          }}
          onClose={() => setCartOpen(false)}
          onUpdate={cart.updateQuantity}
          onRemove={cart.removeItem}
          onClear={cart.clear}
          storeOpen={status.open}
          storeStatusLabel={status.label}
          pickupEnabled={Boolean(data.settings.pickup_enabled)}
          deliveryEnabled={Boolean(data.settings.delivery_enabled)}
          onCheckout={() => {
            setCartOpen(false);
            if (addingToOrder && selectedTrackedOrder) {
              setTrackingOpen(true);
            } else {
              setTrackingOpen(false);
              setSelectedTrackedOrder(null);
              setAddingToOrder(false);
            }
            setCheckoutOpen(true);
          }}
        />
      )}

      {trackingOpen && selectedTrackedOrder && !checkoutOpen && (
        <TrackedOrderPanel
          order={selectedTrackedOrder}
          onClose={() => {
            setTrackingOpen(false);
            setSelectedTrackedOrder(null);
          }}
          onAddToOrder={() => {
            setAdditionError(null);
            setAdditionQuantities({});
            setAdditionModalOpen(true);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutPanel
          organization={data.organization}
          settings={data.settings}
          deliveryZones={data.deliveryZones}
          products={data.products}
          categories={data.categories}
          items={cart.items}
          subtotal={subtotal}
          onClose={() => setCheckoutOpen(false)}
          storeOpen={status.open}
          storeStatusLabel={status.label}
          trackedOrder={trackingOpen ? selectedTrackedOrder : null}
          addingToOrder={addingToOrder}
          onAddToOrder={() => {
            if (!selectedTrackedOrder) return;
            setAddingToOrder(false);
            setTrackingOpen(true);
            setCheckoutOpen(true);
            setCartOpen(false);
          }}
          onOpenAdditions={() => {
            if (!selectedTrackedOrder) return;
            setAdditionError(null);
            setAdditionQuantities({});
            setAdditionModalOpen(true);
          }}
          onSuccess={(order) => {
            cart.clear();
            setTrackedOrders((previous) => {
              const next = [...previous.filter((item) => item.id !== order.id), order];
              try {
                localStorage.setItem(`ppp:last-orders:${data.organization.id}`, JSON.stringify(next));
              } catch {
                // Ignore storage failures; tracking still works for the current session.
              }
              return next;
            });

            if (order.isAddition) {
              setSelectedTrackedOrder(order);
              setAddingToOrder(false);
              setTrackingOpen(true);
              setCheckoutOpen(false);
            } else {
              setTrackingOpen(false);
              setSelectedTrackedOrder(null);
              setAddingToOrder(false);
            }
          }}
          onOrderFinished={(orderId) => {
            setTrackedOrders((previous) => {
              const next = previous.filter((item) => item.id !== orderId);
              try {
                localStorage.setItem(`ppp:last-orders:${data.organization.id}`, JSON.stringify(next));
              } catch {
                // Ignore storage failures.
              }
              return next;
            });
            setSelectedTrackedOrder(null);
            setTrackingOpen(false);
            setAddingToOrder(false);
          }}
        />
      )}
      {additionModalOpen && selectedTrackedOrder && (
        <div className="fixed inset-0 z-[320] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Adicionar itens ao pedido">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => { setAdditionModalOpen(false); setAdditionQuantities({}); setAdditionError(null); }}
            aria-label="Fechar"
          />

          <section className="relative z-10 flex h-[94dvh] max-h-[760px] w-full min-w-0 flex-col overflow-hidden rounded-t-[2rem] border border-black/10 bg-[#0d1117] text-background shadow-2xl sm:h-[88dvh] max-h-[760px] sm:max-w-5xl sm:rounded-[2rem]">
            <header className="shrink-0 border-b border-background/10 bg-[#10151d] px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-background/20 sm:hidden" />
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                      <Plus className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Pedido #{selectedTrackedOrder.number}</p>
                      <h2 className="truncate text-xl font-display tracking-tight sm:text-2xl">Esqueceu alguma coisa?</h2>
                    </div>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-background/55 sm:ml-12">
                    Adicione bebidas, acompanhamentos ou sobremesas ao pedido sem refazer tudo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAdditionModalOpen(false); setAdditionQuantities({}); setAdditionError(null); }}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-background/10 bg-background/5 text-background/70 transition hover:bg-background/10 hover:text-background"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_320px]">
                <main className="min-w-0 p-4 sm:p-5 lg:p-6">
                  <div className="mb-4 rounded-2xl border border-background/10 bg-background/[.035] p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/5 text-background/75">
                        <ShoppingBag className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold">Pedido #{selectedTrackedOrder.number}</p>
                        <p className="mt-0.5 truncate text-[10px] text-background/45">
                          {trackedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} itens no pedido atual
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-[.12em] text-background/40">Total atual</p>
                        <p className="text-sm font-black">{formatCurrency(Number(selectedTrackedOrder.total ?? selectedTrackedOrder.subtotal ?? 0))}</p>
                      </div>
                    </div>
                  </div>

                  {additionProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-background/15 p-8 text-center">
                      <p className="font-semibold">Nenhum item disponível para acréscimo.</p>
                      <p className="mt-1 text-xs leading-5 text-background/50">Cadastre bebidas, acompanhamentos ou sobremesas como produtos simples para disponibilizá-los aqui.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {["Todos", "Bebidas", "Acompanhamentos", "Sobremesas"].map((label, index) => (
                          <span
                            key={label}
                            className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-bold ${index === 0 ? "border-primary bg-primary text-primary-foreground" : "border-background/10 bg-background/[.035] text-background/55"}`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {additionProducts.map((product) => {
                          const quantity = additionQuantities[product.id] ?? 0;
                          return (
                            <div key={product.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-background/10 bg-background/[.035] p-2.5 transition hover:border-primary/30 hover:bg-background/[.055]">
                              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-background/10 ring-1 ring-background/10 sm:size-16">
                                {product.image_url ? (
                                  <img src={product.image_url} alt="" className="size-full object-cover" />
                                ) : (
                                  <div className="grid size-full place-items-center font-display text-lg text-primary/50">{product.name.charAt(0)}</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">{product.name}</p>
                                <p className="mt-0.5 truncate text-[10px] text-background/45">Disponível para adicionar</p>
                                <p className="mt-1 text-xs font-black text-primary">{formatCurrency(Number(product.base_price) || 0)}</p>
                              </div>
                              <div className={`flex shrink-0 items-center rounded-full border bg-background/5 ${quantity > 0 ? "border-primary/50" : "border-background/10"}`}>
                                <button
                                  type="button"
                                  disabled={quantity === 0}
                                  onClick={() => setAdditionQuantities((previous) => ({ ...previous, [product.id]: Math.max(0, (previous[product.id] ?? 0) - 1) }))}
                                  className="grid size-8 place-items-center text-background/50 transition hover:text-background disabled:opacity-25 sm:size-9"
                                  aria-label={`Diminuir ${product.name}`}
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <span className="w-6 text-center text-xs font-black">{quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setAdditionQuantities((previous) => ({ ...previous, [product.id]: Math.min(99, (previous[product.id] ?? 0) + 1) }))}
                                  className="grid size-8 place-items-center text-primary transition hover:text-background sm:size-9"
                                  aria-label={`Aumentar ${product.name}`}
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </main>

                <aside className="hidden border-l border-background/10 bg-[#0a0e14] p-5 lg:flex lg:flex-col">
                  <div className="mb-5">
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Resumo</p>
                    <h3 className="mt-1 text-lg font-display">Seu pedido</h3>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {trackedItems.slice(0, 8).map((item, index) => (
                      <div key={item.lineId || `${item.productId}-${index}`} className="flex min-w-0 gap-2.5 rounded-xl bg-background/[.035] p-2.5">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/5 text-[9px] font-black text-background/55">
                          {item.quantity}×
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">{item.productName || "Item"}</p>
                          <p className="mt-0.5 text-[10px] text-background/40">{formatCurrency((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-background/10 pt-4">
                    <div className="flex items-center justify-between text-xs text-background/45">
                      <span>Acréscimo</span>
                      <span className="font-black text-background">{formatCurrency(additionTotal)}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-xs text-background/45">Novo total</span>
                      <span className="text-xl font-black text-primary">{formatCurrency(Number(selectedTrackedOrder.total ?? selectedTrackedOrder.subtotal ?? 0) + additionTotal)}</span>
                    </div>
                  </div>

                  {additionError && (
                    <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-red-200">{additionError}</p>
                  )}

                  <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3">
                    <p className="text-[10px] font-semibold leading-4 text-background/55">
                      O pagamento de qualquer acréscimo será tratado separadamente do pagamento original quando o pagamento online estiver disponível.
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={additionCount === 0 || additionSubmitting}
                    onClick={confirmAdditions}
                    className="mt-4 h-12 w-full rounded-xl text-sm font-black shadow-[0_8px_24px_hsl(var(--primary)/.2)]"
                  >
                    {additionSubmitting ? "Adicionando..." : `Adicionar · ${formatCurrency(additionTotal)}`}
                  </Button>
                </aside>
              </div>
            </div>

            <footer className="shrink-0 border-t border-background/10 bg-[#0a0e14] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:hidden">
              <div className="mx-auto flex max-w-2xl items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-background/40">Acréscimo</p>
                  <p className="truncate text-lg font-black leading-tight text-background">{formatCurrency(additionTotal)}</p>
                  <p className="truncate text-[9px] text-background/40">
                    Novo total: {formatCurrency(Number(selectedTrackedOrder.total ?? selectedTrackedOrder.subtotal ?? 0) + additionTotal)}
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={additionCount === 0 || additionSubmitting}
                  onClick={confirmAdditions}
                  className="h-12 shrink-0 rounded-full px-5 text-xs font-black shadow-[0_8px_24px_hsl(var(--primary)/.25)]"
                >
                  {additionSubmitting ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
              {additionError && <p className="mx-auto mt-2 max-w-2xl rounded-xl bg-destructive/10 px-3 py-2 text-[10px] font-semibold text-red-200">{additionError}</p>}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}


function getTrackedOrderStatusLabel(status?: OrderStatus) {
  switch (status) {
    case "RECEI;
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
      <div className="flex h-[min(95dvh,860px)] max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:h-[92vh] sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="relative shrink-0 overflow-hidden border-b bg-foreground px-5 pb-5 pt-4 text-background sm:px-6">
          <div className="absolute -right-10 -top-16 size-40 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-2xl sm:size-20 border border-background/15 bg-background/10 shadow-lg">
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
                      <p className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">
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

function itemCountLabel(items: CartItem[]) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return count + " " + (count === 1 ? "item" : "itens");
}

function CartPanel({
  items,
  subtotal,
  selectedTrackedOrders,
  onTrackOrder,
  onClose,
  onUpdate,
  onRemove,
  onClear,
  storeOpen,
  storeStatusLabel,
  pickupEnabled,
  deliveryEnabled,
  onCheckout,
}: {
  items: CartItem[];
  subtotal: number;
  selectedTrackedOrders: PublicTrackedOrder[];
  onTrackOrder: (order: PublicTrackedOrder) => void;
  onClose: () => void;
  onUpdate: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="ppp-cart-panel fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Carrinho">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar carrinho" />
      <aside className="relative z-10 flex h-[94dvh] max-h-[760px] w-full min-w-0 flex-col overflow-hidden rounded-t-[2rem] border border-black/10 bg-[#0d1117] text-background shadow-2xl sm:h-[88dvh] sm:max-w-2xl sm:rounded-[2rem]">
        <header className="shrink-0 border-b border-background/10 bg-[#10151d] px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-background/20 sm:hidden" />
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <ShoppingBag className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Seu pedido</p>
                  <h2 className="truncate text-xl font-display tracking-tight sm:text-2xl">Carrinho</h2>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-background/55">Confira seus itens antes de continuar para a finalização.</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full border border-background/10 bg-background/5 text-background/70 transition hover:bg-background/10 hover:text-background">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <main className="p-4 sm:p-5">
            {selectedTrackedOrders.length > 0 && (
              <section className="mb-4 overflow-hidden rounded-2xl border border-primary/15 bg-background/[.035] shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-background/10 px-4 py-3.5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Pedidos em andamento</p>
                    <h3 className="mt-1 text-base font-bold">Acompanhe seus pedidos</h3>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary">{selectedTrackedOrders.length}</span>
                </div>
                <div className="space-y-2 p-3">
                  {selectedTrackedOrders.map((order) => (
                    <button key={order.id} type="button" onClick={() => onTrackOrder(order)} className="group flex w-full items-center gap-3 rounded-xl border border-background/10 bg-background/[.035] p-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[.14em] text-primary">Em andamento</span>
                          <span className="text-[9px] font-bold text-background/45">#{order.number}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-background/85">Acompanhar pedido</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-background/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {items.length === 0 ? (
              <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
                <div className="grid size-16 place-items-center rounded-2xl border border-background/10 bg-background/[.035] text-primary"><ShoppingBag className="size-7" /></div>
                <p className="mt-4 font-semibold">Seu carrinho está vazio</p>
                <p className="mt-1 max-w-xs text-sm leading-5 text-background/45">Adicione qualquer item do cardápio para começar.</p>
              </div>
            ) : (
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Itens</p>
                    <h3 className="mt-1 text-lg font-display">Seu pedido</h3>
                  </div>
                  <span className="rounded-full border border-background/10 bg-background/[.035] px-2.5 py-1 text-[9px] font-bold text-background/55">{itemCountLabel(items)}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div key={item.lineId} className="flex min-w-0 gap-3 rounded-2xl border border-background/10 bg-background/[.035] p-2.5 sm:p-3">
                      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-background/10 ring-1 ring-background/10">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center font-display text-xl text-primary/50">{item.productName.charAt(0)}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item.productName}{item.secondProductName ? " + " + item.secondProductName : ""}</p>
                            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-background/45">
                              {[item.sizeName, item.crustName, (item.addons ?? []).length ? (item.addons ?? []).length + " adicional(is)" : null, (item.complements ?? []).length ? (item.complements ?? []).length + " complemento(s)" : null].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <button onClick={() => onRemove(item.lineId)} className="grid size-7 shrink-0 place-items-center rounded-full text-background/35 transition hover:bg-red-400/10 hover:text-red-300" aria-label={"Remover " + item.productName}><X className="size-3.5" /></button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-full border border-background/10 bg-background/5">
                            <button onClick={() => onUpdate(item.lineId, item.quantity - 1)} className="grid size-8 place-items-center text-background/45 transition hover:text-background" aria-label="Diminuir"><Minus className="size-3.5" /></button>
                            <span className="w-7 text-center text-xs font-black">{item.quantity}</span>
                            <button onClick={() => onUpdate(item.lineId, item.quantity + 1)} className="grid size-8 place-items-center text-primary transition hover:text-background" aria-label="Aumentar"><Plus className="size-3.5" /></button>
                          </div>
                          <span className="text-sm font-black">{formatCurrency(item.unitPrice * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>

        <footer className="shrink-0 border-t border-background/10 bg-[#0a0e14] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-background/40">Subtotal</p>
                <p className="mt-0.5 font-display text-2xl tracking-tight">{formatCurrency(subtotal)}</p>
              </div>
              <span className="text-right text-[9px] leading-4 text-background/40">Entrega e descontos<br />calculados no checkout</span>
            </div>
            {!storeOpen && <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-center text-[10px] font-semibold text-primary">{storeStatusLabel}</p>}
            <Button disabled={items.length === 0 || !storeOpen} className="mt-3 h-12 w-full rounded-xl text-sm font-black shadow-[0_8px_24px_hsl(var(--primary)/.22)]" onClick={onCheckout}>
              {storeOpen ? "Continuar para checkout" : "Loja fechada"}
            </Button>
            {items.length > 0 && <button onClick={onClear} className="mt-2.5 w-full text-center text-[10px] font-bold uppercase tracking-[.12em] text-background/35 transition hover:text-red-300">Limpar carrinho</button>}
          </div>
        </footer>
      </aside>
    </div>
  );
}

function CheckoutPanel({
  organization,
  settings,
  deliveryZones,
  products,
  categories,
  items,
  subtotal,
  onClose,
  onSuccess,
  trackedOrder,
  addingToOrder,
  onAddToOrder,
  onOpenAdditions,
  storeOpen,
  storeStatusLabel,
  onOrderFinished,
}: {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  products: Product[];
  categories: Category[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: (order: { id: string; number: number; phone: string; items?: CartItem[]; subtotal?: number; total?: number; fulfillment?: FulfillmentType; status?: OrderStatus; isAddition?: boolean }) => void;
  trackedOrder?: { id: string; number: number; phone: string; items?: CartItem[]; subtotal?: number; total?: number; fulfillment?: FulfillmentType; status?: OrderStatus } | null;
  addingToOrder: boolean;
  onAddToOrder: () => void;
  onOpenAdditions: () => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  onOrderFinished: (orderId: string) => void;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    settings.delivery_enabled ? "DELIVERY" : "PICKUP",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (settings.payment_methods ?? [])[0] ?? "PIX",
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
  const [trackingLive, setTrackingLive] = useState(false);
  const [lastTrackingUpdate, setLastTrackingUpdate] = useState<Date | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([]);
  const [confirmedSubtotal, setConfirmedSubtotal] = useState(0);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedFulfillment, setConfirmedFulfillment] = useState<FulfillmentType>(settings.delivery_enabled ? "DELIVERY" : "PICKUP");


  return (
    <div className="ppp-checkout-panel fixed inset-0 z-[60] min-h-[100dvh] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#f7f4ef] text-foreground">
      <div className="mx-auto min-h-[100dvh] w-full max-w-6xl px-[clamp(.75rem,2.5vw,1.5rem)] pb-28 pt-[clamp(.75rem,2.5vw,1.5rem)] sm:px-6 sm:pb-12 sm:pt-6">
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
            {(addingToOrder
              ? [["01", "Itens"], ["02", "Revisão"], ["03", "Confirmação"]]
              : [["01", "Receber"], ["02", "Dados"], ["03", "Pagamento"]]
            ).map(([number, label], index) => (
              <div key={number} className={`flex items-center justify-center gap-2 px-2 py-2.5 ${index === 0 ? "text-background" : "text-background/45"}`}>
                <span className={`grid size-5 place-items-center rounded-full text-[8px] font-black ${index === 0 ? "bg-primary text-primary-foreground" : "border border-background/20"}`}>{number}</span>
                <span className="hidden text-[9px] font-semibold uppercase tracking-[.14em] sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="space-y-3">
            {addingToOrder ? (
              <section className="rounded-[1.5rem] border border-primary/15 bg-white p-5 shadow-[0_8px_25px_rgba(0,0,0,.05)] sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="size-5" /></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">Adicionar ao pedido #{trackedOrder?.number}</p>
                    <h2 className="mt-1 text-xl font-display tracking-tight">Mais alguma coisa?</h2>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Os itens abaixo serão acrescentados ao pedido existente. O endereço, forma de recebimento e telefone continuam os mesmos.</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#faf9f7] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-muted-foreground">Novos itens</p>
                  <div className="mt-3 space-y-2">
                    {items.map((item) => (
                      <div key={item.lineId} className="flex items-start justify-between gap-3 rounded-xl border border-black/8 bg-white p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{item.quantity}× {item.productName}{item.secondProductName ? ` + ${item.secondProductName}` : ""}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{[item.sizeName, item.crustName].filter(Boolean).join(" · ")}</p>
                          {(item.addons ?? []).length > 0 && <p className="mt-1 text-[10px] text-primary">+ {(item.addons ?? []).map((addon) => addon.name).join(", ")}</p>}
                          {(item.complements ?? []).length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">+ {(item.complements ?? []).map((complement) => complement.productName).join(", ")}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-bold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-black/8 bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Acréscimo:</strong> {formatCurrency(subtotal)} · o total do pedido será atualizado após a confirmação.</div>
              </section>
            ) : (
              <>
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
                    <select
                      value={matchedNeighborhood ?? ""}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      disabled={availableNeighborhoods.length === 0}
                      className="h-11 w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {availableNeighborhoods.length > 0 ? "Selecione seu bairro" : "Áreas de entrega indisponíveis"}
                      </option>
                      {availableNeighborhoods.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
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
                      : availableNeighborhoods.length > 0 ? "Informe um bairro atendido para calcular a taxa." : "As áreas de entrega ainda não foram cadastradas. Entre em contato com a loja para confirmar o atendimento."}
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
              </>
            )}
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

              <div className="max-h-[min(42vh,28rem)] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
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
                  <div className="flex justify-between gap-3 text-background/60"><span>{addingToOrder ? "Acréscimo" : "Subtotal"}</span><span>{formatCurrency(subtotal)}</span></div>
                  {!addingToOrder && fulfillment === "DELIVERY" && (
                    <>
                      <div className="flex justify-between gap-3 text-background/60"><span>Entrega</span><span>{selectedZone ? formatCurrency(deliveryFee) : "A calcular"}</span></div>
                      {selectedZone && (
                        <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-[10px] leading-4 text-background/65">
                          Pedido mínimo dos produtos: <strong className="text-background">{formatCurrency(deliveryMinimum)}</strong>
                          <span className="mt-0.5 block text-[9px] text-background/45">+ taxa de entrega {formatCurrency(deliveryFee)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="my-3 border-t border-background/10" />
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[.16em] text-background/45">{addingToOrder ? "Valor adicional" : "Total do pedido"}</p>
                      <p className="mt-0.5 font-display text-3xl tracking-tight">{formatCurrency(displayTotal)}</p>
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
                  disabled={submitting || items.length === 0 || (!storeOpen && !addingToOrder)}
                  onClick={submitOrder}
                  className="mt-4 h-13 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.28)] transition hover:brightness-105"
                >
                  {!storeOpen && !addingToOrder ? "Loja fechada" : submitting ? (addingToOrder ? "Adicionando..." : "Enviando pedido...") : addingToOrder ? `Adicionar ao pedido · ${formatCurrency(displayTotal)}` : `Confirmar pedido · ${formatCurrency(displayTotal)}`}
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
              disabled={submitting || items.length === 0 || (!storeOpen && !addingToOrder)}
              onClick={submitOrder}
              className="h-11 shrink-0 rounded-full px-5 text-xs font-black shadow-[0_8px_20px_hsl(var(--primary)/.2)]"
            >
              {!storeOpen && !addingToOrder ? "Loja fechada" : submitting ? (addingToOrder ? "Adicionando..." : "Enviando...") : addingToOrder ? "Adicionar ao pedido" : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

}
