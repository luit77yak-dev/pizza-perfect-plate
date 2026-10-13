import type { CartItem } from "../../lib/domain/types";
import type { PublicCatalog } from "./services/public-catalog";
import { groupOrderLine } from "./group-order-line.ts";

/** Explicit review of estimates only. Checkout still requires PostgreSQL confirmation. */
export function reviewCartPrices(items: CartItem[], catalog: PublicCatalog, instanceId: string) {
  if (catalog.context.instance_id !== instanceId) throw new Error("Catálogo de outra loja.");
  return items.map((item) => {
    if (item.selectionContract !== "GROUP_ADDONS_V1")
      throw new Error("Remova ou personalize novamente os itens antigos.");
    // Validate selections before replacing any price. Never partially update the cart.
    groupOrderLine(catalog, {
      contract: item.selectionContract,
      productId: item.productId,
      addonIds: item.groupAddonIds ?? [],
      quantity: item.quantity,
      sizeId: item.sizeId,
      crustId: item.crustId,
      estimatedUnitPrice: item.unitPrice,
    });
    if (item.isHalf || item.secondProductId || item.complements.length)
      throw new Error("Personalização incompatível com este contrato.");
    const product = catalog.products.find((p) => p.id === item.productId)!;
    const options = Array.isArray(product.metadata["options"]) ? product.metadata["options"] : [];
    const choice = (type: string, id: string | null): Record<string, unknown> | undefined => {
      const option = options.find(
        (o: unknown) =>
          o !== null && typeof o === "object" && (o as Record<string, unknown>)["id"] === type,
      ) as Record<string, unknown> | undefined;
      return (Array.isArray(option?.["choices"]) ? option["choices"] : []).find(
        (c: Record<string, unknown>) => c["id"] === id,
      );
    };
    const size = choice("tamanho", item.sizeId),
      crust = choice("borda", item.crustId);
    const addons = (item.groupAddonIds ?? []).map((id) =>
      catalog.addon_groups.flatMap((g) => g.addons).find((a) => a.id === id)!,
    );
    const cents = (v: unknown) => {
      const n = Number(v);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        !Number.isSafeInteger(Math.round(n * 100)) ||
        Math.abs(n * 100 - Math.round(n * 100)) > 1e-7
      )
        throw new Error("Preço inválido; revise o catálogo.");
      return Math.round(n * 100);
    };
    const unitPrice =
      (cents(product.price) +
        cents(size?.["price"] ?? 0) +
        cents(crust?.["price"] ?? 0) +
        addons.reduce((sum, a) => sum + cents(a.price_delta), 0)) /
      100;
    return {
      ...item,
      productName: product.name,
      unitPrice,
      crustPrice: Number(crust?.["price"] ?? 0),
      sizeName: size ? String(size["name"] ?? item.sizeId) : null,
      crustName: crust ? String(crust["name"] ?? item.crustId) : null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price_delta })),
    };
  });
}
