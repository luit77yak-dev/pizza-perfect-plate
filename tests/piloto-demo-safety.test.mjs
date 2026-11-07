import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/routes/piloto-demo.tsx", import.meta.url), "utf8");

test("the route labels every checkout as fictitious", () => {
  assert.match(source, /DEMONSTRAÇÃO FICTÍCIA/);
  assert.match(source, /sem enviar pedido/);
  assert.match(source, /não homologa autenticação/);
});
test("the route never performs remote requests or persistent storage", () => {
  for (const denied of [/\bsupabase\s*\./i, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bWebSocket\b/, /\bEventSource\b/, /\brpc\s*\(/]) {
    assert.doesNotMatch(source, denied);
  }
});
test("store-scoped carts and orders are independent", () => {
  assert.match(source, /type StoreId = "forno" \| "horizonte"/);
  assert.match(source, /useState<Carts>\(\{ forno: \{\}, horizonte: \{\} \}\)/);
  assert.match(source, /useState<Orders>\(\{ forno: \[\], horizonte: \[\] \}\)/);
  assert.match(source, /\[store\]: \[\.\.\.prev\[store\], order\]/);
});
test("tracking only mutates synthetic React state", () => {
  assert.match(source, /const stages = \["Recebido", "Em preparo", "Pronto para retirada"\]/);
  assert.match(source, /onClick=\{advanceStatus\}/);
  assert.match(source, /Dados apenas em memória/);
});

test("client and manager share only session-scoped synthetic orders", () => {
  assert.match(source, /setView\("gerente"\)/);
  assert.match(source, /setView\("cliente"\)/);
  assert.match(source, /view === "gerente"/);
  assert.match(source, /Gestão de pedidos fictícios/);
  assert.match(source, /Status atualizado somente pelo painel fictício do gerente/);
  assert.match(source, /onClick=\{advanceStatus\}/);
  assert.match(source, /\[store\]: prev\[store\]\.map/);
});
