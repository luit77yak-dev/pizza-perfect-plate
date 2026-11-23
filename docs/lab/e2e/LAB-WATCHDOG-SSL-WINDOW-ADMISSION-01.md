# NEROXA V1 — LAB-WATCHDOG-SSL-WINDOW-ADMISSION-01

**Data:** 23/11/2026. **Projeto autorizado EXCLUSIVO:** Supabase LAB `gomexvhvecvvfbdzhjct` (`neroxa-f01-f02-sec18-lab`). **Projeto comercial `iefaoaqzltvpfabyeelj`: NO-GO / sem operações.**

## Consentimento e limite

Proprietário autorizou em conversa **preparar uma janela controlada para habilitar SSL enforcement exclusivamente na LAB**, reconhecendo que PostgreSQL pode reiniciar. Esta aprovação cobre a preparação e procedimento da alteração de SSL **na LAB**; **não** autoriza ativar o JIT, autorizar acesso temporário como `postgres`, cadastrar senha, alterar grants, criar Hyperdrive, armar/deploy watchdog, abrir host, mexer no comercial ou fazer resets gerais.

## Preflight independente, somente leitura

- LAB Supabase `ACTIVE_HEALTHY` PostgreSQL 17.11.0.019. `neroxa_i04_lab_watchdog_revoke` continua `NOLOGIN, NOCREATEROLE, NOBYPASSRLS`; `neroxa_lab_e2e_runtime` tem LOGIN, sem elevação.
- Estado do JIT entregue pelo proprietário em Termux: `LAB_JIT_STATUS=HOLD; REASON=SSL_ENFORCEMENT_REQUIRED; WRITES=NONE`. Não significa token inválido. Ainda não verificamos `GET /ssl-enforcement` diretamente com PAT, pois ele nunca saiu do Termux.
- Uma amostra `pg_stat_activity JOIN pg_stat_ssl` mostrou `authenticator`, `pgbouncer`, `postgres`, e uma conexão `supabase_admin` com SSL=true, além de `supabase_admin` aplicação `postgres_exporter` com SSL=false via TCP IPv6 privado/local. **Não comprovado que o enforcement afete ou preserve o exporter**; inspecionar logs/health na janela. Monitor pode ser gerenciado pelo Supabase, sem controle pelo usuário.
- Cloudflare GET de `neroxa-v1-i04-lab`: Hyperdrive aponta à LAB com usuário `neroxa_lab_e2e_runtime`, `mtls.sslmode=verify-full`, porta DB 5432, cache desativado. Worker `neroxa-v1-i04-api-lab` original `33c3539b-b50a-48b5-b869-9a4aa6811fed` a 100%, subdomain e previews desligados. Watchdog original `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` a 100%, `I04_WATCHDOG_ARMED=false`, `I04_GUARD_ENABLED=false`. Nenhuma mudança nesta auditoria.
- Documentação oficial Supabase publicada/atualizada em 16/11/2026: https://supabase.com/docs/guides/platform/ssl-enforcement. A alteração de enforcement **reinicia o banco**, potencialmente interrompe conexões; aplica-se também a ambos lados da conexão no pooler compartilhado. HTTPS API do Supabase já usa TLS. CLI e Management API endpoint experimental `PUT /v1/projects/{ref}/ssl-enforcement` existem; **o conector Supabase disponível neste chat não oferece a ação de SSL enforcement**. Não simular efeito com SQL, nem tentar escrever utilizando token não compartilhado.
- Revisão de documentação oficial confirmou `GET /v1/projects/{ref}/ssl-enforcement` e `PUT /v1/projects/{ref}/ssl-enforcement`; os métodos exigem permissões granulares `database_ssl_config_read` e `database_ssl_config_write`, conforme https://supabase.com/docs/reference/api/v1-get-ssl-enforcement-config e https://supabase.com/docs/reference/api/v1-update-ssl-enforcement-config . Alteração por painel é preferida, sem colar PAT em serviços.

## Procedimento da janela

1. No painel da **LAB exata** `https://supabase.com/dashboard/project/gomexvhvecvvfbdzhjct/database/settings`, registrar estado inicial de Database > SSL Configuration > Enforce SSL on incoming connections; confirmar `Off`. Se já estiver `On`, não alternar; investigar discrepância de status JIT.
2. Preservar confirmação HEALTHY do DB, original Cloudflare e modo TLS do Hyperdrive. Aplicação Food e watchdog permanecem fechados/desarmados. Observar que o `postgres_exporter` ainda estava sem SSL no snapshot.
3. Escolher janela com indisponibilidade aceitável e sem transações ativas de laboratório; se houver atividade sensível imprevista, adiar.
4. **Ação exclusiva do proprietário no painel Supabase:** ligar apenas `Enforce SSL on incoming connections` e confirmar. Não habilitar JIT no mesmo passo. Esperar o reinício que a plataforma pode realizar.
5. Validar `ACTIVE_HEALTHY` e retornar ao painel verificando SSL `On`. O assistente pode refazer somente leituras Supabase/Cloudflare, com retorno do usuário. Comparar `pg_stat_activity/pg_stat_ssl`, especialmente exporter, e observar logs de rejeição `SSL off`. A ausência de uma conexão num único snapshot não é prova suficiente de falha. Checar Hyperdrive sem habilitar Worker/public host e revisar ajustes se aparecer falha.
6. Se houver regressão real no serviço, **interromper novas mudanças** e, com avaliação de impacto, considerar desabilitar o enforcement no mesmo painel. **Desfazer também reinicia o banco**; não reverter cegamente diante de um snapshot inconclusivo.
7. Após saúde+SSL confirmados, usuário executar `neroxa_lab_jit_status_v2_20261123.py --check` no Termux e enviar apenas status. JIT pode mudar para `disabled` ou `enabled`; qualquer estado distinto exige análise independente. Não configurar regra JIT/LOGIN automaticamente.

## Limitações

Não temos navegador controlável pelo assistente no chat nem ação conector que aplique SSL enforcement. O procedimento foi **preparado**, mas **não executado**; nenhum PUT/POST API, migração ou SQL de escrita foi realizado. O acesso via PAT fica exclusivamente no Termux. Sem autorização para outros projetos ou recursos. Monitoramento interno `postgres_exporter` é um risco conhecido sem confirmação de exceção.

**Status:** `SSL_WINDOW_AUTHORIZED=YES`; `SSL_PREFLIGHT=PASS_WITH_MONITORING_CAVEAT`; `SSL_ENFORCEMENT=NOT_APPLIED_BY_ASSISTANT`; `JIT=HOLD_SSL_ENFORCEMENT_REQUIRED`; `ROLE=NOLOGIN`; `NEW_HYPERDRIVE=NONE`; `WATCHDOG_ARMED=false`; `COMMERCIAL=NO-GO`.
