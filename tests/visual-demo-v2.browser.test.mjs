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
  context.setDefaultTimeout(15000);
  const admin = await context.newPage(),
    shop = await context.newPage();
  for (const p of [admin, shop]) p.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(origin + "/visual-demo/painel");
  await shop.goto(origin + "/visual-demo/");
  const nav = async (label) => {
    if (await admin.getByRole("button", { name: "Abrir menu", exact: true }).isVisible())
      await admin.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await admin
      .locator(".forno-sidebar")
      .getByRole("button", { name: new RegExp("^" + label + "(?: \\d+)?$") })
      .click();
  };
  const saveProduct = () =>
    admin.getByRole("button", { name: "Salvar produto", exact: true }).click();
  const productForm = () => admin.getByRole("form", { name: "Editar produto" });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    "base64",
  );
  await nav("Cardápio");
  await admin.getByRole("button", { name: "Novo produto", exact: true }).click();
  await admin.getByLabel("Nome do produto", { exact: true }).fill("Pizza V2");
  await admin.getByLabel("Preço base (R$)", { exact: true }).fill("75");
  await admin
    .getByLabel("Descrição do produto", { exact: true })
    .fill("Produto fictício sincronizado");
  await admin
    .getByLabel("Imagem do produto", { exact: true })
    .setInputFiles({ name: "demo.png", mimeType: "image/png", buffer: png });
  await productForm().locator("img").waitFor();
  await saveProduct();
  await shop.getByRole("button", { name: "Personalizar Pizza V2", exact: true }).waitFor();
  check(
    "admin create syncs across live tabs",
    await shop.getByRole("button", { name: "Personalizar Pizza V2", exact: true }).isVisible(),
  );
  check(
    "local product image appears in storefront",
    await shop
      .getByRole("button", { name: "Personalizar Pizza V2", exact: true })
      .locator("img")
      .getAttribute("src")
      .then((s) => s.startsWith("data:image/png;base64,")),
  );
  await admin.getByRole("button", { name: "Editar produto Pizza V2", exact: true }).click();
  await admin.getByLabel("Preço base (R$)", { exact: true }).fill("82");
  const secondPNG = Buffer.from(
    await shop.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 2;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#e8a144";
      ctx.fillRect(0, 0, 2, 2);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await admin
    .getByLabel("Imagem do produto", { exact: true })
    .setInputFiles({ name: "edited.png", mimeType: "image/png", buffer: secondPNG });
  await admin.waitForFunction(
    (value) => document.querySelector(".demo-image-field img")?.getAttribute("src") === value,
    "data:image/png;base64," + secondPNG.toString("base64"),
  );
  await saveProduct();
  await shop
    .getByRole("button", { name: "Personalizar Pizza V2", exact: true })
    .getByText(/82,00/)
    .waitFor();
  check("edited price syncs", true);
  await shop.waitForFunction(
    (value) =>
      document
        .querySelector('button[aria-label="Personalizar Pizza V2"] img')
        ?.getAttribute("src") === value,
    "data:image/png;base64," + secondPNG.toString("base64"),
  );
  check("edited image syncs to existing store card", true);
  await shop.reload();
  await shop.getByRole("button", { name: "Personalizar Pizza V2", exact: true }).waitFor();
  check("catalog survives reload", true);
  await shop.getByRole("button", { name: "Personalizar Pizza V2", exact: true }).click();
  await shop.getByLabel(/Média · 6 fatias/).check();
  await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
  check(
    "cart snapshot uses updated price",
    await shop.getByRole("dialog").getByText(/82,00/).first().isVisible(),
  );
  await shop.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Desativar produto Pizza V2", exact: true }).click();
  await shop
    .getByRole("button", { name: "Personalizar Pizza V2", exact: true })
    .waitFor({ state: "detached" });
  check("disabled product removed from storefront", true);
  await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
  check(
    "catalog change blocks old cart checkout",
    await shop.getByRole("button", { name: "Loja fechada", exact: true }).isDisabled(),
  );
  check(
    "cart retains old amount explicitly",
    await shop.getByText(/Catálogo alterado/).isVisible(),
  );
  await shop.getByRole("button", { name: "Limpar carrinho", exact: true }).click();
  await shop.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Ativar produto Pizza V2", exact: true }).click();
  await admin.getByRole("button", { name: "Excluir produto Pizza V2", exact: true }).click();
  check(
    "deleted product no longer selectable",
    (await shop.getByRole("button", { name: "Personalizar Pizza V2", exact: true }).count()) === 0,
  );
  // Reusable required addon group with free/paid options.
  await admin.getByRole("button", { name: "Novo grupo", exact: true }).click();
  await admin.getByLabel("Nome do grupo", { exact: true }).fill("Molhos V2");
  await admin.getByLabel("Seleção mínima", { exact: true }).fill("1");
  await admin.getByLabel("Seleção máxima", { exact: true }).fill("2");
  await admin
    .getByRole("group", { name: "Aplicar às categorias" })
    .getByLabel("Pizzas", { exact: true })
    .check();
  for (const [name, price] of [
    ["Molho pago", "3.50"],
    ["Molho gratuito", "0"],
    ["Molho extra", "2"],
  ]) {
    await admin.getByRole("button", { name: "Nova opção", exact: true }).click();
    await admin.getByLabel("Nome da opção", { exact: true }).fill(name);
    await admin.getByLabel("Preço / acréscimo da opção (R$)", { exact: true }).fill(price);
    await admin.getByRole("button", { name: "Aplicar opção ao rascunho", exact: true }).click();
  }
  await admin.getByRole("button", { name: "Salvar grupo", exact: true }).click();
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
  await shop.getByLabel(/Média · 6 fatias/).check();
  const add = shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true });
  check("required minimum prevents add", await add.isDisabled());
  await shop.getByLabel(/Molho pago/).check();
  check("required option enables add", await add.isEnabled());
  await shop.getByLabel(/Molho gratuito/).check();
  await shop.getByLabel(/Molho extra/).check();
  check("max selections enforced", await add.isDisabled());
  await shop.getByLabel(/Molho extra/).uncheck();
  check(
    "free/paid addons calculate correctly",
    await shop.getByRole("dialog").getByText(/43,50/).isVisible(),
  );
  await add.click();
  await admin.getByRole("button", { name: "Editar grupo Molhos V2", exact: true }).click();
  await admin.getByRole("button", { name: "Editar opção Molho pago", exact: true }).click();
  await admin.getByLabel("Preço / acréscimo da opção (R$)", { exact: true }).fill("4");
  await admin.getByRole("button", { name: "Aplicar opção ao rascunho", exact: true }).click();
  await admin.getByRole("button", { name: "Salvar grupo", exact: true }).click();
  await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
  check(
    "addon edit preserves existing item price",
    await shop.getByRole("dialog").getByText(/43,50/).first().isVisible(),
  );
  await shop.getByRole("button", { name: "Limpar carrinho", exact: true }).click();
  await shop.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Editar grupo Molhos V2", exact: true }).click();
  await admin.getByRole("button", { name: "Editar opção Molho pago", exact: true }).click();
  await admin.getByLabel("Opção ativa", { exact: true }).uncheck();
  await admin.getByRole("button", { name: "Aplicar opção ao rascunho", exact: true }).click();
  await admin.getByRole("button", { name: "Excluir opção Molho extra", exact: true }).click();
  await admin.getByRole("button", { name: "Salvar grupo", exact: true }).click();
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
  check(
    "disabled and deleted options unavailable",
    (await shop.getByLabel(/Molho pago|Molho extra/).count()) === 0,
  );
  await shop.getByLabel(/Média · 6 fatias/).check();
  await shop.getByLabel(/Molho gratuito/).check();
  await shop.getByLabel(/Borda fictícia/).check();
  check("crust pricing applied", await shop.getByRole("dialog").getByText(/45,00/).isVisible());
  await shop.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Excluir grupo Molhos V2", exact: true }).click();
  await admin.getByRole("button", { name: "Novo produto", exact: true }).click();
  await admin.getByLabel("Nome do produto", { exact: true }).fill("Bebida V2");
  await admin.getByLabel("Tipo de produto", { exact: true }).selectOption("DRINK");
  await admin.getByLabel("Categoria", { exact: true }).selectOption("demo-drinks");
  await admin.getByLabel("Preço base (R$)", { exact: true }).fill("8");
  await saveProduct();
  await shop.getByRole("button", { name: "Personalizar Bebida V2", exact: true }).waitFor();
  check("drink CRUD reaches storefront", true);
  await admin.getByRole("button", { name: "Editar produto Bebida V2", exact: true }).click();
  await admin.getByLabel("Preço base (R$)", { exact: true }).fill("9");
  await saveProduct();
  await admin.getByRole("button", { name: "Novo grupo", exact: true }).click();
  await admin.getByLabel("Nome do grupo", { exact: true }).fill("Combo V2");
  await admin.getByLabel("Tipo de grupo", { exact: true }).selectOption("COMBO");
  await admin.getByLabel("Seleção máxima", { exact: true }).fill("1");
  await admin
    .getByRole("group", { name: "Aplicar às categorias" })
    .getByLabel("Pizzas", { exact: true })
    .check();
  await admin.getByRole("button", { name: "Nova opção", exact: true }).click();
  await admin.getByLabel("Nome da opção", { exact: true }).fill("Bebida V2 no combo");
  await admin.getByLabel("Produto da opção", { exact: true }).selectOption({ label: "Bebida V2" });
  await admin.getByLabel("Volume no combo", { exact: true }).selectOption({ label: "2 L" });
  await admin.getByRole("button", { name: "Aplicar opção ao rascunho", exact: true }).click();
  await admin.getByRole("button", { name: "Salvar grupo", exact: true }).click();
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
  await shop.getByLabel(/Média · 6 fatias/).check();
  await shop.getByLabel(/Bebida V2 no combo/).check();
  check(
    "combo applies current drink and volume price",
    await shop.getByRole("dialog").getByText(/55,00/).isVisible(),
  );
  await admin.getByRole("button", { name: "Desativar produto Bebida V2", exact: true }).click();
  await shop.getByLabel(/Bebida V2 no combo/).waitFor({ state: "detached" });
  check(
    "inactive beverage unavailable in combo",
    await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).isDisabled(),
  );
  await shop.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Excluir produto Bebida V2", exact: true }).click();
  await admin.getByRole("button", { name: "Excluir grupo Combo V2", exact: true }).click();
  await admin.getByRole("button", { name: "Nova categoria", exact: true }).click();
  await admin.getByLabel("Nome da categoria", { exact: true }).fill("Sobremesas V2");
  await admin.getByLabel("Ordem da categoria", { exact: true }).fill("2");
  await admin.getByRole("button", { name: "Salvar categoria", exact: true }).click();
  await shop.getByRole("heading", { name: "Sobremesas V2", exact: true }).waitFor();
  check("category created and synchronized", true);
  await admin.getByRole("button", { name: "Editar categoria Sobremesas V2", exact: true }).click();
  await admin.getByLabel("Categoria ativa", { exact: true }).uncheck();
  await admin.getByRole("button", { name: "Salvar categoria", exact: true }).click();
  await shop
    .getByRole("heading", { name: "Sobremesas V2", exact: true })
    .waitFor({ state: "detached" });
  check("inactive category hidden", true);
  await admin.getByRole("button", { name: "Excluir categoria Sobremesas V2", exact: true }).click();
  // Store and appearance sync; all images local.
  await nav("Minha loja");
  await admin.getByLabel("Nome da loja", { exact: true }).fill("Forno V2 Fictício");
  await admin.getByLabel("Descrição da loja", { exact: true }).fill("Descrição sincronizada V2");
  await admin.getByLabel("Contato fictício", { exact: true }).fill("Contato demonstrativo V2");
  await admin.getByLabel("Endereço fictício", { exact: true }).fill("Rua fictícia V2");
  await admin
    .getByLabel("Logo", { exact: true })
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await admin.locator(".demo-image-field img").waitFor();
  await admin.getByLabel("Abertura 0", { exact: true }).fill("17:00");
  await admin.getByRole("button", { name: "Salvar loja", exact: true }).click();
  await shop.getByText("Descrição sincronizada V2", { exact: true }).waitFor();
  check(
    "store details shared",
    (await shop.getByText("Contato demonstrativo V2", { exact: true }).isVisible()) &&
      (await shop.getByText("Rua fictícia V2", { exact: true }).isVisible()),
  );
  check("hours synchronized", await shop.getByText(/Domingo: 17:00–23:00/).isVisible());
  check("logo reflected", (await shop.locator('img[src^="data:image/png"]').count()) > 0);
  await admin.getByLabel("Loja aberta (simulação)", { exact: true }).uncheck();
  await admin.getByRole("button", { name: "Salvar loja", exact: true }).click();
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).waitFor();
  await shop.waitForFunction(
    () => document.querySelector('button[aria-label="Personalizar Margherita"]').disabled,
  );
  check("closed store blocks new items", true);
  await admin.getByLabel("Loja aberta (simulação)", { exact: true }).check();
  await admin.getByRole("button", { name: "Salvar loja", exact: true }).click();
  await nav("Aparência");
  await admin.getByLabel("Destaque", { exact: true }).fill("#e8a144");
  await admin
    .getByLabel("Banner", { exact: true })
    .setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png });
  await admin.getByRole("button", { name: "Salvar aparência", exact: true }).click();
  await shop.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".ppp-visual-demo"))
        .getPropertyValue("--forno-gold")
        .trim() === "#e8a144",
  );
  check("appearance syncs to store", true);
  check("appearance live preview", await admin.locator(".demo-appearance-preview").isVisible());
  check(
    "banner displayed locally",
    await shop
      .locator(".forno-hero-image")
      .getAttribute("src")
      .then((s) => s.startsWith("data:image/png")),
  );
  await admin.getByRole("button", { name: "Restaurar identidade original", exact: true }).click();
  await shop.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".ppp-visual-demo"))
        .getPropertyValue("--forno-gold")
        .trim() === "#dfbd6f",
  );
  check("original identity restored", true);
  await nav("Entregas");
  await admin.getByRole("button", { name: "Editar bairro Centro", exact: true }).click();
  await admin.getByLabel("Taxa fictícia (R$)", { exact: true }).fill("4.25");
  await admin.getByRole("button", { name: "Salvar taxa simulada", exact: true }).click();
  await shop.getByText(/Centro:.*4,25/).waitFor();
  check("delivery zone price synchronizes", true);
  // Full checkout creates only a browser-local unpaid order and panel reflects it.
  await shop.getByRole("button", { name: "Personalizar Água", exact: true }).click();
  await shop.getByLabel(/600 ml/).check();
  check(
    "drink volume increases price",
    await shop.getByRole("dialog").getByText(/7,00/).isVisible(),
  );
  await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
  await shop.getByRole("button", { name: "Continuar para checkout", exact: true }).click();
  await shop.getByLabel("Modalidade", { exact: true }).selectOption("Entrega");
  await shop.getByLabel("Bairro", { exact: true }).selectOption("demo-centro");
  check(
    "checkout uses current local delivery fee",
    await shop.getByRole("dialog", { name: "Checkout simulado" }).getByText(/11,25/).isVisible(),
  );
  await shop
    .getByRole("button", { name: "Confirmar somente na demonstração", exact: true })
    .click();
  await shop.getByText(/Pedido #1045 simulado/).waitFor();
  check("checkout confirmation explicitly simulated", true);
  await nav("Pedidos");
  await admin.getByRole("button", { name: /Pedido #1045 de Visitante fictício/ }).waitFor();
  check("simulated checkout appears in admin", true);
  await admin.getByRole("button", { name: /Pedido #1045 de Visitante fictício/ }).click();
  await admin
    .locator(".forno-order")
    .filter({ has: admin.getByRole("button", { name: /Pedido #1045 de/ }) })
    .getByRole("button", { name: "Avançar para: Confirmado", exact: true })
    .click();
  await shop.getByRole("button", { name: "Acompanhar pedido", exact: true }).click();
  await shop
    .getByRole("dialog", { name: "Acompanhamento fictício" })
    .getByText(/CONFIRMED/)
    .waitFor();
  check("tracking follows local panel status", true);
  await shop.keyboard.press("Escape");
  await nav("Clientes");
  await admin.getByLabel("Pesquisar cliente", { exact: true }).fill("Visitante");
  await admin.getByRole("button", { name: "Visitante fictício", exact: true }).click();
  check(
    "customer search/history local",
    await admin.getByRole("button", { name: /Pedido #1045 de/ }).isVisible(),
  );
  await admin.getByLabel("Pesquisar cliente", { exact: true }).fill("Não existe");
  check(
    "customer empty state",
    await admin.getByText("Nenhum cliente fictício encontrado.", { exact: true }).isVisible(),
  );
  await admin.getByRole("button", { name: /^Ver avisos:/ }).click();
  const center = admin.getByRole("region", { name: "Central de notificações" });
  check("notifications bounded", (await center.locator("article").count()) <= 20);
  await center
    .getByRole("button", { name: /^Marcar como lida:/ })
    .first()
    .click();
  check("notice marked read", (await center.getByText("Lida", { exact: true }).count()) > 0);
  const count = await center.locator("article").count();
  await center
    .getByRole("button", { name: /^Dispensar:/ })
    .first()
    .click();
  check("individual dismiss", (await center.locator("article").count()) === count - 1);
  await center.getByRole("button", { name: "Limpar notificações", exact: true }).click();
  check(
    "notice center clears",
    await center.getByText("Nenhuma notificação.", { exact: true }).isVisible(),
  );
  await center.getByRole("button", { name: "Fechar avisos", exact: true }).click();
  await admin.reload();
  await nav("Cardápio");
  check(
    "panel edits survive reload",
    await admin.getByRole("button", { name: "Editar produto Margherita", exact: true }).isVisible(),
  );
  // Reset invalidates any cart and syncs all tabs.
  await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
  await shop.getByLabel(/Média · 6 fatias/).check();
  await shop.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await admin.getByRole("button", { name: "Restaurar demonstração", exact: true }).click();
  await admin.getByRole("button", { name: "Confirmar restauração", exact: true }).click();
  await shop.getByText("Contato fictício: (00) 00000-0000", { exact: true }).waitFor();
  check("reset syncs initial store", true);
  await shop.getByRole("button", { name: "Abrir carrinho", exact: true }).click();
  check(
    "reset invalidates previous cart",
    await shop.getByRole("button", { name: "Loja fechada", exact: true }).isDisabled(),
  );
  await shop.keyboard.press("Escape");
  // Mobile header/form/configurator overflow and accessible navigation.
  for (const width of [320, 375, 390, 430]) {
    await admin.setViewportSize({ width, height: 844 });
    await shop.setViewportSize({ width, height: 844 });
    for (const area of [
      "Visão geral",
      "Cardápio",
      "Minha loja",
      "Aparência",
      "Clientes",
      "Pedidos",
      "Entregas",
      "Pagamentos",
    ]) {
      await nav(area);
      check(
        `${area} no horizontal overflow ${width}`,
        await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
    }
    check(
      `compact header ${width}`,
      await admin.locator(".forno-topbar").evaluate((e) => e.getBoundingClientRect().height <= 90),
    );
    await nav("Cardápio");
    await admin.getByRole("button", { name: "Novo produto", exact: true }).click();
    check(
      `editor no overflow ${width}`,
      await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await admin.getByRole("button", { name: "Cancelar produto", exact: true }).click();
    await shop.getByRole("button", { name: "Personalizar Margherita", exact: true }).click();
    await shop.getByLabel(/Média · 6 fatias/).check();
    check(
      `configurator no overflow ${width}`,
      await shop.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await shop.keyboard.press("Escape");
    await admin.screenshot({ path: join(evidence, `panel-${width}.png`), fullPage: true });
    await shop.screenshot({ path: join(evidence, `store-${width}.png`), fullPage: true });
  }
  await context.close();
  // Corrupt/unsupported data and blocked persistence recover without backend.
  for (const payload of ["{invalid", JSON.stringify({ version: 1 })]) {
    const c = await browser.newContext();
    await c.route("**/*", (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    await c.addInitScript(
      (raw) => localStorage.setItem("neroxa:visual-demo:forno:v2", raw),
      payload,
    );
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(origin + "/visual-demo/");
    await p.getByText(/Dados locais inválidos/).waitFor();
    check(
      "invalid local state recovers initial demo",
      await p.getByRole("button", { name: "Personalizar Margherita", exact: true }).isVisible(),
    );
    await c.close();
  }
  const unavailable = await browser.newContext();
  await unavailable.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  await unavailable.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("blocked storage");
    };
    Storage.prototype.setItem = () => {
      throw Error("blocked storage");
    };
  });
  const fallback = await unavailable.newPage();
  fallback.on("pageerror", (e) => errors.push(e.message));
  await fallback.goto(origin + "/visual-demo/painel");
  await fallback.getByText(/Armazenamento indisponível/).waitFor();
  await fallback.getByRole("button", { name: "Simular item adicional", exact: true }).count();
  await fallback
    .locator(".forno-sidebar")
    .getByRole("button", { name: "Pedidos", exact: true })
    .click();
  await fallback.getByRole("button", { name: "Simular item adicional", exact: true }).click();
  await fallback.getByRole("button", { name: "Simular item adicional", exact: true }).click();
  check(
    "blocked persistence retains consecutive memory updates",
    (await fallback
      .locator(".forno-order")
      .filter({ has: fallback.getByRole("button", { name: /Pedido #1042 de/ }) })
      .locator("em")
      .count()) === 2,
  );
  check(
    "blocked persistence shows explicit warning",
    await fallback.getByText(/Não foi possível salvar/).isVisible(),
  );
  await unavailable.close();
  const isolated = await browser.newContext();
  await isolated.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const p = await isolated.newPage();
  await p.goto(origin + "/visual-demo/painel");
  await p.getByRole("button", { name: /Pedido #1042 de.*Em preparo/ }).waitFor();
  check("separate browser starts with initial fictitious orders", true);
  await isolated.close();
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
  if (browser)
    for (const [i, p] of browser
      .contexts()
      .flatMap((c) => c.pages())
      .entries()) {
      await p
        .screenshot({ path: join(evidence, `failure-${i}.png`), fullPage: true })
        .catch(() => {});
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
