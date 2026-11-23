# NEROXA V1 — LAB-WATCHDOG-PAT-WRITE-CONTEXT-01

**Data:** 23/11/2026 · **LAB alvo:** `gomexvhvecvvfbdzhjct` · **PR #50:** Draft · **Comercial:** NO-GO.

## Recibo da leitura pelo Scoped PAT

O proprietário executou no Termux `neroxa_lab_scoped_pat_check_v2_20261123.py --self-test` com `LAB_PAT_SELF_TEST=PASS; NETWORK=NONE; SECRET_READ=NO; DB_CHANGED=NO`. A seguir o `--check` com Scoped PAT privado retornou:

- `LAB_PAT_CHECK=PASS; PROJECT=LAB_ONLY; ROLE=NOLOGIN`
- `DB_ACCESS=READ_ONLY; WRITE_PERMISSION=NOT_VERIFIED; WRITES=NONE`

O token foi introduzido diretamente no terminal, **não foi transferido** para ChatGPT, arquivos do PR, Cloudflare nem logs desta missão. Isso confirma que o endpoint de **leitura** do projeto LAB aceitou o token e que o papel específico do watchdog segue NOLOGIN. **A leitura não comprova a permissão de escrita.** O token foi criado pelo proprietário com `Database Read-write`, mas essa configuração é auto-relatada, ainda não validada tecnicamente.

## Verificação independente via conector

- Supabase LAB get_project: `ACTIVE_HEALTHY`, Postgres 17.11, host `db.gomexvhvecvvfbdzhjct.supabase.co`.
- SQL `BEGIN READ ONLY; ... ROLLBACK;`: `postgres` conectado com `rolcreaterole=true` e `rolbypassrls=true`, role restrito `neroxa_i04_lab_watchdog_revoke` com `rolcanlogin=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolbypassrls=false`. Consulta read-only anterior confirmou `current_database=postgres`, `current_user=postgres`, `session_user=postgres`.
- Não foi feito `ALTER ROLE`, reset de senha `postgres`, novo Hyperdrive, deploy, alteração de grants ou contato com banco comercial.

## Novo gate de contexto SQL sem escrita

Arquivo **fora do Git** para download na conversa: `neroxa_lab_pat_sql_context_20261123.py`; SHA-256 **do código** `61c886b3ed38f3a45061a1019105a7fe43d851def44c2f3427af2ca68b45599b`.

- `--self-test` passa offline, sem token ou conexão, verificando que SQL é **SELECT-only**.
- `--check` lê o Scoped PAT por `getpass` oculto; nunca imprime, salva ou passa em argv/env. Faz uma única requisição HTTPS à API oficial `POST /v1/projects/gomexvhvecvvfbdzhjct/database/query` com `{query: SELECT estático, read_only: false}`; SSL com CA do SO e hostname, sem proxy nem redirect.
- O SELECT verifica `current_database=postgres`, `current_user=session_user=postgres`, `transaction_read_only=off`, `postgres.rolcreaterole=true`, existência da instância LAB A exata e role dedicado ainda sem LOGIN e sem poderes administrativos.
- `LAB_SQL_CONTEXT=PASS; ADMIN_CONTEXT=WRITE_CAPABLE; SQL_WRITES=NONE` significa que o endpoint retornou contexto SQL de escrita para o PAT **sem ter efetuado escrita**, não garante que o comando futuro `ALTER ROLE` será aceito nem autoriza executá-lo.
- Falhas retornam somente `HOLD` e código de motivo fechado, nunca expõem a resposta SQL bruta ou segredo. O campo `read_only: false` sinaliza contexto que admite escrita **mas a consulta realmente enviada é SELECT**, não uma mutação.

**Autoteste local:** `python3 -m py_compile` PASS, `--self-test` `LAB_SQL_CONTEXT_SELF_TEST=PASS; NETWORK=NONE; SECRET_READ=NO; DB_CHANGED=NO`. A execução do `--check` com o PAT real **depende do proprietário no Termux**.

## Gates posteriores não autorizados

`LAB_SQL_CONTEXT=AWAITING_TERMUX`; `DB_ROLE=NOLOGIN`; `POSTGRES_PASSWORD_RESET=NO`; `HYPERDRIVE_WATCHDOG=NONE`; `WATCHDOG=DISARMED`; `HOST_CLOSED=LAST_VERIFIED`; `COMERCIAL=NO-GO`.

O cadastro da senha privada e a ativação do LOGIN requerem uma janela específica de administração. O endpoint da Management API pode processar/logar textos de consulta; **não enviar senha nem verificador SCRAM como texto de query até existir canal com auditoria de segredo aprovada**. O próximo gate após resultado PASS será desenhar provisionamento privado que evite vazamento de senha/hashes e rever plano de desativação NOLOGIN e Hyperdrive dedicado antes de alterar estado.
