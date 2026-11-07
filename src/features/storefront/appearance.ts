export type StorefrontAppearance = "forno";

// Presentation only. Keys are catalog instance slugs, never a domain fallback.
// Add an establishment here only after its visual identity has been approved.
export const storefrontAppearances: Readonly<Record<string, StorefrontAppearance>> = {};

export function usesFornoAppearance(
  instanceSlug: string,
  hasBurgers: boolean,
  override?: StorefrontAppearance,
) {
  return !hasBurgers && (override ?? storefrontAppearances[instanceSlug]) === "forno";
}
