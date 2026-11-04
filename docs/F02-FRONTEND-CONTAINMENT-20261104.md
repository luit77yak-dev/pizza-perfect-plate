# NEROXA — F02 | Parecer de contenção e admissão de revisão

**Data:** 2026-11-04  
**Repositório:** `luit77yak-dev/pizza-perfect-plate`  
**Base de comparação:** Delivery `main` `bff5bee289cd4e911a5be012cb7b8731e48e82fd`  
**Branch:** `security/f02-frontend-containment-20261104`  
**Decisão:** **PASS LOCAL COM RESSALVAS / NÃO ADMITIR PR, CI, MERGE OU DEPLOY SEM NOVA DECISÃO**.

## 1. Medidas de contenção na branch

- `CheckoutPanel.tsx`: checkout e acréscimos suspensos com mensagem explícita, sem PII, envio HTTP ou RPC pública desse componente; corrigida regressão mobile causada por seletor genérico de diálogos.
- `Storefront.tsx`: removidos polling e fallback de rastreamento por UUID + telefone. Não criar recibo de sucesso fictício; não apagar dados históricos do navegador.
- `src/routes/painel.tsx`: `/painel` exibe suspensão; o código operacional permanece apenas como fonte não roteada.
- `src/routes/admin/pedidos.tsx`: **novo achado pós-ensaio**: a rota ainda montava a página `AdminOrdersPage`, capaz de chamar `get_admin_orders` e `update_admin_order_status`, além de autenticação. A branch passou a montar `SuspendedAdminOrders`. O código legado foi preservado mas deixa de ser o componente da rota. **Esse delta teve PASS visual e foi coberto pelos 6 testes estáticos, ambos no SHA `2f7c2892270d802cdf68ea51ce9a3961f6fe8831`.**
- `vercel.json`: desligado o deployment automático da branch via `git.deploymentEnabled`.
- `tools/f02-local-browser-smoke.mjs`: servidor fictício local e worktree descartável; compila CSS sem depender da transformação CSS de desenvolvimento e usa proxy apenas para `127.0.0.1:8777`.
- `tools/f02-local-deny-probe.mjs`: **executado com PASS 4/4**. Quatro requisições sintéticas exclusivamente para `127.0.0.1` foram rejeitadas com HTTP 403; o contador subiu de 0 para 4 sem leituras do catálogo. Não faz chamadas ao Supabase real.
- `tests/f02-frontend-containment.test.mjs`: **6/6 testes estáticos PASS** no SHA `2f7c2892270d802cdf68ea51ce9a3961f6fe8831`, incluindo o contrato de `/admin/pedidos`.

## 2. Evidências efetivamente observadas pelo fundador no Termux e no Chrome

| Verificação | Resultado observado | Limite |
| --- | --- | --- |
| Clone e SHA da branch | PASS em `41e5269ce99002755af5465fc5c03a9d726ed725` | SHA contendo as duas novas verificações funcionais |
| Integridade `git status --short` | PASS (saída vazia) | Naquele SHA |
| `node --test tests/f02-frontend-containment.test.mjs` | **6/6 PASS**, 0 FAIL | Inclui teste da suspensão de `/admin/pedidos` |
| `tsc --noEmit` | **PASS**, exit 0 | Após suspensão de `/admin/pedidos` |
| Build normal Vite/Nitro | PASS em revisão anterior | Não equivale ao build final de toda a branch atual |
| Build sintético do executor | PASS em ambiente Termux | Worktree e fixtures diferentes da versão comercial |
| Painel `/painel` no Chrome mobile | PASS visual, aviso de suspensão | `/admin/pedidos` verificado em captura posterior, PASS visual |
| Checkout mobile no Chrome | PASS visual após correção de layout | Não certifica serviços hospedados |
| Catálogo fictício | Carregou em localhost | O item de teste passou de `SIMPLE` para `SIDE` apenas na fixture |
| `/__health` local | `catalog_reads: 6`, `blocked_requests: 0` | Contabiliza apenas o mock, não todas as saídas de rede |
| Prettier `CheckoutPanel.tsx` | PASS em revisão intermediária | Nova marcação sem reteste final |
| ESLint dos três arquivos iniciais | 666 erros de Prettier e 2 avisos de Hooks antes da correção de checkout; sem Prettier: 0 erros, 2 avisos | Lint completo NÃO PASS; outros arquivos não foram varridos |

O fundador forneceu capturas da vitrine, da suspensão `/painel`, do aviso de checkout mobile corrigido e do recibo local. Elas constam da conversa de validação, **não estão anexadas ao repositório**.

## 3. Revisão de superfície e riscos remanescentes

1. A suspensão de interface **não revoga grants, ACL, RLS ou RPCs** do Supabase. Consumidores externos e aliases ainda exigem inventário e avaliação separados.
2. O catálogo hospedado ainda é acessado por `get_public_storefront_catalog` na implementação normal. A fixture do navegador substituiu essa conexão **somente na worktree temporária**, não é a aplicação em produção.
3. `blocked_requests: 0` no fluxo positivo significa que nenhuma requisição recusada atingiu o mock. **Não comprova ausência de egress para outros destinos**. O teste negativo local só prova rejeição de rotas locais, caso seja executado. Falta auditoria de egress/browser com evidência independente.
4. Novos deltas (`/admin/pedidos`, sexto teste, ferramenta de rejeições e este documento) **foram cobertos pelo PASS 6/6 e TypeScript exit 0 no SHA `2f7c2892270d802cdf68ea51ce9a3961f6fe8831`**, conforme saída do Termux. Os novos arquivos auxiliares e esta atualização documental não foram executados no SHA mais recente.
5. O código antigo da rota administrativa permanece no arquivo para análise, mas não deve ser tratado como backend seguro nem reaproveitado sem F01 homologada.
6. O workflow `.github/workflows/ci.yml` dispara em `pull_request` contra `main`, inclusive PR draft; usa Node 22 e roda Prettier, ESLint e build. **Não criar PR automaticamente**: requer decisão específica de admissão do CI.
7. F01, F02 hosted, SEC-18 e Gate 0 continuam **NO-GO**. Checkout desabilitado e tracking indisponível impedem operação comercial.

## 4. Sequência de admissibilidade (somente após autorização correspondente)

- [x] No SHA `2f7c2892270d802cdf68ea51ce9a3961f6fe8831`, executados `node --test` (6/6) e `tsc --noEmit` (exit 0).
- [x] Build sintético e inspeção visual de `/admin/pedidos`, `/painel` e checkout mobile executados; PASS visual, não prova hosted.
- [x] `node tools/f02-local-deny-probe.mjs`: 4/4 HTTP 403, incremento exato de 4 em `blocked_requests`; **não testa a API hospedada**.
- [ ] Obter prova separada de tráfego externo bloqueado ou ausência de egress; nenhum resultado local isolado certifica isso.
- [ ] Revisar lint/formatação completa, compatibilidade com a PR candidata de capabilities, outros consumidores e planos de recuperação.
- [ ] Deliberar explicitamente sobre PR e disparo de CI antes de abri-la; depois, merge/deploy/SQL exigem autorizações próprias.

**Proibições nesta fase:** CI nativo, GitHub Actions manual, execução SQL, Supabase hosted mutation, deploy, merge, DNS, exposição pública, custos incrementais e GO comercial.

## 5. Inventário estático de saídas de rede (revisão documental)

- `src/features/storefront/services/load-store.ts`: a versão normal faz `get_public_storefront_catalog` com a origem resolvida pelo domínio. O harness troca o cliente por um proxy do mock **somente na worktree**.
- `src/integrations/storefront-backend/client.ts`: URL Supabase hospedada codificada no cliente público e `fetch` customizado. Em hospedagem real, o catálogo não é offline.
- `src/integrations/supabase/client.ts`: fallback para o Supabase hospedado; inclui cliente de Auth. As rotas administrativas antigas não são mais selecionadas no candidato, mas o acesso direto à API não foi revogado.
- `src/integrations/supabase/client.server.ts` e `auth-middleware.ts`: clientes de servidor usam variáveis de ambiente e mecanismos de autenticação; a presença do código não comprova execução, vazamento nem isolamento.
- `src/routes/__root.tsx`: Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) e preconnect externos.
- `src/components/storefront/Storefront.tsx`, `StorefrontHero.tsx`, `StorefrontAbout.tsx`: imagens remotas do Unsplash; outras imagens também podem vir de URLs do catálogo.
- `src/lib/lovable-error-reporting.ts`: callbacks de telemetria de editor são condicionais a integrações presentes em `window`; destino/execução efetiva não identificados nesta revisão.
- `src/integrations/supabase/previewAuthStorage.ts`: broker de Auth por `postMessage` restrito a determinados hosts de preview; não é prova de egress HTTP, mas exige revisão de superfícies de preview e sessão.

**Parecer de egress:** inventário estático **PARCIAL**. Não houve captura de tráfego do navegador nem atestação de ausência de acesso externo, e `blocked_requests: 0` mede somente requisições rejeitadas pelo mock. Um CSP em `<meta>` no harness reduz a superfície de recursos, mas não substitui fiscalização independente da rede; não certificar egress apenas por esse CSP.

## 6. Controles de lint e CI

- Ferramenta estática adicional: `tools/f02-lint-baseline-delta.mjs` lê via `git show` a base congelada e o candidato, chama `ESLint.lintText()` em memória, separa `prettier/prettier` de outras regras e imprime deltas por arquivo. **Executada pelo fundador no Termux, com resultado comparativo registrado abaixo**; não altera o código.
- O script pode baixar o commit base público se ele não estiver disponível em clone raso; não faz checkout, fix, push, build ou CI.
- O workflow `.github/workflows/ci.yml` é acionado por PR para `main` (inclusive draft), formata arquivos com `prettier --write`, executa ESLint e build. Exige admissão específica antes de abrir PR.
- Dado que não houve lint completo e existem erros de formatação herdados, **lint completo permanece NÃO APROVADO**. A comparação de baseline serve para dimensionar o delta, não para dispensar lint de admissão.

### Resultado real da comparação de lint — 2026-11-04

Executado em clone limpo da branch no SHA `908aaa2a7b343a229d43d2b25c18c690f2d30f55`, contra a base congelada `bff5bee289cd4e911a5be012cb7b8731e48e82fd`. O comparador buscou o commit base público (clone raso) sem checkout.

| Arquivo | Base: erros Prettier | Candidato: erros Prettier | Delta | Avisos base/candidato |
| --- | ---: | ---: | ---: | ---: |
| `Storefront.tsx` | 294 | 281 | -13 | 0 / 0 |
| `CheckoutPanel.tsx` | 68 | 0 | -68 | 0 / 0 |
| `painel.tsx` | 382 | 384 | +2 | 2 / 2 |
| `admin/pedidos.tsx` | 36 | 37 | +1 | 2 / 2 |
| **Total, 4 arquivos** | **780** | **702** | **-78** | **4 / 4** |

- Todos os **702 erros atuais** desses quatro arquivos são `prettier/prettier`; **zero erros** de outras regras. Os **4 avisos de React Hooks** permanecem, sem acréscimo líquido.
- A redução líquida de 78 **não significa zero regressões locais**: `painel.tsx` e `admin/pedidos.tsx` ganharam, respectivamente, +2 e +1 ocorrências de Prettier. Identificar as ocorrências no trecho adicionado e ajustar apenas esses trechos, sem reformatar o legado inteiro.
- `Storefront.tsx` permanece com 281 erros herdados; o checkout novo está com **0** erros Prettier.
- `git status --short` retornou árvore limpa. **Nenhum CI, merge, PR ou deploy** foi provocado pela comparação.
- Isto é um **baseline relativo, não PASS de lint completo**; a auditoria está limitada aos 4 arquivos alterados e não cobre toda a árvore nem a versão do workflow em execução.
- `.github/workflows/ci.yml` formata alguns arquivos em seu checkout temporário antes de executar ESLint; o resultado desse workflow, caso futuramente autorizado, deve ser avaliado separadamente do lint direto do clone.
