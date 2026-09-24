/**
 * Tipos de dominio do sistema. Nenhum dado especifico de pizzaria aqui —
 * tudo vem do banco (multi-tenant por organization_id).
 */

export type AppRole = "OWNER" | "ADMIN" | "ATTENDANT" | "KITCHEN" | "DRIVER" | "CUSTOMER";

export type OrderStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type CouponType = "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
export type FulfillmentType = "DELIVERY" | "PICKUP";
export type PaymentMethod = "CASH" | "PIX" | "CARD_ON_DELIVERY" | "CARD_ON_SITE";
export type ProductKind = "PIZZA" | "SIMPLE";
export type HalfPizzaRule = "highest_half" | "average_halves" | "fixed_price";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  demo_mode: boolean;
}

export interface OrganizationSettings {
  organization_id: string;
  description: string | null;
  whatsapp_phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_cta_label: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  social_links: Record<string, string>;
  payment_methods: PaymentMethod[];
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  min_order_amount: number;
  estimated_delivery_minutes: number;
  estimated_pickup_minutes: number;
  half_pizza_pricing_rule: HalfPizzaRule;
  half_pizza_fixed_price: number | null;
  loyalty_points_per_currency: number;
  scheduling_enabled: boolean;
}

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

export interface ProductSize {
  id: string;
  organization_id: string;
  name: string;
  slices: number | null;
  sort_order: number;
  active: boolean;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  size_id: string;
  price: number;
}

export interface Product {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  kind: ProductKind;
  base_price: number;
  allow_half: boolean;
  active: boolean;
  featured: boolean;
  available: boolean;
  sort_order: number;
  prices?: ProductPrice[];
}

export interface Crust {
  id: string;
  organization_id: string;
  name: string;
  price: number;
  sort_order: number;
  active: boolean;
}

export interface Addon {
  id: string;
  organization_id: string;
  name: string;
  price: number;
  sort_order: number;
  active: boolean;
}

export interface DeliveryZone {
  id: string;
  organization_id: string;
  name: string;
  neighborhoods: string[];
  minimum_order: number;
  delivery_fee: number;
  estimated_minutes: number | null;
  active: boolean;
}

export interface StoreHour {
  id: string;
  organization_id: string;
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  closed: boolean;
}

export interface SpecialHour {
  id: string;
  organization_id: string;
  date: string;
  opens_at: string | null;
  closes_at: string | null;
  closed: boolean;
  note: string | null;
}

export interface Coupon {
  id: string;
  organization_id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

/** Item do carrinho — o mesmo formato usado pelo checkout e por pedidos manuais. */
export interface CartItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  /** id local do item no carrinho */
  lineId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  secondProductId: string | null;
  secondProductName: string | null;
  isHalf: boolean;
  sizeId: string | null;
  sizeName: string | null;
  crustId: string | null;
  crustName: string | null;
  crustPrice: number;
  addons: CartItemAddon[];
  quantity: number;
  notes: string | null;
  /** preco unitario calculado (base + borda + adicionais) */
  unitPrice: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}
