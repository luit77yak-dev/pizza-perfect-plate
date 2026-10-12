# Checkout via gateway same-origin — candidato isolado (12/10/2026)

**Status:** PR #37 em DRAFT, **NO-GO** para produção. Não aplicar SQL de cutover, mudar credenciais de Vercel/Supabase, fazer merge ou promover deploy. A PR de isolamento do Neroxa Master permanece draft.

## Implementado na branch

- `src/routes/api/checkout.ts`: `POST /api/checkout` via TanStack Start, importação dinâmica do adaptador exclusivo do servidor.
- `src/server/checkout-gateway.server.ts`: usa `supabaseAdmin` em servidor para resolver `get_public_storefront_context(domain)` e, somente após a validação, chamar `create_public_order` com dados da instância canônica. Não expõe credenciais ao navegador.
- `src/server/checkout-gateway.ts`: core testável sem banco, desativado por padrão, valida esquema HTTPS e domínio roteado, `Host` e `Origin` iguais à URL, `Sec-Fetch-Site` quando disponível, `Content-Type` JSON, tamanho ≤64 KiB, `idempotency_key` UUID, até 40 itens, registro de domínio/instância/organização e ausência de divergências no corpo. Ignora `X-Forwarded-Host` fornecido pelo cliente. Não vaza detalhes do banco.
- `CheckoutPanel.tsx`: quando `VITE_NEROXA_CHECKOUT_GATEWAY=true`, chama `/api/checkout` e **nunca recai** para a RPC pública se o gateway falhar. Enquanto a flag do frontend está desligada, usa o contrato histórico de RPC, para testes graduais.

## Duas flags independentes: deliberadamente inativas

- **Servidor:** `NEROXA_CHECKOUT_GATEWAY_ENABLED=true` (servidor apenas). Sem esta flag, o endpoint retorna HTTP 503, sem abrir uma conexão ao banco.
- **Frontend:** `VITE_NEROXA_CHECKOUT_GATEWAY=true` (compilação; variável pública). Sem ela, o checkout segue direto pela RPC pública legada.
- **Segredo:** o adaptador depende de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (somente servidor), já lidos pelo módulo `client.server.ts`. **Não criar ou fornecer valores no chat nem publicar segredos.** O segredo privilegiado contorna RLS; uso requer gates adicionais de auditoria e limitação de abuso.

O gateway **não** aceita mapeamento alternativo para `localhost`, domínio Lovable nem preview da Vercel quando o modo privilegiado está ativo; testes de fluxo real precisam de domínio de ensaio validado com roteamento TLS apropriado, **não o domínio em produção**.

## Atestação de origem: limitação importante

Mesmo que um gateway same-origin determine o host a partir de `Request.url` e confira `Host/Origin`, **esses valores não autentificam por si só quem está chamando**: clientes não-browser podem falsificar cabeçalhos; a infraestrutura deve entregar um domínio roteado confiável e testes devem comprovar que host arbitrário não atravessa o ingress. O checkout público deve resistir a spam, duplicidade e enumeração de pedidos mesmo após o ingresso ser configurado.

## Gates explícitos para ativar

1. Validar no ambiente de ensaio o encaminhamento HTTPS e o domínio efetivamente autenticado/roteado pelo provedor de borda; rejeitar `Host`, `Origin` e `X-Forwarded-Host` falsificados no servidor.
2. Configurar credencial privilegiada no **servidor**, auditada e restrita ao ambiente; adicionar **rate limiting persistente**, quotas e monitoramento contra criação repetitiva/abusiva de pedidos; não depender de memória da função serverless.
3. Aplicar candidatos SQL apenas em clone e demonstrar que as RPCs resolvem domínio VERIFIED ↔ instância ACTIVE, inclusive duas lojas da mesma organização. O servidor **não** deve confiar no `store_domain` nem `instance_id` do JSON quando discorda do contexto.
4. Adaptar/validar todos os consumidores versionados, o painel legado e fluxos de alteração de pedidos. Planejar a revogação do `EXECUTE` público de `create_public_order` **somente quando o checkout via gateway estiver disponível** e um rollback coordenado estiver ensaiado. Sem essa revogação, chamadas diretas continuam contornando o gateway.
5. Exercitar falhas de credenciais, banco indisponível, Host/Origin falsificados, domínio ausente, organização errada, produtos de outra loja, idempotência, troca de instância e recuperação lógica pós-cutover.
6. Reconciliar a configuração real órfã identificada no Master por leitura agregada; definir plano sem perda de dados, sem alterar produção durante as auditorias.

## Riscos conhecidos e decisão

- O cliente SQL atual usa `service_role` em servidor: maior superfície de privilégio; o objetivo final deve migrar para um acesso mais restrito, sem deixar um segredo poderoso disponível em código cliente.
- `get_public_storefront_context` está ausente das tipagens antigas do projeto; adaptador com tipagem local temporária até a geração de tipos do schema novo, sem estender acesso a tabelas arbitrárias.
- Os testes do módulo cobrem o roteamento e as recusas com **dependências simuladas**; não provam segurança da Vercel, Supabase real ou prevenção de spam. A matriz PostgreSQL/JWT histórica de 275 verificações foi feita em etapa separada, sem acoplar este endpoint HTTP.
- **Nenhum deploy liberado.** Previews automáticos podem ser criados ao enviar commits, mas o gateway permanece desativado até configuração explícita do servidor.

**Próxima etapa:** CI completo na PR do delivery; depois ensaio E2E com ambiente descartável e infraestrutura de domínio compatível, teste de não-bypass da RPC e eventual decisão humana sobre implantação.
