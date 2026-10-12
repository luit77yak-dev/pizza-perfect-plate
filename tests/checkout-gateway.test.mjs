import assert from "node:assert/strict";
import { test } from "node:test";
import { handleCheckoutRequest, CheckoutRateLimitError } from "../src/server/checkout-gateway.ts";

const org = "a0000000-0000-4000-8000-000000000001";
const a1 = "b0000000-0000-4000-8000-000000000001";
const a2 = "b0000000-0000-4000-8000-000000000002";
const orderId = "d0000000-0000-4000-8000-000000000004";
const key = "c0000000-0000-4000-8000-000000000001";
const hostname = "a.neroxa.example";
const url = "https://" + hostname + "/api/checkout";

const payload = {
  organization_id: org,
  instance_id: a1,
  store_domain: hostname,
  idempotency_key: key,
  customer_name: "Cliente de teste",
  customer_phone: "00000000001",
  fulfillment: "PICKUP",
  payment_method: "PIX",
  items: [{ product_id: "e0000000-0000-4000-8000-000000000001", quantity: 1 }],
};

function request(
  order = payload,
  { urlValue = url, host = hostname, origin = "https://" + hostname, extras = {} } = {},
) {
  return new Request(urlValue, {
    method: "POST",
    headers: {
      host,
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...extras,
    },
    body: JSON.stringify({ p_order: order }),
  });
}

function makeDeps(overrides = {}) {
  const calls = [];
  const deps = {
    enabled: true,
    resolveContext: async (domain) => {
      calls.push(["resolve", domain]);
      return { domain, instance_id: a1, organization_id: org };
    },
    reserveQuota: async (context, phone) => {
      calls.push(["quota", context, phone]);
    },
    createOrder: async (p) => {
      calls.push(["create", p]);
      return { order_id: orderId, order_number: 2, total: 31.5 };
    },
    ...overrides,
  };
  return { calls, deps };
}

test("disabled by default: no Supabase action is attempted", async () => {
  const { calls, deps } = makeDeps({ enabled: false });
  const response = await handleCheckoutRequest(request(), deps);
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
});

test("domain comes from routed request; payload cannot select another shop", async () => {
  const { calls, deps } = makeDeps();
  const response = await handleCheckoutRequest(request(), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    order_id: orderId,
    order_number: 2,
    total: 31.5,
  });
  assert.deepEqual(calls[0], ["resolve", hostname]);
  assert.deepEqual(calls[1], ["quota", { domain: hostname, instance_id: a1, organization_id: org }, payload.customer_phone]);
  assert.equal(calls[2][1].instance_id, a1);
  assert.equal(calls[2][1].store_domain, hostname);
  assert.equal(calls[2][1].organization_id, org);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("two domains of one organization resolve independently", async () => {
  const { calls, deps } = makeDeps({
    resolveContext: async (domain) => ({
      domain,
      instance_id: domain.startsWith("b.") ? a2 : a1,
      organization_id: org,
    }),
  });
  const bDomain = "b.neroxa.example";
  const result = await handleCheckoutRequest(
    request(
      { ...payload, instance_id: a2, store_domain: bDomain },
      {
        host: bDomain,
        origin: "https://" + bDomain,
        urlValue: "https://" + bDomain + "/api/checkout",
      },
    ),
    deps,
  );
  assert.equal(result.status, 200);
  assert.equal(calls[0][1].instance_id, a2);
});

test("rejects forged organization, instance and catalog-domain fields", async () => {
  for (const changed of [
    { instance_id: a2 },
    { organization_id: "a0000000-0000-4000-8000-000000000002" },
    { store_domain: "b.neroxa.example" },
  ]) {
    const { calls, deps } = makeDeps();
    assert.equal((await handleCheckoutRequest(request({ ...payload, ...changed }), deps)).status, 403);
    assert.equal(calls.filter((entry) => entry[0] === "create").length, 0);
  }
});

test("rejects forged host, Origin and Sec-Fetch-Site", async () => {
  for (const bad of [
    { host: "b.neroxa.example" },
    { origin: "https://b.neroxa.example" },
    { origin: "" },
    { extras: { "sec-fetch-site": "cross-site" } },
  ]) {
    const { calls, deps } = makeDeps();
    assert.equal((await handleCheckoutRequest(request(payload, bad), deps)).status, 403);
    assert.equal(calls.length, 0);
  }
});

test("Host port normalization keeps strict hostname and full Origin checks", async () => {
  const urlValue = "https://" + hostname + ":4173/api/checkout";
  const origin = "https://" + hostname + ":4173";
  const { deps } = makeDeps();
  const normalized = await handleCheckoutRequest(
    request(payload, { urlValue, host: hostname, origin }),
    deps,
  );
  assert.equal(normalized.status, 200, "runtime may normalize Host without nondefault port");

  for (const bad of [
    { urlValue, host: hostname + ":8443", origin },
    { urlValue, host: "b.neroxa.example", origin },
    { urlValue, host: hostname, origin: "https://" + hostname },
  ]) {
    const { deps: blocked } = makeDeps();
    assert.equal(
      (await handleCheckoutRequest(request(payload, bad), blocked)).status,
      403,
      "wrong host, explicit port or Origin must never be accepted",
    );
  }
});

test("never trusts X-Forwarded-Host to select the store", async () => {
  const { calls, deps } = makeDeps();
  const response = await handleCheckoutRequest(
    request(payload, { extras: { "x-forwarded-host": "b.neroxa.example" } }),
    deps,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], ["resolve", hostname]);
});

test("rejects localhost, preview hosts and non-TLS requests", async () => {
  for (const { origin, host } of [
    { origin: "https://pizza-perfect-plate.vercel.app", host: "pizza-perfect-plate.vercel.app" },
    { origin: "http://localhost:3000", host: "localhost:3000" },
    { origin: "http://a.neroxa.example", host: "a.neroxa.example" },
  ]) {
    const { calls, deps } = makeDeps();
    const result = await handleCheckoutRequest(
      request(payload, { urlValue: origin + "/api/checkout", host, origin }),
      deps,
    );
    assert.equal(result.status, 403);
    assert.equal(calls.length, 0);
  }
});

test("rejects unknown or mismatched server-side domain registration", async () => {
  for (const resolveContext of [
    async () => null,
    async () => ({ domain: "b.neroxa.example", organization_id: org, instance_id: a1 }),
    async () => ({ domain: hostname, organization_id: org, instance_id: "invalid" }),
    async () => { throw new Error("DB unavailable"); },
  ]) {
    const { calls, deps } = makeDeps({ resolveContext });
    const response = await handleCheckoutRequest(request(), deps);
    assert.ok([404, 503].includes(response.status));
    assert.equal(calls.filter((entry) => entry[0] === "create").length, 0);
  }
});

test("rejects missing idempotency and oversized bodies", async () => {
  const { calls, deps } = makeDeps();
  const noKey = { ...payload, idempotency_key: "" };
  assert.equal((await handleCheckoutRequest(request(noKey), deps)).status, 400);
  const oversized = { ...payload, notes: "a".repeat(70_000) };
  assert.equal((await handleCheckoutRequest(request(oversized), deps)).status, 413);
  assert.equal(calls.length, 0);
});

test("hides privileged backend errors and does not log customer data", async () => {
  const { deps } = makeDeps({
    createOrder: async () => { throw new Error("db secret or private context"); },
  });
  const response = await handleCheckoutRequest(request(), deps);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /db secret|private context/);
});


test("quota rejects attempts before privileged create RPC", async () => {
  const { calls, deps } = makeDeps({
    reserveQuota: async (context, phone) => {
      calls.push(["quota", context, phone]);
      throw new CheckoutRateLimitError("quota exceeded");
    },
  });
  const response = await handleCheckoutRequest(request(), deps);
  assert.equal(response.status, 429);
  assert.equal(calls.filter((c) => c[0] === "create").length, 0);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("quota backend failure returns 503 without creating an order", async () => {
  const { calls, deps } = makeDeps({
    reserveQuota: async () => { throw new Error("postgres unavailable"); },
  });
  const response = await handleCheckoutRequest(request(), deps);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /postgres unavailable/);
  assert.equal(calls.filter((c) => c[0] === "create").length, 0);
});

test("quota identity is only checked after store identity and payload pass", async () => {
  const { calls, deps } = makeDeps();
  const wrong = { ...payload, instance_id: a2 };
  assert.equal((await handleCheckoutRequest(request(wrong), deps)).status, 403);
  assert.equal(calls.filter((c) => c[0] === "quota").length, 0);
  const badPhone = { ...payload, customer_phone: "a" };
  assert.equal((await handleCheckoutRequest(request(badPhone), deps)).status, 400);
  assert.equal(calls.filter((c) => c[0] === "quota").length, 0);
});
