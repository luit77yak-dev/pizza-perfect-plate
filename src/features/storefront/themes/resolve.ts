import type { Product } from "@/lib/domain/types";
import { getStorefrontTheme } from "./registry";

/** Selects presentation only. Delivery rules remain in the core engine. */
export function resolveStorefrontTheme(products: Product[]) {
  return getStorefrontTheme(products.some((product) => product.kind === "BURGER") ? "burger-club" : "neroxa-classic");
}
