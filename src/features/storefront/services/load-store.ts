import type {
  Addon,
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
} from "@/lib/domain/types";
import { supabase } from "@/integrations/supabase/client";

export type ProductAddonLink = {
  product_id: string;
  addon_id: string;
  sort_order: number;
};

export type StoreData = {
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

function getCurrentHostname() {
  if (typeof window === "undefined") return null;
  return window.location.hostname.trim().toLowerCase().replace(/\.$/, "");
}

async function resolveOrganizationIdFromDomain() {
  const hostname = getCurrentHostname();
  if (!hostname) return null;

  const { data, error } = await supabase
    .from("organization_domains")
    .select("organization_id")
    .eq("domain", hostname)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    // Keep existing demo/slug behavior working if the domain mapping migration
    // has not been applied yet or the current hostname is not registered.
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }

  return data?.organization_id ?? null;
}

export async function loadStore(slug?: string): Promise<StoreData> {
  let organizationQuery = supabase
    .from("organizations")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (slug) {
    organizationQuery = organizationQuery.eq("demo_mode", false).eq("slug", slug);
  } else {
    const organizationId = await resolveOrganizationIdFromDomain();

    if (organizationId) {
      organizationQuery = organizationQuery.eq("id", organizationId);
    } else {
      organizationQuery = organizationQuery.eq("demo_mode", true);
    }
  }

  const { data: organization, error: organizationError } = await organizationQuery.maybeSingle();

  if (organizationError) throw organizationError;
  if (!organization) {
    throw new Error(
      slug
        ? "Nenhuma loja foi encontrada para este endereço."
        : "Nenhuma pizzaria de demonstração foi configurada.",
    );
  }

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
