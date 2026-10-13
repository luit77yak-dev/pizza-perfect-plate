import type { CartItem } from "@/lib/domain/types";
import type { PublicCatalog } from "./services/public-catalog";
import { groupOrderLine } from "./group-order-line.ts";
type LegacyLine = {
  product_id: string;
  second_product_id: string | null;
  is_half: boolean;
  size_id: string | null;
  crust_id: string | null;
  quantity: number;
  notes: string | null;
  addons: Array<{ id: string }>;
};
export type CartOrderLine =
  LegacyLine | (ReturnType<typeof groupOrderLine> & { notes: string | null });
/** One serializer for checkout and private append. Never infer an addon's entity type. */
export function cartOrderLines(
  items: CartItem[],
  catalog: PublicCatalog | null = null,
  recover = false,
) {
  return items.flatMap<CartOrderLine>((item) => {
    if (recover) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        item.selectionContract !== "GROUP_ADDONS_V1" ||
        !uuid.test(item.productId) ||
        !Array.isArray(item.groupAddonIds) ||
        item.groupAddonIds.some((id) => typeof id !== "string" || !uuid.test(id)) ||
        new Set(item.groupAddonIds).size !== item.groupAddonIds.length ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0 ||
        item.isHalf ||
        item.secondProductId ||
        item.complements?.length
      )
        throw new Error("Snapshot original inválido; solicite reconciliação segura.");
      return [
        {
          selection_contract: "GROUP_ADDONS_V1",
          product_id: item.productId,
          group_addon_ids: item.groupAddonIds,
          quantity: item.quantity,
          size_id: item.sizeId,
          crust_id: item.crustId,
          expected_unit_price: item.unitPrice,
          notes: item.notes,
        },
      ];
    }
    if (catalog || item.selectionContract === "GROUP_ADDONS_V1") {
      if (!catalog || item.selectionContract !== "GROUP_ADDONS_V1")
        throw new Error("Revise os itens antigos da sacola antes de usar o catálogo avançado.");
      if (item.isHalf || item.secondProductId || item.complements?.length)
        throw new Error("Contrato de meio-a-meio/combo ainda não homologado.");
      return [
        {
          ...groupOrderLine(catalog, {
            contract: item.selectionContract,
            productId: item.productId,
            addonIds: item.groupAddonIds ?? [],
            quantity: item.quantity,
            sizeId: item.sizeId,
            crustId: item.crustId,
            estimatedUnitPrice: item.unitPrice,
          }),
          notes: item.notes,
        },
      ];
    }
    return [
      {
        product_id: item.productId,
        second_product_id: item.secondProductId,
        is_half: item.isHalf,
        size_id: item.sizeId,
        crust_id: item.crustId,
        quantity: item.quantity,
        notes: item.notes,
        addons: item.addons.map((addon) => ({ id: addon.id })),
      },
      ...(item.complements ?? []).map((complement) => ({
        product_id: complement.productId,
        second_product_id: null,
        is_half: false,
        size_id: null,
        crust_id: null,
        quantity: 1,
        notes: "Complemento do pedido: " + item.productName,
        addons: [],
      })),
    ];
  });
}
