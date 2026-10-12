import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Static safety contracts. These do NOT certify database ACL or RPC authorization.
const checkout = readFileSync("src/features/storefront/components/CheckoutPanel.tsx", "utf8");
const storefront = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
const trackingPanel = readFileSync("src/components/storefront/TrackedOrderPanel.tsx", "utf8");
const admin = readFileSync("src/routes/admin/pedidos.tsx", "utf8");
const legacyPanel = readFileSync("src/routes/painel.tsx", "utf8");

test("protected checkout must fail closed before historical phone-only amendment RPC", () => {
  const guarded = checkout.indexOf('if (import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true")', checkout.indexOf("if (existingOrder)"));
  const append = checkout.indexOf('"append_public_order_items_with_payment"');
  assert.ok(guarded > 0 && guarded < append, "guard must precede vulnerable legacy append");
  const relevant = checkout.slice(guarded, append);
  assert.match(relevant, /setError\(/);
  assert.match(relevant, /return;/);
});

test("protected storefront hides the old add-to-order action at the tracking panel", () => {
  assert.match(storefront, /allowOrderAmendments=\{import\.meta\.env\["VITE_NEROXA_CHECKOUT_GATEWAY"\] !== "true"\}/);
  assert.match(trackingPanel, /const canAddMore = allowOrderAmendments &&/);
  assert.match(trackingPanel, /\{canAddMore &&/);
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

test("public tracking is still phone-based, not token-authorized (release gate)", () => {
  assert.match(storefront, /"get_public_order_status"/);
  assert.match(storefront, /p_customer_phone: stored\.phone/);
});
