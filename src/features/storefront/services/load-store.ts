import type { Addon, Category, Crust, Organization, OrganizationSettings, Product, ProductPrice, ProductSize } from "@/lib/domain/types";
import { fetchCommercialCatalog, type CommercialAddonGroup, type CommercialAvailability } from "./commercial-catalog";

export type ProductAddonLink = { product_id: string; addon_id: string; sort_order: number };

export type StoreData = {
  instanceId: string;
  storeDomain: string;
  addonGroups: CommercialAddonGroup[];
  availability: CommercialAvailability;
  organization: Organization;
  settings: OrganizationSettings;
  categories: Category[];
  sizes: ProductSize[];
  products: Product[];
  prices: ProductPrice[];
  crusts: Crust[];
  addons: Addon[];
  productAddonLinks: ProductAddonLink[];
  hours: never[];
  specialHours: never[];
  deliveryZones: Array<{ id: string; organization_id: string; name: string; neighborhoods: string[]; minimum_order: number; delivery_fee: number; estimated_minutes: number | null; active: boolean }>;
};

type PublicStorefrontCatalog = {
  context: {
    domain: string; instance_id: string; instance_slug: string; instance_name: string;
    instance_status: string; organization_id: string; organization_name: string;
    system_id: string | null; system_slug: string | null; system_name: string | null; system_type: string | null;
  };
  categories: Array<{ id: string; name: string; slug: string; description?: string | null; image_url?: string | null; sort_order: number; active: boolean }>;
  products: Array<{ id: string; category_id: string | null; name: string; slug: string; description: string | null; image_url: string | null; price: number | null; active: boolean; sort_order: number; metadata: Record<string, unknown> }>;
  settings?: Partial<OrganizationSettings>;
  delivery_zones?: Array<{
    id: string; name: string; neighborhoods: string[]; minimum_order: number;
    delivery_fee: number; estimated_minutes: number | null; active: boolean;
  }>;
};

function getDomain() {
  if (typeof window === "undefined") throw new Error("Storefront domain is unavailable outside the browser.");
  return window.location.hostname.toLowerCase();
}

function toProduct(row: PublicStorefrontCatalog["products"][number], organizationId: string): Product {
  return {
    id: row.id, organization_id: organizationId, category_id: row.category_id, name: row.name,
    description: row.description, image_url: row.image_url,
    kind: (["SIMPLE", "PIZZA", "BURGER", "SIDE", "COMBO", "DRINK"].includes(String(row.metadata?.["kind"])) ? String(row.metadata?.["kind"]) : "SIMPLE") as Product["kind"],
    base_price: Number(row.price ?? 0), allow_half: row.metadata?.["allow_half"] === true, active: row.active,
    featured: row.metadata?.["featured"] === true, available: row.metadata?.["available"] !== false, sort_order: row.sort_order, metadata: row.metadata,
  };
}

function defaultSettings(organizationId: string): OrganizationSettings {
  return {
    organization_id: organizationId, description: null, whatsapp_phone: null,
    address_street: null, address_number: null, address_neighborhood: null, address_city: null, address_state: null, address_zip: null,
    logo_url: null, favicon_url: null, hero_image_url: null, hero_title: null, hero_subtitle: null, hero_cta_label: null,
    primary_color: "145 28% 32%", secondary_color: "42 35% 96%", font_family: "inherit", social_links: {},
    payment_methods: ["PIX"], delivery_enabled: true, pickup_enabled: true, pickup_instructions: null,
    min_order_amount: 0, estimated_delivery_minutes: 45, estimated_pickup_minutes: 20,
    half_pizza_pricing_rule: "highest_half", half_pizza_fixed_price: null, loyalty_points_per_currency: 0, scheduling_enabled: false,
  };
}

export async function loadStore(): Promise<StoreData> {
  const domain = getDomain();
  try {
    const validated = await fetchCommercialCatalog(window.location.origin);
    const catalog = validated.catalog as unknown as PublicStorefrontCatalog;
    const { context } = catalog;
    const organization: Organization = {
      id: context.organization_id, slug: context.instance_slug,
      name: context.organization_name || context.instance_name, active: true, demo_mode: false,
    };
    const categories: Category[] = catalog.categories.map((category) => ({
      id: category.id, organization_id: context.organization_id, name: category.name,
      description: category.description ?? null, image_url: category.image_url ?? null,
      sort_order: category.sort_order, active: category.active,
    }));
    const fallback = defaultSettings(context.organization_id);
    const settings: OrganizationSettings = {
      ...fallback,
      ...(catalog.settings ?? {}),
      organization_id: context.organization_id,
      payment_methods: (catalog.settings?.payment_methods as OrganizationSettings["payment_methods"] | undefined) ?? fallback.payment_methods,
      social_links: (catalog.settings?.social_links as Record<string, string> | undefined) ?? fallback.social_links,
    };
    const deliveryZones = (catalog.delivery_zones ?? []).map((zone) => ({
      id: zone.id,
      organization_id: context.organization_id,
      name: zone.name,
      neighborhoods: zone.neighborhoods ?? [],
      minimum_order: Number(zone.minimum_order ?? 0),
      delivery_fee: Number(zone.delivery_fee ?? 0),
      estimated_minutes: zone.estimated_minutes ?? null,
      active: zone.active,
    }));
    const products = catalog.products.map((product) => toProduct(product, context.organization_id));
    const pizzaRows = products.filter((product) => product.kind === "PIZZA");
    const optionRows = pizzaRows.flatMap((product) => {
      const options = Array.isArray(product.metadata?.["options"]) ? product.metadata["options"] : [];
      return options.map((option) => ({ product, option: option as Record<string, unknown> }));
    });
    const sizeChoices = (optionRows.find((row) => row.option["id"] === "tamanho")?.option["choices"] as Array<Record<string, unknown>> | undefined) ?? [];
    const sizes: ProductSize[] = sizeChoices.map((choice, index) => ({
      id: String(choice["id"]),
      organization_id: context.organization_id,
      name: String(choice["name"] ?? choice["id"]),
      slices: String(choice["name"] ?? "").match(/(\\d+)\\s*fatias/i)?.[1] ? Number(String(choice["name"]).match(/(\\d+)\\s*fatias/i)?.[1]) : null,
      sort_order: index,
      active: true,
    }));
    const prices: ProductPrice[] = pizzaRows.flatMap((product) => {
      const option = optionRows.find((row) => row.product.id === product.id && row.option["id"] === "tamanho")?.option;
      const choices = (option?.["choices"] as Array<Record<string, unknown>> | undefined) ?? [];
      return choices.map((choice) => ({
        id: `virtual-${product.id}-${String(choice["id"])}`,
        product_id: product.id,
        size_id: String(choice["id"]),
        price: Number(product.base_price) + Number(choice["price"] ?? 0),
      }));
    });
    const crustChoices = (optionRows.find((row) => row.option["id"] === "borda")?.option["choices"] as Array<Record<string, unknown>> | undefined) ?? [];
    const crusts: Crust[] = crustChoices.map((choice, index) => ({
      id: String(choice["id"]),
      organization_id: context.organization_id,
      name: String(choice["name"] ?? choice["id"]),
      price: Number(choice["price"] ?? 0),
      sort_order: index,
      active: true,
    }));
    const addons: Addon[] = validated.addonGroups.flatMap((group) => group.addons.map((addon) => ({
      id: addon.id,
      organization_id: context.organization_id,
      name: addon.name,
      price: addon.price_delta,
      sort_order: addon.sort_order,
      active: addon.active,
    })));
    return {
      instanceId: context.instance_id,
      storeDomain: context.domain,
      addonGroups: validated.addonGroups,
      availability: validated.availability,
      organization, settings, categories, products, sizes, prices, crusts, addons,
      productAddonLinks: validated.addonGroups.flatMap(group => group.products.flatMap(product => group.addons.map(addon => ({
        product_id: product.product_id,
        addon_id: addon.id,
        sort_order: addon.sort_order,
      })))),
      hours: [], specialHours: [], deliveryZones,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(`Falha inesperada ao carregar a loja ${domain}.`);
  }
}
