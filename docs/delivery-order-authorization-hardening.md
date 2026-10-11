# Delivery Engine — hardening de autorização (rascunho, sem execução)

Origem: PR #33 `fix/unify-neroxa-order-storage`. Esta branch é de preparação; **não aplicar migrações nem fazer merge** antes de integrar frontend e executar testes.

## Achados verificados
- `get_public_order_status(uuid,text)` identifica o pedido por UUID + telefone e retorna dados pessoais/endereço. `anon` e `authenticated` podem executar.
- `append_public_order_items_with_payment(uuid,text,jsonb,text)` usa UUID + telefone como autorização de escrita; aceita estados RECEIVED, CONFIRMED, PREPARING e READY.
- A inclusão altera `payment_method` e total, mas não cria comprovante, pagamento confirmado nem aprovação explícita do restaurante.
- `get_admin_orders` e `update_admin_order_status` verificam membro ativo da organização ou membro da plataforma; transições de status são validadas.
- RLS ativado nas tabelas e grants diretos revogados; RPCs SECURITY DEFINER exigem revisão específica.

## Contrato proposto (pendente de implementação)
1. Gerar um segredo aleatório criptograficamente seguro, exclusivo por pedido e por finalidade. Guardar somente hash no banco. Nunca usar telefone como autorização de escrita.
2. Entregar o segredo somente ao comprador durante o checkout por canal seguro; **não** colocá-lo em URL, logs, analytics, notificações ou respostas de status.
3. Exigir segredo válido para solicitar item adicional, com prazo e revogação; rate-limit na borda e resposta genérica a credenciais inválidas.
4. Limitar inclusão automática a RECEIVED ou CONFIRMED. PREPARING exige aprovação do restaurante e novo fluxo; READY e estados posteriores bloqueiam.
5. Preservar preço calculado no servidor, escopo por instance_id, bloqueio transacional e idempotência de requisições; registrar evento de auditoria e valor incremental.
6. Não marcar cobrança como paga ao adicionar item; explicitar valor adicional pendente e mecanismo de pagamento/aceite conforme método.
7. Rever leitura pública de status: token somente-leitura separado ou alternativa autenticada; limitar PII na resposta.
8. Implementar uma migration nova, aditiva, para preservar histórico e permitir cutover seguro; alterar backend/frontend/testes juntos. Não alterar RPC antiga de forma incompatível antes do cutover.
9. Conferir política de membros, roles, search_path, privilégios EXECUTE e dependências das oito migrations.

## Matriz mínima de testes (sem dados reais)
- Token válido e inválido; token revogado/expirado; repetição idempotente; corrida simultânea.
- Pedido de outra loja, produto de outra loja e usuário de outra organização: negar.
- Status RECEIVED/CONFIRMED: solicitar; PREPARING: exigir aprovação; READY/OUT_FOR_DELIVERY/DELIVERED/CANCELLED: negar.
- Preço adulterado no payload: ignorar; quantidade inválida: rejeitar; pagamento adicional: nunca confirmar sem evidência.
- Anon/authenticated sem token: negar; membro de outra organização: negar; auditoria registra mudanças.
- Migração, rollback e restauração ensaiados em ambiente isolado compatível com Supabase PostgreSQL 17 e supabase_vault.

## Gate de liberação
Sem merge, deploy ou SQL remoto até: implementação completa, testes passando, validação de autorização e ensaio de recuperação. Backup criptografado já existe, mas restauração integral não foi comprovada.
