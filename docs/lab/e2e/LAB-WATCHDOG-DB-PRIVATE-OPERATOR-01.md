# NEROXA V1 — LAB-WATCHDOG-DB-PRIVATE-OPERATOR-01

**Data:** 23/11/2026 · **Escopo:** LAB A / operador privado Termux · **PR:** #50 Draft · **Comercial:** NO-GO.

## Recibo do proprietário

O Termux reportou `DB_PASSWORD_PREP=PASS`, papel `neroxa_i04_lab_watchdog_revoke`, projeto `gomexvhvecvvfbdzhjct`, senha de 64 caracteres com arquivo `0600` e diretórios privados `0700`, `NETWORK=NONE`, `DB_LOGIN=NOLOGIN`, `HYPERDRIVE=NOT_CREATED`. O **identificador de sessão, senha e SHA-256 da senha não estão registrados neste relatório nem no PR**.

## Preflight independente

- Supabase LAB `gomexvhvecvvfbdzhjct` HEALTHY; role `neroxa_i04_lab_watchdog_revoke` com `rolcanlogin=false`, `rolinherit=false`, `rolbypassrls=false`; seis grants históricos revogados, zero grants ativos.
- Cloudflare GET: Worker `neroxa-v1-i04-api-lab` original `33c3539b-b50a-48b5-b869-9a4aa6811fed` 100%, workers.dev/previews fechados; watchdog versão `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` original 100%, Cron `* * * * *` mantido.
- Nenhuma escrita SQL, configuração Cloudflare, ativação de papel, acesso HTTP de aplicação ou alteração comercial realizada nesta missão.

## Artefato privado preparado

Arquivo Python entregue na conversa, **fora do repositório**: `neroxa_watchdog_db_psql_20261123.py` (SHA-256 do código: `5fe720cd5037244faed6d228802ab23579306841d543b2e0ee901deca7449f02`).

- `--self-test` e `--local-check --session SESSION_ID`: nenhum acesso remoto. Verificação de integridade e permissões `0600/0700`.
- `--preflight`: exige `psql`, hostname LAB oficial (direto ou Session Pooler LAB conforme painel), usuário administrativo pinado, CA do projeto LAB e `PGSSLMODE=verify-full`; verifica role ainda NOLOGIN, identidade Postgres, conexão SSL e instância A no LAB sem escrita.
- `--activate`: **não executado e não autorizado nesta missão**. Requer preflight, terminal interativo e frase explícita de confirmação; gera SCRAM-SHA-256 local do arquivo privado e só envia **verificador** via stdin ao `psql`, nunca senha plaintext como argumento de processo, SQL salvo ou log. Executa exclusivamente `ALTER ROLE neroxa_i04_lab_watchdog_revoke WITH LOGIN ...` sob verificação transacional LAB. Não usar antes da admissão separada de integração com Hyperdrive e aprovação específica.
- `--verify-login`: futuro; usa arquivo `.pgpass` temporário privado `0600`, remove-o em `finally`, e valida TLS, current_user e impossibilidade de SELECT/UPDATE na tabela de grants.

**Teste realizado no modelo nesta sessão:** `--self-test` PASS; cenário de HOME temporário com gerador de senha `--prepare` seguido de operador `--local-check` PASS; preflight sem CA bloqueado; compilação Python PASS. **Nenhum teste psql remoto foi executado**. Este arquivo não substitui verificação de certificado, ACL, pooler ou conexão real.

## Próximo gate

Executar **somente** `--self-test` e `--local-check` no Termux, sem fornecer senha em chat. Depois obter o certificado CA da LAB e parâmetros oficiais de conexão no Supabase Connect, realizar preflight autenticado de leitura e conferir TLS. A ativação real do login e provisionamento do Hyperdrive devem ser encadeados em janela autorizada, com reversão imediata `NOLOGIN` em erro. O watchdog deve permanecer desarmado e host fechado até readback e testes independentes completos.

`TERMUX_SECRET_READY=USER_REPORTED_PASS`; `REMOTE_LOGIN=NOLOGIN`; `DEDICATED_HYPERDRIVE=NOT_CREATED`; `RUNTIME_REVOKE=NOT_RUN`; `LIVE_WINDOW=HOLD`; `COMERCIAL=NO-GO`.


## RECIBO DO TERMUX — validação do operador privado

O proprietário executou `--self-test` e `--local-check` na sessão privada preparada anteriormente, reportando:

- `OFFLINE_OPERATOR_SELF_TEST=PASS; NETWORK=NONE; SECRET_CREATED=NO`.
- `LOCAL_DB_SECRET_CHECK=PASS; PRIVATE_FILE=0600; PRIVATE_DIRS=0700`.
- `NETWORK=NONE; PASSWORD_PRINTED=NO; DB_CHANGED=NO`.

Por segurança, o identificador da sessão e a senha não foram transcritos para o PR. **Os comandos não validam uma conexão PostgreSQL e não ativam LOGIN.**

Preflight independente atual: Supabase LAB `gomexvhvecvvfbdzhjct` `ACTIVE_HEALTHY`, papel `neroxa_i04_lab_watchdog_revoke` `NOLOGIN`, 0 grants ativos e 6 históricos revogados. Cloudflare: Worker original `33c3539b-b50a-48b5-b869-9a4aa6811fed` a 100%, host/previews fechados; watchdog original `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` a 100%, Cron `* * * * *`, `ARMED=false`, `GUARD_ENABLED=false`.

**Próxima operação permitida ao proprietário:** obter o certificado CA e parâmetros de conexão **oficiais da LAB** no Dashboard Supabase; executar `--preflight` com `PGSSLMODE=verify-full` e `psql` em modo leitura. Direto: `db.gomexvhvecvvfbdzhjct.supabase.co:5432` (requer rota IPv6 no plano sem IPv4 adicional). Se conexão direta não funcionar, usar apenas o **Session Pooler indicado no painel LAB**, com porta `5432` e usuário `postgres.gomexvhvecvvfbdzhjct`. Nunca inventar hostname do pooler nem reutilizar certificado não verificado de outro projeto.

**Permanecem bloqueados:** `--activate`, LOGIN, senha remota, novo Hyperdrive, deploy, arming, grants e testes HTTP reais. `COMERCIAL=NO-GO`.

## RECIBO DE FALHA DO PREFLIGHT E DIAGNÓSTICO SEGURO

Em 23/11/2026, o proprietário informou que o preflight local pediu senha administrativa (`Password:`) e terminou com `DB_ROLE_OPERATOR=HOLD; ERROR_TYPE=RuntimeError`. **Isso NÃO comprova autenticação bem-sucedida, nem identifica qual gate falhou.** Auditoria do código original `neroxa_watchdog_db_psql_20261123.py`: o mesmo tipo `RuntimeError` é usado tanto quando psql retorna exit code não zero (conexão, autenticação, TLS ou erro SQL), quanto quando a consulta read-only retorna `LAB_ROLE_PREFLIGHT_HOLD`. O operador omite stderr deliberadamente para não revelar credenciais.

A leitura Supabase posterior confirmou `rolcanlogin=false` e `rolbypassrls=false` no papel restrito, sem ativação. O preflight original usa apenas SELECT; nenhum `ALTER ROLE` foi solicitado.

Foi criado e testado fora do Git (arquivo entregue diretamente na conversa) `neroxa_watchdog_db_diagnose_20261123.py`, SHA-256 **do código** `84868b57738a5dac774757f0ede994680a4554cf97b273154798db22976e5934`. Reusa whitelist de host e checagem de CA do operador anterior, executa `BEGIN READ ONLY; SELECT CASE ...; ROLLBACK;` por psql, com `PGSSLMODE=verify-full`. Nunca abre `db-role.secret`, não imprime stdout/stderr brutos e converte erros em categorias de lista fechada (DNS, rota, timeout, autenticação, certificado/hostname, usuário/tenant pooler, permissões, SQL), ou `UNCLASSIFIED_PSQL_FAILURE` quando indeterminado. `--self-test` local: `OFFLINE_DB_DIAG_SELF_TEST=PASS`; compilação Python PASS.

**Próximo passo:** usuário executar somente `--self-test` e `--diagnose` com o MESMO hostname, CA, admin-user e porta da tentativa anterior, enviar só o código `DB_DIAG`. Não coletar senhas nem transcrição completa do erro de psql. **`--activate` proibido** até confirmar preflight e capacidade de rollback; Hyperdrive exclusivo, watchdog armado, rotas e comercial permanecem bloqueados.
