import type { StorefrontTheme } from "./types";

/**
 * Built-in themes are frontend-only. They consume the same Delivery Engine data.
 * Add visual variants here; do not fork delivery business logic per tenant.
 */
export const STOREFRONT_THEMES: Record<string, StorefrontTheme> = {
  "neroxa-classic": {
    id: "neroxa-classic",
    name: "Neroxa Classic",
    header: "compact",
    menuLayout: "grid",
    categoryNavigation: "tabs",
    footer: "complete",
    tokens: { primaryColor: "145 28% 32%", secondaryColor: "42 35% 96%", cardRadius: "1rem", menuImageAspect: "square" },
  },
  "neroxa-horizontal": {
    id: "neroxa-horizontal",
    name: "Neroxa Horizontal",
    header: "banner",
    menuLayout: "horizontal",
    categoryNavigation: "horizontal-scroll",
    footer: "minimal",
    tokens: { cardRadius: "1rem", menuImageAspect: "landscape" },
  },
  "burger-club": {
    id: "burger-club",
    name: "Burger Club",
    header: "hero",
    menuLayout: "grid",
    categoryNavigation: "horizontal-scroll",
    footer: "complete",
    tokens: { primaryColor: "30 10% 8%", secondaryColor: "42 35% 96%", cardRadius: "1rem", menuImageAspect: "square" },
  },
  "neroxa-accordion": {
    id: "neroxa-accordion",
    name: "Neroxa Accordion",
    header: "background-image",
    menuLayout: "list",
    categoryNavigation: "accordion",
    footer: "institutional",
    tokens: { cardRadius: "0.875rem", menuImageAspect: "portrait" },
  },
};

export function getStorefrontTheme(themeId?: string | null): StorefrontTheme {
  return STOREFRONT_THEMES[themeId ?? ""] ?? STOREFRONT_THEMES["neroxa-classic"];
}
