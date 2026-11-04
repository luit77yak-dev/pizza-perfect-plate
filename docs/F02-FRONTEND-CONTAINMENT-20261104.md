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
- `src/routes/admin/pedidos.tsx`: **novo achado pós-ensaio**: a rota ainda montava a página `AdminOrdersPage`, capaz de chamar `get_admin_orders` e `update_admin_order_status`, além de autenticação. A branch passou a montar `SuspendedAdminOrders`. O código legado foi preservado mas deixa de ser o componente da rota. **Esse delta ainda não foi validado no Termux.**
- `vercel.json`: desligado o deployment automático da branch via `git.deploymentEnabled`.
- `tools/f02-local-browser-smoke.mjs`: servidor fictício local e worktree descartável; compila CSS sem depender da transformação CSS de desenvolvimento e usa proxy apenas para `127.0.0.1:8777`.
- `tools/f02-local-deny-probe.mjs`: **novo e não executado**. Quatro requisições sintéticas exclusivamente para `127.0.0.1`, exigindo HTTP 403, com comparação dos contadores antes/depois. Não faz chamadas ao Supabase real.
- `tests/f02-frontend-containment.test.mjs`: eram 5 testes estáticos aprovados; foi adicionado um 6º contrato para `/admin/pedidos`, **ainda não executado**.

## 2. Evidências efetivamente observadas pelo fundador no Termux e no Chrome

| Verificação | Resultado observado | Limite |
| --- | --- | --- |
| Clone e SHA da branch | PASS em `41e5269ce99002755af5465fc5c03a9d726ed725` | SHA anterior aos dois novos deltas |
| Integridade `git status --short` | PASS (saída vazia) | Naquele SHA |
| `node --test tests/f02-frontend-containment.test.mjs` | **5/5 PASS**, 0 FAIL | Sexto teste ainda não executado |
| `tsc --noEmit` | **PASS**, exit 0 | Após correção mobile, antes da nova rota |
| Build normal Vite/Nitro | PASS em revisão anterior | Não equivale ao build final de toda a branch atual |
| Build sintético do executor | PASS em ambiente Termux | Worktree e fixtures diferentes da versão comercial |
| Painel `/painel` no Chrome mobile | PASS visual, aviso de suspensão | Não testa `/admin/pedidos` |
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
4. Novos deltas (`/admin/pedidos`, sexto teste, ferramenta de rejeições e este documento) **não estão cobertos pelo PASS 5/5 do SHA anterior**. É obrigatório repetir os testes locais.
5. O código antigo da rota administrativa permanece no arquivo para análise, mas não deve ser tratado como backend seguro nem reaproveitado sem F01 homologada.
6. O workflow `.github/workflows/ci.yml` dispara em `pull_request` contra `main`, inclusive PR draft; usa Node 22 e roda Prettier, ESLint e build. **Não criar PR automaticamente**: requer decisão específica de admissão do CI.
7. F01, F02 hosted, SEC-18 e Gate 0 continuam **NO-GO**. Checkout desabilitado e tracking indisponível impedem operação comercial.

## 4. Sequência de admissibilidade (somente após autorização correspondente)

- [ ] No novo SHA, executar `node --test tests/f02-frontend-containment.test.mjs` e `./node_modules/.bin/tsc --noEmit` (esperados 6/6, exit 0).
- [ ] Reexecutar build sintético e revisar visualmente `/admin/pedidos`, além do checkout.
- [ ] Com o servidor local fictício ativo, executar `node tools/f02-local-deny-probe.mjs`, esperando quatro HTTP 403 e exatamente quatro incrementos do contador; confirmar que **não testa a API hospedada**.
- [ ] Obter prova separada de tráfego externo bloqueado ou ausência de egress; nenhum resultado local isolado certifica isso.
- [ ] Revisar lint/formatação completa, compatibilidade com a PR candidata de capabilities, outros consumidores e planos de recuperação.
- [ ] Deliberar explicitamente sobre PR e disparo de CI antes de abri-la; depois, merge/deploy/SQL exigem autorizações próprias.

**Proibições nesta fase:** CI nativo, GitHub Actions manual, execução SQL, Supabase hosted mutation, deploy, merge, DNS, exposição pública, custos incrementais e GO comercial.
