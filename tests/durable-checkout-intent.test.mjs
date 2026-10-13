import test from "node:test";
import assert from "node:assert/strict";
import {
  withDurableCheckoutIntent,
  intentStorageKey,
} from "../src/core/delivery/durable-checkout-intent.ts";
const store = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};
function locks() {
  const tails = new Map();
  return {
    request(name, cb) {
      const pending = (tails.get(name) ?? Promise.resolve()).catch(() => {}).then(cb);
      tails.set(name, pending);
      return pending;
    },
  };
}
const payload = (instance = "A1") => ({
  instance_id: instance,
  client_cart_reference: "a".repeat(64),
  customer_name: "Cliente fictício",
  customer_phone: "00000000001",
  items: [{ product_id: "fiction", quantity: 1 }],
  expected_total: 30,
});
test("lost response survives remount and exact retry with no PII stored", async () => {
  const storage = store(),
    lock = locks();
  let key;
  await assert.rejects(
    withDurableCheckoutIntent(
      "A1",
      payload(),
      async (p) => {
        key = p.idempotency_key;
        throw Error("lost after persistence");
      },
      { storage, locks: lock },
    ),
  );
  const saved = storage.getItem(intentStorageKey("A1"));
  assert.ok(
    !saved.includes("Cliente") && !saved.includes("00000000001") && !saved.includes("items"),
  );
  await withDurableCheckoutIntent(
    "A1",
    payload(),
    async (p, resolve) => {
      assert.equal(p.idempotency_key, key);
      resolve();
    },
    { storage, locks: locks() },
  );
  assert.equal(JSON.parse(storage.getItem(intentStorageKey("A1"))).state, "CONFIRMED");
});
test("two concurrent tabs retain one confirmed key and explicit new cart differs", async () => {
  const storage = store(),
    lock = locks(),
    keys = [];
  const operation = async (p, resolve) => {
    keys.push(p.idempotency_key);
    await new Promise((r) => setTimeout(r, 10));
    resolve();
  };
  await Promise.all([
    withDurableCheckoutIntent("A1", payload(), operation, { storage, locks: lock }),
    withDurableCheckoutIntent("A1", payload(), operation, { storage, locks: lock }),
  ]);
  assert.equal(new Set(keys).size, 1);
  await withDurableCheckoutIntent(
    "A1",
    { ...payload(), client_cart_reference: "b".repeat(64) },
    operation,
    { storage, locks: lock },
  );
  assert.equal(new Set(keys).size, 2);
});
test("uncertain changed payload and expired intent never send or clear", async () => {
  const storage = store(),
    lock = locks();
  await assert.rejects(
    withDurableCheckoutIntent(
      "A1",
      payload(),
      async () => {
        throw Error("timeout");
      },
      { storage, locks: lock, now: () => 100 },
    ),
  );
  let calls = 0;
  await assert.rejects(
    withDurableCheckoutIntent("A1", { ...payload(), expected_total: 35 }, async () => calls++, {
      storage,
      locks: lock,
      now: () => 101,
    }),
  );
  await assert.rejects(
    withDurableCheckoutIntent("A1", payload(), async () => calls++, {
      storage,
      locks: lock,
      now: () => 100 + 86400000,
    }),
  );
  assert.equal(calls, 0);
  assert.ok(storage.getItem(intentStorageKey("A1")));
});
test("blocked storage or missing locks refuses before operation", async () => {
  let calls = 0;
  const bad = {
    getItem: () => null,
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => {},
  };
  await assert.rejects(
    withDurableCheckoutIntent("A1", payload(), async () => calls++, {
      storage: bad,
      locks: locks(),
    }),
  );
  await assert.rejects(
    withDurableCheckoutIntent("A1", payload(), async () => calls++, {
      storage: store(),
      locks: null,
    }),
  );
  assert.equal(calls, 0);
});
test("separate instance keys and rollback are explicit", async () => {
  const storage = store(),
    lock = locks();
  for (const instance of ["A1", "A2", "B1"])
    await withDurableCheckoutIntent(instance, payload(instance), async () => {}, {
      storage,
      locks: lock,
    });
  assert.equal(storage.data.size, 3);
  await assert.rejects(
    withDurableCheckoutIntent("A1", payload("A2"), async () => {}, { storage, locks: lock }),
  );
  await withDurableCheckoutIntent("A1", payload(), async (p, resolve) => resolve(true), {
    storage,
    locks: lock,
  });
  assert.ok(storage.getItem(intentStorageKey("A1")));
  await withDurableCheckoutIntent("D1", payload("D1"), async (p, resolve) => resolve(true), {
    storage,
    locks: lock,
  });
  assert.equal(storage.getItem(intentStorageKey("D1")), null);
  assert.ok(storage.getItem(intentStorageKey("A2")));
});
