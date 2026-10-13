// Real Chromium, real components; intercepted transport, NOT an Auth/RLS/database test.
import { createRequire } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ?? "/opt/codex/cua_node/lib/node_modules/playwright",
);
const catalog = JSON.parse(fs.readFileSync(new URL("catalog-a.json", import.meta.url), "utf8"));
const out = new URL("../../audits/homologation-20261013/", import.meta.url);
fs.mkdirSync(new URL("screenshots/", out), { recursive: true });
const checks = [],
  requests = [],
  errors = [],
  blocked = [];
let mode = "PRICE";
let completed = false;
const check = (name, ok) => {
  checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
  console.log("PASS", name);
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
});
try {
  await context.route("**/*", async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.pathname === "/homologation-harness.html" && u.hostname === "127.0.0.1")
      return route.fulfill({
        contentType: "text/html",
        body: '<html><head><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/homologation-harness.tsx"></script></body></html>',
      });
    if (u.hostname === "127.0.0.1" && u.pathname.endsWith("/rpc/get_public_storefront_catalog"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalog),
      });
    if (u.hostname === "127.0.0.1") {
      if (u.port !== "4173") return route.abort();
      if (u.pathname === "/api/checkout") {
        requests.push(req.postDataJSON().p_order);
        await new Promise((r) => setTimeout(r, 250));
        return route.fulfill({
          status: mode === "OK" ? 200 : mode === "PRICE" ? 409 : 503,
          contentType: "application/json",
          body: JSON.stringify(
            mode === "OK"
              ? {
                  order_id: "a0000000-0000-0000-0000-000000000999",
                  order_number: 999,
                  total: 35,
                  amendment_token: "f".repeat(64),
                }
              : mode === "PRICE"
                ? { code: "PRICE_CHANGED", error: "O preço mudou. Revise o pedido." }
                : { error: "Resposta incerta fictícia" },
          ),
        });
      }
      if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/rest/")) return route.abort();
      return route.continue();
    }
    if (
      u.hostname === "iefaoaqzltvpfabyeelj.supabase.co" &&
      u.pathname.endsWith("/rpc/get_public_storefront_catalog")
    )
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...catalog,
          context: { ...catalog.context, domain: req.postDataJSON().p_domain },
        }),
      });
    blocked.push({ host: u.hostname, path: u.pathname });
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Produto ficticio A", exact: true }).waitFor();
  check("store catalog renders through intercepted transport", true);
  check(
    "missing hours fail closed in actual storefront",
    (await page.getByText("Fechada hoje", { exact: true }).count()) > 0,
  );
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    check(
      "store no document overflow " + width,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await page.screenshot({
      path: new URL("screenshots/store-" + width + ".png", out).pathname,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "Produto ficticio A", exact: true }) })
    .click();
  await page.getByRole("button", { name: /Próxima etapa/ }).click();
  await page.getByText("Pago ficticio", { exact: false }).click();
  await page.getByRole("button", { name: /Próxima etapa/ }).click();
  await page.getByRole("button", { name: /Adicionar ao carrinho/ }).click();
  check("product configured with paid addon", true);
  await page.reload({ waitUntil: "networkidle" });
  check(
    "cart persists reload",
    await page.evaluate(() =>
      Object.entries(localStorage).some(
        ([k, v]) => k.includes("cart") && v.includes("Produto ficticio A"),
      ),
    ),
  );
  await page.goto("https://127.0.0.1:4173/homologation-harness.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  check("required identity blocks transport", requests.length === 0);
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  await page.getByLabel(/Telefone/).fill("00000000001");
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  check("delivery missing address blocks transport", requests.length === 0);
  await page.getByRole("button", { name: /Retirada/ }).click();
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "O preço mudou" }).waitFor();
  check("PRICE_CHANGED shown", requests.length === 1);
  check(
    "confirmation blocked until review",
    await page.getByRole("button", { name: /Enviar pedido/ }).isDisabled(),
  );
  await page.getByRole("button", { name: "Revisar preços", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Valores atualizados" }).waitFor();
  check("review is explicit and never submits", requests.length === 1);
  check(
    "updated 35 displayed before consent",
    (await page.getByRole("button", { name: /Enviar pedido/ }).innerText()).includes("35,00"),
  );
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    check(
      "checkout no document overflow " + width,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await page.screenshot({
      path: new URL("screenshots/checkout-" + width + ".png", out).pathname,
      fullPage: true,
    });
  }
  mode = "UNCERTAIN";
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "Resposta incerta" }).waitFor();
  const uncertain = requests.at(-1);
  await page.getByLabel(/Nome/).fill("Outro cliente fictício");
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "tentativa anterior" }).waitFor();
  check("changed uncertain intent does not send another write", requests.length === 2);
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  mode = "OK";
  await page.getByRole("button", { name: /Enviar pedido/ }).evaluate((b) => {
    b.click();
    b.click();
  });
  await page.waitForFunction(() => document.title === "Pedido confirmado");
  check(
    "retry preserves original key",
    requests.slice(1).every((r) => r.idempotency_key === uncertain.idempotency_key),
  );
  check(
    "new consent replaces price-conflicted key",
    uncertain.idempotency_key !== requests[0].idempotency_key,
  );
  check("pickup request has no address", requests.at(-1).address_street === null);
  check(
    "normalized identifiers preserved",
    requests.at(-1).items.every((i) => i.selection_contract === "GROUP_ADDONS_V1"),
  );
  check("no JavaScript exceptions", errors.length === 0);
  mode = "PRICE";
  await page.goto("https://127.0.0.1:4173/homologation-harness.html?failReview=1", {
    waitUntil: "networkidle",
  });
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  await page.getByLabel(/Telefone/).fill("00000000001");
  await page.getByRole("button", { name: /Retirada/ }).click();
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("button", { name: "Revisar preços" }).click();
  await page.getByRole("alert").filter({ hasText: "Catálogo indisponível fictício" }).waitFor();
  check(
    "failed review cannot unlock confirmation",
    await page.getByRole("button", { name: /Enviar pedido/ }).isDisabled(),
  );
  await page.goto("https://127.0.0.1:4173/homologation-harness.html", { waitUntil: "networkidle" });
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  await page.getByLabel(/Telefone/).fill("00000000001");
  await page.getByLabel(/Rua/).fill("Rua fictícia");
  await page.getByLabel(/Número/).fill("123");
  await page.getByLabel(/Bairro/).selectOption("Teste");
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "O preço mudou" }).waitFor();
  const beforeReviewCount = requests.length;
  await page.getByRole("button", { name: "Revisar preços" }).click();
  await page.getByRole("status").filter({ hasText: "Valores atualizados" }).waitFor();
  check(
    "delivery price plus changed fee displayed before consent",
    (await page.getByRole("button", { name: /Enviar pedido/ }).innerText()).includes("41,00"),
  );
  check("fee review never submits", requests.length === beforeReviewCount);
  await page.getByLabel(/Nome/).focus();
  await page.keyboard.press("Tab");
  check(
    "keyboard can reach telephone",
    await page.getByLabel(/Telefone/).evaluate((e) => document.activeElement === e),
  );
  await page.screenshot({
    path: new URL("screenshots/delivery-fee-review-390.png", out).pathname,
    fullPage: true,
  });
  mode = "UNCERTAIN";
  await page.goto("https://127.0.0.1:4173/homologation-harness.html", { waitUntil: "networkidle" });
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  await page.getByLabel(/Telefone/).fill("00000000001");
  await page.getByLabel(/Rua/).fill("Rua fictícia");
  await page.getByLabel(/Número/).fill("123");
  await page.getByLabel(/Bairro/).selectOption("Teste");
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "Resposta incerta" }).waitFor();
  const beforeReload = requests.at(-1).idempotency_key;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel(/Nome/).fill("Cliente fictício");
  await page.getByLabel(/Telefone/).fill("00000000001");
  await page.getByLabel(/Rua/).fill("Rua fictícia");
  await page.getByLabel(/Número/).fill("123");
  await page.getByLabel(/Bairro/).selectOption("Teste");
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.getByRole("alert").filter({ hasText: "Resposta incerta" }).waitFor();
  check(
    "known reload intent-loss blocker reproduced",
    beforeReload !== requests.at(-1).idempotency_key,
  );
  completed = true;
} finally {
  fs.writeFileSync(
    new URL("browser-results.json", out),
    JSON.stringify(
      {
        classification: completed ? "PASS_COMPONENTS_MOCK_TRANSPORT" : "FAIL_OR_INCOMPLETE",
        realDatabaseValidated: false,
        operationallyApproved: false,
        knownFailures: [
          "Storefront always closed: hours absent",
          "Uncertain intent/key lost on checkout reload; potential duplicate requires real DB test",
        ],
        authValidated: false,
        fullStorefrontCheckoutBlocked: "hours absent from catalog",
        checks,
        errors,
        blockedExternalHosts: [...new Set(blocked.map((v) => v.host))],
        checkoutRequestCount: requests.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
