import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCustomerDetails } from "../src/core/delivery/customer-details.ts";
import { sameDeliveryBackend } from "../src/core/delivery/backend-binding.ts";
import {
  DELIVERY_PAYMENT_METHODS,
  DELIVERY_PRODUCT_KINDS,
  DELIVERY_ORDER_STATUSES,
} from "../src/core/delivery/contracts.ts";
import { handleCheckoutRequest } from "../src/server/checkout-gateway.ts";
const customer = {
  customer_name: "Cliente fictício",
  customer_phone: "00000000001",
  fulfillment: "PICKUP",
};
const delivery = {
  ...customer,
  fulfillment: "DELIVERY",
  address_street: "Rua fictícia",
  address_number: "S/N",
  address_neighborhood: "Bairro fictício",
};
test("pickup does not require an address; delivery requires each address field", () => {
  assert.equal(validateCustomerDetails(customer), null);
  assert.equal(validateCustomerDetails(delivery), null);
  for (const key of ["address_street", "address_number", "address_neighborhood"]) {
    assert.notEqual(validateCustomerDetails({ ...delivery, [key]: " " }), null);
  }
  assert.notEqual(
    validateCustomerDetails({ ...delivery, address_street: null, address_number: null }),
    null,
  );
});
test("invalid customer identity and fulfillment are rejected centrally", () => {
  for (const invalid of [
    { customer_name: " " },
    { customer_name: "x" },
    { customer_name: "x".repeat(161) },
    { customer_phone: "abc" },
    { fulfillment: "OTHER" },
  ]) {
    assert.notEqual(validateCustomerDetails({ ...customer, ...invalid }), null);
  }
});
test("backend binding denies missing configuration, different projects and crafted URLs", () => {
  const url = "https://master.example";
  assert.ok(sameDeliveryBackend(url, url + "/"));
  assert.ok(sameDeliveryBackend("http://127.0.0.1:54321", "http://127.0.0.1:54321"));
  for (const other of [
    undefined,
    "https://another.example",
    url + "/rest/v1",
    url + "?x=y",
    "https://user@master.example",
    "http://master.example",
    "https://master.example.attacker.test",
  ]) {
    assert.equal(sameDeliveryBackend(other, url), false);
  }
});
test("PR36 vocabulary retains PR37 payment, product and state contracts", () => {
  assert.ok(DELIVERY_PAYMENT_METHODS.includes("CARD_ON_SITE"));
  assert.ok(!DELIVERY_PAYMENT_METHODS.includes("CARD_ON_PICKUP"));
  for (const kind of ["DRINK", "COMBO", "SIDE"]) assert.ok(DELIVERY_PRODUCT_KINDS.includes(kind));
  assert.equal(new Set(DELIVERY_ORDER_STATUSES).size, 7);
});
function request(payload, method = "POST") {
  return new Request("https://a.example/api/checkout", {
    method,
    headers: { origin: "https://a.example", "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ p_order: payload }) } : {}),
  });
}
const id = "b0000000-0000-4000-8000-000000000001";
const payload = { ...customer, idempotency_key: id, items: [{ product_id: id, quantity: 1 }] };
test("invalid delivery and method do not resolve context or call quota/database", async () => {
  let calls = 0;
  const reject = async () => {
    calls++;
    throw Error("Unexpected call");
  };
  const dependencies = {
    enabled: true,
    resolveContext: reject,
    reserveQuota: reject,
    createOrder: reject,
  };
  assert.equal(
    (
      await handleCheckoutRequest(
        request({ ...payload, fulfillment: "DELIVERY", address_neighborhood: "Bairro" }),
        dependencies,
      )
    ).status,
    400,
  );
  assert.equal((await handleCheckoutRequest(request(payload, "GET"), dependencies)).status, 405);
  assert.equal(calls, 0);
});
test("negative server totals fail closed instead of being presented as confirmed", async () => {
  const dependencies = {
    enabled: true,
    resolveContext: async () => ({ domain: "a.example", instance_id: id, organization_id: id }),
    reserveQuota: async () => {},
    createOrder: async () => ({ order_id: id, order_number: 1, total: -1 }),
  };
  assert.equal((await handleCheckoutRequest(request(payload), dependencies)).status, 502);
});
