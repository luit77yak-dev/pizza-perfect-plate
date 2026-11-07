import assert from "node:assert/strict";
import { test } from "node:test";
import {
  disposableCheckoutAllowed,
  handleDisposableCheckout,
} from "../src/server/pilot-disposable-checkout-adapter.ts";
import { CheckoutRateLimitError } from "../src/server/checkout-gateway.ts";
import { readFileSync } from "node:fs";

const org = "a0000000-0000-4000-8000-000000000001";
const instA = "b0000000-0000-4000-8000-000000000001";
const instB = "b0000000-0000-4000-8000-000000000002";
const id = "d0000000-0000-4000-8000-000000000004";
const key = "c0000000-0000-4000-8000-000000000001";
const productId = "e0000000-0000-4000-8000-000000000001";
const env = Object.freeze({
  NEROXA_PILOT_PRIVATE_ADAPTER: "synthetic-test-only",
  NEROXA_BACKEND_MODE: "homologation",
  NEROXA_TEST_PROJECT_REF: "local-disposable",
  NEROXA_PILOT_TEST_DOMAINS: "a.synthetic.invalid,b.synthetic.invalid",
  SUPABASE_URL: "http://127.0.0.1:54321",
  NEROXA_DELIVERY_BACKEND_URL: "http://127.0.0.1:54321",
});
function request(domain = "a.synthetic.invalid", changes = {}) {
  const payload = {
    organization_id: org,
    instance_id: domain.startsWith("b.") ? instB : instA,
    store_domain: domain,
    idempotency_key: key,
    customer_name: "Comprador de teste",
    customer_phone: "00000000001",
    fulfillment: "PICKUP",
    payment_method: "PIX",
    items: [{ product_id: productId, quantity: 1 }],
    ...changes,
  };
  return new Request("https://" + domain + "/api/checkout", {
    method: "POST",
    headers: {
      Host: domain,
      Origin: "https://" + domain,
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({p_order: payload}),
  });
}
function fakeBackend(overrides = {}) {
  const calls = [];
  const backend = {
    resolveContext: async (domain) => {
      calls.push(["resolve", domain]);
      return { domain, instance_id: domain.startsWith("b.") ? instB : instA, organization_id: org };
    },
    reserveQuota: async (context) => {
      calls.push(["quota", context.instance_id]);
    },
    createOrder: async (payload) => {
      calls.push(["create", payload.instance_id, payload.organization_id, payload.store_domain]);
      return {order_id: id, order_number: 1, total: 47.90};
    },
    ...overrides,
  };
  return {backend, calls};
}

test("disposable mode accepts only explicitly synthetic loopback config", () => {
  assert.equal(disposableCheckoutAllowed(env), true);
  for (const changed of [
    {NEROXA_PILOT_PRIVATE_ADAPTER: "true"},
    {NEROXA_BACKEND_MODE: "production"},
    {NEROXA_TEST_PROJECT_REF: "hosted"},
    {SUPABASE_URL: "https://example.supabase.co"},
    {NEROXA_DELIVERY_BACKEND_URL: "http://127.0.0.1:54322"},
    {NEROXA_PILOT_TEST_DOMAINS: "a.synthetic.invalid,real.example.com"},
    {NEROXA_PILOT_TEST_DOMAINS: "a.synthetic.invalid,a.synthetic.invalid"},
    {NEROXA_PILOT_TEST_DOMAINS: ""},
  ]) assert.equal(disposableCheckoutAllowed({...env, ...changed}), false);
});

test("two stores in one organization retain distinct server-resolved instances", async () => {
  const {backend, calls} = fakeBackend();
  for (const domain of ["a.synthetic.invalid", "b.synthetic.invalid"]) {
    const response = await handleDisposableCheckout(request(domain), env, backend);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).total, 47.9);
  }
  assert.deepEqual(calls.filter(([name]) => name === "create").map(x => x.slice(1)), [
    [instA, org, "a.synthetic.invalid"], [instB, org, "b.synthetic.invalid"],
  ]);
});

test("client cannot select another tenant instance and create is not invoked", async () => {
  const {backend, calls} = fakeBackend();
  const response = await handleDisposableCheckout(request("a.synthetic.invalid", {
    instance_id: instB,
  }), env, backend);
  assert.equal(response.status, 403);
  assert.equal(calls.filter(x => x[0] === "create").length, 0);
});

test("unlisted synthetic domain cannot resolve a store", async () => {
  const {backend, calls} = fakeBackend();
  const response = await handleDisposableCheckout(request("c.synthetic.invalid"), env, backend);
  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test("disabled, hosted and mistargeted configurations never invoke backend", async () => {
  for (const change of [
    {NEROXA_PILOT_PRIVATE_ADAPTER: undefined},
    {NEROXA_BACKEND_MODE: "production"},
    {SUPABASE_URL: "https://example.supabase.co"},
  ]) {
    const {backend, calls} = fakeBackend();
    const response = await handleDisposableCheckout(request(), {...env, ...change}, backend);
    assert.equal(response.status, 503);
    assert.equal(calls.length, 0);
  }
});

test("rate limit is enforced before any create operation", async () => {
  const {backend, calls} = fakeBackend({
    reserveQuota: async () => { throw new CheckoutRateLimitError("quota"); },
  });
  const response = await handleDisposableCheckout(request(), env, backend);
  assert.equal(response.status, 429);
  assert.equal(calls.some(x => x[0] === "create"), false);
});

test("backend error remains opaque and checkout request does not succeed", async () => {
  const {backend} = fakeBackend({
    createOrder: async () => { throw new Error("private PII or RPC failure"); },
  });
  const response = await handleDisposableCheckout(request(), env, backend);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PII|RPC failure/);
});

test("production HTTP route stays closed and never imports disposable adapter", () => {
  const route = readFileSync(new URL("../src/routes/api/checkout.ts", import.meta.url), "utf8");
  const closed = readFileSync(new URL("../src/server/pilot-checkout-closed.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /pilot-disposable-checkout-adapter|handleDisposableCheckout/);
  assert.doesNotMatch(closed, /pilot-disposable-checkout-adapter|handleDisposableCheckout/);
  assert.match(closed, /enabled: false/);
});
