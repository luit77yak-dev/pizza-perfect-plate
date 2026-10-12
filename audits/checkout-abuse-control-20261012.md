# Checkout seguro — controle de abuso e ensaio HTTP local (12/10/2026)

**Estado: candidato em PR draft; NO-GO produção.** Nenhuma variável/credencial de produção foi alterada.

## Contenção persistente de requisições

O servidor usa `NEROXA_CHECKOUT_RATE_LIMIT_SECRET` (somente servidor, mínimo de 32 bytes) para computar **HMAC-SHA256 de `instance_id:telefone_normalizado`**. Envia apenas o digest à RPC candidata `neroxa_checkout_reserve_quota` do Master. Sem a chave, a rota protegida responde 503: não existe fallback privilegiado. Não armazenar o segredo em `VITE_*`, no navegador, em documentação ou logs.

O contador no PostgreSQL do Master é atômico e particionado por instância, com limites de **60 requisições por loja/60 s** e **5 requisições por contato/600 s** (valores de teste a homologar). Uma recusa da RPC `PT429` é traduzida em HTTP 429 pelo servidor; indisponibilidade da função/DB provoca HTTP 503 e **nenhuma criação de pedido**. As gravações de reserva e pedido são transações separadas; tentativas malsucedidas consomem quota.

Os dados de telefone não são gravados na tabela de quotas, mas o digest HMAC é um dado pseudonimizado; exige política de retenção e acesso. O telefone vem do cliente e pode mudar: isso **não substitui** rate limit real na borda por IP/conta, antispam, deteção de bots e fiscalização operacional. Uma credencial `service_role` tem alto privilégio: em produção preferir privilégio mínimo e restringir ingress confiável.

## Flags obrigatoriamente desativadas até homologação

- `NEROXA_CHECKOUT_GATEWAY_ENABLED=true` — servidor, **off por padrão**.
- `VITE_NEROXA_CHECKOUT_GATEWAY=true` — frontend, **off por padrão**; se ativa, jamais faz fallback à RPC pública.
- `NEROXA_CHECKOUT_RATE_LIMIT_SECRET` — segredo separado exclusivo do servidor, **não definido nesta PR**.

A rota do TanStack Start é `POST /api/checkout`. O workflow do consumidor executa testes do core e um smoke HTTP no **TanStack dev server em localhost** com gate desligado, exigindo HTTP 503 sem utilizar Supabase. O `vite preview` Node falhou porque o build da aplicação tem destino Nitro/Cloudflare e não fornece o arquivo `dist/server/server.js` esperado pelo preview. Isso foi explicitamente separado da capacidade de rodar na Vercel.

## Nova evidência: checkout HTTP HTTPS **habilitado** com Supabase descartável

[Isolated A-B Auth Matrix — 38306941709](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38306941709) **PASS** no checkout `POST /api/checkout` executado de verdade pelo TanStack em servidor de desenvolvimento **HTTPS local**: **30/30 verificações**. O mesmo workflow preservou **275/275** em Auth/isolamento e **49/49** em gateway/PostgREST real. Total: **354 verificações, zero falhas** em ambiente descartável.

Com o gateway habilitado e o acesso anônimo à RPC revogado no clone, A e B (duas instâncias da mesma organização) criaram pedidos com preços server-side; a tentativa com `Origin` falsificado, domínio inexistente, `Host` incompatível e produto de outra loja foi recusada. Cinco pedidos fictícios de um contato foram aceitos e o sexto retornou **HTTP 429**; a contagem final foi +1 A, +6 B, +0 C. A rota foi usada sem dados nem credenciais de produção. [Relatório Master](https://github.com/luit77yak-dev/neroxa-master/blob/audit/store-isolation-candidate-20261011/audits/checkout-https-enabled-rehearsal-20261012.md).

O TanStack omite o cabeçalho `Host` ao encaminhar `Request` em certos ambientes. O gateway agora exige `Origin` completo e, quando `Host` existe, valida-o estritamente. **Essas comparações não atestam criptograficamente a origem; o roteamento confiável do domínio pela infraestrutura ainda precisa de homologação própria.**

## Evidências

- **[Pizza Perfect Plate workflow 38273616553](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38273616553): PASS**, 16 testes de contratos/gateway, lint, TypeScript, build e smoke HTTP local retornando 503.
- **[Master workflow 38273960408](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38273960408): PASS**, 275 verificações reais Auth/JWT/RLS e 49 verificações integradas de gateway/PostgREST/limitação, incluindo 12 requisições concorrentes (5 aceitas; 7 com 429), quotas por instância, quota global por loja 60/min e rollback automático de incremento rejeitado. Também foram aceitos cinco pedidos do mesmo contato fictício pelo gateway, com a sexta tentativa recusada em HTTP 429 e nenhum pedido adicional criado. O banco de teste foi removido após execução.
- [Relatório no Master](https://github.com/luit77yak-dev/neroxa-master/blob/audit/store-isolation-candidate-20261011/audits/checkout-durable-quotas-20261012.md)

## Gate restante

É necessário testar a implantação/roteamento HTTPS confiável do provedor (Vercel/edge), impedir bypass em todas as rotas legadas, auditar monitoramento e antifraude, e coordenar revogação pública de `create_public_order` **sem interromper o checkout atual**. Também faltam retenção/limpeza dos contadores, E2E em ambiente isolado com HTTP real habilitado, reconciliação histórica sem instância e contingência entre ambientes. A PR não concede autorização de deploy.

**DRAFT em ambos os repositórios. Sem merge, sem SQL na produção, sem ativar as flags.**
