import assert from "node:assert/strict";
import { test } from "node:test";
import { groupOrderLine } from "../src/core/delivery/group-order-line.ts";
const catalog = {
  context: { instance_id: "A1", organization_id: "A", domain: "a.invalid" },
  products: [{ id: "product", active: true, metadata: {}, price: 30 }],
  addon_groups: [
    {
      id: "group",
      active: true,
      required: true,
      min_selections: 1,
      max_selections: 1,
      products: [{ product_id: "product" }],
      addons: [{ id: "addon", active: true, price_delta: 2 }],
    },
  ],
};
const selection = {
  contract: "GROUP_ADDONS_V1",
  productId: "product",
  addonIds: ["addon"],
  quantity: 1,
  estimatedUnitPrice: 32,
};
test("explicit addon identifiers never become product identifiers", () => {
  const line = groupOrderLine(catalog, selection);
  assert.deepEqual(line.group_addon_ids, ["addon"]);
  assert.equal(line.product_id, "product");
  assert.ok(!("addons" in line));
  assert.equal(line.expected_unit_price, 32);
});
test("required groups, duplicates, wrong-shop IDs and product IDs fail closed", () => {
  for (const ids of [[], ["addon", "addon"], ["other-shop"], ["product"]])
    assert.throws(() => groupOrderLine(catalog, { ...selection, addonIds: ids }));
});
test("quantity and availability denied before HTTP", () => {
  for (const quantity of [-1, 0, 11, 1.5])
    assert.throws(() => groupOrderLine(catalog, { ...selection, quantity }));
  assert.throws(() =>
    groupOrderLine(
      { ...catalog, products: [{ ...catalog.products[0], active: false }] },
      selection,
    ),
  );
});
test("combo contract stays blocked", () => {
  assert.throws(() =>
    groupOrderLine(
      { ...catalog, products: [{ ...catalog.products[0], metadata: { kind: "COMBO" } }] },
      selection,
    ),
  );
});

import { cartOrderLines } from "../src/core/delivery/cart-order-lines.ts";
import {
  handleCheckoutRequest,
  CheckoutPriceChangedError,
} from "../src/server/checkout-gateway.ts";
const cartItem = {
  lineId: "line",
  productId: "product",
  secondProductId: null,
  isHalf: false,
  sizeId: null,
  crustId: null,
  quantity: 1,
  notes: null,
  addons: [{ id: "addon", name: "Fictício", price: 2 }],
  complements: [],
  unitPrice: 32,
  selectionContract: "GROUP_ADDONS_V1",
  groupAddonIds: ["addon"],
};
test("checkout/append serializer keeps GROUP separate and denies legacy restoration in advanced mode", () => {
  const wire = cartOrderLines([cartItem], catalog)[0];
  assert.equal(wire.selection_contract, "GROUP_ADDONS_V1");
  assert.deepEqual(wire.group_addon_ids, ["addon"]);
  assert.ok(!("addons" in wire));
  assert.throws(() => cartOrderLines([{ ...cartItem, selectionContract: undefined }], catalog));
  assert.throws(() => cartOrderLines([cartItem], null));
  assert.throws(() => cartOrderLines([cartItem], { ...catalog, products: [] }));
});
test("per-product textual required options validated without casting UUIDs", () => {
  const rich = {
    ...catalog,
    products: [
      {
        ...catalog.products[0],
        metadata: {
          options: [
            {
              id: "tamanho",
              required: true,
              choices: [{ id: "grande", name: "Grande", price: 5 }],
            },
          ],
        },
      },
    ],
  };
  assert.throws(() => groupOrderLine(rich, selection));
  assert.equal(groupOrderLine(rich, { ...selection, sizeId: "grande" }).size_id, "grande");
  assert.throws(() => groupOrderLine(rich, { ...selection, sizeId: "invalid" }));
});
test("transactional stale-price error is HTTP409 with explicit review code", async () => {
  const id = "b0000000-0000-4000-8000-000000000001";
  const req = new Request("https://a.invalid/api/checkout", {
    method: "POST",
    headers: { origin: "https://a.invalid", "content-type": "application/json" },
    body: JSON.stringify({
      p_order: {
        idempotency_key: id,
        customer_name: "Cliente fictício",
        customer_phone: "00000000001",
        fulfillment: "PICKUP",
        items: [{ product_id: id, quantity: 1 }],
      },
    }),
  });
  const response = await handleCheckoutRequest(req, {
    enabled: true,
    resolveContext: async () => ({ domain: "a.invalid", instance_id: id, organization_id: id }),
    reserveQuota: async () => {},
    createOrder: async () => {
      throw new CheckoutPriceChangedError();
    },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "PRICE_CHANGED");
});

import { withProductOptions } from "../src/core/delivery/product-options.ts";
test("options projection uses only the selected product and excludes inactive choices", () => {
  const data = {
    groupCatalog: catalog,
    organization: { id: "A" },
    sizes: [{ id: "other-size" }],
    prices: [],
    crusts: [],
  };
  const product = {
    id: "product",
    base_price: 30,
    metadata: {
      options: [
        {
          id: "tamanho",
          choices: [
            { id: "local-size", name: "Local", price: 5 },
            { id: "inactive", active: false, price: 2 },
          ],
        },
        { id: "borda", choices: [{ id: "local-crust", name: "Local crust", price: 3 }] },
      ],
    },
  };
  const projected = withProductOptions(data, product);
  assert.deepEqual(
    projected.sizes.map((s) => s.id),
    ["local-size"],
  );
  assert.equal(projected.prices[0].price, 35);
  assert.equal(projected.crusts[0].price, 3);
  assert.equal(
    withProductOptions({ ...data, groupCatalog: null }, product).sizes[0].id,
    "other-size",
  );
});

import { groupedContract } from "../src/server/group-contract.ts";
test("private mode determines the protocol; caller cannot remove marker or mix formats", () => {
  assert.equal(groupedContract([{ selection_contract: "GROUP_ADDONS_V1" }], true), true);
  assert.equal(groupedContract([{ product_id: "legacy" }], false), false);
  assert.throws(() => groupedContract([{ product_id: "legacy" }], true));
  assert.throws(() => groupedContract([{ selection_contract: "GROUP_ADDONS_V1" }], false));
  assert.throws(() =>
    groupedContract([{ selection_contract: "GROUP_ADDONS_V1" }, { product_id: "legacy" }], true),
  );
});
