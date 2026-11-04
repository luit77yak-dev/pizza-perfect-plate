import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Static contracts: no hosted SQL, Auth, browser or integration behavior is certified.
const checkout = readFileSync("src/features/storefront/components/CheckoutPanel.tsx", "utf8");
const storefront = readFileSync("src/components/storefront/Storefront.tsx", "utf8");
const panel = readFileSync("src/routes/painel.tsx", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

test("buyer checkout and amendment do not use public RPC, collect personal details, or send HTTP", () => {
  assert.doesNotMatch(checkout, /supabase|create_public_order|append_public_order_items|fetch\s*\(/);
  assert.doesNotMatch(checkout, /<input|<Textarea|onSubmit|type="submit"/i);
  assert.match(checkout, /Checkout temporariamente indisponível/);
  assert.match(checkout, /Alterações do pedido temporariamente indisponíveis/);
});

test("storefront never polls UUID and phone tracking or fabricates successful checkout", () => {
  assert.doesNotMatch(storefront, /get_public_order_status|p_customer_phone|supabase\.rpc\s*\(/);
  assert.doesNotMatch(storefront, /readPrivateTracking\s*\(/);
  assert.match(storefront, /const \[trackedOrders, setTrackedOrders\] = useState<TrackedOrder\[]>\(\[\]\)/);
  assert.doesNotMatch(storefront, /setTrackedOrders\s*\(/);
  assert.match(storefront, /onSuccess=\{\(\) => \{/);
});

test("organization-scoped legacy staff route is suspended, not authorized by the UI", () => {
  assert.match(panel, /createFileRoute\("\/painel"\)\(\{\s*component: SuspendedLegacyPanel,/);
  assert.match(panel, /Painel legado temporariamente indisponível/);
  assert.doesNotMatch(panel, /component: StaffPanel,/);
  // Old code is retained temporarily but is NOT connected to the router.
  assert.match(panel, /function StaffPanel\(\)/);
});

test("this branch has automated Vercel deployments explicitly disabled", () => {
  assert.equal(
    vercel.git?.deploymentEnabled?.["security/f02-frontend-containment-20261104"],
    false,
  );
});
