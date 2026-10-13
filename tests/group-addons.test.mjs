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
