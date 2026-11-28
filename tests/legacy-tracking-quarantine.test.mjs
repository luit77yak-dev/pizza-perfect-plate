import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Food storefront has no direct UUID/phone tracking RPC", () => {
  const source = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
  assert.doesNotMatch(source, /\bsupabase\.rpc\s*\(\s*['"`]get_public_order_status['"`]/);
  assert.doesNotMatch(source, /\bget_public_order_status\s*\(/);
  assert.match(source, /readPrivateTracking\(instance,order\)/);
  assert.doesNotMatch(source, /localStorage\.getItem|localStorage\.setItem/);
});

test("checkout still rejects unauthorised public requests", () => {
  const route = readFileSync("src/routes/api/checkout.ts", "utf8");
  const closed = readFileSync("src/server/pilot-checkout-closed.ts", "utf8");
  assert.match(route, /rejectPilotCheckout\(request\)/);
  assert.match(closed, /enabled:\s*false/);
});
