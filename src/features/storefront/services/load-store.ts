import type { Category, Organization, OrganizationSettings, Product } from "@/lib/domain/types";
import { supabase } from "@/integrations/supabase/client";

export type ProductAddonLink = { product_id: string; addon_id: string; sort_order: number };

export type StoreData = {
  organization: Organization;
  settings: OrganizationSettings;
  categories: Category[];
  sizes: never[];
  products: Product[];
  prices: never[];
  crusts: never[];
  addons: never[];
  productAddonLinks: ProductAddonLink[];
  hours: never[];
  specialHours: never[];
  deliveryZones: never[];
};

type PublicStorefrontCatalog = {
  context: {
    domain: string; instance_id: string; instance_slug: string; instance_name: string;
    instance_status: string; organization_id: string; organization_name: string;
    system_id: string | null; system_slug: string | null; system_name: string | null; system_type: string | null;
  };
  categories: Array<{ id: string; name: string; slug: string; description?: string | null; image_url?: string | null; sort_order: number; active: boolean }>;
  products: Array<{ id: string; category_id: string | null; name: string; slug: string; description: string | null; image_url: string | null; price: number | null; active: boolean; sort_order: number; metadata: Record<string, unknown> }>;
};

function getDomain() {
  return window.location.hostname.replace(/\.$/, "").toLowerCase();
}

function toProduct(row: PublicStorefrontCatalog["products"][number], organizationId: string): Product {
  return {
    id: row.id,
    organization_id: organizationId,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    image_url: row.image_url,
    kind: row.metadata.kind === "SIMPLE" ? "SIMPLE" : "PIZZA",
    base_price: Number(row.price ?? 0),
    allow_half: row.metadata.allow_half === true,
    active: row.active,
    featured: row.metadata.featured === true,
    available: row.metadata.available !== false,
    sort_order: row.sort_order,
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
  const { data, error } = await supabase.rpc("get_public_storefront_catalog", { p_domain: domain });
  if (error) throw error;

  const catalog = data as PublicStorefrontCatalog | null;
  if (!catalog?.context?.instance_id) throw new Error(`Nenhuma loja ativa foi configurada para o domínio ${domain}.`);

  const { context } = catalog;
  const organization: Organization = {
    id: context.organization_id, slug: context.instance_slug,
    name: context.organization_name || context.instance_name, active: true, demo_mode: true,
  };

  const categories: Category[] = catalog.categories.map((category) => ({
    id: category.id, organization_id: context.organization_id, name: category.name,
    description: category.description ?? null, image_url: category.image_url ?? null,
    sort_order: category.sort_order, active: category.active,
  }));

  return {
    organization, settings: defaultSettings(context.organization_id), categories,
    products: catalog.products.map((product) => toProduct(product, context.organization_id)),
    sizes: [], prices: [], crusts: [], addons: [], productAddonLinks: [], hours: [], specialHours: [], deliveryZones: [],
  };
}
