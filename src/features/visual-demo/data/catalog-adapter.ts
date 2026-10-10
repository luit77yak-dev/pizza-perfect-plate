import { defaultSettings, DEMO_ORGANIZATION_ID } from "../catalog";
import type { DemoState } from "./model";
import type { CSSProperties } from "react";
import type { StoreData } from "@/features/storefront/services/load-store";
export function demoCatalog(s: DemoState): StoreData {
  const org = DEMO_ORGANIZATION_ID;
  return {
    organization: {
      id: org,
      slug: "demo-forno",
      name: s.store.name,
      active: true,
      demo_mode: true,
    },
    sizes: [],
    prices: [],
    crusts: [],
    addons: [],
    productAddonLinks: [],
    hours: [],
    specialHours: [],
    settings: {
      ...defaultSettings(org),
      hero_title: "Pizza que fica na memória.",
      hero_cta_label: "Explorar o cardápio",
      description: s.store.description,
      logo_url: s.store.logo || null,
      hero_image_url: s.store.banner || null,
      hero_subtitle: s.store.description,
      delivery_enabled: s.store.delivery,
      pickup_enabled: s.store.pickup,
    },
    categories: s.categories.map((c) => ({
      id: c.id,
      organization_id: org,
      name: c.name,
      description: null,
      image_url: null,
      active: c.active,
      sort_order: c.sort,
    })),
    products: s.products.map((p) => ({
      id: p.id,
      organization_id: org,
      category_id: p.categoryId,
      name: p.name,
      description: p.description,
      image_url: p.image || null,
      kind: p.kind,
      base_price: p.price,
      allow_half: p.allowHalf,
      active: p.active,
      available: p.available,
      featured: true,
      sort_order: p.sort,
    })),
    deliveryZones: s.zones.map((z) => ({
      id: z.id,
      organization_id: org,
      name: z.name,
      neighborhoods: [z.name],
      minimum_order: 0,
      delivery_fee: z.fee,
      estimated_minutes: 30,
      active: true,
    })),
  };
}
export function demoStyle(s: DemoState): CSSProperties {
  return {
    "--fp-bg": s.store.background,
    "--fp-card": s.store.surface,
    "--fp-text": s.store.foreground,
    "--fp-accent": s.store.accent,
    "--forno-bg": s.store.background,
    "--forno-surface": s.store.surface,
    "--forno-deep": s.store.background,
    "--forno-green": s.store.surface,
    "--forno-cream": s.store.foreground,
    "--forno-gold": s.store.accent,
  } as CSSProperties;
}
