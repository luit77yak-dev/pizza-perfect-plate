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

## JIT-STATUS-V2 — corrigido estado unavailable

Em 23/11/2026, o proprietário executou no Termux:
- `LAB_JIT_SELF_TEST=PASS; NETWORK=NONE; TOKEN_READ=NO; DB_CHANGED=NO`
- `LAB_JIT_STATUS=HOLD; REASON=UNKNOWN_RESPONSE; WRITES=NONE`

Inspeção da fonte exata do script v1 `neroxa_lab_jit_status_20261123.py` provou que o endpoint estava **correto** (`GET /v1/projects/{ref}/jit-access`, ver API Reference), mas o parser tratava apenas `state=enabled` e `state=disabled`, convertendo a alternativa documentada `state=unavailable` em UNKNOWN_RESPONSE. Isso não significa token inválido, não prova JIT desligado e não permite inferir qual bloqueio existe sem o retorno do v2.

**Fonte oficial:** https://supabase.com/docs/reference/api/v1-get-jit-access-config . Resposta 200 documentada por `oneOf` de `enabled/disabled` com `appliedSuccessfully`, ou `state=unavailable` e enum `unavailableReason`: `platform_unsupported`, `postgres_upgrade_required`, `ssl_enforcement_required`, `temporarily_unavailable`. Se `appliedSuccessfully=false` o verificador deve classificar HOLD, não aprovação.

Criado **fora do Git**, disponível como download somente na conversa, o arquivo `neroxa_lab_jit_status_v2_20261123.py`. SHA-256 **do código**, sem relação com credenciais: `a8e39d9c7e71c3e3222d5f4fa13f400c77caa0e15e51a0c70a4efb9ae0cca06e`. V2 conserva endpoint correto, HTTPS com CA do SO, token por `getpass`, proibição de proxy e redirecionamento, `GET` único, sem segredo do watchdog. Faz whitelist de causas de indisponibilidade e só imprime códigos. `python3 -m py_compile` e `--self-test` PASS offline, cobrindo `unavailable` e `appliedSuccessfully` falso. **Não foi executado com token real no Termux** nesta etapa.

Readback Supabase LAB `gomexvhvecvvfbdzhjct` `ACTIVE_HEALTHY`: role `neroxa_i04_lab_watchdog_revoke` continua `rolcanlogin=false`, `rolcreaterole=false`, `rolbypassrls=false`.

**Próximo gate:** proprietário executar versão v2 `--self-test` e `--check` e enviar apenas linhas de status. Se `REASON=SSL_ENFORCEMENT_REQUIRED`, **não** habilitar SSL à força: a alteração de SSL enforcement no Supabase pode reiniciar o banco e afetar conexões; exigir avaliação de impacto/janela antes. `--activate`, `ALTER ROLE`, migrações, regra JIT, novo Hyperdrive, Watchdog armar, acesso público e comercial permanecem bloqueados.

`JIT_V1=HOLD_UNKNOWN_RESPONSE`; `JIT_V2_SELF_TEST=PASS`; `JIT_V2_REMOTE=AWAIT_TERMUX`; `DB_ROLE=NOLOGIN`; `COMMERCIAL=NO-GO`.
