import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { storefrontLocalKey } from "../src/lib/domain/store-context.ts";

const a1 = "b0000000-0000-4000-8000-000000000001";
const a2 = "b0000000-0000-4000-8000-000000000002";

test("same-organization store instances never share cart or tracking keys", () => {
  for (const kind of ["cart", "tracked-orders", "last-order"]) {
    assert.notEqual(storefrontLocalKey(kind, a1), storefrontLocalKey(kind, a2));
    assert.equal(storefrontLocalKey(kind, a1), storefrontLocalKey(kind, a1));
  }
});

test("missing instance_id is refused", () => {
  assert.throws(() => storefrontLocalKey("cart", ""), /instance_id/);
});

test("loader propagates resolved instance and domain; cart remains keyed by store", () => {
  const loader = readFileSync("src/features/storefront/services/load-store.ts", "utf8");
  const storefront = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
  const cart = readFileSync("src/features/cart/hooks/use-local-cart.ts", "utf8");
  assert.match(loader, /instanceId:\s*context\.instance_id/);
  assert.match(loader, /storeDomain:\s*context\.domain/);
  assert.match(storefront, /useLocalCart\(data\?\.instanceId\)/);
  assert.match(cart, /storefrontLocalKey\("cart", instanceId\)/);
  assert.doesNotMatch(cart, /getItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(storefront, /tracked-orders:\$\{data\.organization\.id\}/);
  assert.match(storefront, /storefrontLocalKey\("tracked-orders", data\.instanceId\)/);
  assert.match(storefront, /storefrontLocalKey\("last-order", data\.instanceId\)/);
});

test("closed checkout remains unchanged during state isolation", () => {
  const route = readFileSync("src/routes/api/checkout.ts", "utf8");
  const closed = readFileSync("src/server/pilot-checkout-closed.ts", "utf8");
  assert.match(route, /rejectPilotCheckout\(request\)/);
  assert.match(closed, /enabled:\s*false/);
});
