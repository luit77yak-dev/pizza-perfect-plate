import type { PublicCatalog } from "./services/public-catalog";
export type GroupSelection = {
  contract: "GROUP_ADDONS_V1";
  productId: string;
  addonIds: string[];
  quantity: number;
  sizeId?: string | null;
  crustId?: string | null;
  estimatedUnitPrice: number;
};
/** Catalog-bound UX validation. The database independently prices/snapshots the line. */
export function groupOrderLine(catalog: PublicCatalog, selection: GroupSelection) {
  const product = catalog.products.find((p) => p.id === selection.productId);
  if (
    selection.contract !== "GROUP_ADDONS_V1" ||
    !product ||
    !product.active ||
    product.metadata["available"] === false
  )
    throw new Error("Produto indisponível neste catálogo.");
  if (product.metadata["kind"] === "COMBO") throw new Error("Contrato de combo pendente.");
  if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 10)
    throw new Error("Quantidade inválida.");
  if (!Number.isFinite(selection.estimatedUnitPrice) || selection.estimatedUnitPrice < 0)
    throw new Error("Estimativa inválida.");
  if (new Set(selection.addonIds).size !== selection.addonIds.length)
    throw new Error("Adicional duplicado.");
  const groups = catalog.addon_groups.filter((g) =>
    g.products.some((p) => p.product_id === product.id),
  );
  for (const id of selection.addonIds) {
    if (!groups.some((g) => g.active && g.addons.some((a) => a.active && a.id === id)))
      throw new Error("Adicional não pertence ao produto.");
  }
  for (const group of groups) {
    const count = group.addons.filter((a) => selection.addonIds.includes(a.id)).length;
    if (
      (!group.active && (group.required || group.min_selections > 0)) ||
      count < Math.max(group.min_selections, group.required ? 1 : 0) ||
      count > group.max_selections
    )
      throw new Error(`Revise o grupo ${group.name}.`);
  }
  return {
    selection_contract: "GROUP_ADDONS_V1" as const,
    product_id: product.id,
    group_addon_ids: [...selection.addonIds],
    size_id: selection.sizeId ?? null,
    crust_id: selection.crustId ?? null,
    quantity: selection.quantity,
    expected_unit_price: selection.estimatedUnitPrice,
  };
}
