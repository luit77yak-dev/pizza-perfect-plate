# LAB-WATCHDOG-REVOKE-ADAPTER-01 — Review-only PostgreSQL port

## Finalidade

Estender o contrato `recovery-contract.cjs` com a **revogação verificável de um grant temporário da LAB A**, sem criar endpoint público e sem usar Supabase `service_role`. Arquivos desta pasta permanecem isolados do runtime `src/**` e do Worker Cloudflare implantado.

## Componentes

- `grant-revoke-adapter.cjs`: portas `isTemporaryLabAGrantRevoked()` / `revokeTemporaryLabAGrant()`, usam exclusivamente `SELECT private.neroxa_i04_watchdog_lab_a_*(...)` parametrizado; antes de qualquer query operacional verificam `current_user=session_user=neroxa_i04_lab_watchdog_revoke`, database `postgres` e TLS ativo.
- `sql/REVIEW_ONLY_lab_a_grant_revocation.sql`: proposta **não aplicada** de papel dedicado com senha inicial NULL e funções privadas `SECURITY DEFINER`, bloqueadas para PUBLIC, anon e authenticated. Funções filtram ID + prazo exato + instance ID LAB A + TTL máximo 15min. Revogação confirmada exclusivamente por `revoked_at IS NOT NULL`, nunca por expiração.
- `watchdog-wiring-preview.cjs`: integra as portas privadas com as três ações de recuperação `HOST_CLOSED`, `LAB_A_GRANT_REVOKED` e `ORIGINAL_100` com retry do `recovery-contract.cjs`.
- Testes `grant-revoke-adapter.test.cjs` e `watchdog-wiring-preview.test.cjs`: mocks sem rede, sem SQL remoto, sem tokens.

## Requisitos para a futura execução real

1. Revisar a proposta SQL e a exposição de schemas no projeto **exclusivamente LAB** `gomexvhvecvvfbdzhjct`. É `SECURITY DEFINER`: o dono pode bypassar RLS, por isso o SQL restringe a LAB A e ainda exige auditoria independente.
2. Sob autorização distinta de escrita, criar função/papel dedicados e conferir com leitura de volta ACL, função, `rolbypassrls`, privilégios na tabela, função inacessível para anon/authenticated/PUBLIC, e impossibilidade de modificar LAB B; prover senha forte **somente em canal privado**, nunca em Git, CI ou chat.
3. Configurar **Hyperdrive separado** com o login de revogação de privilégio mínimo e TLS `verify-full`. Não reutilizar o Hyperdrive Food que usa outro papel. Conferir `pg@8.23.1` (bundling offline), `nodejs_compat` e `createDbClient` antes de compor uma versão Cloudflare INATIVA do watchdog.
4. Configurar somente em bindings cifrados o ID do grant temporário, início de janela e expiração <=15 minutos, sem expor valores em log/artefato. ID e prazo devem corresponder ao registro exato no banco.
5. Integrar adaptador Cloudflare com privilégios mínimos para fechamento das URLs e restauração original. Submeter testes de falha parcial, D1/retry, isolamento B, Access anônimo e readback SQL. Não executar `scheduled` armado até provar rollback e revogação real com a janela fechada.
6. Provar a propagação do cron e redundância de fechamento; Cron Trigger não é um SLA de fechamento ao segundo.

## Limites atuais

`DB_FUNCTIONS=NOT_APPLIED`; `DB_ROLE=NOT_CREATED`; `RESTRICTED_HYPERDRIVE=NOT_CONFIGURED`; `WORKER_ENTRY_BUNDLED=NO`; `WATCHDOG_NEW_VERSION=NOT_CREATED`; `WATCHDOG_CURRENT=DISARMED`; `CRON=* * * * *`; `HTTP_TESTS=NOT_RUN`; `COMMERCIAL=NO-GO`.

O sucesso do CI demonstra apenas testes locais da interface e da lógica simulada. Não equivale a autorização, migração, deployment ou teste de recuperação real.
