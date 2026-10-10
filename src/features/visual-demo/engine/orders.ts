import type { CartItem } from "@/lib/domain/types";
import type { DemoOrder, DemoState } from "../data/model";

/** Presentation-independent demo contracts. No storage, transport or brand styling. */
export type OrderStatus = DemoOrder["status"];
export const statusLabels: Record<OrderStatus, string> = {
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
export function orderFlow(fulfillment: DemoOrder["fulfillment"]): OrderStatus[] {
  return fulfillment === "Entrega"
    ? ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]
    : ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "DELIVERED"];
}
export function nextOrderStatus(order: DemoOrder): OrderStatus | null {
  const flow = orderFlow(order.fulfillment),
    index = flow.indexOf(order.status);
  return index < 0 ? null : (flow[index + 1] ?? null);
}
export function changeOrderStatus(state: DemoState, id: number, status: OrderStatus): DemoState {
  const order = state.orders.find((o) => o.id === id);
  if (!order || ["CANCELLED", "DELIVERED"].includes(order.status))
    throw Error("Pedido encerrado ou indisponível.");
  const cancelAllowed = status === "CANCELLED" && order.status !== "OUT_FOR_DELIVERY";
  if (!cancelAllowed && status !== nextOrderStatus(order))
    throw Error("Transição demonstrativa inválida.");
  return { ...state, orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)) };
}
const cents = (n: number) => Math.round(n * 100);
export function orderAmounts(items: { quantity: number; price: number }[], fee: number) {
  const subtotal = items.reduce((n, i) => n + cents(i.price) * i.quantity, 0);
  return { subtotal: subtotal / 100, fee: cents(fee) / 100, total: (subtotal + cents(fee)) / 100 };
}
export function cartAmounts(items: CartItem[], fee: number) {
  return orderAmounts(
    items.map((i) => ({ quantity: i.quantity, price: i.unitPrice })),
    fee,
  );
}
export const exampleCustomer = {
  name: "Visitante fictício",
  phone: "(00) 00000-0000",
  zip: "00000-000",
  street: "Rua da Demonstração",
  number: "123",
  complement: "Casa de exemplo",
  reference: "Ao lado da praça fictícia",
  notes: "Pedido de exemplo, sem envio real.",
} as const;
export type CheckoutDraft = { fulfillment: "Entrega" | "Retirada"; zoneId: string } & {
  [K in keyof typeof exampleCustomer]: string;
};
export function exampleDraft(
  fulfillment: CheckoutDraft["fulfillment"] = "Retirada",
  zoneId = "",
): CheckoutDraft {
  return { ...exampleCustomer, fulfillment, zoneId };
}
export function validateService(
  draft: CheckoutDraft,
  state: DemoState,
): Partial<Record<keyof CheckoutDraft, string>> {
  const errors: Partial<Record<keyof CheckoutDraft, string>> = {};
  if (!draft.name.trim()) errors.name = "Informe um nome de exemplo.";
  if (draft.phone.replace(/\D/g, "").length < 10)
    errors.phone = "Informe um telefone fictício com DDD.";
  if (draft.fulfillment === "Entrega") {
    if (!state.store.delivery) errors.fulfillment = "Entrega indisponível.";
    if (!draft.street.trim()) errors.street = "Informe a rua fictícia.";
    if (!draft.number.trim()) errors.number = "Informe o número fictício.";
    if (!state.zones.some((z) => z.id === draft.zoneId))
      errors.zoneId = "Escolha uma região atendida.";
    if (draft.zip && !/^\d{5}-?\d{3}$/.test(draft.zip))
      errors.zip = "Use um CEP fictício com 8 dígitos.";
  } else if (!state.store.pickup) errors.fulfillment = "Retirada indisponível.";
  return errors;
}
export function cartDetails(i: CartItem & { demoDetails?: string[] }): string[] {
  if (i.demoDetails)
    return [
      i.isHalf ? `Meio a meio: ${i.productName} / ${i.secondProductName}` : null,
      ...i.demoDetails,
    ].filter((v): v is string => Boolean(v));
  return [
    i.isHalf ? `Meio a meio: ${i.productName} / ${i.secondProductName}` : null,
    i.sizeName,
    i.crustName ? `Borda: ${i.crustName}` : null,
    ...i.addons.map((a) => a.name),
    ...i.complements.map((c) => `Combo: ${c.productName}`),
  ].filter((v): v is string => Boolean(v));
}
export type CheckoutSnapshot = ReturnType<typeof cartAmounts> & {
  generation: string;
  fulfillment: CheckoutDraft["fulfillment"];
  zoneId: string | null;
};
export function checkoutSnapshot(
  state: DemoState,
  items: CartItem[],
  draft: CheckoutDraft,
): CheckoutSnapshot {
  const fee =
    draft.fulfillment === "Entrega"
      ? (state.zones.find((z) => z.id === draft.zoneId)?.fee ?? 0)
      : 0;
  return {
    ...cartAmounts(items, fee),
    generation: state.generation,
    fulfillment: draft.fulfillment,
    zoneId: draft.fulfillment === "Entrega" ? draft.zoneId : null,
  };
}
