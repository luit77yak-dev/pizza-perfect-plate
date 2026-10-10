import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const data = (s) => "data:text/javascript;base64," + Buffer.from(s).toString("base64");
const compile = (p) =>
  ts.transpileModule(readFileSync(new URL(p, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const money = data(compile("../src/lib/domain/money.ts"));
const pricing = data(
  compile("../src/lib/domain/pricing.ts").replace('"./money"', JSON.stringify(money)),
);
const orders = data(compile("../src/features/visual-demo/engine/orders.ts"));
const m = await import(
  data(
    compile("../src/features/visual-demo/data/model.ts")
      .replace('"zod"', JSON.stringify(pathToFileURL(require.resolve("zod")).href))
      .replace('"@/lib/domain/pricing"', JSON.stringify(pricing))
      .replace('"../engine/orders"', JSON.stringify(orders)),
  )
);
const engine = await import(orders);
let checks = 0;
function check(label, fn) {
  fn();
  checks++;
}
const state = m.createInitialState();
const item = m.makeCartItem(
  state,
  "demo-margherita",
  { "demo-size": ["demo-medium"] },
  2,
  "PRIVATE_SENTINEL@example.invalid",
);
for (const fulfillment of ["Entrega", "Retirada"]) {
  const draft = engine.exampleDraft(fulfillment, "demo-centro");
  const snap = engine.checkoutSnapshot(state, [item], draft);
  const next = m.submitDemoOrder(
    state,
    [item],
    m.catalogToken(state),
    fulfillment,
    draft.zoneId,
    snap,
  );
  const order = next.orders[0];
  check("snapshot amounts shared " + fulfillment, () =>
    assert.deepEqual(engine.orderAmounts(order.items, order.fee), {
      subtotal: snap.subtotal,
      fee: snap.fee,
      total: snap.total,
    }),
  );
  check("only predefined profile persisted " + fulfillment, () => {
    assert.equal(order.name, engine.exampleCustomer.name);
    assert.ok(!JSON.stringify(next).includes("PRIVATE_SENTINEL"));
    assert.ok(order.customerProfile);
  });
  check("valid service " + fulfillment, () =>
    assert.deepEqual(engine.validateService(draft, state), {}),
  );
  let walked = next;
  const flow = engine.orderFlow(fulfillment);
  for (const status of flow.slice(1)) walked = engine.changeOrderStatus(walked, order.id, status);
  check("terminal transition denied " + fulfillment, () =>
    assert.throws(() => engine.changeOrderStatus(walked, order.id, "RECEIVED")),
  );
  check("pickup never dispatches " + fulfillment, () =>
    assert.equal(flow.includes("OUT_FOR_DELIVERY"), fulfillment === "Entrega"),
  );
  const cancelled = engine.changeOrderStatus(next, order.id, "CANCELLED");
  check("cancel terminal " + fulfillment, () => {
    assert.equal(cancelled.orders[0].status, "CANCELLED");
    assert.equal(engine.nextOrderStatus(cancelled.orders[0]), null);
    assert.throws(() => engine.changeOrderStatus(cancelled, order.id, "CONFIRMED"));
    assert.throws(() =>
      m.appendDemoItem(cancelled, order.id, { name: "test", price: 1, quantity: 1 }),
    );
  });
  check("skip status rejected " + fulfillment, () =>
    assert.throws(() => engine.changeOrderStatus(next, order.id, "PREPARING")),
  );
  const wrong = { ...snap, total: snap.total + 1 };
  check("confirmation price mismatch rejected " + fulfillment, () =>
    assert.throws(() =>
      m.submitDemoOrder(state, [item], m.catalogToken(state), fulfillment, draft.zoneId, wrong),
    ),
  );
}
check("fee changed after confirmation rejected", () => {
  const draft = engine.exampleDraft("Entrega", "demo-centro"),
    snap = engine.checkoutSnapshot(state, [item], draft);
  const changed = {
    ...state,
    zones: state.zones.map((z) => (z.id === draft.zoneId ? { ...z, fee: z.fee + 1 } : z)),
  };
  assert.throws(() =>
    m.submitDemoOrder(
      changed,
      [item],
      m.catalogToken(changed),
      draft.fulfillment,
      draft.zoneId,
      snap,
    ),
  );
});
check("reset during checkout rejects", () => {
  const draft = engine.exampleDraft(),
    snap = engine.checkoutSnapshot(state, [item], draft),
    reset = { ...state, generation: "reset-new" };
  assert.throws(() =>
    m.submitDemoOrder(reset, [item], m.catalogToken(state), "Retirada", null, snap),
  );
});
check("stale price rejects", () => {
  const changed = { ...state, products: state.products.map((p) => ({ ...p, price: p.price + 1 })) };
  assert.throws(() => m.submitDemoOrder(changed, [item], m.catalogToken(state), "Retirada", null));
});
check("pickup address optional", () =>
  assert.deepEqual(
    engine.validateService(
      { ...engine.exampleDraft(), street: "", number: "", zip: "", zoneId: "" },
      state,
    ),
    {},
  ),
);
for (const key of ["name", "phone", "street", "number", "zoneId"])
  check("invalid field " + key, () =>
    assert.ok(
      engine.validateService(
        { ...engine.exampleDraft("Entrega", "demo-centro"), [key]: "" },
        state,
      )[key],
    ),
  );
check("bad optional CEP invalid", () =>
  assert.ok(
    engine.validateService(
      { ...engine.exampleDraft("Entrega", "demo-centro"), zip: "invalid" },
      state,
    ).zip,
  ),
);
check("old V2 schema preserved", () => {
  const legacy = m.createInitialState();
  legacy.version = 2;
  for (const o of legacy.orders) {
    delete o.customerProfile;
    for (const i of o.items) {
      delete i.image;
      delete i.details;
    }
  }
  assert.deepEqual(m.recoverState(JSON.stringify(legacy)), {
    state: { ...legacy, version: 3 },
    recovered: false,
    migrated: true,
  });
});
check("optional profile rejects arbitrary personal details", () =>
  assert.equal(
    m.stateSchema.safeParse({
      ...state,
      orders: [{ ...state.orders[0], customerProfile: "real-person" }],
    }).success,
    false,
  ),
);
check("integer cent totals", () =>
  assert.deepEqual(
    engine.orderAmounts(
      [
        { price: 0.1, quantity: 3 },
        { price: 0.2, quantity: 1 },
      ],
      0.1,
    ),
    { subtotal: 0.5, fee: 0.1, total: 0.6 },
  ),
);
console.log(`${checks} demo V2.1 domain/privacy checks passed`);
