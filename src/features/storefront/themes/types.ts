import type { DeliveryTenantSettings } from "@/core/delivery/tenant";

/**
 * Visual configuration only. Business rules/data must never be placed here.
 * New tenants can select/compose these values without changing the delivery engine.
 */
export type StorefrontLayout = "grid" | "list" | "horizontal" | "accordion";
export type StorefrontHeader = "compact" | "banner" | "hero" | "background-image";
export type StorefrontCategoryNavigation = "tabs" | "accordion" | "horizontal-scroll" | "list";
export type StorefrontFooter = "minimal" | "complete" | "social" | "institutional";

export interface StorefrontTheme {
  id: string;
  name: string;
  header: StorefrontHeader;
  menuLayout: StorefrontLayout;
  categoryNavigation: StorefrontCategoryNavigation;
  footer: StorefrontFooter;
  tokens: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    cardRadius?: string;
    menuImageAspect?: "square" | "portrait" | "landscape";
  };
}

export interface StorefrontVisualConfig {
  themeId: string;
  theme: StorefrontTheme;
  settings: DeliveryTenantSettings;
}
