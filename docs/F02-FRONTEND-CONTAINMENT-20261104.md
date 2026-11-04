# NEROXA F02 — isolamento de frontend (não publicar)

**Data:** 2026-11-04  
**Base:** Delivery `main` `bff5bee289cd4e911a5be012cb7b8731e48e82fd`  
**Branch:** `security/f02-frontend-containment-20261104`  
**Estado:** STATIC CANDIDATE / NO MERGE / NO DEPLOY / NO COMMERCIAL GO

## Escopo

1. `src/features/storefront/components/CheckoutPanel.tsx`: substituir a integração pública de pedido e item esquecido por um aviso explícito, sem coleta de PII e sem envio remoto. Nenhuma migração do gateway candidato foi realizada.
2. `src/components/storefront/Storefront.tsx`: remover o polling `get_public_order_status` com UUID+telefone e o pós-checkout que consultava a mesma RPC; não carregar recibos armazenados localmente como se fossem status atual. O armazenamento histórico do navegador não é apagado automaticamente; recuperação depende de atendimento.
3. `src/routes/painel.tsx`: apontar a rota pública `/painel` para um aviso de suspensão. O código legado ainda existe no arquivo para revisão histórica, mas não é selecionado como componente roteado. **Não significa revogação de permissões SQL**.
4. `vercel.json`: `git.deploymentEnabled["security/f02-frontend-containment-20261104"]=false` para não criar preview automático dessa branch.
5. `tests/f02-frontend-containment.test.mjs`: verificações estáticas, executáveis via `node --test tests/f02-frontend-containment.test.mjs` em clone de revisão offline.

## Resultado esperado no candidato

- Catálogo e carrinho podem ser visualizados; checkout e complementos ficam indisponíveis.
- O cliente não recebe sinal de sucesso de um pedido que não foi enviado.
- Tracking antigo não é consultado por UUID+telefone; pedidos históricos precisam de atendimento assistido.
- O painel legado não deve oferecer interface operacional.
- Nenhum backend seguro novo, token, recovery, SQL, ACL, status de pagamento ou integração comercial foi ativado.

## Limitações e riscos

- **Uma alteração no frontend não remove o acesso às RPCs legadas no Supabase.** Clientes externos podem continuar chamando a API, conforme grants efetivos existentes.
- A interface candidata de checkout está deliberadamente **desativada**, logo este patch isolado **não é um release comercial**.
- Não há prova de TypeScript, build, navegador, performance, políticas, bundle efetivamente distribuído ou efeitos server-side nesta revisão.
- Os guards de capability das PRs Delivery #43/#44 ainda são local-only; não copiá-los como se fossem solução hospedada.
- O backend do Master PR #50 e a decisão de revoke continuam **NO-GO**. A F01 e a SEC-18 também permanecem abertas.

## Gates antes de qualquer PR para main ou publicação

- [ ] Validar a branch em clone local com lint, TypeScript, build e UI/browser (sem backend real).
- [ ] Revisar a discrepância com Delivery PR #43/#44 e garantir compatibilidade sem reintroduzir o fallback por telefone.
- [ ] Identificar integralmente outros consumidores/aliases/deployments e os grants reais no Supabase por leitura autorizada.
- [ ] Homologar o backend de capabilities e as identidades A1/A2/C em laboratório nativo autorizado.
- [ ] Aprovar plano explícito de migração, proteção dos consumidores existentes e eventual REVOKE — nunca por inferência.
- [ ] Obter aprovação separada do fundador para PR/merge/deploy, com SHA exato e planejamento de rollback seguro.

**Limite desta missão:** nenhum merge, CI, SQL, Vercel deploy, alterações de DNS, compra ou exposição pública deliberada. A F01 continua bloqueada pelo Actions.
