import { getStorefrontTheme } from "./registry";
import type { StorefrontTheme } from "./types";

/**
 * Resolves presentation from tenant configuration only.
 * Product kinds belong to the Delivery Engine and must never select a theme.
 */
export function resolveStorefrontTheme(themeId?: string | null): StorefrontTheme {
  return getStorefrontTheme(themeId);
}
