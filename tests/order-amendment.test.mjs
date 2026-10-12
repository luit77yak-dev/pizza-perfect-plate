import assert from "node:assert/strict";
import { test } from "node:test";
import { CheckoutRateLimitError } from "../src/server/checkout-gateway.ts";
import {
  AmendmentAuthorizationError,
  AmendmentConflictError,
  handleOrderAmendmentRequest,
} from "../src/server/order-amendment.ts";

const org = "a0000000-0000-4000-8000-000000000001";
const a = "b0000000-0000-4000-8000-000000000001";
const b = "b0000000-0000-4000-8000-000000000002";
const orderId = "c0000000-0000-4000-8000-000000000001";
const requestKey = "d0000000-0000-4000-8000-000000000001";
const productId = "e0000000-0000-4000-8000-000000000001";
const token = "A".repeat(43);
const hostname = "a.neroxa.example";
const url = "https://" + hostname + "/api/order-amend";
const body = {
  order_id: orderId,
  instance_id: a,
  request_key: requestKey,
  token,
  items: [{ product_id: productId, quantity: 1 }],
};

function request(data = body, params = {}) {
  const { target = url, host = hostname, origin = "https://" + hostname, extra = {} } = params;
  return new Request(target, {
    method: "POST",
    headers: {
      host,
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...extra,
    },
    body: JSON.stringify(data),
  });
}
function setup(changes = {}) {
  const calls = [];
  const deps = {
    enabled: true,
    resolveContext: async (domain) => {
      calls.push(["resolve", domain]);
      return { domain, instance_id: a, organization_id: org };
    },
    reserveQuota: async (ctx, capability) => {
      calls.push(["quota", ctx.instance_id, capability]);
    },
    appendItems: async (ctx, params) => {
      calls.push(["append", ctx.instance_id, params]);
      return {
        order_id: orderId, order_number: 2, subtotal: 38,
        total: 41, added_amount: 8, payment_state: "NOT_SETTLED",
      };
    },
    ...changes,
  };
  return { calls, deps };
}

test("disabled amendment route does not reach privileged Supabase", async () => {
  const { calls, deps } = setup({ enabled: false });
  const result = await handleOrderAmendmentRequest(request(), deps);
  assert.equal(result.status, 503);
  assert.equal(calls.length, 0);
});

test("server determines instance and returns unpaid increment", async () => {
  const { calls, deps } = setup();
  const result = await handleOrderAmendmentRequest(request(), deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    order_id: orderId, order_number: 2, subtotal: 38,
    total: 41, added_amount: 8, payment_state: "NOT_SETTLED",
  });
  assert.deepEqual(calls[0], ["resolve", hostname]);
  assert.deepEqual(calls[1], ["quota", a, token]);
  assert.equal(calls[2][1], a);
  assert.equal(calls[2][2].requestKey, requestKey);
  assert.equal(result.headers.get("cache-control"), "no-store");
});

test("cannot route another store or forged host/origin to mutation", async () => {
  for (const params of [
    { body: { ...body, instance_id: b } },
    { p: { host: "b.neroxa.example" } },
    { p: { origin: "https://b.neroxa.example" } },
    { p: { extra: { "sec-fetch-site": "cross-site" } } },
  ]) {
    const { deps, calls } = setup();
    const reply = await handleOrderAmendmentRequest(
      request(params.body ?? body, params.p ?? {}),
      deps,
    );
    assert.equal(reply.status, 403);
    assert.equal(calls.some(c => c[0] === "append"), false);
  }
});

test("stripped Host works only for same-origin HTTPS", async () => {
  const u = "https://" + hostname + ":4173/api/order-amend";
  const origin = "https://" + hostname + ":4173";
  const missingHost = request(body, { target: u, host: hostname, origin });
  missingHost.headers.delete("host");
  assert.equal((await handleOrderAmendmentRequest(missingHost, setup().deps)).status, 200);
  for (const invalid of [
    request(body, { target: u, host: hostname + ":8443", origin }),
    request(body, { target: u, host: hostname, origin: "https://" + hostname }),
  ]) {
    assert.equal((await handleOrderAmendmentRequest(invalid, setup().deps)).status, 403);
  }
});

test("rejects absent/bad capability, identifiers and quantities before quota", async () => {
  for (const candidate of [
    { ...body, token: "" },
    { ...body, token: "bad" },
    { ...body, request_key: "x" },
    { ...body, items: [] },
    { ...body, items: [{ product_id: productId, quantity: 0 }] },
    { ...body, items: [{ product_id: productId, quantity: 11 }] },
    { ...body, items: [{ product_id: "invalid", quantity: 1 }] },
  ]) {
    const { deps, calls } = setup();
    const response = await handleOrderAmendmentRequest(request(candidate), deps);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  }
});

test("persistent quota 429 and backend errors both fail closed", async () => {
  const limited = setup({
    reserveQuota: async () => { throw new CheckoutRateLimitError("too many"); },
  });
  const exhausted = await handleOrderAmendmentRequest(request(), limited.deps);
  assert.equal(exhausted.status, 429);
  assert.equal(limited.calls.some(c => c[0] === "append"), false);

  const unreachable = setup({
    reserveQuota: async () => { throw new Error("internal database secret"); },
  });
  const down = await handleOrderAmendmentRequest(request(), unreachable.deps);
  assert.equal(down.status, 503);
  assert.doesNotMatch(await down.text(), /internal database secret/);
  assert.equal(unreachable.calls.some(c => c[0] === "append"), false);
});

test("authorization errors and stale-status conflicts never expose tokens", async () => {
  for (const [fault, status] of [
    [new AmendmentAuthorizationError("secret token"), 403],
    [new AmendmentConflictError("private order data"), 409],
    [new Error("database stack and secret"), 503],
  ]) {
    const { deps } = setup({ appendItems: async () => { throw fault; } });
    const response = await handleOrderAmendmentRequest(request(), deps);
    assert.equal(response.status, status);
    const data = await response.text();
    assert.doesNotMatch(data, /secret token|private order data|database stack/);
  }
});

test("no forwarded-host redirection or preview-domain bypass", async () => {
  const requestA = request(body, { extra: { "x-forwarded-host": "b.neroxa.example" } });
  const { deps, calls } = setup();
  assert.equal((await handleOrderAmendmentRequest(requestA, deps)).status, 200);
  assert.deepEqual(calls[0], ["resolve", hostname]);

  for (const blockedDomain of ["app.vercel.app", "localhost"]) {
    const target = "https://" + blockedDomain + "/api/order-amend";
    const response = await handleOrderAmendmentRequest(
      request(body, { target, host: blockedDomain, origin: "https://" + blockedDomain }),
      setup().deps,
    );
    assert.equal(response.status, 403);
  }
});
