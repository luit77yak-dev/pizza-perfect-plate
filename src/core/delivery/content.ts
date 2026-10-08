/** Stable platform copy/labels. Tenant-specific marketing copy belongs in organization settings. */
import type { DeliveryOrderStatus } from "./contracts";

export const DELIVERY_STATUS_LABELS: Record<DeliveryOrderStatus, string> = {
  RECEIVED: "Pedido recebido",
  CONFIRMED: "Pedido confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const DELIVERY_FULFILLMENT_LABELS = {
  DELIVERY: "Entrega",
  PICKUP: "Retirada no local",
} as const;

export const DELIVERY_PAYMENT_LABELS = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CARD_ON_DELIVERY: "Cartão na entrega",
  CARD_ON_PICKUP: "Cartão no local",
} as const;

export const DELIVERY_SYSTEM_SECTIONS = [
  "catalog",
  "categories",
  "customization",
  "cart",
  "checkout",
  "delivery",
  "orders",
  "customers",
  "coupons",
  "appearance",
  "settings",
  "audit",
] as const;
