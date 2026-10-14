import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// These are STATIC route-mount safety contracts, NOT Auth/RLS or database tests.
const legacy = readFileSync("src/routes/painel.tsx", "utf8");
const orders = readFileSync("src/routes/admin/pedidos.tsx", "utf8");
const routeStart = legacy.indexOf('export const Route = createFileRoute("/painel")');
const legacyStart = legacy.indexOf("function StaffPanel()");
const routeAndGate = legacy.slice(routeStart, legacyStart);
const routeRegistration = routeAndGate.slice(0, routeAndGate.indexOf("});") + 3);

test("/painel never mounts the organization-scoped legacy implementation", () => {
  assert.ok(routeStart >= 0 && legacyStart > routeStart);
  assert.match(routeRegistration, /component:\s*SuspendedLegacyPanel/);
  assert.doesNotMatch(routeRegistration, /component:\s*StaffPanel/);
  assert.match(routeAndGate, /function SuspendedLegacyPanel\(\)/);
  assert.doesNotMatch(routeAndGate, /<StaffPanel|\.from\(|\.rpc\(|supabase/);
});

test("closed route does not select an organization or instance supplied by A or B", () => {
  // A and B belong to the same organization; neither may enter this legacy route.
  // This is a no-mount contract only. Negative database requests still require
  // real authenticated identities and an isolated test database.
  const fixtures = [
    { organization: "shared-org", instance: "pizza-A" },
    { organization: "shared-org", instance: "pizza-B" },
    { organization: "other-org", instance: "pizza-C" },
  ];
  for (const fixture of fixtures) {
    assert.ok(fixture.instance);
    assert.match(routeRegistration, /component:\s*SuspendedLegacyPanel/);
  }
  assert.doesNotMatch(routeAndGate, /organization_members|p_organization_id|instance_id/);
});

test("suspension is disclosed, and alternative links only to the existing order UI", () => {
  assert.match(routeAndGate, /Painel legado temporariamente indisponível/);
  assert.match(routeAndGate, /href="\/admin\/pedidos"/);
  assert.match(routeAndGate, /não autoriza operação comercial/);
  assert.doesNotMatch(routeAndGate, /href="\/painel"/);
});

test("order admin still uses instance-bound RPC, but is not thereby homologated", () => {
  assert.match(orders, /"get_admin_orders"/);
  assert.match(orders, /p_instance_id:\s*current\.instance_id/);
  assert.match(orders, /"update_admin_order_status"/);
  // Legacy code/SQL remains in the repository and old ACLs were not revoked.
  assert.match(legacy.slice(legacyStart), /\.from\("orders"\)/);
  assert.match(legacy.slice(legacyStart), /\.rpc\("update_order_status"/);
});
