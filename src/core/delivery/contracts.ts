/**
 * Neroxa Delivery Engine — stable business contract.
 *
 * This layer contains the capabilities shared by every delivery tenant.
 * It must not contain branding, layout, copy, colors or component choices.
 */

export const DELIVERY_ORDER_STATUSES = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type DeliveryOrderStatus = (typeof DELIVERY_ORDER_STATUSES)[number];

export const DELIVERY_FULFILLMENT_TYPES = ["DELIVERY", "PICKUP"] as const;
export type DeliveryFulfillment = (typeof DELIVERY_FULFILLMENT_TYPES)[number];

export const DELIVERY_PAYMENT_METHODS = [
  "CASH",
  "PIX",
  "CARD_ON_DELIVERY",
  "CARD_ON_PICKUP",
] as const;
export type DeliveryPaymentMethod = (typeof DELIVERY_PAYMENT_METHODS)[number];

export const DELIVERY_PRODUCT_KINDS = ["PIZZA", "BURGER", "SIMPLE"] as const;
export type DeliveryProductKind = (typeof DELIVERY_PRODUCT_KINDS)[number];

export interface DeliveryCapabilities {
  catalog: true;
  categories: true;
  productCustomization: true;
  cart: true;
  checkout: true;
  deliveryZones: true;
  coupons: true;
  orderTracking: true;
  customerAccount: true;
  whatsappHandoff: true;
  admin: true;
  audit: true;
}

/** The business capabilities of the platform are stable across tenants. */
export const DELIVERY_CAPABILITIES: DeliveryCapabilities = {
  catalog: true,
  categories: true,
  productCustomization: true,
  cart: true,
  checkout: true,
  deliveryZones: true,
  coupons: true,
  orderTracking: true,
  customerAccount: true,
  whatsappHandoff: true,
  admin: true,
  audit: true,
};

export type DeliveryEngine = {
  capabilities: DeliveryCapabilities;
};

export const deliveryEngine: DeliveryEngine = {
  capabilities: DELIVERY_CAPABILITIES,
};
