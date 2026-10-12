# Gate de consumidores de pedidos legados — 12/10/2026

**Estado: NO-GO produção, PR #37 DRAFT.** Esta branch protegeu criação por instância no gateway candidato, mas os demais fluxos ainda precisam de homologação. Não aplicar SQL remoto, alterar flags de produção, mesclar ou promover deploy.

## Descobertas

- **Criação:** `CheckoutPanel.tsx` usa `POST /api/checkout` somente se `VITE_NEROXA_CHECKOUT_GATEWAY=true`, sem fallback público quando o endpoint falha. Com flag desligada mantém `create_public_order` histórico. Revogar a RPC direta só no cutover coordenado.
- **Item esquecido:** o fluxo antigo chama `append_public_order_items_with_payment` do navegador com UUID+telefone, não uma credencial exclusiva de alteração. O Master histórico registra EXECUTE `anon`/`authenticated` e a função altera subtotal, total e forma de pagamento. A precificação por instância não corrige a autorização fraca de comprador.
- **Trava preventiva nesta PR:** com a flag do gateway protegida, `TrackedOrderPanel` não exibe a opção de complementar e o `CheckoutPanel` recusa a tentativa antes da RPC antiga. O fluxo com flag desligada fica intocado. **Essa trava é só de UX/cliente; não remove acesso anônimo à RPC.**
- **Acompanhamento:** `Storefront.tsx` usa `get_public_order_status` com UUID+telefone; o Master histórico pode retornar nome, telefone, endereço, notas e itens. Dados locais de rastreamento foram isolados por instância, porém o controle de acesso da RPC ainda exige uma credencial exclusiva ou autorização equivalente.
- **Painel novo:** `src/routes/admin/pedidos.tsx` usa `get_admin_orders(p_instance_id)` e `update_admin_order_status(p_order_id,...)`; a autorização deve ser garantida na RPC. Isolamento de operadores foi testado no clone, sem certificação do deploy.
- **Painel legado:** `src/routes/painel.tsx` lê `orders`, produtos, áreas de entrega e settings por `organization_id`, chama `update_order_status` e subscreve `order_items` por organização; ainda não foi convertido para loja/instância. A existência da rota no código não prova seu uso em produção, mas também não autoriza tratá-la como desativada.
- **Pagamento:** a mudança de `payment_method` ao adicionar itens não representa cobrança confirmada. Revisar transições e pagamento antes de liberar o comercial.
- **PR #36 separada:** existe proposta de token de alteração na PR [#36](https://github.com/luit77yak-dev/pizza-perfect-plate/pull/36), baseada na PR #33; não está integrada, validada ou pronta para merge com esta branch.

## Testes adicionados

`tests/order-consumer-safety.test.mjs` verifica que a interface protegida não acessa a RPC antiga de complemento, que não há fallback do checkout seguro e que as chamadas atuais de tracking e painel legado continuam inventariadas. São **testes estáticos**, não substituem SQL ACL, isolamento em runtime ou teste antifraude.

No Master, o candidato `audits/sql/legacy-order-append-no-bypass.release-gate.candidate.sql` e a matriz Auth/PostgREST do clone testam a possível revogação de append direto. **Nenhuma permissão real foi modificada.**

[Inventário e matriz de riscos no Master](https://github.com/luit77yak-dev/neroxa-master/blob/audit/store-isolation-candidate-20261011/audits/order-consumer-authz-matrix-20261012.md)

## Gates antes de habilitar o gateway comercial

1. Criar uma API de alteração com token aleatório por pedido, validade e revogação, restrito à instância; conferir preço/estado/idempotência no SQL e rate limiting no servidor.
2. Migrar acompanhamento para leitura com autorização e resposta mínima, sem expor endereço/telefone apenas com UUID+telefone.
3. Desabilitar ou migrar o `/painel` legado de forma controlada, sem perder pedidos históricos.
4. Homologar ACL das RPCs antigas e novas com JWTs anônimos, usuários reais e clientes de outras instâncias; executar revogação **somente em clone** antes do release planejado.
5. Inspecionar dependências externas, pagamentos, domínios confiáveis, contingência e conciliação do catálogo histórico sem instância.

**Bloqueio intencional:** no modo seguro, item esquecido ficará indisponível até o endpoint de alteração ser autorizado, implementado e testado. Não prometer essa função aos clientes antes de fechar a migração.
