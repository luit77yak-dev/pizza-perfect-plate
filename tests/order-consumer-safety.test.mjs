import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Static safety contracts. These do NOT certify database ACL or RPC authorization.
const checkout = readFileSync("src/features/storefront/components/CheckoutPanel.tsx", "utf8");
const storefront = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
const trackingPanel = readFileSync("src/components/storefront/TrackedOrderPanel.tsx", "utf8");
const admin = readFileSync("src/routes/admin/pedidos.tsx", "utf8");
const legacyPanel = readFileSync("src/routes/painel.tsx", "utf8");

test("phone-only append is absent even with gateway disabled", () => {
  assert.doesNotMatch(checkout, /append_public_order_items/);
  assert.match(checkout, /Alteração segura indisponível/);
});

test("buyer token and RECEIVED/CONFIRMED are required for secure add-to-order CTA", () => {
  assert.match(storefront, /VITE_NEROXA_CHECKOUT_AMENDMENTS/);
  assert.match(storefront, /readBuyerAmendmentToken\(data\.instanceId, selectedOrder\.id\)/);
  assert.match(storefront, /\["RECEIVED", "CONFIRMED"\]\.includes/);
  assert.match(trackingPanel, /const canAddMore\s*=\s*allowOrderAmendments\s*&&/);
  assert.match(trackingPanel, /\{canAddMore &&/);
});

test("secure amendment requires session token, server endpoint and no phone-only fallback", () => {
  const guarded = checkout.indexOf('if (import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true")', checkout.indexOf("if (existingOrder)"));
  const legacy = checkout.indexOf("// Phone/UUID never authorize", guarded);
  assert.ok(guarded > 0 && legacy > guarded);
  const block = checkout.slice(guarded, legacy);
  assert.match(block, /readBuyerAmendmentToken\(instanceId, existingOrder\.id\)/);
  assert.match(block, /fetch\("\/api\/order-amend"/);
  assert.match(block, /if \(!response\.ok\) throw new Error/);
  assert.match(block, /return;/);
  assert.doesNotMatch(block, /supabase\.rpc\(/);
});

test("issued buyer credential stays in browser memory without persistent storage", () => {
  const capability = readFileSync("src/lib/domain/order-amendment-capability.ts", "utf8");
  assert.match(capability, /tokens\.set/);
  assert.match(capability, /tokens\.get/);
  assert.doesNotMatch(capability, /(?:localStorage|sessionStorage)\.(getItem|setItem|removeItem)/);
  assert.match(checkout, /rememberBuyerAmendmentToken\(instanceId/);
});

test("public order creation in protected mode must not fall back to direct RPC", () => {
  const start = checkout.indexOf('if (import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true")', checkout.indexOf("const payload ="));
  const fallback = checkout.indexOf('supabase.rpc("create_public_order"', start);
  assert.ok(start > 0 && fallback > start);
  assert.match(checkout.slice(start, fallback), /if \(!response\.ok\) throw new Error/);
});

test("new admin panel is instance-scoped; legacy panel remains a known release blocker", () => {
  assert.match(admin, /"get_admin_orders"/);
  assert.match(admin, /p_instance_id: current\.instance_id/);
  assert.match(admin, /"update_admin_order_status"/);
  // A passing inventory check here highlights a deliberate unresolved migration,
  // NOT that the older organization-scoped panel is safe for multi-store use.
  assert.match(legacyPanel, /\.from\("orders"\)/);
  assert.match(legacyPanel, /\.eq\("organization_id", orgId\)/);
  assert.match(legacyPanel, /\.rpc\("update_order_status"/);
});

test("tracking has no UUID plus phone fallback in either consumer", () => {
  assert.doesNotMatch(storefront, /get_public_order_status|p_customer_phone/);
  assert.equal((storefront.match(/readPrivateTracking\(/g) ?? []).length, 2);
});
