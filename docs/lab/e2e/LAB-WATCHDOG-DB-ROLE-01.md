# NEROXA V1 — LAB-WATCHDOG-DB-ROLE-01

**Data:** 23/11/2026 · **Alvo:** Supabase LAB `gomexvhvecvvfbdzhjct`, exclusivamente · **PR:** #50 Draft · **Comercial:** NO-GO.

## OBJETIVO

Instalar o bootstrap de menor privilégio para futuro rollback automático de um único grant LAB A, mantendo o papel **sem login e sem senha**, para que não haja canal de banco funcional antes da preparação privada. Preservar todas as ordens/grants históricos, Cloudflare Main original e o watchdog desarmado.

## AUDITORIA PRELIMINAR — SOMENTE LEITURA

- `private.neroxa_lab_operator_grants` existe, pertence ao postgres, RLS=true, sem políticas; não há UPDATE público.
- Papel `neroxa_i04_lab_watchdog_revoke` e funções `private.neroxa_i04_watchdog_lab_a_*` ainda não existiam.
- Schema `private` sem USAGE para `anon`, `authenticated` ou `service_role`.
- Inicialmente seis grants históricos (5 A, 1 B), todos revogados; nenhum ativo. Nenhum valor de token ou hash foi recuperado.
- Documentação Supabase orienta restringir EXECUTE em funções `SECURITY DEFINER`, em especial porque o proprietário pode ignorar RLS; o código foi estritamente pinado ao UUID da LAB A.

## APLICAÇÃO EXECUTADA — SOMENTE LAB

1. Migração auditável **`neroxa_lab_a_watchdog_revoke_bootstrap_nologin_20261123`** (versão Supabase `20261123173048`) aplicada com sucesso. Fonte completa em `lab-source/watchdog-review/sql/LAB_ONLY_bootstrap_no_login_20261123.sql`. A transação aborta se o papel ou as funções preexistirem; cria `neroxa_i04_lab_watchdog_revoke` como `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; cria duas funções `SECURITY DEFINER` privadas com `search_path=''`, escopo LAB A, ID e prazo do grant exatos, TTL de no máximo 15 minutos. Revoga `EXECUTE` de `PUBLIC`, `anon`, `authenticated`, `service_role`, `authenticator` e concede exclusivamente ao papel dedicado. Não concede DML direto da tabela.
2. Detectado risco de visibilidade MVCC: a função de leitura classificada inicialmente como `STABLE` poderia não observar a revogação efetuada na mesma chamada SQL. Aplicada migração de correção **`neroxa_lab_a_watchdog_revoke_readback_volatile_20261123`** (versão `20261123173239`) alterando só a função de readback para `VOLATILE`, sem modificar ACL/segredos ou corpo da função. Fonte `lab-source/watchdog-review/sql/LAB_ONLY_fix_readback_volatility_20261123.sql`; comportamento documentado em <https://www.postgresql.org/docs/current/xfunc-volatility.html>.
3. O SQL de revisão histórico `REVIEW_ONLY_lab_a_grant_revocation.sql` foi marcado como **SUPERSEDED / NEVER EXECUTE**, com `RAISE EXCEPTION` no início para impedir execução acidental. Não usar nem instalar esse draft; as duas migrações LAB_ONLY são as fontes atuais.

## PROVA INDEPENDENTE

- Catálogo `pg_roles`: papel dedicado encontrado `rolcanlogin=false`, `rolinherit=false`, `rolbypassrls=false`, sem poderes de superuser, createdb ou createrole.
- Catálogo `pg_proc`: duas funções em `private`, `SECURITY DEFINER`, `provolatile='v'`, `search_path=''`; ambas com EXECUTE **true** para o papel dedicado, **false** para `anon`, `authenticated`, `service_role`, `authenticator`.
- `has_table_privilege`: role dedicado SELECT/UPDATE/INSERT/DELETE da tabela de grants = false; `private` USAGE do papel dedicado = true; papéis públicos não têm USAGE no schema.
- Read-only `SELECT` com UUID sintético inexistente retornou `false`, e leitura usando o registro histórico da LAB B retornou `0` resultados considerados revogados via função LAB A (um registro B existia).
- Read-only pós-DDL: LAB A 5 grants históricos revogados, 0 ativos; LAB B 1 histórico revogado, 0 ativos.
- `list_migrations` confirmou os dois nomes e números de versão. Security Advisors Supabase retornaram avisos anteriores gerais (incluindo `rls_enabled_no_policy` em tabelas privadas e proteção de senhas vazadas do Auth), **sem novo alerta específico das funções revogadoras**. Não afirmar que o projeto tem zero lints.
- Cloudflare GET após alterações: Worker LAB original `33c3539b-b50a-48b5-b869-9a4aa6811fed` = 100%, workers.dev=false, previews=false; watchdog atual `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` = 100%, cron `* * * * *`, `ARMED=false`, `GUARD_ENABLED=false`.
- [GitHub Actions #45229131074](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/45229131074) SUCCESS com novo teste estático que valida migrações NOLOGIN, ACL, isolação LAB A, visibilidade `VOLATILE` e bloqueio do rascunho antigo; os testes existentes de fontes, Worker review, harness HTTP e watchdog mock permaneceram verdes.

## LIMITES E BLOQUEIOS

`DB_ROLE_NOLOGIN=PASS`; `DB_FUNCTION_ACL=PASS`; `LAB_B_SCOPE_READ_PROOF=PASS`; `NEW_GRANTS=0`; `ACTUAL_REVOKE_OF_ACTIVE_GRANT=NOT_RUN`; `DB_PASSWORD=NOT_PROVISIONED`; `DB_LOGIN=DISABLED`; `PRIVATE_HYPERDRIVE=NOT_CREATED`; `PG_DRIVER_BUNDLED=NO`; `NEW_WATCHDOG_VERSION=NOT_CREATED`; `RECOVERY_RUNTIME=NOT_VERIFIED`; `LIVE_HTTP_NEGATIVES=NOT_RUN`; `COMMERCIAL=NO-GO`.

**Não foi feita a revogação real de um grant**: todos os grants anteriores estavam revogados, e as funções são acessíveis só por um role NOLOGIN. A existência e permissões das funções **não prova** que o watchdog consegue se conectar e usá-las em runtime; ainda é preciso demonstrar TLS/verificação de identidade na conexão Hyperdrive e testes de falha.

## PRÓXIMA AÇÃO

Preparar método privado para atribuir senha forte e habilitar LOGIN **apenas quando o Hyperdrive restrito for configurado**, sem circular senha pelo chat, GitHub, CI ou logs; verificar todos os dados de conexão e `verify-full` antes de qualquer alteração. Criar Hyperdrive **separado**, apontando para a LAB com esse role de funções apenas, e validar o driver `pg@8.23.1` em versão Worker **inativa**. Não implantar nem armar até comprovar retries, readback e revogação real de um grant sintético temporário autorizado, com Worker Main fechado e rollback independente.

`PR50=DRAFT` · `PUBLIC_CHECKOUT=OFF` · `WATCHDOG_ARMED=NO` · `COMERCIAL=NO-GO`.
