// Tests only an isolated Vercel build; never accepts a hosted URL.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve(process.argv[2] ?? "");
assert.ok(
  process.argv[2] && existsSync(join(output, "functions/__server.func/index.mjs")),
  "Supply isolated .vercel/output directory",
);
const evidence = resolve(process.env.FORNO_TEST_EVIDENCE ?? "/tmp/forno-panel-tests");
mkdirSync(evidence, { recursive: true });
const results = [],
  requests = [],
  blocked = [],
  errors = [];
let serverCalls = 0;
globalThis.fetch = async () => {
  serverCalls++;
  throw new Error("Outbound server request prohibited");
};
const { default: entry } = await import(
  pathToFileURL(join(output, "functions/__server.func/index.mjs"))
);
function check(test, value) {
  results.push({ test, pass: Boolean(value) });
  writeFileSync(join(evidence, "progress.json"), JSON.stringify(results));
  assert.ok(value, test);
}
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.VERCEL_TARGET_ENV = "production";
for (const path of ["/visual-demo", "/visual-demo/painel", "/visual-demo/painel/"]) {
  const response = await entry.fetch(
    new Request("https://synthetic.vercel.app" + path, {
      headers: { "x-vercel-env": "preview", "x-forwarded-host": "localhost" },
    }),
    {},
  );
  check(
    "production denial " + path,
    response.status === 404 && response.headers.get("cache-control")?.includes("no-store"),
  );
}
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;
check(
  "unknown runtime denies panel",
  (await entry.fetch(new Request("https://synthetic.vercel.app/visual-demo/painel"), {})).status ===
    404,
);
process.env.VERCEL_ENV = "preview";
process.env.VERCEL_TARGET_ENV = "preview";
const panelResponse = await entry.fetch(
  new Request("https://synthetic.vercel.app/visual-demo/painel"),
  {},
);
const panelHtml = await panelResponse.text();
check(
  "panel SSR renders panel, not storefront",
  panelResponse.status === 200 &&
    panelHtml.includes("Sua operação, em boas mãos.") &&
    !panelHtml.includes("Personalizar Margherita"),
);
const menuHtml = await (
  await entry.fetch(new Request("https://synthetic.vercel.app/visual-demo"), {})
).text();
check(
  "public demo route preserved",
  menuHtml.includes("Personalizar Margherita") && !menuHtml.includes("Sua operação, em boas mãos."),
);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    requests.push({ path, method: req.method });
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    const file = join(output, "static", path);
    if (path.startsWith("/assets/") && existsSync(file)) {
      res.setHeader("content-type", path.endsWith(".css") ? "text/css" : "text/javascript");
      res.end(readFileSync(file));
      return;
    }
    const response = await entry.fetch(
      new Request("http://127.0.0.1" + req.url, { headers: req.headers }),
      {},
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500);
    res.end(error.message);
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  const { chromium } = createRequire(import.meta.url)(
    process.env.PLAYWRIGHT_MODULE ?? "playwright",
  );
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.origin === origin) return r.continue();
    blocked.push({ host: u.hostname, path: u.pathname });
    return r.abort();
  });
  await context.addInitScript(() => {
    window.audioProbe = { contexts: 0, started: 0, resumes: 0, mode: "ok" };
    window.AudioContext = class {
      constructor() {
        audioProbe.contexts++;
        this.state = "suspended";
        this.currentTime = 0;
        this.destination = {};
      }
      async resume() {
        audioProbe.resumes++;
        if (audioProbe.mode === "reject") throw Error("Autoplay bloqueado (teste)");
        this.state = audioProbe.mode === "suspend" ? "suspended" : "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          disconnect() {},
        };
      }
      createOscillator() {
        return {
          frequency: {},
          connect() {},
          disconnect() {},
          start() {
            audioProbe.started++;
          },
          stop() {
            queueMicrotask(() => this.onended?.());
          },
        };
      }
    };
  });
  context.setDefaultTimeout(10000);
  const shop = await context.newPage(),
    admin = await context.newPage();
  for (const p of [shop, admin]) p.on("pageerror", (e) => errors.push(e.message));
  await shop.goto(origin + "/visual-demo/");
  await admin.goto(origin + "/visual-demo/painel");
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).waitFor();
  const nav = async (label) => {
    await admin.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await admin
      .locator(".forno-sidebar")
      .getByRole("button", { name: new RegExp("^" + label + "(?: \\d+)?$") })
      .click();
  };
  async function startCheckout() {
    await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
    check(
      "single required choice selected automatically",
      await shop.getByLabel(/Média/).isChecked(),
    );
    await shop.getByLabel(/Média/).check();
    await shop.getByLabel("Observação fictícia", { exact: true }).fill("SECRET_NOTE_SENTINEL");
    await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
    check(
      "successful add opens bag",
      await shop.getByRole("dialog", { name: "Carrinho", exact: true }).isVisible(),
    );
    await shop.getByRole("button", { name: "Aumentar", exact: true }).click();
    await shop.getByRole("button", { name: "Diminuir", exact: true }).click();
    await shop.getByRole("button", { name: "Modificar Margherita", exact: true }).click();
    await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
    check(
      "bag edit returns to bag without duplicate",
      (await shop.getByRole("button", { name: "Modificar Margherita", exact: true }).count()) === 1,
    );
    await shop.getByRole("button", { name: "Continuar comprando", exact: true }).click();
    await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
    check(
      "continue shopping preserves bag",
      await shop.getByRole("button", { name: "Modificar Margherita", exact: true }).isVisible(),
    );
    await shop.getByRole("button", { name: "Continuar para checkout", exact: true }).click();
  }
  const dialog = () => shop.getByRole("dialog", { name: "Checkout simulado" });
  const tracking = () => shop.getByRole("dialog", { name: "Acompanhamento fictício" });
  const noOverflow = async (page) =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        [...document.querySelectorAll('[role="dialog"]')].every(
          (d) => d.scrollWidth <= d.clientWidth + 1,
        ),
    );
  await admin.getByRole("button", { name: "Ativar som", exact: true }).click();
  check(
    "enable initializes without automatic tone",
    await admin.evaluate(() => audioProbe.contexts === 1 && audioProbe.started === 0),
  );
  await admin.getByRole("button", { name: "Testar som", exact: true }).click();
  await admin.waitForFunction(() => audioProbe.started === 1);
  check("manual audio test plays after interaction", true);
  await startCheckout();
  check(
    "review lists product and price",
    await dialog().getByRole("heading", { name: "1× Margherita", exact: true }).isVisible(),
  );
  await dialog().getByRole("button", { name: "Editar Margherita", exact: true }).click();
  check("edit restores size selection", await shop.getByLabel(/Média/).isChecked());
  await shop.getByLabel("Quantidade", { exact: true }).fill("2");
  await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  check(
    "edit replaces rather than duplicates",
    await dialog().getByRole("heading", { name: "2× Margherita", exact: true }).isVisible(),
  );
  await dialog().getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog()
    .getByRole("button", { name: /Entrega Endereço de exemplo/ })
    .click();
  await dialog().getByLabel("Nome fictício", { exact: false }).fill("");
  await dialog().getByLabel("Telefone fictício", { exact: false }).fill("1");
  await dialog().getByLabel("Rua fictícia", { exact: false }).fill("");
  await dialog().getByLabel("Número fictício", { exact: false }).fill("");
  await dialog().getByLabel("Bairro", { exact: true }).selectOption("demo-centro");
  await dialog().getByRole("button", { name: "Revisar confirmação", exact: true }).click();
  check(
    "accessible required field validation",
    (await dialog().locator('[aria-invalid="true"]').count()) >= 4,
  );
  await shop.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
  check(
    "neighborhood alone does not confirm and focuses first error",
    await dialog()
      .getByLabel("Nome fictício", { exact: false })
      .evaluate((el) => el === document.activeElement),
  );
  await dialog().getByRole("button", { name: "Usar dados de exemplo", exact: true }).click();
  await dialog().getByLabel("Nome fictício", { exact: false }).fill("PRIVATE_NAME_SENTINEL");
  await dialog().getByLabel("Rua fictícia", { exact: false }).fill("PRIVATE_ADDRESS_SENTINEL");
  await dialog().getByLabel("Telefone fictício", { exact: false }).fill("11999998888");
  await dialog()
    .getByLabel("Observações fictícias", { exact: true })
    .fill("PRIVATE_ORDER_NOTE_SENTINEL");
  await dialog().getByLabel("Bairro", { exact: true }).selectOption("demo-centro");
  await dialog().getByRole("button", { name: "Voltar ao carrinho", exact: true }).click();
  await shop.getByRole("button", { name: "Continuar para checkout", exact: true }).click();
  await dialog().getByRole("button", { name: "Continuar", exact: true }).click();
  check(
    "memory draft survives return to cart",
    (await dialog().getByLabel("Nome fictício", { exact: false }).inputValue()) ===
      "PRIVATE_NAME_SENTINEL",
  );
  await dialog()
    .getByRole("button", { name: /Entrega Endereço de exemplo/ })
    .click();
  for (const width of [320, 375, 390, 430]) {
    await shop.setViewportSize({ width, height: 780 });
    check("service no overflow " + width, await noOverflow(shop));
    await shop.screenshot({ path: join(evidence, `checkout-service-${width}.png`) });
  }
  await dialog().getByRole("button", { name: "Revisar confirmação", exact: true }).click();
  check(
    "confirmation uses only predetermined fictional profile",
    (await dialog()
      .getByRole("heading", { name: "Visitante fictício", exact: true })
      .isVisible()) && !(await dialog().textContent()).includes("PRIVATE_NAME_SENTINEL"),
  );
  check(
    "confirmation subtotal fee total consistent",
    (await dialog().locator(".forno-amounts").textContent()).includes("86,00"),
  );
  await nav("Entregas");
  await admin.getByRole("button", { name: "Editar bairro Centro", exact: true }).click();
  await admin.getByLabel("Taxa fictícia (R$)", { exact: true }).fill("7");
  await admin.getByRole("button", { name: "Salvar taxa simulada", exact: true }).click();
  await shop.getByText(/A taxa ou a modalidade mudou/).waitFor();
  check(
    "fee change invalidates reviewed confirmation",
    await dialog()
      .getByRole("button", { name: "Confirmar somente na demonstração", exact: true })
      .isDisabled(),
  );
  await dialog().getByRole("button", { name: "Voltar", exact: true }).click();
  await dialog().getByRole("button", { name: "Revisar confirmação", exact: true }).click();
  for (const width of [320, 375, 390, 430]) {
    await shop.setViewportSize({ width, height: 780 });
    check("confirmation no overflow " + width, await noOverflow(shop));
    await shop.screenshot({ path: join(evidence, `checkout-confirm-${width}.png`) });
  }
  await dialog()
    .getByRole("button", { name: "Confirmar somente na demonstração", exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await tracking()
    .getByRole("status")
    .getByRole("heading", { name: "Pedido recebido", exact: true })
    .waitFor();
  await admin.waitForFunction(() => audioProbe.started === 2);
  check("new order in other tab rings once", true);
  check(
    "tracking total matches confirmation snapshot",
    (await tracking().locator(".forno-amounts").textContent()).includes("87,00"),
  );
  const stored = await shop.evaluate(() => localStorage.getItem("neroxa:visual-demo:forno:v4"));
  check(
    "rapid repeated confirmation creates one order",
    JSON.parse(stored).orders.filter((o) => o.name === "Visitante fictício").length === 1,
  );
  check(
    "no freely entered personal data or notes persisted",
    !/PRIVATE_|SECRET_NOTE_SENTINEL|11999998888/.test(stored),
  );
  await nav("Pedidos");
  const order = () =>
    admin
      .locator(".forno-order")
      .filter({ has: admin.getByRole("button", { name: /Pedido #1045 de Visitante/ }) });
  await order()
    .getByRole("button", { name: /Pedido #1045 de Visitante/ })
    .click();
  check("admin sees same snapshot amount", (await order().textContent()).includes("87,00"));
  await order().getByRole("button", { name: "Avançar para: Confirmado", exact: true }).click();
  await tracking()
    .getByRole("status")
    .getByRole("heading", { name: "Pedido confirmado", exact: true })
    .waitFor();
  check("open tracking updates across tabs", true);
  await order().getByRole("button", { name: "Cancelar pedido demonstrativo", exact: true }).click();
  await tracking()
    .getByRole("status")
    .getByRole("heading", { name: "Pedido cancelado", exact: true })
    .waitFor();
  check(
    "cancelled tracking hides timeline and has no status controls",
    (await tracking().locator(".forno-order-timeline").count()) === 0 &&
      (await tracking()
        .getByRole("button", { name: /Avançar|Cancelar pedido/ })
        .count()) === 0,
  );
  check(
    "state changes do not duplicate order tone",
    await admin.evaluate(() => audioProbe.started === 2),
  );
  await tracking().getByRole("button", { name: "Fechar acompanhamento", exact: true }).click();
  await shop.reload();
  await shop.getByRole("button", { name: "Acompanhar pedido", exact: true }).click();
  await tracking()
    .getByRole("status")
    .getByRole("heading", { name: "Pedido cancelado", exact: true })
    .waitFor();
  check("tracking closes reopens and reloads", true);
  await tracking().getByRole("button", { name: "Fechar acompanhamento", exact: true }).click();
  await admin.reload();
  await admin.getByRole("button", { name: "Desativar som", exact: true }).waitFor();
  check(
    "audio preference survives reload without autoplay",
    await admin.evaluate(() => audioProbe.contexts === 0 && audioProbe.started === 0),
  );
  await admin.getByRole("button", { name: "Testar som", exact: true }).click();
  await admin.waitForFunction(() => audioProbe.started === 1);
  await startCheckout();
  await dialog().getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog()
    .getByRole("button", { name: /Retirada Na casa fictícia/ })
    .click();
  check(
    "pickup never requires address",
    (await dialog().getByLabel("Rua fictícia", { exact: false }).count()) === 0,
  );
  await dialog().getByRole("button", { name: "Revisar confirmação", exact: true }).click();
  await dialog()
    .getByRole("button", { name: "Confirmar somente na demonstração", exact: true })
    .click();
  await nav("Pedidos");
  const pickup = () =>
    admin
      .locator(".forno-order")
      .filter({ has: admin.getByRole("button", { name: /Pedido #1046 de Visitante/ }) });
  await pickup()
    .getByRole("button", { name: /Pedido #1046 de Visitante/ })
    .click();
  for (const [next, label] of [
    ["Confirmado", "Pedido confirmado"],
    ["Em preparo", "Em preparo"],
    ["Pronto para retirada", "Pronto para retirada"],
    ["Retirado", "Retirado"],
  ]) {
    await pickup()
      .getByRole("button", { name: "Avançar para: " + next, exact: true })
      .click();
    await tracking()
      .getByRole("status")
      .getByRole("heading", { name: label, exact: true })
      .waitFor();
    check("pickup tracking " + label, true);
  }
  check(
    "pickup timeline has no delivery stage",
    !(await tracking().textContent()).includes("Saiu para entrega"),
  );
  for (const width of [320, 375, 390, 430]) {
    await shop.setViewportSize({ width, height: 780 });
    check("tracking no overflow " + width, await noOverflow(shop));
    await shop.screenshot({ path: join(evidence, `tracking-${width}.png`) });
    await admin.setViewportSize({ width, height: 780 });
    check("panel no overflow " + width, await noOverflow(admin));
    await admin.evaluate(() => window.scrollTo(0, 0));
    await admin.screenshot({ path: join(evidence, `panel-${width}.png`) });
  }
  // Reset an already-open tracking view, including ID reuse protection.
  await admin.getByRole("button", { name: "Restaurar demonstração", exact: true }).click();
  await admin.getByRole("button", { name: "Confirmar restauração", exact: true }).click();
  await tracking().getByRole("heading", { name: "Demonstração restaurada", exact: true }).waitFor();
  check("reset invalidates open tracking", true);
  await tracking().getByRole("button", { name: "Fechar acompanhamento", exact: true }).click();
  await startCheckout();
  await dialog().getByRole("button", { name: "Continuar", exact: true }).click();
  await admin.getByRole("button", { name: "Restaurar demonstração", exact: true }).click();
  await admin.getByRole("button", { name: "Confirmar restauração", exact: true }).click();
  await dialog()
    .getByText(/O catálogo ou a demonstração mudou/)
    .waitFor();
  check(
    "reset blocks active checkout",
    await dialog().getByRole("button", { name: "Revisar confirmação", exact: true }).isDisabled(),
  );
  await shop.keyboard.press("Escape");
  await shop.reload();
  await startCheckout();
  await nav("Cardápio");
  await admin.getByRole("button", { name: "Editar produto Margherita", exact: true }).click();
  await admin.getByLabel("Preço base (R$)", { exact: true }).fill("55");
  await admin.getByRole("button", { name: "Salvar produto", exact: true }).click();
  await dialog()
    .getByText(/O catálogo ou a demonstração mudou/)
    .waitFor();
  check(
    "price edit blocks old checkout snapshot",
    await dialog().getByRole("button", { name: "Continuar", exact: true }).isDisabled(),
  );
  // Failure/suspension diagnosed; none causes a panel error.
  await admin.getByRole("button", { name: "Desativar som", exact: true }).click();
  await admin.evaluate(() => (audioProbe.mode = "reject"));
  await admin.getByRole("button", { name: "Ativar som", exact: true }).click();
  await admin.getByText("Autoplay bloqueado (teste)", { exact: true }).waitFor();
  check("audio rejection visible", true);
  await admin.evaluate(() => (audioProbe.mode = "suspend"));
  await admin.getByRole("button", { name: "Testar som", exact: true }).click();
  await admin.getByText(/O navegador bloqueou o áudio/).waitFor();
  check("suspended audio diagnosed", true);
  await admin.evaluate(() => (audioProbe.mode = "ok"));
  await admin.getByRole("button", { name: "Testar som", exact: true }).click();
  await admin.getByText(/Som liberado nesta aba/).waitFor();
  check("audio recovers after gesture", true);
  await admin.evaluate(() => {
    window.AudioContext = undefined;
  });
  await admin.getByRole("button", { name: "Testar som", exact: true }).click();
  await admin.getByText("Áudio não disponível neste navegador.", { exact: true }).waitFor();
  check("unsupported audio handled without panel failure", true);
  const memory = await browser.newContext({ viewport: { width: 320, height: 700 } });
  await memory.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  await memory.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw Error("blocked");
    };
  });
  const mpage = await memory.newPage();
  mpage.on("pageerror", (e) => errors.push(e.message));
  await mpage.goto(origin + "/visual-demo/");
  await mpage.getByText(/Armazenamento indisponível/).waitFor();
  await mpage.getByRole("button", { name: "Personalizar Água", exact: true }).click();
  await mpage.getByLabel(/600 ml/).check();
  await mpage.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await mpage.getByRole("button", { name: "Continuar para checkout", exact: true }).click();
  await mpage.getByRole("button", { name: "Continuar", exact: true }).click();
  await mpage.getByRole("button", { name: "Revisar confirmação", exact: true }).click();
  await mpage
    .getByRole("button", { name: "Confirmar somente na demonstração", exact: true })
    .click();
  await mpage
    .getByRole("status")
    .getByRole("heading", { name: "Pedido recebido", exact: true })
    .waitFor();
  check("storage denied keeps checkout and tracking in memory", true);
  await memory.close();
  const legacySeed = await shop.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v4"));
    s.version = 2;
    for (const o of s.orders) {
      delete o.customerProfile;
      delete o.requestId;
      for (const i of o.items) {
        delete i.image;
        delete i.details;
      }
    }
    return JSON.stringify(s);
  });
  const migration = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await migration.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  await migration.addInitScript(
    (raw) => localStorage.setItem("neroxa:visual-demo:forno:v2", raw),
    legacySeed,
  );
  const legacyPage = await migration.newPage();
  legacyPage.on("pageerror", (e) => errors.push(e.message));
  await legacyPage.goto(origin + "/visual-demo/painel");
  await legacyPage.getByText(/Dados demonstrativos V2 importados/).waitFor();
  check(
    "legacy state migrated without deleting backup",
    await legacyPage.evaluate(
      (original) =>
        localStorage.getItem("neroxa:visual-demo:forno:v2") === original &&
        JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v4")).version === 4,
      legacySeed,
    ),
  );
  check(
    "migration preserves catalog and orders",
    await legacyPage.evaluate((original) => {
      const before = JSON.parse(original),
        after = JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v4"));
      return (
        JSON.stringify(before.products) === JSON.stringify(after.products) &&
        JSON.stringify(before.orders) === JSON.stringify(after.orders)
      );
    }, legacySeed),
  );
  await legacyPage.evaluate(() => {
    const old = JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v2"));
    old.store.name = "Aba V2 antiga";
    localStorage.setItem("neroxa:visual-demo:forno:v2", JSON.stringify(old));
  });
  await legacyPage.reload();
  check(
    "old-version writes cannot replace V21 state",
    !(await legacyPage.textContent("body")).includes("Aba V2 antiga"),
  );
  await migration.close();
  const v3 = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await v3.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const v3seed = JSON.stringify({ ...JSON.parse(legacySeed), version: 3 });
  await v3.addInitScript((raw) => localStorage.setItem("neroxa:visual-demo:forno:v3", raw), v3seed);
  const v3page = await v3.newPage();
  await v3page.goto(origin + "/visual-demo/");
  await v3page.getByText(/Dados demonstrativos V2.1 importados/).waitFor();
  check(
    "V3 migration preserves original and confirmed orders",
    await v3page.evaluate((raw) => {
      const next = JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v4"));
      return (
        localStorage.getItem("neroxa:visual-demo:forno:v3") === raw &&
        JSON.stringify(next.orders) === JSON.stringify(JSON.parse(raw).orders)
      );
    }, v3seed),
  );
  await v3page.evaluate(() => {
    const old = JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v3"));
    old.store.name = "Aba V3 antiga";
    localStorage.setItem("neroxa:visual-demo:forno:v3", JSON.stringify(old));
  });
  await v3page.reload();
  check(
    "old V3 tabs cannot overwrite V4",
    !(await v3page.textContent("body")).includes("Aba V3 antiga"),
  );
  await v3.close();
  const corrupt = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await corrupt.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const corruptPage = await corrupt.newPage();
  await corruptPage.goto(origin + "/visual-demo/painel");
  await corruptPage.evaluate(() => localStorage.setItem("neroxa:visual-demo:forno:v4", "invalid"));
  await corruptPage.reload();
  await corruptPage.getByText(/Dados locais inválidos/).waitFor();
  await corruptPage.getByRole("button", { name: "Restaurar demonstração", exact: true }).click();
  await corruptPage.getByRole("button", { name: "Confirmar restauração", exact: true }).click();
  check(
    "explicit restore recovers corrupt V4 storage",
    await corruptPage.evaluate(
      () => JSON.parse(localStorage.getItem("neroxa:visual-demo:forno:v4")).version === 4,
    ),
  );
  await corrupt.close();
  const native = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await native.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  await native.addInitScript(() => {
    const Original = window.AudioContext;
    window.nativeContexts = [];
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        nativeContexts.push(this);
      }
    };
  });
  const nativePage = await native.newPage();
  nativePage.on("pageerror", (e) => errors.push(e.message));
  await nativePage.goto(origin + "/visual-demo/painel");
  check(
    "real Chromium AudioContext not created on load",
    await nativePage.evaluate(() => nativeContexts.length === 0),
  );
  await nativePage.getByRole("button", { name: "Ativar som", exact: true }).click();
  await nativePage.getByRole("button", { name: "Testar som", exact: true }).click();
  await nativePage.getByText(/Som liberado nesta aba/).waitFor();
  check(
    "real Chromium audio API running after gesture",
    await nativePage.evaluate(
      () => nativeContexts.length === 1 && nativeContexts[0].state === "running",
    ),
  );
  await native.close();
  check("no outbound server calls", serverCalls === 0);
  check(
    "no writes RPC payments auth or backend",
    requests.every((r) => r.method === "GET" && !/rpc|supabase|payment|checkout|auth/.test(r.path)),
  );
  check("no JavaScript hydration errors", errors.length === 0);
} catch (error) {
  if (browser)
    for (const [i, p] of browser
      .contexts()
      .flatMap((c) => c.pages())
      .entries()) {
      await p.screenshot({ path: join(evidence, `failure-${i}.png`) }).catch(() => {});
      writeFileSync(join(evidence, `failure-${i}.html`), await p.content().catch(() => ""));
    }
  results.push({ test: "execution", pass: false, error: error.message });
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
  writeFileSync(
    join(evidence, "results.json"),
    JSON.stringify({ results, serverCalls, requests, blocked, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: results.length,
      passed: results.filter((r) => r.pass).length,
      failures: results.filter((r) => !r.pass),
    }),
  );
}
