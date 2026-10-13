/** Private activation decides input version; a browser tag never authorizes downgrade. */
export class GroupContractError extends Error {}
export function groupedContract(items: unknown, enabled: boolean): boolean {
  if (!Array.isArray(items) || items.length === 0) throw new GroupContractError("Items required");
  const isGroup = (item: unknown) =>
    item !== null &&
    typeof item === "object" &&
    (item as Record<string, unknown>)["selection_contract"] === "GROUP_ADDONS_V1";
  const anyGroup = items.some(isGroup);
  if ((enabled && !items.every(isGroup)) || (!enabled && anyGroup))
    throw new GroupContractError("Checkout input version not enabled");
  return anyGroup;
}
