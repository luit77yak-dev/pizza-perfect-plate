/** Store-scoped browser keys. Never use organization_id as a store key. */
export function storefrontLocalKey(
  kind: "cart" | "tracked-orders" | "last-order",
  instanceId: string,
): string {
  if (!instanceId) throw new Error("A loja precisa ter instance_id.");
  const prefix = kind === "cart" ? "pizza-perfect-plate:cart" : `ppp:${kind}`;
  return `${prefix}:${instanceId}`;
}
