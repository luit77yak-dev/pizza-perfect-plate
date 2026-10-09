import type { DeliveryTenantSettings } from "@/core/delivery/tenant";

/**
 * Storefront visual contract.
 *
 * This layer controls presentation only. Product/order/payment rules belong to
 * the Delivery Engine and must never be selected by a visual theme.
 *
 * All new fields are optional so existing tenant settings and built-in themes
 * remain compatible while the storefront is migrated component by component.
 */

export type StorefrontLayout = "grid" | "list" | "horizontal" | "accordion";
export type StorefrontHeader = "compact" | "banner" | "hero" | "background-image";
export type StorefrontCategoryNavigation = "tabs" | "accordion" | "horizontal-scroll" | "list";
export type StorefrontFooter = "minimal" | "complete" | "social" | "institutional";
export type StorefrontSectionId =
  | "hero"
  | "category-navigation"
  | "menu"
  | "about"
  | "delivery-info"
  | "testimonials"
  | "contact"
  | "footer";

export type StorefrontColorTokens = {
  /** CSS color value; consumers should apply it through CSS custom properties. */
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
};

export type StorefrontTypographyTokens = {
  fontFamily?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  baseFontSize?: string;
  headingWeight?: string | number;
};

export type StorefrontShapeTokens = {
  cardRadius?: string;
  buttonRadius?: string;
  controlRadius?: string;
  contentWidth?: string;
  sectionSpacing?: string;
  menuImageAspect?: "square" | "portrait" | "landscape";
};

export type StorefrontDesignTokens = StorefrontColorTokens &
  StorefrontTypographyTokens &
  StorefrontShapeTokens;

export interface StorefrontSectionConfig {
  /** Whether this section is rendered. Missing means use the selected theme default. */
  enabled?: boolean;
  /** Relative order among configurable sections. Missing means use the theme default. */
  order?: number;
}

export interface StorefrontContentConfig {
  brandName?: string;
  announcementText?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaLabel?: string;
  aboutEyebrow?: string;
  aboutTitle?: string;
  aboutText?: string;
  aboutImageUrl?: string;
  footerText?: string;
  /** Explicit image overrides. Empty values should be treated as absent. */
  logoUrl?: string;
  faviconUrl?: string;
  heroImageUrl?: string;
}

export interface StorefrontComponentConfig {
  header?: StorefrontHeader;
  menuLayout?: StorefrontLayout;
  categoryNavigation?: StorefrontCategoryNavigation;
  footer?: StorefrontFooter;
  /** Optional component-specific presentation switches; not business rules. */
  showSearch?: boolean;
  showProductCounts?: boolean;
  showFeaturedBadges?: boolean;
  showAboutSection?: boolean;
}

export interface StorefrontTheme {
  id: string;
  name: string;
  header: StorefrontHeader;
  menuLayout: StorefrontLayout;
  categoryNavigation: StorefrontCategoryNavigation;
  footer: StorefrontFooter;
  tokens: StorefrontDesignTokens;
  /** Default section visibility/order for this preset. */
  sections?: Partial<Record<StorefrontSectionId, StorefrontSectionConfig>>;
  /** Optional resolved presentation toggles; defaults preserve existing storefront behavior. */
  showSearch?: boolean;
  showProductCounts?: boolean;
  showFeaturedBadges?: boolean;
  showAboutSection?: boolean;
}

export interface StorefrontVisualOverrides {
  /** Schema version lets us evolve configuration without breaking old stores. */
  schemaVersion?: 1;
  /** Tenant-specific tokens override theme defaults. */
  tokens?: StorefrontDesignTokens;
  /** Component choices override the selected theme preset. */
  components?: StorefrontComponentConfig;
  /** Tenant-owned copy and media; never hardcode another store's brand here. */
  content?: StorefrontContentConfig;
  /** Visibility and ordering overrides for supported sections. */
  sections?: Partial<Record<StorefrontSectionId, StorefrontSectionConfig>>;
}

export interface StorefrontVisualConfig {
  themeId: string;
  theme: StorefrontTheme;
  settings: DeliveryTenantSettings;
  /** Optional until persisted visual overrides are wired into the storefront loader. */
  overrides?: StorefrontVisualOverrides;
}
