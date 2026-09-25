import { round2 } from "./money";
import type { HalfPizzaRule } from "./types";

export function calculateHalfPizzaBasePrice(
  firstPrice: number,
  secondPrice: number,
  rule: HalfPizzaRule,
  fixedPrice?: number | null,
): number {
  const a = Number(firstPrice) || 0;
  const b = Number(secondPrice) || 0;
  if (rule === "fixed_price" && fixedPrice != null) return round2(Number(fixedPrice));
  if (rule === "average_halves") return round2((a + b) / 2);
  return round2(Math.max(a, b));
}

export function calculateProductUnitPrice(input: {
  basePrice: number;
  secondBasePrice?: number;
  isHalf?: boolean;
  halfRule?: HalfPizzaRule;
  halfFixedPrice?: number | null;
  crustPrice?: number;
  addonPrices?: number[];
}): number {
  const base = input.isHalf
    ? calculateHalfPizzaBasePrice(
        input.basePrice,
        input.secondBasePrice ?? input.basePrice,
        input.halfRule ?? "highest_half",
        input.halfFixedPrice,
      )
    : Number(input.basePrice) || 0;

  const crust = Number(input.crustPrice) || 0;
  const addons = (input.addonPrices ?? []).reduce((sum, price) => sum + (Number(price) || 0), 0);
  return round2(base + crust + addons);
}

export function calculateCartSubtotal(
  items: Array<{ unitPrice: number; quantity: number }>,
): number {
  return round2(
    items.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * Math.max(1, item.quantity), 0),
  );
}
