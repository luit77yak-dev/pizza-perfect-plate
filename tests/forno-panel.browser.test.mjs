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
  for (const width of [320, 390, 430, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 640 : 900 },
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      blocked.push({ host: url.hostname, path: url.pathname });
      return route.abort();
    });
    await context.addInitScript(() => {
      localStorage.setItem("pizza-perfect-plate:cart", "synthetic-private-real-cart");
      window.demoStorageReads = [];
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        window.demoStorageReads.push(key);
        return get.call(this, key);
      };
      window.audioProbe = { contexts: 0, resumed: 0, started: 0, closed: 0 };
      window.AudioContext = class {
        constructor() {
          window.audioProbe.contexts++;
          this.currentTime = 0;
          this.destination = {};
        }
        resume() {
          window.audioProbe.resumed++;
          return Promise.resolve();
        }
        close() {
          window.audioProbe.closed++;
          return Promise.resolve();
        }
        createGain() {
          return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
        }
        createOscillator() {
          return {
            frequency: {},
            connect() {},
            start() {
              window.audioProbe.started++;
            },
            stop() {
              queueMicrotask(() => this.onended?.());
            },
          };
        }
      };
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/visual-demo/painel");
    await page.getByRole("heading", { level: 1, name: "Visão geral" }).waitFor();
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".forno-panel")).backgroundColor ===
        "rgb(16, 25, 20)",
    );
    const sidebar = page.locator(".forno-sidebar");
    async function navigate(label) {
      if (width <= 800) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
      await sidebar.getByRole("button", { name: new RegExp("^" + label + "(?: \\d+)?$") }).click();
      await page.getByRole("heading", { level: 1, name: label, exact: true }).waitFor();
    }
    function order(id) {
      return page
        .locator(".forno-order")
        .filter({ has: page.getByRole("button", { name: new RegExp("Pedido #" + id + " de") }) });
    }
    async function noOverflow(label) {
      check(
        label + " has no page overflow " + width,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
    }
    check(
      "dark premium header " + width,
      await page
        .locator(".forno-topbar")
        .evaluate((el) => getComputedStyle(el).backgroundColor === "rgb(16, 25, 20)"),
    );
    check(
      "header title contrast " + width,
      await page
        .getByRole("heading", { level: 1, name: "Visão geral" })
        .evaluate((el) => getComputedStyle(el).color === "rgb(243, 236, 220)"),
    );
    await noOverflow("overview");
    check("demo banner visible " + width, await page.getByRole("note").isVisible());
    if (width <= 800) {
      await page.waitForFunction(() => document.querySelector(".forno-sidebar").inert);
      check(
        "closed drawer has no shadow " + width,
        await sidebar.evaluate((el) => getComputedStyle(el).boxShadow === "none"),
      );
      check("closed drawer inaccessible " + width, await sidebar.evaluate((el) => el.inert));
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.waitForFunction(() =>
        document.querySelector(".forno-sidebar").contains(document.activeElement),
      );
      check(
        "background inert with menu " + width,
        await page.locator("main").evaluate((el) => el.inert),
      );
      for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
      check(
        "menu traps keyboard focus " + width,
        await sidebar.evaluate((el) => el.contains(document.activeElement)),
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector(".forno-sidebar").getBoundingClientRect().right <= 0,
      );
      check(
        "Escape restores toggle focus " + width,
        await page
          .getByRole("button", { name: "Abrir menu" })
          .evaluate((el) => el === document.activeElement),
      );
    }
    await page.screenshot({ path: join(evidence, "overview-" + width + ".png"), fullPage: true });
    const first = order(1042);
    await first.getByRole("button", { name: /Pedido #1042 de/ }).click();
    check("order collapses " + width, (await first.locator(".forno-order-detail").count()) === 0);
    await first.getByRole("button", { name: /Pedido #1042 de/ }).click();
    check("order expands " + width, await first.locator(".forno-order-detail").isVisible());
    await navigate("Pedidos");
    await page.getByRole("button", { name: "Prontos", exact: true }).click();
    check(
      "empty order filter " + width,
      await page.getByText("Nenhum pedido neste filtro.", { exact: true }).isVisible(),
    );
    await page.getByRole("button", { name: "Recebidos", exact: true }).click();
    check(
      "filter isolates received " + width,
      (await page.locator(".forno-order").count()) === 1 && (await order(1043).count()) === 1,
    );
    await page.getByRole("button", { name: "Simular item adicional" }).click();
    check(
      "update visible despite prior filter " + width,
      (await page
        .getByRole("button", { name: "Todos", exact: true })
        .getAttribute("aria-pressed")) === "true" &&
        (await page.locator(".forno-order").count()) === 3,
    );
    check(
      "unread update highlighted " + width,
      await order(1042).evaluate((el) => el.classList.contains("forno-order-updated")),
    );
    check("sound defaults off " + width, await page.evaluate(() => audioProbe.contexts === 0));
    await page.getByRole("button", { name: "Ativar som", exact: true }).click();
    await page.getByRole("button", { name: "Simular item adicional" }).click();
    check(
      "optional audio starts/resumes/closes " + width,
      await page.evaluate(
        () =>
          audioProbe.contexts === 1 &&
          audioProbe.started === 1 &&
          audioProbe.resumed === 1 &&
          audioProbe.closed === 1,
      ),
    );
    check(
      "multiple unseen additions identified " + width,
      (await order(1042).locator("em").count()) === 2,
    );
    await page.getByRole("button", { name: "Desativar som", exact: true }).click();
    await order(1042).getByRole("button", { name: "Confirmar ciência" }).click();
    check(
      "acknowledgment clears badges and new labels " + width,
      (await order(1042).locator("em").count()) === 0 &&
        !(await order(1042).evaluate((el) => el.classList.contains("forno-order-updated"))),
    );
    await page.getByRole("button", { name: "Simular item adicional" }).click();
    check(
      "only latest unacknowledged addition is new " + width,
      (await order(1042).locator("em").count()) === 1,
    );
    check(
      "disabled sound does not restart " + width,
      await page.evaluate(() => audioProbe.contexts === 1),
    );
    await order(1042).getByRole("button", { name: "Confirmar ciência" }).click();
    await noOverflow("orders");
    await page.screenshot({ path: join(evidence, "orders-" + width + ".png"), fullPage: true });
    await navigate("Pagamentos");
    check(
      "additions do not become paid automatically " + width,
      await page
        .locator(".forno-stats article")
        .first()
        .getByText(/124,90/)
        .isVisible(),
    );
    check(
      "new amounts remain pending " + width,
      await page.getByText(/157,00 em aberto/).isVisible(),
    );
    check(
      "partial payment clearly identified " + width,
      await page.getByText(/Adicional pendente: R.*45,00/).isVisible(),
    );
    await noOverflow("payments");
    await navigate("Pedidos");
    await order(1042).getByRole("button", { name: "Avançar para: Pronto", exact: true }).click();
    await order(1042)
      .getByRole("button", { name: "Avançar para: Saiu para entrega", exact: true })
      .click();
    const countBefore = await order(1042).locator(".forno-order-items > div").count();
    await page.getByRole("button", { name: "Simular item adicional" }).click();
    check(
      "append denied after dispatch " + width,
      (await order(1042).locator(".forno-order-items > div").count()) === countBefore &&
        (await page
          .getByRole("status")
          .getByText(/Alteração bloqueada/)
          .isVisible()),
    );
    await order(1042).getByRole("button", { name: "Avançar para: Entregue", exact: true }).click();
    check(
      "delivered order has no next transition " + width,
      (await order(1042)
        .getByRole("button", { name: /Avançar para:/ })
        .count()) === 0,
    );
    await order(1043)
      .getByRole("button", { name: /Pedido #1043 de/ })
      .click();
    for (const label of ["Confirmado", "Em preparo", "Pronto", "Entregue"])
      await order(1043)
        .getByRole("button", { name: "Avançar para: " + label, exact: true })
        .click();
    check(
      "pickup skips delivery leg " + width,
      (await order(1043)
        .getByRole("button", { name: /Pedido #1043 de.*Entregue/ })
        .count()) === 1 &&
        (await order(1043)
          .getByRole("button", { name: /Avançar para:/ })
          .count()) === 0,
    );
    await page.getByRole("button", { name: "Confirmados", exact: true }).click();
    check(
      "confirmed filter available " + width,
      (await page.locator(".forno-order").count()) === 1,
    );
    await page.getByRole("button", { name: "Entregues", exact: true }).click();
    check(
      "delivered filter available " + width,
      (await page.locator(".forno-order").count()) === 2,
    );
    check(
      "notifications bounded " + width,
      (await page.locator(".forno-alerts > div").count()) <= 4,
    );
    await navigate("Entregas");
    await page.screenshot({ path: join(evidence, "delivery-" + width + ".png"), fullPage: true });
    const name = page.getByLabel("Bairro fictício", { exact: true }),
      fee = page.getByLabel("Taxa fictícia (R$)", { exact: true });
    await name.fill("Inválido");
    await fee.fill("-1");
    await page.getByRole("button", { name: "Adicionar bairro fictício" }).click();
    check(
      "negative fee rejected " + width,
      (await page.getByRole("button", { name: /^Editar bairro/ }).count()) === 3,
    );
    await name.fill("centro");
    await fee.fill("5");
    await page.getByRole("button", { name: "Adicionar bairro fictício" }).click();
    check(
      "duplicate zone rejected " + width,
      await page
        .getByRole("alert")
        .getByText(/já existe/)
        .isVisible(),
    );
    await name.fill("Vila Demo");
    await fee.fill("7.50");
    await page.getByRole("button", { name: "Adicionar bairro fictício" }).click();
    check(
      "zone creation stays local " + width,
      await page.getByRole("button", { name: "Editar bairro Vila Demo" }).isVisible(),
    );
    await page.getByRole("button", { name: "Editar bairro Vila Demo" }).click();
    await fee.fill("3.25");
    await page.getByRole("button", { name: "Salvar taxa simulada" }).click();
    check(
      "zone edit displayed " + width,
      await page
        .locator(".forno-table > div")
        .filter({ has: page.getByRole("button", { name: "Editar bairro Vila Demo" }) })
        .getByText(/3,25/)
        .isVisible(),
    );
    await noOverflow("delivery");
    while (await page.getByRole("button", { name: /^Remover bairro/ }).count())
      await page
        .getByRole("button", { name: /^Remover bairro/ })
        .first()
        .click();
    check(
      "zone empty state " + width,
      await page.getByText("Nenhum bairro fictício cadastrado.", { exact: true }).isVisible(),
    );
    for (const section of ["Cardápio", "Clientes", "Minha loja", "Aparência", "Visão geral"]) {
      await navigate(section);
      await noOverflow(section);
    }
    check(
      "real browser storage ignored " + width,
      (await page.evaluate(() => demoStorageReads)).every(
        (key) => key !== "pizza-perfect-plate:cart" && !key.startsWith("ppp:"),
      ),
    );
    const second = await context.newPage();
    await second.goto(origin + "/visual-demo/painel");
    await second.getByRole("heading", { level: 1, name: "Visão geral" }).waitFor();
    check(
      "visitor panel state isolated " + width,
      (await second.getByRole("button", { name: /Pedido #1042 de.*Em preparo/ }).isVisible()) &&
        (await second.locator(".forno-update-badge").count()) === 0,
    );
    await context.close();
  }
  check("no server/backend fetch", serverCalls === 0);
  check(
    "no backend browser requests",
    requests.every(
      (r) => r.method === "GET" && !r.path.includes("/rpc/") && !r.path.includes("/auth/"),
    ),
  );
  check(
    "only existing fonts blocked",
    blocked.every((r) => r.host === "fonts.googleapis.com" || r.host === "fonts.gstatic.com"),
  );
  check("no browser/hydration errors", errors.length === 0);
} catch (error) {
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
