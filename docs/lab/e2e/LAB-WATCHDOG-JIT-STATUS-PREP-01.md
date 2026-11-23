# NEROXA V1 — LAB-WATCHDOG-JIT-STATUS-PREP-01

**Data:** 23/11/2026 · **Projeto alvo exclusivo:** LAB `gomexvhvecvvfbdzhjct` · **Comercial:** NO-GO · **PR #50:** Draft.

## Recibo do PAT e contexto SQL

O proprietário executou `neroxa_lab_pat_sql_context_20261123.py --self-test`, obtendo `LAB_SQL_CONTEXT_SELF_TEST=PASS; NETWORK=NONE; SECRET_READ=NO; DB_CHANGED=NO`. Em `--check` com o token exclusivamente no prompt oculto do Termux obteve:

```text
LAB_SQL_CONTEXT=PASS; PROJECT=LAB_ONLY; ROLE=NOLOGIN
ADMIN_CONTEXT=WRITE_CAPABLE; SQL_WRITES=NONE; ROLE_CHANGE=NOT_RUN
```

O resultado comprova que o PAT do proprietário foi aceito pela rota SQL administrativa e que o contexto era capaz de escrita, mas a instrução realmente executada foi somente SELECT. Nenhuma senha, PAT ou verificador SCRAM foi exposto; nenhuma ALTER ROLE foi executada. A verificação remota independente via conector Supabase LAB confirmou projeto `ACTIVE_HEALTHY`, o papel `postgres` com `rolcreaterole=true` e o papel `neroxa_i04_lab_watchdog_revoke` ainda `NOLOGIN` e sem privilégios administrativos.

## Mudança de estratégia: JIT PSQL privado antes de qualquer ativação

A API SQL aceita consultas, mas enviar `ALTER ROLE ... PASSWORD '<verificador SCRAM>'` via Management API pode tornar o verificador parte dos registros da consulta. A senha local tem alta entropia, mas a política de projeto exige não expor nem o verificador. Preferir **psql privado via Temporary access (JIT) do Supabase**: o PAT é introduzido somente no prompt do terminal; a conexão TLS deve ser `verify-full` com CA oficial da LAB. O JIT requer explicitamente: configuração de acesso temporário `enabled`, SSL enforcement, autorização *deste usuário* para assumir `postgres` com validade curta e restrição de IP; o token de administração para conceder JIT (se usado) precisa de **Database JIT Read-write e Organization Members Read**, permissões distintas de Database Read-write. A configuração do PAT de acesso à Management SQL **não prova** que JIT está ligado ou mapeado. Não habilitar JIT ou mapear `postgres` sem outra admissão explícita, pois esse papel tem privilégios amplos.

Referências oficiais de novembro/2026:
- https://supabase.com/docs/guides/platform/temporary-access
- https://supabase.com/docs/guides/platform/team-database-access
- https://supabase.com/docs/guides/platform/ssl-enforcement

## Gate preparado sem alterações

O arquivo para Termux **fora do repositório** `neroxa_lab_jit_status_20261123.py` tem SHA-256 **do código** `b36693ed37a631b9ae8de9f75ee9d4eff167c96f0ccf68be387bc5ab800ca081`. Faz `GET https://api.supabase.com/v1/projects/gomexvhvecvvfbdzhjct/jit-access` via HTTPS autenticado, recusa proxy/redirect, lê PAT por `getpass` e imprime apenas status `ENABLED`, `DISABLED` ou `HOLD`. Não acessa arquivo da senha do watchdog e **não** tem PUT, POST nem SQL. `--self-test` e `py_compile` PASS offline. O resultado no Termux ainda está pendente.

**Limitação:** o endpoint GET depende de Project Settings Read; um 403 não significa necessariamente que o JIT está desativado e não justifica ampliar permissões. Um status ENABLED não prova que há regra autorizando este usuário a assumir `postgres`. Não migrar automaticamente de JIT para API SQL de escrita com verificador; manter NOLOGIN até caminho privado e rollback seguros.

`TERMUX_SQL_CONTEXT=PASS`; `JIT_STATUS=AWAIT_TERMUX`; `ROLE=NOLOGIN`; `HYPERDRIVE_WATCHDOG=NONE`; `WATCHDOG_ARMED=false`; `HOST_CLOSED=LAST_VERIFIED`; `COMERCIAL=NO-GO`.
