import assert from "node:assert/strict";
import test from "node:test";
import {
  testBackend,
  assertServerBackend,
  assertBackendRequest,
  configuredStoreDomain,
} from "../src/core/delivery/backend-configuration.ts";
const jwt = (role, ref) =>
  [
    "e30",
    Buffer.from(JSON.stringify({ role, ref })).toString("base64url"),
    "synthetic-signature",
  ].join(".");
const config = () => ({
  VITE_NEROXA_BACKEND_MODE: "homologation",
  VITE_NEROXA_TEST_BACKEND_URL: "http://127.0.0.1:54321",
  VITE_NEROXA_TEST_PROJECT_REF: "local-disposable",
  VITE_NEROXA_TEST_PUBLISHABLE_KEY: jwt("anon"),
});
const server = () => ({
  NEROXA_BACKEND_MODE: "homologation",
  NEROXA_TEST_PROJECT_REF: "local-disposable",
  SUPABASE_URL: "http://127.0.0.1:54321",
  NEROXA_DELIVERY_BACKEND_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
});
test("legacy production and preview behavior retained only without test opt-in", () => {
  assert.equal(testBackend({}), null);
  assert.equal(configuredStoreDomain(null, "localhost"), "food.neroxa.ia.br");
});
test("explicit local config and matching private runtime accepted", () => {
  assertServerBackend(testBackend(config()), server(), true);
});
for (const field of Object.keys(config()).filter((k) => k !== "VITE_NEROXA_BACKEND_MODE"))
  test(`test config missing ${field} denied`, () => {
    const e = config();
    delete e[field];
    assert.throws(() => testBackend(e));
  });
for (const url of [
  "not-a-url",
  "http://example.com",
  "https://iefaoaqzltvpfabyeelj.supabase.co",
  "https://uvyinrojuhizjqbuzdcy.supabase.co",
  "https://example.com",
  "http://127.0.0.1:54321/path",
  "http://user:pass@127.0.0.1:54321",
  "http://127.0.0.1:54321/?q=1",
])
  test(`unsafe test destination ${url} denied before transport`, () =>
    assert.throws(() => testBackend({ ...config(), VITE_NEROXA_TEST_BACKEND_URL: url })));
test("production ref rejected even if explicitly configured", () =>
  assert.throws(() =>
    testBackend({ ...config(), VITE_NEROXA_TEST_PROJECT_REF: "iefaoaqzltvpfabyeelj" }),
  ));
test("hosted project requires exact URL and anon ref", () => {
  const ref = "abcdefghijklmnopqrst";
  const c = {
    ...config(),
    VITE_NEROXA_TEST_PROJECT_REF: ref,
    VITE_NEROXA_TEST_BACKEND_URL: `https://${ref}.supabase.co`,
    VITE_NEROXA_TEST_PUBLISHABLE_KEY: jwt("anon", ref),
  };
  assert.ok(testBackend(c));
  assert.throws(() =>
    testBackend({ ...c, VITE_NEROXA_TEST_PUBLISHABLE_KEY: jwt("anon", "different-project") }),
  );
});
test("public config never accepts privileged credential", () => {
  for (const key of [jwt("service_role"), "sb_secret_abcdefghijklmnopqrstuvwxyz"])
    assert.throws(() => testBackend({ ...config(), VITE_NEROXA_TEST_PUBLISHABLE_KEY: key }));
});
test("opaque publishable format allowed, runtime project binding still requires real backend verification", () =>
  assert.ok(
    testBackend({
      ...config(),
      VITE_NEROXA_TEST_PROJECT_REF: "abcdefghijklmnopqrst",
      VITE_NEROXA_TEST_BACKEND_URL: "https://abcdefghijklmnopqrst.supabase.co",
      VITE_NEROXA_TEST_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
    }),
  ));
test("admin browser other project rejected", () =>
  assert.throws(() =>
    testBackend({ ...config(), VITE_SUPABASE_URL: "https://other.supabase.co" }),
  ));
test("admin key divergence rejected", () =>
  assert.throws(() =>
    testBackend({ ...config(), VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon", "foreign") }),
  ));
for (const field of [
  "SUPABASE_URL",
  "NEROXA_DELIVERY_BACKEND_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEROXA_TEST_PROJECT_REF",
  "NEROXA_BACKEND_MODE",
])
  test(`private divergence ${field} denied`, () =>
    assert.throws(() =>
      assertServerBackend(testBackend(config()), { ...server(), [field]: "different" }, true),
    ));
test("private credential must be privileged, not public", () =>
  assert.throws(() =>
    assertServerBackend(
      testBackend(config()),
      { ...server(), SUPABASE_SERVICE_ROLE_KEY: jwt("anon") },
      true,
    ),
  ));
test("server opt-in cannot use legacy compiled config", () =>
  assert.throws(() => assertServerBackend(null, server())));
test("mode typo denied, not production fallback", () =>
  assert.throws(() => testBackend({ ...config(), VITE_NEROXA_BACKEND_MODE: "homologation " })));
test("test settings without opt-in denied", () => {
  const e = config();
  delete e.VITE_NEROXA_BACKEND_MODE;
  assert.throws(() => testBackend(e));
});
test("SSR public and private use identical destination and project", () => {
  const c = testBackend(config());
  assert.equal(c.url, server().SUPABASE_URL);
  assertServerBackend(c, server());
});
test("unknown preview domains have no real-store fallback", () => {
  const c = testBackend(config());
  for (const host of [
    "localhost",
    "unknown.vercel.app",
    "example.lovable.app",
    "a.ab.invalid",
    "b.ab.invalid",
    "c.ab.invalid",
  ])
    assert.equal(configuredStoreDomain(c, host), host);
});
test("SDK fetch cannot redirect credentials to external project", () => {
  const c = testBackend(config());
  assert.throws(() =>
    assertBackendRequest(c, "https://iefaoaqzltvpfabyeelj.supabase.co/rest/v1/neroxa_orders"),
  );
  assertBackendRequest(c, "http://127.0.0.1:54321/auth/v1/token");
});
test("public key from known production project rejected even through local transport", () =>
  assert.throws(() =>
    testBackend({
      ...config(),
      VITE_NEROXA_TEST_PUBLISHABLE_KEY: jwt("anon", "iefaoaqzltvpfabyeelj"),
    }),
  ));
test("actual public key probe is scoped, redirect-denying and shared across concurrent calls", async () => {
  const { ensureTestBackendKey } = await import("../src/core/delivery/backend-configuration.ts");
  const c = testBackend(config());
  let calls = 0;
  const transport = async (url, init) => {
    calls++;
    assert.equal(url, c.url + "/rest/v1/");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.apikey, c.key);
    return Response.json({ swagger: "2.0" });
  };
  await Promise.all([ensureTestBackendKey(c, transport), ensureTestBackendKey(c, transport)]);
  assert.equal(calls, 1);
});
test("hosted opaque public key rejected by destination before catalog or privileged operation", async () => {
  const { ensureTestBackendKey } = await import("../src/core/delivery/backend-configuration.ts");
  const c = testBackend({
    ...config(),
    VITE_NEROXA_TEST_PROJECT_REF: "abcdefghijklmnopqrst",
    VITE_NEROXA_TEST_BACKEND_URL: "https://abcdefghijklmnopqrst.supabase.co",
    VITE_NEROXA_TEST_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  });
  let calls = 0;
  await assert.rejects(() =>
    ensureTestBackendKey(c, async () => {
      calls++;
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }),
  );
  await assert.rejects(() =>
    ensureTestBackendKey(c, async () => {
      calls++;
      return Response.json({ swagger: "2.0" });
    }),
  );
  assert.equal(calls, 1);
});
test("temporary native PostgREST failure denies operations but can be safely retried at same destination", async () => {
  const { ensureTestBackendKey } = await import("../src/core/delivery/backend-configuration.ts");
  const c = testBackend(config());
  let calls = 0;
  const transport = async (url, init) => {
    calls++;
    assert.equal(url, c.url + "/rest/v1/");
    assert.ok(init.signal);
    return calls === 1
      ? Response.json({ error: "unavailable" }, { status: 503 })
      : Response.json({ swagger: "2.0" });
  };
  await assert.rejects(() => ensureTestBackendKey(c, transport));
  await ensureTestBackendKey(c, transport);
  assert.equal(calls, 2);
});

test("native local opaque key is denied before any request because local gateway binding is unproved", () =>
  assert.throws(() =>
    testBackend({
      ...config(),
      VITE_NEROXA_TEST_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
    }),
  ));
