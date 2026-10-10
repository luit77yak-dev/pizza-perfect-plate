import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const data = (js) => "data:text/javascript;base64," + Buffer.from(js).toString("base64");
const compile = (file) =>
  ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const money = data(compile("../src/lib/domain/money.ts"));
const pricing = data(
  compile("../src/lib/domain/pricing.ts").replace('"./money"', JSON.stringify(money)),
);
const orders = data(compile("../src/features/visual-demo/engine/orders.ts"));
const model = data(
  compile("../src/features/visual-demo/data/model.ts")
    .replace('"zod"', JSON.stringify(pathToFileURL(require.resolve("zod")).href))
    .replace('"@/lib/domain/pricing"', JSON.stringify(pricing))
    .replace('"../engine/orders"', JSON.stringify(orders)),
);
const m = await import(model);
let checks = 0;
function ok(name, fn) {
  fn();
  checks++;
}
const initial = m.createInitialState,
  clone = (s) => structuredClone(s),
  selection = { "demo-size": ["demo-medium"] };
ok("valid initial and roundtrip", () =>
  assert.deepEqual(m.recoverState(JSON.stringify(initial())).state, initial()),
);
for (const raw of [
  "{broken",
  JSON.stringify({ ...initial(), version: 1 }),
  JSON.stringify({ ...initial(), privateToken: "secret" }),
  "x".repeat(2200001),
])
  ok("invalid storage recovers", () => assert.equal(m.recoverState(raw).recovered, true));
ok("empty storage is initial", () => assert.equal(m.recoverState(null).recovered, false));
for (const patch of [
  { price: -1 },
  { price: NaN },
  { price: Infinity },
  { price: 1.111 },
  { image: "https://example.com/private.png" },
  { image: "data:image/svg+xml;base64,PHN2Zz4=" },
  { categoryId: "other-tenant" },
])
  ok("invalid product rejected", () => {
    const s = initial();
    s.products[0] = { ...s.products[0], ...patch };
    assert.equal(m.stateSchema.safeParse(s).success, false);
  });
ok("duplicate IDs rejected", () => {
  const s = initial();
  s.products.push(s.products[0]);
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
ok("create/edit/delete product cascades flavor and combo links", () => {
  let s = initial();
  s.products.push({ ...s.products[0], id: "new", name: "Pizza teste", price: 60 });
  s = m.stateSchema.parse(s);
  assert.equal(m.quote(s, "new", selection).price, 60);
  s.products.find((p) => p.id === "new").price = 65;
  assert.equal(m.quote(s, "new", selection).price, 65);
  s = m.removeProduct(s, "demo-margherita");
  assert.equal(m.stateSchema.safeParse(s).success, true);
  assert.equal(
    s.groups.some((g) => g.options.some((o) => o.productId === "demo-margherita")),
    false,
  );
});
ok("image local validated", () => {
  const s = initial();
  s.products[0].image = "data:image/png;base64,aGVsbG8=";
  assert.equal(m.stateSchema.safeParse(s).success, true);
});
for (const patch of [{ active: false }, { available: false }])
  ok("unavailable product denied", () => {
    const s = initial();
    Object.assign(s.products[0], patch);
    assert.throws(() => m.quote(s, "demo-margherita", selection), /indisponível/);
  });
ok("inactive category denies", () => {
  const s = initial();
  s.categories[0].active = false;
  assert.throws(() => m.quote(s, "demo-margherita", selection));
});
ok("required size missing denied", () =>
  assert.throws(() => m.quote(initial(), "demo-margherita", {}), /Tamanho/),
);
ok("duplicate option denied", () =>
  assert.throws(() =>
    m.quote(initial(), "demo-margherita", { "demo-size": ["demo-medium", "demo-medium"] }),
  ),
);
ok("inactive option denied", () => {
  const s = initial();
  s.groups[0].options[0].active = false;
  assert.throws(() => m.quote(s, "demo-margherita", selection));
});
ok("inactive group rejects previous selection", () => {
  const s = initial();
  s.groups[0].active = false;
  assert.throws(() => m.quote(s, "demo-margherita", selection));
});
ok("foreign group rejected", () =>
  assert.throws(() =>
    m.quote(initial(), "demo-margherita", { ...selection, "admin-options": ["a"] }),
  ),
);
ok("paid/free extras and round calculation", () => {
  const s = initial();
  s.groups
    .find((g) => g.id === "demo-addon")
    .options.push({ ...s.groups[2].options[0], id: "free", price: 0 });
  assert.equal(
    m.quote(s, "demo-margherita", {
      ...selection,
      "demo-addon": ["demo-basil", "free"],
      "demo-crust": ["demo-crust-option"],
    }).price,
    47,
  );
});
ok("minimum and maximum counts enforced", () => {
  const s = initial(),
    g = s.groups.find((g) => g.id === "demo-addon");
  g.min = 1;
  g.max = 1;
  g.options.push({ ...g.options[0], id: "second" });
  assert.throws(() => m.quote(s, "demo-margherita", selection));
  assert.throws(() =>
    m.quote(s, "demo-margherita", { ...selection, "demo-addon": ["demo-basil", "second"] }),
  );
});
for (const [rule, expected] of [
  ["highest_half", 40],
  ["average_halves", 37.5],
  ["fixed_price", 55],
])
  ok("half rule " + rule, () => {
    const s = initial();
    s.products[0].halfRule = rule;
    s.products[0].halfFixedPrice = 55;
    assert.equal(
      m.quote(s, "demo-margherita", { ...selection, "demo-flavors": ["demo-flavor-marinara"] })
        .price,
      expected,
    );
  });
ok("half disallowed", () => {
  const s = initial();
  s.products[0].allowHalf = false;
  assert.throws(() =>
    m.quote(s, "demo-margherita", { ...selection, "demo-flavors": ["demo-flavor-marinara"] }),
  );
});
ok("inactive half product denied", () => {
  const s = initial();
  s.products[1].active = false;
  assert.throws(() =>
    m.quote(s, "demo-margherita", { ...selection, "demo-flavors": ["demo-flavor-marinara"] }),
  );
});
ok("shared group applies to multiple products/category", () => {
  const s = initial();
  const g = s.groups[2];
  g.categoryIds = [];
  g.productIds = ["demo-margherita", "demo-marinara"];
  assert.equal(
    m.quote(s, "demo-margherita", { ...selection, "demo-addon": ["demo-basil"] }).price,
    42,
  );
  assert.equal(
    m.quote(s, "demo-marinara", { ...selection, "demo-addon": ["demo-basil"] }).price,
    37,
  );
});
ok("drink volume pricing", () =>
  assert.equal(m.quote(initial(), "demo-water", { "demo-volumes": ["demo-2l"] }).price, 11),
);
ok("combo references current price and volume", () => {
  const s = initial(),
    g = s.groups.find((g) => g.kind === "COMBO");
  g.options[0].variantId = "demo-600";
  s.products.find((p) => p.id === "demo-water").price = 6;
  assert.equal(
    m.quote(s, "demo-margherita", { ...selection, "demo-combo": ["demo-combo-water"] }).price,
    48,
  );
});
ok("inactive drink denied in combo", () => {
  const s = initial();
  s.products.find((p) => p.id === "demo-water").active = false;
  assert.throws(() =>
    m.quote(s, "demo-margherita", { ...selection, "demo-combo": ["demo-combo-water"] }),
  );
});
ok("inactive volume denied in combo", () => {
  const s = initial();
  s.groups.find((g) => g.kind === "COMBO").options[0].variantId = "demo-600";
  s.groups.find((g) => g.id === "demo-volumes").options[1].active = false;
  assert.throws(() =>
    m.quote(s, "demo-margherita", { ...selection, "demo-combo": ["demo-combo-water"] }),
  );
});
ok("remove volume group clears references", () => {
  let s = initial();
  s.groups.find((g) => g.kind === "COMBO").options[0].variantId = "demo-600";
  s = m.removeGroup(s, "demo-volumes");
  assert.equal(m.stateSchema.safeParse(s).success, true);
  assert.equal(s.groups.find((g) => g.kind === "COMBO").options[0].variantId, null);
});
ok("invalid bounds/references rejected", () => {
  const s = initial();
  s.groups[0].min = 2;
  assert.equal(m.stateSchema.safeParse(s).success, false);
  s.groups[0].min = 1;
  s.groups[0].productIds = ["foreign"];
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
for (const quantity of [0, -1, 1.5, 100, NaN])
  ok("invalid quantity denied", () =>
    assert.throws(() => m.quote(initial(), "demo-margherita", selection, quantity)),
  );
ok("cart price immutable and stale checkout denied", () => {
  const s = initial(),
    token = m.catalogToken(s),
    item = m.makeCartItem(s, "demo-margherita", selection, 2, "");
  s.products[0].price = 50;
  assert.equal(item.unitPrice, 40);
  assert.throws(() => m.submitDemoOrder(s, [item], token, "Retirada", null), /mudou/);
});
ok("appearance/name change does not reprice cart", () => {
  const s = initial(),
    token = m.catalogToken(s);
  s.store.name = "Outra demo";
  s.store.accent = "#ff0000";
  assert.equal(m.catalogToken(s), token);
});
ok("reset generation invalidates cart", () => {
  const s = initial(),
    token = m.catalogToken(s);
  s.generation = "reset";
  assert.notEqual(m.catalogToken(s), token);
});
ok("checkout only local unpaid synthetic order", () => {
  const s = initial(),
    item = m.makeCartItem(s, "demo-margherita", selection, 2, "");
  const result = m.submitDemoOrder(s, [item], m.catalogToken(s), "Entrega", "demo-centro");
  assert.equal(result.orders[0].name, "Visitante fictício");
  assert.equal(result.orders[0].fee, 6);
  assert.equal(result.orders[0].paidAmount, 0);
  assert.equal(result.orders[0].payment, "PENDING");
  assert.equal(m.stateSchema.safeParse(result).success, true);
});
for (const patch of [{ open: false }, { pickup: false }])
  ok("closed/disabled fulfillment checkout denied", () => {
    const s = initial(),
      item = m.makeCartItem(s, "demo-margherita", selection, 1, "");
    Object.assign(s.store, patch);
    assert.throws(() => m.submitDemoOrder(s, [item], m.catalogToken(s), "Retirada", null));
  });
ok("delivery must have zone", () => {
  const s = initial(),
    item = m.makeCartItem(s, "demo-margherita", selection, 1, "");
  assert.throws(() => m.submitDemoOrder(s, [item], m.catalogToken(s), "Entrega", "foreign"));
});
ok("empty or forged cart rejected", () => {
  const s = initial();
  assert.throws(() => m.submitDemoOrder(s, [], m.catalogToken(s), "Retirada", null));
  const item = m.makeCartItem(s, "demo-margherita", selection, 1, "");
  item.productId = "real-order-id";
  assert.throws(() => m.submitDemoOrder(s, [item], m.catalogToken(s), "Retirada", null));
});
ok("notification dedupe/limit/TTL", () => {
  let s = initial();
  s = m.notifyState(s, "same", "one");
  s = m.notifyState(s, "same", "two");
  assert.equal(s.notifications.length, 1);
  s.notifications[0].created = 0;
  s = m.notifyState(s, "new", "new");
  assert.equal(s.notifications.length, 1);
  for (let i = 0; i < 30; i++) s = m.notifyState(s, String(i), "test");
  assert.equal(s.notifications.length, 20);
});
ok("paid values remain independent of appended items", () => {
  const s = initial(),
    o = s.orders[0];
  o.items.push({ name: "Extra", price: 15, quantity: 1, added: true });
  o.payment = "PENDING";
  assert.equal(o.paidAmount, 63.9);
  assert.equal(m.stateSchema.safeParse(s).success, true);
  o.payment = "PAID";
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
ok("demo uses no backend imports", () => {
  for (const file of ["model.ts", "store.ts", "catalog-adapter.ts"]) {
    const src = readFileSync(
      new URL("../src/features/visual-demo/data/" + file, import.meta.url),
      "utf8",
    );
    assert.equal(/supabase|\.rpc\(|fetch\(|axios/i.test(src), false);
  }
});
ok("low-contrast identity rejected", () => {
  const s = initial();
  s.store.foreground = s.store.background;
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
ok("multiple half flavor groups rejected", () => {
  const s = initial(),
    g = clone(s.groups.find((g) => g.kind === "FLAVOR"));
  g.id = "another-flavor";
  g.options = g.options.map((o) => ({ ...o, id: o.id + "-other" }));
  s.groups.push(g);
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
ok("duplicate option IDs across groups rejected", () => {
  const s = initial();
  s.groups[1].options[0].id = s.groups[0].options[0].id;
  assert.equal(m.stateSchema.safeParse(s).success, false);
});
ok("editing volume group clears removed combo references", () => {
  const s = initial();
  s.groups.find((g) => g.kind === "COMBO").options[0].variantId = "demo-600";
  const g = clone(s.groups.find((g) => g.id === "demo-volumes"));
  g.options = g.options.filter((o) => o.id !== "demo-600");
  const n = m.replaceGroup(s, g);
  assert.equal(n.groups.find((g) => g.kind === "COMBO").options[0].variantId, null);
  assert.equal(m.stateSchema.safeParse(n).success, true);
});
ok("append uses authoritative current operational status", () => {
  const s = initial();
  s.orders[0].status = "OUT_FOR_DELIVERY";
  assert.throws(
    () => m.appendDemoItem(s, 1042, { name: "Extra", price: 15, quantity: 1 }),
    /bloqueada/,
  );
  s.orders[0].status = "PREPARING";
  const n = m.appendDemoItem(s, 1042, { name: "Extra", price: 15, quantity: 1 });
  assert.equal(n.orders[0].paidAmount, 63.9);
  assert.equal(n.orders[0].updated, true);
  assert.equal(m.stateSchema.safeParse(n).success, true);
});
ok("reserved group identifier rejected on recovery", () => {
  const s = initial();
  s.groups[0].id = "constructor";
  assert.equal(m.recoverState(JSON.stringify(s)).recovered, true);
});
ok("malformed selection type denied", () =>
  assert.throws(() => m.quote(initial(), "demo-margherita", { "demo-size": {} }), /inválida/),
);
console.log(`${checks} demo V2 domain/security checks passed`);
