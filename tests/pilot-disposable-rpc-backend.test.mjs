import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createDisposableRpcBackend } from "../src/server/pilot-disposable-rpc-backend.ts";
import { handleDisposableCheckout } from "../src/server/pilot-disposable-checkout-adapter.ts";

const org = "a0000000-0000-4000-8000-000000000001";
const A = "b0000000-0000-4000-8000-000000000001";
const B = "b0000000-0000-4000-8000-000000000002";
const orderId = "d0000000-0000-4000-8000-000000000004";
const checkoutKey = "c0000000-0000-4000-8000-000000000001";
const domainA = "a.synthetic.invalid";
const domainB = "b.synthetic.invalid";
const env = Object.freeze({
  NEROXA_PILOT_PRIVATE_ADAPTER: "synthetic-test-only",
  NEROXA_PILOT_RPC_CONTRACT: "emulated-atomic-v1",
  NEROXA_BACKEND_MODE: "homologation",
  NEROXA_TEST_PROJECT_REF: "local-disposable",
  NEROXA_PILOT_TEST_DOMAINS: domainA + "," + domainB,
  SUPABASE_URL: "http://127.0.0.1:54321",
  NEROXA_DELIVERY_BACKEND_URL: "http://127.0.0.1:54321",
  NEROXA_CHECKOUT_RATE_LIMIT_SECRET: "q".repeat(48),
});

function request(domain = domainA, changes = {}) {
  const data = {
    organization_id: org,
    instance_id: domain === domainB ? B : A,
    store_domain: domain,
    idempotency_key: checkoutKey,
    customer_name: "Cliente de teste",
    customer_phone: "00000000001",
    fulfillment: "PICKUP",
    payment_method: "PIX",
    subtotal: 0.01,
    items: [{ product_id: "e0000000-0000-4000-8000-000000000001", quantity: 1 }],
    ...changes,
  };
  return new Request("https://" + domain + "/api/checkout", {
    method: "POST",
    headers: { Host: domain, Origin: "https://" + domain,
      "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ p_order: data }),
  });
}

function transport(overrides = {}) {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (overrides[name]) return overrides[name](args);
      if (name === "get_public_storefront_context") return {
        data: {domain: args.p_domain, instance_id: args.p_domain === domainB ? B : A, organization_id: org},
        error: null,
      };
      if (name === "neroxa_checkout_reserve_quota") return { data: true, error: null };
      if (name === "create_public_order") return {
        data: {order_id: orderId, order_number: 19, total: 59.90}, error: null,
      };
      if (name === "neroxa_register_buyer_capabilities") return { data: true, error: null };
      throw new Error("Unrecognized synthetic RPC: " + name);
    },
  };
  return {client, calls};
}

test("two stores use distinct server-resolved instances in real RPC contract shape", async () => {
  const {client, calls} = transport();
  const backend = createDisposableRpcBackend(env, client);
  for (const domain of [domainA, domainB]) {
    const response = await handleDisposableCheckout(request(domain), env, backend);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.total, 59.9);
    assert.match(data.tracking_token, /^[a-zA-Z0-9_-]{43}$/);
    assert.match(data.amendment_token, /^[a-zA-Z0-9_-]{43}$/);
    assert.notEqual(data.tracking_token, data.amendment_token);
    const registrations = calls.filter(c => c.name === "neroxa_register_buyer_capabilities");
    const last = registrations.at(-1).args;
    assert.equal(last.p_instance_id, domain === domainB ? B : A);
    assert.equal(last.p_order_id, orderId);
    assert.equal(last.p_checkout_key, checkoutKey);
    assert.equal(last.p_tracking_sha256, createHash("sha256").update(data.tracking_token).digest("hex"));
    assert.equal(last.p_amendment_sha256, createHash("sha256").update(data.amendment_token).digest("hex"));
  }
  const created = calls.filter(c => c.name === "create_public_order");
  assert.deepEqual(created.map(c => c.args.p_order.instance_id), [A, B]);
  assert.deepEqual(calls.filter(c => c.name === "get_public_storefront_context").map(c => c.args.p_domain), [domainA,domainB]);
});

test("raw phone is not sent to quota RPC; server result overrides client subtotal", async () => {
  const {client, calls} = transport();
  const response = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total, 59.9);
  const quota = calls.find(c => c.name === "neroxa_checkout_reserve_quota");
  assert.equal(quota.args.p_instance_id, A);
  assert.match(quota.args.p_contact_fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(quota.args).sort(), [
    "p_contact_fingerprint", "p_instance_id",
  ]);
  assert.notEqual(quota.args.p_contact_fingerprint, "00000000001");
  assert.equal(calls.find(c => c.name === "create_public_order").args.p_order.subtotal, 0.01);
});

test("forged instance from another store is rejected before quota and order RPC", async () => {
  const {client, calls} = transport();
  const r = await handleDisposableCheckout(request(domainA, {instance_id: B}), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 403);
  assert.deepEqual(calls.map(x => x.name), ["get_public_storefront_context"]);
});

test("wrong domain supplied by backend is denied before quota and order RPC", async () => {
  const {client, calls} = transport({
    get_public_storefront_context: async () => ({
      data: {domain: domainB, instance_id: B, organization_id: org}, error: null,
    }),
  });
  const r = await handleDisposableCheckout(request(domainA), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 404);
  assert.deepEqual(calls.map(x => x.name), ["get_public_storefront_context"]);
});

test("atomic buyer registration error yields 503, never a successful checkout", async () => {
  const {client, calls} = transport({
    neroxa_register_buyer_capabilities: async () => ({ data: null, error: { code: "42501" }}),
  });
  const r = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /42501|token|secret/i);
  assert.deepEqual(calls.map(x => x.name), [
    "get_public_storefront_context","neroxa_checkout_reserve_quota",
    "create_public_order","neroxa_register_buyer_capabilities",
  ]);
});

test("replay never reissues earlier tracking or amendment credentials", async () => {
  const {client} = transport({
    neroxa_register_buyer_capabilities: async () => ({data: false, error: null}),
  });
  const r = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 200);
  const response = await r.json();
  assert.equal(response.tracking_token, undefined);
  assert.equal(response.amendment_token, undefined);
});

test("quota denial aborts before order creation", async () => {
  const {client, calls} = transport({
    neroxa_checkout_reserve_quota: async () => ({data: null, error: {code: "PT429"}}),
  });
  const r = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 429);
  assert.deepEqual(calls.map(x => x.name), ["get_public_storefront_context","neroxa_checkout_reserve_quota"]);
});

test("price drift maps to HTTP 409 and never registers credentials", async () => {
  const {client, calls} = transport({
    create_public_order: async () => ({data: null, error: {code:"PT409"}}),
  });
  const r = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 409);
  assert.equal(calls.some(c => c.name === "neroxa_register_buyer_capabilities"), false);
});

test("closed store maps to HTTP 423 with no capability registration", async () => {
  const {client, calls} = transport({
    create_public_order: async () => ({data: null, error: {code:"PT423"}}),
  });
  const r = await handleDisposableCheckout(request(), env, createDisposableRpcBackend(env, client));
  assert.equal(r.status, 423);
  assert.equal(calls.some(c => c.name === "neroxa_register_buyer_capabilities"), false);
});

test("hosted or misconfigured RPC contract denies every call to transport", async () => {
  for (const change of [
    {NEROXA_BACKEND_MODE: "production"},
    {NEROXA_PILOT_RPC_CONTRACT: "anything-else"},
    {NEROXA_CHECKOUT_RATE_LIMIT_SECRET: ""},
    {SUPABASE_URL:"https://live-project.supabase.co"},
    {NEROXA_PILOT_TEST_DOMAINS:"real-shop.example.com"},
  ]) {
    const {client, calls} = transport();
    const r = await handleDisposableCheckout(request(), {...env,...change}, createDisposableRpcBackend({...env,...change},client));
    assert.equal(r.status, 503);
    assert.equal(calls.length, 0);
  }
});

test("public checkout stays unconnected to synthetic RPC adapter", () => {
  const route = readFileSync(new URL("../src/routes/api/checkout.ts", import.meta.url),"utf8");
  const blocked = readFileSync(new URL("../src/server/pilot-checkout-closed.ts", import.meta.url),"utf8");
  assert.doesNotMatch(route, /createDisposableRpcBackend|pilot-disposable-rpc-backend/);
  assert.doesNotMatch(blocked, /createDisposableRpcBackend|pilot-disposable-rpc-backend/);
  assert.match(blocked, /enabled: false/);
});
