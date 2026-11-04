// NEROXA F02 — teste negativo somente contra os endpoints loopback do ensaio.
// Não usa DNS público, Supabase, GitHub Actions, SQL, credenciais ou dados reais.
import assert from "node:assert/strict";

const site = "http://127.0.0.1:4173";
const mock = "http://127.0.0.1:8777";

async function localFetch(url, options = {}) {
  const target = new URL(url);
  assert.equal(target.hostname, "127.0.0.1", "Somente loopback autorizado");
  assert.ok([4173, 8777].includes(Number(target.port)), "Porta local não prevista");
  return fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

async function health() {
  const response = await localFetch(mock + "/__health");
  assert.equal(response.status, 200, "Servidor fictício indisponível");
  const body = await response.json();
  assert.match(body.sha, /^[a-f0-9]{40}$/, "SHA inválido no recibo");
  assert.ok(Number.isInteger(body.catalog_reads));
  assert.ok(Number.isInteger(body.blocked_requests));
  return body;
}

const fixtures = [
  {
    name: "criação de pedido legado rejeitada",
    path: "/rest/v1/rpc/create_public_order",
    method: "POST",
    body: { p_domain: "fixture.invalid", p_customer_phone: "00000000000" },
  },
  {
    name: "tracking antigo por UUID/telefone rejeitado",
    path: "/rest/v1/rpc/get_public_order_status",
    method: "POST",
    body: {
      p_order_id: "00000000-0000-4000-8000-000000000000",
      p_customer_phone: "00000000000",
    },
  },
  {
    name: "acréscimo público antigo rejeitado",
    path: "/rest/v1/rpc/append_public_order_items_with_payment",
    method: "POST",
    body: {
      p_order_id: "00000000-0000-4000-8000-000000000000",
      p_customer_phone: "00000000000",
      p_items: [],
    },
  },
  {
    name: "endpoint Auth não autorizado rejeitado",
    path: "/auth/v1/user",
    method: "GET",
  },
];

try {
  const before = await health();
  console.log("F02_LOCAL_NEGATIVE_START", JSON.stringify(before));
  for (const item of fixtures) {
    const response = await localFetch(site + item.path, {
      method: item.method,
      ...(item.body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body) }
        : {}),
    });
    assert.equal(response.status, 403, item.name + ": esperado HTTP 403");
    console.log("PASS HTTP 403:", item.name);
  }
  const after = await health();
  assert.equal(
    after.sha,
    before.sha,
    "SHA do executor mudou durante o teste"
  );
  assert.equal(
    after.catalog_reads,
    before.catalog_reads,
    "Teste negativo não deveria ler o catálogo"
  );
  assert.equal(
    after.blocked_requests - before.blocked_requests,
    fixtures.length,
    "Contador do mock não corresponde às rejeições esperadas"
  );
  console.log("F02_LOCAL_NEGATIVE_PASS", JSON.stringify({
    sha: after.sha,
    expected_blocks: fixtures.length,
    observed_blocks: after.blocked_requests - before.blocked_requests,
    catalog_reads_before: before.catalog_reads,
    catalog_reads_after: after.catalog_reads,
  }));
  console.log(
    "LIMITE: prova apenas que o MOCK LOCAL rejeita essas rotas; " +
    "não certifica grants SQL, tráfego externo ou segurança hospedada."
  );
} catch (error) {
  console.error("F02_LOCAL_NEGATIVE_FAIL:", error?.message ?? String(error));
  process.exitCode = 1;
}
