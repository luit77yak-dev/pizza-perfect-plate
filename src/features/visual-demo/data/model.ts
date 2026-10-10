import { z } from "zod";
import {
  cartDetails,
  cartAmounts,
  exampleCustomer,
  validateService,
  orderAmounts,
} from "../engine/orders";
import type { CheckoutSnapshot } from "../engine/orders";
import { calculateHalfPizzaBasePrice } from "@/lib/domain/pricing";
import type { CartItem } from "@/lib/domain/types";

const id = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  .refine(
    (v) => !Object.prototype.hasOwnProperty.call(Object.prototype, v) && v !== "prototype",
    "Identificador reservado.",
  );
const name = z.string().trim().min(1).max(100);
const text = z.string().max(1000);
const money = z
  .number()
  .finite()
  .min(0)
  .max(9999)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001);
export const imageSchema = z
  .string()
  .max(280000)
  .refine(
    (s) => s === "" || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s),
    "Use imagem PNG, JPEG ou WebP local (até 200 KB).",
  );
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const optionSchema = z
  .object({
    id,
    name,
    description: text,
    price: money,
    image: imageSchema,
    active: z.boolean(),
    productId: id.nullable(),
    variantId: id.nullable(),
  })
  .strict();
export const groupSchema = z
  .object({
    id,
    name,
    kind: z.enum(["SIZE", "CRUST", "ADDON", "FLAVOR", "COMBO"]),
    active: z.boolean(),
    min: z.number().int().min(0).max(20),
    max: z.number().int().min(1).max(20),
    productIds: z.array(id).max(100),
    categoryIds: z.array(id).max(30),
    options: z.array(optionSchema).max(50),
  })
  .strict()
  .refine(
    (g) => g.min <= g.max && (!["SIZE", "CRUST", "FLAVOR"].includes(g.kind) || g.max === 1),
    "Limites incompatíveis com o tipo de grupo.",
  );
export const productSchema = z
  .object({
    id,
    name,
    description: text,
    price: money,
    image: imageSchema,
    categoryId: id,
    kind: z.enum(["PIZZA", "DRINK", "SIMPLE", "COMBO"]),
    active: z.boolean(),
    available: z.boolean(),
    allowHalf: z.boolean(),
    halfRule: z.enum(["highest_half", "average_halves", "fixed_price"]),
    halfFixedPrice: money,
    sort: z.number().int().min(0).max(999),
  })
  .strict();
const categorySchema = z
  .object({ id, name, active: z.boolean(), sort: z.number().int().min(0).max(999) })
  .strict();
const zoneSchema = z.object({ id, name, fee: money, eta: z.string().max(80) }).strict();
const storeSchema = z
  .object({
    name,
    description: text,
    contact: z.string().max(100),
    address: z.string().max(250),
    open: z.boolean(),
    delivery: z.boolean(),
    pickup: z.boolean(),
    hours: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            closed: z.boolean(),
          })
          .strict(),
      )
      .length(7),
    logo: imageSchema,
    banner: imageSchema,
    background: color,
    surface: color,
    foreground: color,
    accent: color,
  })
  .strict();
const itemSchema = z
  .object({
    name: z.string().min(1).max(1000),
    quantity: z.number().int().min(1).max(99),
    price: money,
    added: z.boolean().optional(),
    details: z.array(z.string().max(1000)).max(1000).optional(),
    image: imageSchema.optional(),
  })
  .strict();
const orderSchema = z
  .object({
    id: z.number().int().positive(),
    name,
    time: z.string().max(80),
    status: z.enum([
      "RECEIVED",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ]),
    payment: z.enum(["PAID", "PENDING"]),
    paidAmount: z.number().finite().min(0).max(1000000),
    fulfillment: z.enum(["Entrega", "Retirada"]),
    neighborhood: z.string().max(100),
    requestId: z.string().min(1).max(100).optional(),
    customerProfile: z.enum(["DELIVERY_EXAMPLE", "PICKUP_EXAMPLE"]).optional(),
    fee: money,
    items: z.array(itemSchema).min(1).max(100),
    updated: z.boolean(),
  })
  .strict()
  .refine(
    (o) =>
      o.paidAmount <= o.items.reduce((n, i) => n + i.price * i.quantity, o.fee) + 0.001 &&
      (o.payment !== "PAID" ||
        Math.abs(o.paidAmount - o.items.reduce((n, i) => n + i.price * i.quantity, o.fee)) < 0.001),
    "Pagamento inconsistente.",
  );
export const stateSchema = z
  .object({
    version: z.literal(4),
    generation: id,
    revision: z.string().max(100),
    store: storeSchema,
    categories: z.array(categorySchema).min(1).max(30),
    products: z.array(productSchema).max(100),
    groups: z.array(groupSchema).max(50),
    zones: z.array(zoneSchema).max(50),
    orders: z.array(orderSchema).max(200),
    notifications: z
      .array(
        z
          .object({
            id,
            key: z.string().max(160),
            message: z.string().max(250),
            read: z.boolean(),
            created: z.number().finite().nonnegative(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((s, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const luminance = (hex: string) => {
      const parts = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return parts[0]! * 0.2126 + parts[1]! * 0.7152 + parts[2]! * 0.0722;
    };
    const contrast = (a: string, b: string) => {
      const x = luminance(a),
        y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    if (
      [s.store.background, s.store.surface].some(
        (bg) => contrast(s.store.foreground, bg) < 4.5 || contrast(s.store.accent, bg) < 4.5,
      )
    )
      invalid("Texto e destaque precisam de contraste mínimo 4,5:1.");
    for (const list of [s.products, s.groups, s.categories, s.zones, s.orders, s.notifications])
      if (new Set(list.map((v) => v.id)).size !== list.length)
        invalid("Identificadores duplicados.");
    const optionIds = s.groups.flatMap((g) => g.options.map((o) => o.id));
    if (new Set(optionIds).size !== optionIds.length)
      invalid("Identificadores de opções devem ser únicos entre grupos.");
    for (const p of s.products) {
      if (
        s.groups.filter(
          (g) =>
            g.active &&
            g.kind === "FLAVOR" &&
            (g.productIds.includes(p.id) || g.categoryIds.includes(p.categoryId)),
        ).length > 1
      )
        invalid("Use um único grupo de sabores por produto.");
    }
    if (new Set(s.store.hours.map((h) => h.weekday)).size !== 7) invalid("Dias duplicados.");
    for (const p of s.products)
      if (!s.categories.some((c) => c.id === p.categoryId)) invalid("Categoria inexistente.");
    for (const g of s.groups) {
      if (new Set(g.options.map((o) => o.id)).size !== g.options.length)
        invalid("Opções duplicadas.");
      if (
        g.productIds.some((i) => !s.products.some((p) => p.id === i)) ||
        g.categoryIds.some((i) => !s.categories.some((c) => c.id === i))
      )
        invalid("Associação inexistente.");
      for (const o of g.options) {
        const p = s.products.find((p) => p.id === o.productId);
        if (o.productId && !p) invalid("Produto referenciado inexistente.");
        if (g.kind === "FLAVOR" && (!p || p.kind !== "PIZZA"))
          invalid("Sabor deve referenciar uma pizza.");
        if (g.kind === "COMBO" && (!p || p.kind !== "DRINK"))
          invalid("Combo deve referenciar uma bebida.");
        if (!["FLAVOR", "COMBO"].includes(g.kind) && (o.productId || o.variantId))
          invalid("Referência incompatível.");
        if (
          o.variantId &&
          (!p ||
            !s.groups.some(
              (v) =>
                v.kind === "SIZE" &&
                (v.productIds.includes(p.id) || v.categoryIds.includes(p.categoryId)) &&
                v.options.some((t) => t.id === o.variantId),
            ))
        )
          invalid("Volume inexistente.");
      }
    }
  });
export type DemoState = z.infer<typeof stateSchema>;
export type DemoProduct = z.infer<typeof productSchema>;
export type DemoGroup = z.infer<typeof groupSchema>;
export type DemoOption = z.infer<typeof optionSchema>;
export type DemoOrder = DemoState["orders"][number];
export type Selection = Record<string, string[]>;
export const LEGACY_STORAGE_KEY = "neroxa:visual-demo:forno:v2";
export const PREVIOUS_STORAGE_KEY = "neroxa:visual-demo:forno:v3";
export const STORAGE_KEY = "neroxa:visual-demo:forno:v4";
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function createInitialState(): DemoState {
  const product = (
    id: string,
    name: string,
    price: number,
    kind: DemoProduct["kind"],
  ): DemoProduct => ({
    id,
    name,
    description: "Produto fictício para demonstração",
    price,
    kind,
    categoryId: kind === "DRINK" ? "demo-drinks" : "demo-pizzas",
    active: true,
    available: true,
    image: "",
    allowHalf: kind === "PIZZA",
    halfRule: "highest_half",
    halfFixedPrice: 40,
    sort: 0,
  });
  const option = (
    id: string,
    name: string,
    price: number,
    productId: string | null = null,
  ): DemoOption => ({
    id,
    name,
    price,
    description: "",
    image: "",
    active: true,
    productId,
    variantId: null,
  });
  const group = (
    id: string,
    name: string,
    kind: DemoGroup["kind"],
    options: DemoOption[],
    min = 0,
  ): DemoGroup => ({
    id,
    name,
    kind,
    options,
    min,
    max: kind === "ADDON" ? 3 : 1,
    active: true,
    productIds: [],
    categoryIds: ["demo-pizzas"],
  });
  return stateSchema.parse({
    version: 4,
    generation: "initial",
    revision: "initial",
    store: {
      name: "Forno di Pietra",
      description: "Dados fictícios. Nenhum pedido será enviado.",
      contact: "Contato fictício: (00) 00000-0000",
      address: "Rua de Exemplo, 100 — Cidade fictícia",
      open: true,
      delivery: true,
      pickup: true,
      hours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens: "18:00",
        closes: "23:00",
        closed: false,
      })),
      logo: "",
      banner: "",
      background: "#101914",
      surface: "#18231b",
      foreground: "#f3ecdc",
      accent: "#dfbd6f",
    },
    categories: [
      { id: "demo-pizzas", name: "Pizzas", active: true, sort: 0 },
      { id: "demo-drinks", name: "Bebidas", active: true, sort: 1 },
    ],
    products: [
      product("demo-margherita", "Margherita", 40, "PIZZA"),
      product("demo-marinara", "Marinara", 35, "PIZZA"),
      product("demo-water", "Água", 5, "DRINK"),
    ],
    groups: [
      group("demo-size", "Tamanho", "SIZE", [option("demo-medium", "Média · 6 fatias", 0)], 1),
      group("demo-crust", "Bordas", "CRUST", [option("demo-crust-option", "Borda fictícia", 5)]),
      group("demo-addon", "Complementos", "ADDON", [option("demo-basil", "Manjericão extra", 2)]),
      group("demo-flavors", "Meio a meio", "FLAVOR", [
        option("demo-flavor-margherita", "Margherita", 0, "demo-margherita"),
        option("demo-flavor-marinara", "Marinara", 0, "demo-marinara"),
      ]),
      group("demo-combo", "Bebida no combo", "COMBO", [
        option("demo-combo-water", "Água", 0, "demo-water"),
      ]),
      {
        ...group(
          "demo-volumes",
          "Volume",
          "SIZE",
          [
            option("demo-can", "Lata", 0),
            option("demo-600", "600 ml", 2),
            option("demo-2l", "2 L", 6),
          ],
          1,
        ),
        categoryIds: ["demo-drinks"],
      },
    ],
    zones: [
      { id: "demo-centro", name: "Centro", fee: 6, eta: "20–30 min" },
      { id: "demo-jardim", name: "Jardim América", fee: 9, eta: "30–40 min" },
      { id: "demo-sul", name: "Setor Sul", fee: 12, eta: "40–50 min" },
    ],
    orders: [
      {
        id: 1042,
        name: "Mariana Costa",
        time: "19:42",
        status: "PREPARING",
        payment: "PAID",
        paidAmount: 63.9,
        fulfillment: "Entrega",
        neighborhood: "Centro",
        fee: 6,
        items: [
          { name: "Pizza Margherita", quantity: 1, price: 49.9 },
          { name: "Refrigerante", quantity: 1, price: 8 },
        ],
        updated: false,
      },
      {
        id: 1043,
        name: "Rafael Lima",
        time: "19:49",
        status: "RECEIVED",
        payment: "PENDING",
        paidAmount: 0,
        fulfillment: "Retirada",
        neighborhood: "—",
        fee: 0,
        items: [{ name: "Pizza Quatro Queijos", quantity: 2, price: 56 }],
        updated: false,
      },
      {
        id: 1044,
        name: "Beatriz Alves",
        time: "19:54",
        status: "CONFIRMED",
        payment: "PAID",
        paidAmount: 61,
        fulfillment: "Entrega",
        neighborhood: "Jardim América",
        fee: 9,
        items: [{ name: "Pizza Calabresa", quantity: 1, price: 52 }],
        updated: false,
      },
    ],
    notifications: [],
  });
}
export function recoverState(raw: string | null): {
  state: DemoState;
  recovered: boolean;
  migrated?: boolean;
} {
  if (raw === null) return { state: createInitialState(), recovered: false };
  try {
    if (raw.length > 2200000) throw Error("size");
    const value = JSON.parse(raw);
    if (value?.version === 2 || value?.version === 3)
      return {
        state: stateSchema.parse({ ...value, version: 4 }),
        recovered: false,
        migrated: true,
      };
    return { state: stateSchema.parse(value), recovered: false };
  } catch {
    return { state: createInitialState(), recovered: true };
  }
}
export function isAvailable(s: DemoState, p: DemoProduct): boolean {
  return p.active && p.available && s.categories.some((c) => c.id === p.categoryId && c.active);
}
export function groupsFor(s: DemoState, p: DemoProduct): DemoGroup[] {
  return s.groups.filter(
    (g) =>
      g.active &&
      (g.productIds.includes(p.id) || g.categoryIds.includes(p.categoryId)) &&
      (g.kind !== "FLAVOR" || (p.kind === "PIZZA" && p.allowHalf)),
  );
}
export function optionAvailable(s: DemoState, g: DemoGroup, o: DemoOption): boolean {
  if (!o.active) return false;
  if (!o.productId) return true;
  const p = s.products.find((p) => p.id === o.productId);
  if (!p || !isAvailable(s, p)) return false;
  return (
    !o.variantId ||
    s.groups.some(
      (v) =>
        v.active &&
        v.kind === "SIZE" &&
        (v.productIds.includes(p.id) || v.categoryIds.includes(p.categoryId)) &&
        v.options.some((t) => t.id === o.variantId && t.active),
    )
  );
}
/** Only fill an empty, required, single-choice group with exactly one available option. */
export function initialDemoSelection(
  s: DemoState,
  productId: string,
  previous: Selection = {},
): Selection {
  const p = s.products.find((p) => p.id === productId);
  const selection = { ...previous };
  if (!p || !isAvailable(s, p)) return selection;
  for (const g of groupsFor(s, p)) {
    const available = g.options.filter((o) => optionAvailable(s, g, o));
    if (g.min === 1 && g.max === 1 && !selection[g.id]?.length && available.length === 1)
      selection[g.id] = [available[0]!.id];
  }
  return selection;
}
export function quote(
  s: DemoState,
  productId: string,
  selection: Selection,
  quantity = 1,
): { price: number; product: DemoProduct; labels: string[] } {
  const p = s.products.find((p) => p.id === productId);
  if (!p || !isAvailable(s, p)) throw Error("Produto indisponível.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw Error("Quantidade inválida.");
  const groups = groupsFor(s, p);
  if (Object.keys(selection).some((id) => !groups.some((g) => g.id === id)))
    throw Error("Grupo indisponível.");
  let base = p.price,
    extras = 0;
  const labels: string[] = [];
  for (const g of groups) {
    const ids = selection[g.id] ?? [];
    if (!Array.isArray(ids)) throw Error("Seleção inválida.");
    if (new Set(ids).size !== ids.length || ids.length < g.min || ids.length > g.max)
      throw Error(`${g.name}: selecione de ${g.min} a ${g.max}.`);
    for (const id of ids) {
      const o = g.options.find((o) => o.id === id);
      if (!o || !optionAvailable(s, g, o)) throw Error("Opção indisponível.");
      labels.push(`${g.name}: ${o.name}`);
      if (g.kind === "FLAVOR") {
        const second = s.products.find((v) => v.id === o.productId)!;
        base = calculateHalfPizzaBasePrice(p.price, second.price, p.halfRule, p.halfFixedPrice);
      } else if (g.kind === "COMBO") {
        const drink = s.products.find((v) => v.id === o.productId)!;
        const volume = s.groups.flatMap((g) => g.options).find((v) => v.id === o.variantId);
        extras += drink.price + (volume?.price ?? 0);
        labels.push([drink.name, volume?.name].filter(Boolean).join(" · "));
      } else extras += o.price;
    }
  }
  const price = round(base + extras);
  if (price > 9999) throw Error("Valor fora do limite demonstrativo.");
  return { price, product: p, labels };
}
function optionCost(s: DemoState, p: DemoProduct, g: DemoGroup, o: DemoOption): number {
  if (g.kind === "FLAVOR") {
    const second = s.products.find((v) => v.id === o.productId)!;
    return (
      calculateHalfPizzaBasePrice(p.price, second.price, p.halfRule, p.halfFixedPrice) - p.price
    );
  }
  if (g.kind === "COMBO") {
    const drink = s.products.find((v) => v.id === o.productId)!;
    return (
      drink.price +
      (s.groups.flatMap((g) => g.options).find((v) => v.id === o.variantId)?.price ?? 0)
    );
  }
  return o.price;
}
export function minimumPrice(s: DemoState, p: DemoProduct): number {
  const selection: Selection = {};
  for (const g of groupsFor(s, p)) {
    const opts = g.options
      .filter((o) => optionAvailable(s, g, o))
      .sort((a, b) => optionCost(s, p, g, a) - optionCost(s, p, g, b));
    selection[g.id] = opts.slice(0, g.min).map((o) => o.id);
  }
  try {
    return quote(s, p.id, selection).price;
  } catch {
    return p.price;
  }
}
export function makeCartItem(
  s: DemoState,
  productId: string,
  selection: Selection,
  quantity: number,
  notes: string,
): CartItem & { demoDetails: string[] } {
  const q = quote(s, productId, selection, quantity);
  const chosen = groupsFor(s, q.product).flatMap((g) =>
    (selection[g.id] ?? []).map((id) => ({
      group: g,
      option: g.options.find((o) => o.id === id)!,
    })),
  );
  const size = chosen.find((c) => c.group.kind === "SIZE")?.option;
  const crust = chosen.find((c) => c.group.kind === "CRUST")?.option;
  const flavor = chosen.find((c) => c.group.kind === "FLAVOR")?.option;
  const second = s.products.find((p) => p.id === flavor?.productId);
  return {
    lineId: crypto.randomUUID(),
    demoDetails: q.labels,
    productId,
    productName: q.product.name,
    imageUrl: q.product.image || null,
    secondProductId: second?.id ?? null,
    secondProductName: second?.name ?? null,
    isHalf: Boolean(second),
    sizeId: size?.id ?? null,
    sizeName: size?.name ?? null,
    crustId: crust?.id ?? null,
    crustName: crust?.name ?? null,
    crustPrice: crust?.price ?? 0,
    addons: chosen
      .filter((c) => c.group.kind === "ADDON")
      .map((c) => ({ id: c.option.id, name: c.option.name, price: c.option.price })),
    complements: chosen
      .filter((c) => c.group.kind === "COMBO")
      .map((c) => {
        const drink = s.products.find((p) => p.id === c.option.productId)!;
        return {
          productId: drink.id,
          productName: drink.name,
          imageUrl: drink.image || null,
          price: optionCost(s, q.product, c.group, c.option),
        };
      }),
    quantity,
    notes: [...q.labels, notes.trim().slice(0, 250)].filter(Boolean).join(" · ") || null,
    unitPrice: q.price,
  };
}
export function catalogToken(s: DemoState): string {
  return JSON.stringify([s.generation, s.products, s.groups, s.categories]);
}
export function removeProduct(s: DemoState, id: string): DemoState {
  return {
    ...s,
    products: s.products.filter((p) => p.id !== id),
    groups: s.groups.map((g) => ({
      ...g,
      productIds: g.productIds.filter((p) => p !== id),
      options: g.options.filter((o) => o.productId !== id),
    })),
  };
}
export function removeGroup(s: DemoState, id: string): DemoState {
  const removed = new Set(s.groups.find((g) => g.id === id)?.options.map((o) => o.id));
  return {
    ...s,
    groups: s.groups
      .filter((g) => g.id !== id)
      .map((g) => ({
        ...g,
        options: g.options.map((o) =>
          removed.has(o.variantId ?? "") ? { ...o, variantId: null } : o,
        ),
      })),
  };
}
export function notifyState(s: DemoState, key: string, message: string): DemoState {
  const now = Date.now();
  return {
    ...s,
    notifications: [
      { id: crypto.randomUUID(), key, message, read: false, created: now },
      ...s.notifications.filter((n) => n.key !== key && now - n.created < 86400000),
    ].slice(0, 20),
  };
}
export function submitDemoOrder(
  s: DemoState,
  items: CartItem[],
  token: string,
  fulfillment: "Entrega" | "Retirada",
  zoneId: string | null,
  expected?: CheckoutSnapshot,
): DemoState {
  if (!s.store.open || !items.length || catalogToken(s) !== token)
    throw Error("Revise o carrinho: a loja ou o catálogo mudou.");
  if (!expected?.service || !expected.requestId || expected.requestId.length > 100)
    throw Error("Revise os dados de atendimento e a confirmação.");
  const serviceErrors = validateService(expected.service, s);
  if (Object.keys(serviceErrors).length) throw Error(Object.values(serviceErrors)[0]);
  if (
    expected.service.fulfillment !== fulfillment ||
    (fulfillment === "Entrega" && expected.service.zoneId !== zoneId) ||
    expected.generation !== s.generation ||
    expected.requestId !== items[0]?.lineId
  )
    throw Error("Dados de atendimento ou demonstração alterados. Revise a confirmação.");
  const existing = s.orders.find((o) => o.requestId === expected.requestId);
  if (existing) {
    if (
      existing.fulfillment !== fulfillment ||
      orderAmounts(existing.items, existing.fee).total !== expected.total ||
      JSON.stringify(existing.items.map((i) => [i.name, i.quantity, i.price])) !==
        JSON.stringify(items.map((i) => [i.productName, i.quantity, i.unitPrice]))
    )
      throw Error("Esta confirmação já foi usada para outro conteúdo. Revise o pedido recente.");
    return s;
  }
  if (
    (fulfillment === "Entrega" && !s.store.delivery) ||
    (fulfillment === "Retirada" && !s.store.pickup)
  )
    throw Error("Modalidade indisponível.");
  const zone = s.zones.find((z) => z.id === zoneId);
  if (fulfillment === "Entrega" && !zone) throw Error("Escolha um bairro.");
  if (
    items.length > 100 ||
    items.some(
      (i) =>
        !s.products.some((p) => p.id === i.productId && isAvailable(s, p)) ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 99 ||
        !Number.isFinite(i.unitPrice) ||
        i.unitPrice < 0 ||
        i.unitPrice > 9999,
    )
  )
    throw Error("Carrinho demonstrativo inválido.");
  const amounts = cartAmounts(items, fulfillment === "Entrega" ? zone!.fee : 0);
  if (
    expected &&
    (expected.generation !== s.generation ||
      expected.fulfillment !== fulfillment ||
      expected.zoneId !== (fulfillment === "Entrega" ? zoneId : null) ||
      expected.total !== amounts.total ||
      expected.fee !== amounts.fee ||
      expected.subtotal !== amounts.subtotal)
  )
    throw Error("Os valores ou a demonstração mudaram. Revise a confirmação.");
  const id = Math.max(1044, ...s.orders.map((o) => o.id)) + 1;
  const order: DemoOrder = {
    id,
    requestId: expected.requestId,
    name: exampleCustomer.name,
    customerProfile: fulfillment === "Entrega" ? "DELIVERY_EXAMPLE" : "PICKUP_EXAMPLE",
    time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    status: "RECEIVED",
    payment: "PENDING",
    paidAmount: 0,
    fulfillment,
    neighborhood: fulfillment === "Entrega" ? zone!.name : "—",
    fee: fulfillment === "Entrega" ? zone!.fee : 0,
    items: items.map((i) => ({
      name: i.productName,
      details: cartDetails(i),
      image: i.imageUrl ?? "",
      quantity: i.quantity,
      price: i.unitPrice,
    })),
    updated: false,
  };
  return notifyState(
    { ...s, orders: [order, ...s.orders].slice(0, 200) },
    `order:${id}`,
    `Pedido #${id} criado somente nesta demonstração.`,
  );
}

export function replaceGroup(s: DemoState, g: DemoGroup): DemoState {
  const removed = new Set(
    (s.groups.find((v) => v.id === g.id)?.options ?? [])
      .filter((o) => !g.options.some((v) => v.id === o.id))
      .map((o) => o.id),
  );
  const groups = s.groups.some((v) => v.id === g.id)
    ? s.groups.map((v) => (v.id === g.id ? g : v))
    : [...s.groups, g];
  return {
    ...s,
    groups: groups.map((v) => ({
      ...v,
      options: v.options.map((o) =>
        removed.has(o.variantId ?? "") ? { ...o, variantId: null } : o,
      ),
    })),
  };
}
export function appendDemoItem(
  s: DemoState,
  id: number,
  item: DemoOrder["items"][number],
): DemoState {
  const order = s.orders.find((o) => o.id === id);
  if (!order || ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(order.status))
    throw Error("Alteração bloqueada: o pedido já saiu para entrega ou foi entregue.");
  if (order.items.length >= 100) throw Error("Limite demonstrativo de itens atingido.");
  return {
    ...s,
    orders: s.orders.map((o) =>
      o.id === id
        ? {
            ...o,
            items: [...o.items, { ...item, added: true }],
            payment: "PENDING" as const,
            updated: true,
          }
        : o,
    ),
  };
}
