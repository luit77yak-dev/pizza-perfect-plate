# NEROXA V1 — LAB-WATCHDOG-REVOKE-ADAPTER-01

**Data:** 23/11/2026 · **Escopo:** LAB A apenas, PR #50 Draft · **Comercial:** NO-GO.

## OBJETIVO

Implementar uma interface de revogação específica para um grant temporário da LAB A e conectá-la à recuperação que já exige três resultados verificáveis (host fechado, grant revogado, versão original 100%). Preservar Cloudflare implantada e Supabase; não inferir que mocks provam autorização ou rollback real.

## FEITO

1. **Supabase LAB — revisão somente leitura:** `private.neroxa_lab_operator_grants` contém `id`, `instance_id`, `token_sha256`, `created_at`, `expires_at`, `revoked_at`. Tabela pertence a `postgres`, tem RLS ativado, sem políticas atuais, e papéis públicos `anon` e `authenticated` não possuem os privilégios consultados. Nenhuma mudança na tabela nem nas políticas existentes.
2. Criado `lab-source/watchdog-review/grant-revoke-adapter.cjs`: funções do contrato `isTemporaryLabAGrantRevoked` / `revokeTemporaryLabAGrant` que exigem ID UUID do grant, exata expiração, TTL máximo 15 minutos, `instanceId` fixo LAB A, `current_user` e `session_user` iguais ao novo papel dedicado `neroxa_i04_lab_watchdog_revoke`, database `postgres`, TLS `ssl=true`. Só permite duas chamadas SQL parametrizadas a funções **privadas**; nunca faz UPDATE direto, lê o Bearer ou usa service_role. Todas as conexões `pg` são fechadas em `finally`.
3. Criado SQL **somente para revisão, NÃO EXECUTADO** em `lab-source/watchdog-review/sql/REVIEW_ONLY_lab_a_grant_revocation.sql`: propõe papel LOGIN NOINHERIT com senha inicial NULL e duas funções no schema private para consultar revogação e marcar `revoked_at` apenas no grant A identificado pelo UUID+expiração e limitado a duração de 15 minutos. `REVOKE EXECUTE` de PUBLIC, anon, authenticated, service_role e grant exclusivo ao papel dedicado. Funções `SECURITY DEFINER` exigem aprovação independente devido a RLS bypass e escopo privilegiado.
4. Criado `lab-source/watchdog-review/watchdog-wiring-preview.cjs`: integra o adaptador SQL ao `recovery-contract.cjs` e aos portos Cloudflare simulados. Quando desarmado, sem efeitos. Depois do prazo, tenta fechar host, revogar o grant e restaurar original independentemente. Se o adaptador DB faltar ou falhar, mantém `HOLD_RETRY_NEXT_TICK`; host e rollback Cloudflare ainda são tentados. Não marca expirado como revogado.
5. Testes novos `grant-revoke-adapter.test.cjs` e `watchdog-wiring-preview.test.cjs`, ambos executados no CI do PR #50 sem rede/DB. README explica provisionamento privado e o que ainda não foi integrado.

## PROVA

- [GitHub Actions #45224981847](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/45224981847), SUCCESS: passos novos de adaptador e integração mock, junto de 12 fontes, 5 módulos Worker fail-closed, negativos HTTP mock e contrato de recuperação.
- GET Cloudflare após mudança mostrou versão original Food `33c3539b-b50a-48b5-b869-9a4aa6811fed` a 100%, workers.dev/previews false, watchdog real `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` a 100%, cron `* * * * *` ativo em configuração, `I04_GUARD_ENABLED=false`, `I04_WATCHDOG_ARMED=false`. Nada publicado no Worker novo.
- Nenhum token, session ID, hash de grant, senha, JWT, cookie ou segredo em código/CI. `PR50=DRAFT`, sem merge.

## BLOQUEIO REAL

`DB_REVOKE_FUNCTIONS=NOT_APPLIED`; `RESTRICTED_DB_ROLE=NOT_CREATED`; `RESTRICTED_HYPERDRIVE=NOT_CONFIGURED`; `NEW_WATCHDOG_VERSION=NOT_CREATED`; `WATCHDOG_CURRENT=DISARMED`; `GRANT_A_NEW=NOT_CREATED`; `LIVE_HTTP_NEGATIVES=NOT_RUN`; `COMMERCIAL=NO-GO`.

O motivo de não publicar uma versão inativa de Worker com o adaptador é técnico: ainda não há login PostgreSQL restrito e nem Hyperdrive dedicado / módulo `pg` empacotado para essa versão. Criar uma versão falsamente "deployável" sem essa dependência poderia esconder uma falha no mecanismo de recuperação.

## PRÓXIMA AÇÃO

1. Revisar e autorizar **especificamente SQL na LAB A**: papel dedicado + duas funções privadas, leitura de volta de ACL/RLS e teste de isolamento contra LAB B (sem alterar comercial).
2. Provisionar senha somente por canal privado, configurar Hyperdrive LAB restrito TLS verify-full e verificar `pg@8.23.1` empacotado no Worker; não reutilizar o Hyperdrive Food de papel mais amplo.
3. Com esses gates, empacotar uma nova versão **inativa** do watchdog com o contrato/retry, integrar CF + PG e executar provas reais de recuperação enquanto host permanece fechado, antes de qualquer arming/deploy/abertura temporária.
4. Somente depois pedir autorização delimitada para janela protegida <=15 min e seis testes HTTP; nunca inferir comercial GO.

`REVOKE_ADAPTER_OFFLINE=PASS` · `WORKER_REVIEW_ONLY=YES` · `ORIGINAL_100=PASS` · `WATCHDOG_ARMED=NO` · `COMMERCIAL=NO-GO`.
