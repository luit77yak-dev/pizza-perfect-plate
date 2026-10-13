import type { Product } from "@/lib/domain/types";
import type { StoreData } from "./services/load-public-store";
/** Presentation-only projection of this product's text option IDs, never other pizzas'. */
export function withProductOptions(data: StoreData, product: Product): StoreData {
  if (!data.groupCatalog) return data;
  const options = Array.isArray(product.metadata?.["options"]) ? product.metadata["options"] : [];
  const choices = (id: string): Array<Record<string, unknown>> => {
    const option = options.find(
      (o: unknown) =>
        o !== null && typeof o === "object" && (o as Record<string, unknown>)["id"] === id,
    ) as Record<string, unknown> | undefined;
    return Array.isArray(option?.["choices"])
      ? option["choices"].filter(
          (c: unknown): c is Record<string, unknown> =>
            c !== null &&
            typeof c === "object" &&
            !Array.isArray(c) &&
            (c as Record<string, unknown>)["active"] !== false &&
            (c as Record<string, unknown>)["available"] !== false,
        )
      : [];
  };
  const sizeChoices = choices("tamanho"),
    crustChoices = choices("borda");
  return {
    ...data,
    sizes: sizeChoices.map((c, i) => ({
      id: String(c["id"]),
      organization_id: data.organization.id,
      name: String(c["name"] ?? c["id"]),
      slices: null,
      sort_order: i,
      active: true,
    })),
    prices: sizeChoices.map((c) => ({
      id: `estimate-${product.id}-${String(c["id"])}`,
      product_id: product.id,
      size_id: String(c["id"]),
      price: Number(product.base_price) + Number(c["price"] ?? 0),
    })),
    crusts: crustChoices.map((c, i) => ({
      id: String(c["id"]),
      organization_id: data.organization.id,
      name: String(c["name"] ?? c["id"]),
      price: Number(c["price"] ?? 0),
      sort_order: i,
      active: true,
    })),
  };
}
