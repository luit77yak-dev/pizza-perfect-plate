import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rejectPilotCheckout } from "../src/server/pilot-checkout-closed.ts";

const checkout = readFileSync(new URL("../src/features/storefront/components/CheckoutPanel.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/routes/api/checkout.ts", import.meta.url), "utf8");

test("POST checkout boundary rejects unconditionally without storing data", async () => {
  const response = await rejectPilotCheckout(new Request("https://a.synthetic.invalid/api/checkout", {method: "POST"}));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match((await response.json()).error, /Checkout seguro indisponível/);
});

test("browser cannot create or amend orders via direct public RPC", () => {
  assert.doesNotMatch(checkout, /supabase\.rpc\s*\(/);
  assert.doesNotMatch(checkout, /create_public_order|append_public_order_items_with_payment/);
  assert.doesNotMatch(checkout, /integrations\/storefront-backend\/client/);
  assert.match(checkout, /Complementos indisponíveis até validação/);
});

test("client POST requires an explicit feature switch and uses only the app endpoint", () => {
  assert.match(checkout, /VITE_NEROXA_CHECKOUT_GATEWAY/);
  assert.match(checkout, /fetch\("\/api\/checkout"/);
  assert.match(checkout, /if \(!response\.ok\)/);
});

test("server route has no privileged imports and calls a closed handler", () => {
  assert.match(route, /createFileRoute\("\/api\/checkout"\)/);
  assert.match(route, /POST: async \(\{ request \}\) => rejectPilotCheckout\(request\)/);
  assert.doesNotMatch(route, /supabase|service_role|process\.env|fetch\(/i);
});
