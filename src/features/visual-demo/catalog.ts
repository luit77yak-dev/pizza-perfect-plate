import type { OrganizationSettings } from "@/lib/domain/types";

export const DEMO_ORGANIZATION_ID = "demo-forno-organization";
export function defaultSettings(organizationId: string): OrganizationSettings {
  return {
    organization_id: organizationId,
    description: null,
    whatsapp_phone: null,
    address_street: null,
    address_number: null,
    address_neighborhood: null,
    address_city: null,
    address_state: null,
    address_zip: null,
    logo_url: null,
    favicon_url: null,
    hero_image_url: null,
    hero_title: null,
    hero_subtitle: null,
    hero_cta_label: null,
    primary_color: "145 28% 32%",
    secondary_color: "42 35% 96%",
    font_family: "inherit",
    social_links: {},
    payment_methods: [],
    delivery_enabled: true,
    pickup_enabled: true,
    pickup_instructions: null,
    min_order_amount: 0,
    estimated_delivery_minutes: 45,
    estimated_pickup_minutes: 20,
    half_pizza_pricing_rule: "highest_half",
    half_pizza_fixed_price: null,
    loyalty_points_per_currency: 0,
    scheduling_enabled: false,
  };
}
