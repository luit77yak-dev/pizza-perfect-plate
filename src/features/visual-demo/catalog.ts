import type { OrganizationSettings, Product } from "@/lib/domain/types";
import type { StoreData } from "@/features/storefront/services/load-store";

export const DEMO_ORGANIZATION_ID = "demo-forno-organization";
function defaultSettings(organizationId: string): OrganizationSettings {
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

export function createDemoCatalog(): StoreData {
  const id = DEMO_ORGANIZATION_ID;
  const product = (
    productId: string,
    name: string,
    kind: Product["kind"],
    price: number,
  ): Product => ({
    id: productId,
    organization_id: id,
    category_id: kind === "PIZZA" ? "demo-pizzas" : "demo-drinks",
    name,
    kind,
    base_price: price,
    description: "Produto fictício para demonstração",
    image_url: null,
    allow_half: kind === "PIZZA",
    active: true,
    featured: true,
    available: true,
    sort_order: 0,
  });
  return {
    organization: {
      id,
      slug: "demo-forno",
      name: "Forno di Pietra — Demonstração",
      active: true,
      demo_mode: true,
    },
    settings: {
      ...defaultSettings(id),
      hero_title: "Pizza que fica na memória.",
      hero_cta_label: "Explorar o cardápio",
      description: "Dados fictícios. Nenhum pedido será enviado.",
      payment_methods: [],
      whatsapp_phone: null,
      delivery_enabled: false,
      pickup_enabled: true,
    },
    categories: ["Pizzas", "Bebidas"].map((name, index) => ({
      id: index === 0 ? "demo-pizzas" : "demo-drinks",
      organization_id: id,
      name,
      description: "Categoria fictícia",
      image_url: null,
      sort_order: index,
      active: true,
    })),
    products: [
      product("demo-margherita", "Margherita", "PIZZA", 40),
      product("demo-marinara", "Marinara", "PIZZA", 35),
      product("demo-water", "Água", "SIMPLE", 5),
    ],
    sizes: [
      {
        id: "demo-size",
        organization_id: id,
        name: "Média",
        slices: 6,
        sort_order: 0,
        active: true,
      },
    ],
    prices: [
      { id: "demo-price-1", product_id: "demo-margherita", size_id: "demo-size", price: 40 },
      { id: "demo-price-2", product_id: "demo-marinara", size_id: "demo-size", price: 35 },
    ],
    crusts: [
      {
        id: "demo-crust",
        organization_id: id,
        name: "Borda fictícia",
        price: 5,
        sort_order: 0,
        active: true,
      },
    ],
    addons: [
      {
        id: "demo-addon",
        organization_id: id,
        name: "Manjericão extra",
        price: 2,
        sort_order: 0,
        active: true,
      },
    ],
    productAddonLinks: ["demo-margherita", "demo-marinara"].map((product_id) => ({
      product_id,
      addon_id: "demo-addon",
      sort_order: 0,
    })),
    hours: [],
    specialHours: [],
    deliveryZones: [],
  };
}
