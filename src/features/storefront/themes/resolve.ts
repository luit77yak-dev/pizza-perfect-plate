import type { DeliveryTenantSettings } from "@/core/delivery/tenant";
import { getStorefrontTheme } from "./registry";
import type {
  StorefrontDesignTokens,
  StorefrontTheme,
  StorefrontVisualConfig,
  StorefrontVisualOverrides,
} from "./types";

/**
 * Resolves presentation from tenant configuration only.
 * Product kinds belong to the Delivery Engine and must never select a theme.
 */
export function resolveStorefrontTheme(themeId?: string | null): StorefrontTheme {
  return getStorefrontTheme(themeId);
}

/**
 * Combines a built-in preset with tenant-owned visual overrides.
 *
 * Precedence: built-in theme defaults < tenant settings < explicit visual
 * overrides. This is intentionally presentation-only; it must not receive or
 * mutate catalog, cart, checkout, pricing, order, or payment state.
 */
export function resolveStorefrontVisualConfig(
  themeId: string | null | undefined,
  settings: DeliveryTenantSettings,
  overrides?: StorefrontVisualOverrides,
): StorefrontVisualConfig {
  const theme = getStorefrontTheme(themeId);
  const tenantTokens: StorefrontDesignTokens = {
    primaryColor: settings.primary_color ?? undefined,
    secondaryColor: settings.secondary_color ?? undefined,
    fontFamily: settings.font_family ?? undefined,
  };
  const tokens: StorefrontDesignTokens = {
    ...theme.tokens,
    ...tenantTokens,
    ...(overrides?.tokens ?? {}),
  };
  const components = {
    header: theme.header,
    menuLayout: theme.menuLayout,
    categoryNavigation: theme.categoryNavigation,
    footer: theme.footer,
    ...(overrides?.components ?? {}),
  };
  const resolvedTheme: StorefrontTheme = {
    ...theme,
    header: components.header ?? theme.header,
    menuLayout: components.menuLayout ?? theme.menuLayout,
    categoryNavigation: components.categoryNavigation ?? theme.categoryNavigation,
    footer: components.footer ?? theme.footer,
    tokens,
    sections: {
      ...(theme.sections ?? {}),
      ...(overrides?.sections ?? {}),
    },
  };

  return {
    themeId: theme.id,
    theme: resolvedTheme,
    settings,
    overrides: {
      ...overrides,
      tokens,
      components,
      content: {
        logoUrl: settings.logo_url ?? undefined,
        faviconUrl: settings.favicon_url ?? undefined,
        heroImageUrl: settings.hero_image_url ?? undefined,
        heroTitle: settings.hero_title ?? undefined,
        heroSubtitle: settings.hero_subtitle ?? undefined,
        ...(overrides?.content ?? {}),
      },
    },
  };
}
