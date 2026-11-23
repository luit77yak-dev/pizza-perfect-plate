# LAB-SECURITY-HTTP-PREP-01 — navegador Access, sem JWT exportado

**Objetivo:** preparar (não executar) negativos HTTP reais para a LAB A usando a sessão pessoal já autenticada no Cloudflare Access. Todo o conteúdo deste diretório é **somente revisão no PR #50**; nada é inserido em `src/` comercial, Worker publicado, secrets ou banco nesta etapa.

## Artefatos e fronteiras

- `browser-negative-harness.js` define `globalThis.neroxaLabSecurityHTTP`. A simples carga do arquivo **não faz requisições**; a chamada sem `execute: true` retorna apenas um plano DRY_RUN.
- `browser-negative-harness.test.cjs` simula seis respostas do Worker, testa travas, roteamento, replays e negativas ambíguas. Usa `node:test`, `vm` e bibliotecas nativas, **sem rede nem segredos**.
- O teste real ocorre **somente** em uma janela LAB aprovada separadamente, via navegador pessoal com Cloudflare Access, sob hostname privado `.workers.dev`, credenciais de operador inseridas via campo `type=password` na própria sessão, e prazo de até 15 minutos. Não exportar cookie, JWT pessoal, Bearer ou segredo para chat, Git, CI, URL, `localStorage` ou logs.
- O script faz exclusivamente seis POST para `order-list`/`catalog` no **mesmo origin** e impede redirects (por exemplo, para login). Não faz checkout, transição, atualização de estado, criação de grants ou deployments. Cada requisição consome um nonce no banco LAB e exige autorização **específica de execução/escrita de nonce**. A aprovação textual incluída na chamada não substitui autorização explícita do proprietário e admissão de janela.

## Negativas planejadas

| Caso | Pré-condição | Resposta estritamente aceita |
|---|---|---|
| Grant ativo LAB A positivo | sessão Access + grant A atual | 200 JSON `lab:true` de `order-list` |
| Grant ativo A consultando LAB B | LAB B distinto | 403 JSON `LAB instance denied` |
| Grant A previamente revogado | token distinto, revogação comprovada no LAB | 403 JSON com SQLSTATE `42501` |
| Operador ausente | sessão Access válida | 401 JSON `Operational authorization required` |
| Catálogo com nonce novo | sessão Access válida + catálogo LAB | 200 JSON `lab:true` |
| Replay do mesmo nonce | resultado anterior 200 | 409 JSON `LAB nonce already consumed` |

Os códigos são rejeitados se o conteúdo não for JSON com `X-Content-Type-Options: nosniff` da aplicação. **Não** considerar status HTTP do Cloudflare Access/redirect/HTML como PASS do Worker. A recusa de um token revogado por HTTP **não prova por si só** `revoked_at`; confirmar por consulta independente só-leitura do LAB. A negativa A→B requer também a prova de que o mesmo token faz leitura positiva de A, realizada primeiro.

**JWT inválido/expirado na Cloudflare:** fica `NOT_RUN_SEPARATE_GATED_TEST`. O Edge normalmente injeta o JWT autenticado; um navegador logado não é ambiente válido para fabricar/injetar um JWT falso e alegar teste do verificador. Negativas criptográficas offline de JWT já existem no PR. Prova de desafio/anônimo da borda e de JWKS real precisam de procedimento independente, sem exportar credenciais pessoais e com observação da resposta efetiva.

## Reprodução offline já autorizada (sem rede)

```sh
node --test lab-source/security-http/browser-negative-harness.test.cjs
```

## Procedimento FUTURO (NÃO EXECUTAR nesta missão)

1. Aprovar a janela privada, revalidar Worker/Access/URL, deadline, rollback efetivo, permissões/grants e conexão ao PostgreSQL LAB. Não abrir workers.dev se a proteção Access não estiver demonstrada.
2. Garantir um **grant ativo da LAB A**, outro **já revogado** (não criar nem reativar em nome desta preparação) e instâncias A/B verificadas; ambos permanecerão apenas na memória do navegador durante a execução.
3. Abrir o host LAB já autenticado; conferir os bytes do script na branch do PR e colá-lo como um Snippet local do DevTools. O arquivo **não** é inserido na aplicação Food nem hospedado remotamente por este PR.
4. A chamada em navegador `neroxaLabSecurityHTTP()` é sempre dry-run. Somente mediante autorização e até 15 minutos restantes, invocar manualmente:

```js
neroxaLabSecurityHTTP({
  execute: true,
  approval: 'LAB-SECURITY-HTTP-APPROVED',
  expectedHost: location.hostname, // verificar visualmente o host aprovado
  instanceA: '<UUID-LAB-A-verificado>',
  instanceB: '<UUID-LAB-B-verificado>',
  approvedUntil: '<timestamp-ISO-8601-autorizado>'
}).then(result => console.info({
  state: result.state,
  cases: result.cases?.map(({test, http_status}) => ({test, http_status})),
  jwtInvalid: result.jwtInvalid
})).catch(() => console.warn('LAB HTTP NEGATIVES: HOLD — revisar o erro localmente sem compartilhar secrets'));
```

5. Verificar resultados com SQL **somente leitura** (nonces únicos, `revoked_at`, escopo da loja A, sem alterações de pedidos) e uma observação independente do host/Access; restaurar a versão original e encerrar a janela, revogando o grant temporário.

**Não** usar uma validação `PASS` simulada do CI como prova de HTTP remoto. Uma falha, redirect/challenge ou 503 é `HOLD` e interrompe os casos seguintes. A execução negativa em browser fica `NOT_RUN` até autorização explícita e prova real. `PR50=DRAFT`, `PUBLIC_CHECKOUT=OFF`, `COMERCIAL=NO-GO`.