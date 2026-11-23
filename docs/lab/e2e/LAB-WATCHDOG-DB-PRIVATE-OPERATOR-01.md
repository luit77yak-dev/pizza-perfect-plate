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
