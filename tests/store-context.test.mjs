import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { storefrontLocalKey } from "../src/lib/domain/store-context.ts";

const a1 = "b0000000-0000-4000-8000-000000000001";
const a2 = "b0000000-0000-4000-8000-000000000002";

test("same-organization stores have different cart and tracking keys", () => {
  for (const kind of ["cart", "tracked-orders", "last-order"]) {
    assert.notEqual(storefrontLocalKey(kind, a1), storefrontLocalKey(kind, a2));
    assert.equal(storefrontLocalKey(kind, a1), storefrontLocalKey(kind, a1));
  }
});

test("missing store identity fails closed", () => {
  assert.throws(() => storefrontLocalKey("cart", ""), /instance_id/);
});

test("public catalog identity is passed through to checkout", () => {
  const compatibility = readFileSync("src/features/storefront/services/load-store.ts", "utf8");
  assert.match(
    compatibility,
    /export \{ loadStore \} from "@\/core\/delivery\/services\/load-public-store"/,
  );
  const load = readFileSync("src/core/delivery/services/load-public-store.ts", "utf8");
  const storefront = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
  const checkout = readFileSync("src/features/storefront/components/CheckoutPanel.tsx", "utf8");

  assert.match(load, /instanceId: context\.instance_id/);
  assert.match(load, /storeDomain: context\.domain/);
  assert.match(storefront, /instanceId=\{data\.instanceId\}/);
  assert.match(storefront, /storeDomain=\{data\.storeDomain\}/);
  assert.match(checkout, /instance_id: instanceId/);
  assert.match(checkout, /store_domain: storeDomain/);
  assert.match(storefront, /useLocalCart\(data\?\.instanceId\)/);
  assert.doesNotMatch(storefront, /tracked-orders:\$\{data\.organization\.id\}/);
});
