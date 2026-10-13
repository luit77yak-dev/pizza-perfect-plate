import { test } from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson, RequestBodyTooLarge } from "../src/server/bounded-json.ts";
import { handleCheckoutRequest } from "../src/server/checkout-gateway.ts";
import { handleOrderAmendmentRequest } from "../src/server/order-amendment.ts";

function streaming() {
  let read = 0,
    cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      read++;
      controller.enqueue(new Uint8Array(8192).fill(32));
      if (read === 100) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://a1.rehearsal.invalid/api/checkout", {
    method: "POST",
    duplex: "half",
    headers: {
      origin: "https://a1.rehearsal.invalid",
      "Content-Type": "application/json",
      "Content-Length": "0",
    },
    body: stream,
  });
  return { request, stats: () => ({ read, cancelled }) };
}

test("bounded reader cancels an oversized stream without draining it", async () => {
  const { request, stats } = streaming();
  await assert.rejects(() => readBoundedJson(request, 16384), RequestBodyTooLarge);
  assert.equal(stats().cancelled, true);
  assert.ok(stats().read < 10);
});
test("bounded reader preserves valid JSON and rejects invalid UTF8", async () => {
  const request = new Request("https://example.invalid", { method: "POST", body: '{"value":1}' });
  assert.deepEqual(await readBoundedJson(request, 11), { value: 1 });
  const invalid = new Request("https://example.invalid", {
    method: "POST",
    body: new Uint8Array([0xff]),
  });
  await assert.rejects(() => readBoundedJson(invalid, 10));
});
for (const handler of [handleCheckoutRequest, handleOrderAmendmentRequest]) {
  test(handler.name + " rejects spoofed lengths before any backend call", async () => {
    let calls = 0;
    const { request, stats } = streaming();
    const response = await handler(request, {
      enabled: true,
      resolveContext: async () => {
        calls++;
        return null;
      },
      reserveQuota: async () => {
        calls++;
      },
      createOrder: async () => {
        calls++;
      },
      appendItems: async () => {
        calls++;
      },
    });
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
    assert.equal(stats().cancelled, true);
    assert.ok(stats().read < 12);
  });
}
