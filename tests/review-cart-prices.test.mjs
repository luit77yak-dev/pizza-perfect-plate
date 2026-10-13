import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewCartPrices } from "../src/core/delivery/review-cart-prices.ts";
const catalog = JSON.parse(
  readFileSync(new URL("homologation/catalog-a.json", import.meta.url), "utf8"),
);
const p = catalog.products.find((p) => p.name === "Produto ficticio A");
const a = catalog.addon_groups[0].addons.find((a) => a.price_delta === 2);
const item = {
  selectionContract: "GROUP_ADDONS_V1",
  groupAddonIds: [a.id],
  lineId: "fixture",
  productId: p.id,
  productName: p.name,
  isHalf: false,
  secondProductId: null,
  secondProductName: null,
  sizeId: "grande",
  sizeName: "Grande",
  crustId: null,
  crustName: null,
  crustPrice: 0,
  addons: [],
  complements: [],
  quantity: 2,
  unitPrice: 30,
  notes: null,
  imageUrl: null,
};
test("explicit price review updates exact estimates without mutating old cart", () => {
  const updated = structuredClone(catalog);
  updated.products.find((v) => v.id === p.id).price = 35;
  const result = reviewCartPrices([item], updated, catalog.context.instance_id);
  assert.equal(result[0].unitPrice, 47);
  assert.equal(result[0].quantity, 2);
  assert.equal(item.unitPrice, 30);
  assert.equal(result[0].addons[0].id, a.id);
});
test("review rejects another instance, unavailable selection and fractional cents", () => {
  assert.throws(() => reviewCartPrices([item], catalog, "another"));
  const updated = structuredClone(catalog);
  updated.addon_groups[0].addons.find((v) => v.id === a.id).active = false;
  assert.throws(() => reviewCartPrices([item], updated, catalog.context.instance_id));
  updated.addon_groups[0].addons.find((v) => v.id === a.id).active = true;
  updated.products.find((v) => v.id === p.id).price = 35.001;
  assert.throws(() => reviewCartPrices([item], updated, catalog.context.instance_id));
});
test("review refuses legacy identifiers and incomplete required groups", () => {
  assert.throws(() =>
    reviewCartPrices(
      [{ ...item, selectionContract: undefined }],
      catalog,
      catalog.context.instance_id,
    ),
  );
  assert.throws(() =>
    reviewCartPrices([{ ...item, groupAddonIds: [] }], catalog, catalog.context.instance_id),
  );
});
