# NEROXA V1 — LAB-WATCHDOG-PAT-READONLY-GATE-01

**Data:** 23/11/2026 · **Projeto alvo exclusivo:** Supabase LAB `gomexvhvecvvfbdzhjct` · **PR #50:** Draft · **Comercial:** NO-GO.

## Situação e decisão

O usuário confirmou que já possui um Scoped PAT `sbp_fc_...`, portanto não foi recomendado redefinir a senha `postgres` por perda da senha administrativa. **Importante:** uma credencial `sbp_fc` anteriormente verificada no histórico atendia a um JIT de **leitura no projeto comercial**, não uma permissão demonstrada de escrita na LAB. Não assumir que esse mesmo token serve à LAB, não copiá-lo ao chat nem dar acesso cruzado.

A documentação Supabase atual admite `POST https://api.supabase.com/v1/projects/{ref}/database/query/read-only`, usando PAT com **Database (Read)**, sempre como `supabase_read_only_user`. O resultado da consulta de leitura **não prova** a permissão Database (Read-write) para futura ativação de LOGIN; conferir scope no painel antes de qualquer passo de escrita. Referências: https://supabase.com/docs/reference/api/v1-read-only-query e https://supabase.com/docs/guides/platform/personal-access-tokens.

## Ferramenta local (fora de Git)

Criado script para download no Termux, **não comitar**: `neroxa_lab_scoped_pat_check_20261123.py` — SHA-256 do **código** `f5b6a2425c9bde0672cd9b437e4bd1792da0f477e3d6777f8504aee98107a2d7`.

- `--self-test`: execução sem rede, token ou escrita, saída `LAB_PAT_SELF_TEST=PASS`.
- `--check`: recebe Scoped PAT via `getpass`, não imprime, não salva nem passa em argumentos ou variáveis de ambiente. Usa HTTPS com validação CA/hostname, sem redirecionamento nem proxy, URL fixa do projeto LAB e endpoint read-only; envia SELECT estático para validar `current_database=postgres` e papel `neroxa_i04_lab_watchdog_revoke` ainda `NOLOGIN`. Só responde com `LAB_PAT_CHECK=PASS` ou `HOLD; REASON=...` sem stderr/credenciais.
- Nenhuma senha PostgreSQL, token operacional LAB A ou segredo do watchdog é lido.
- `--activate`, `ALTER ROLE`, Hyperdrive e escrita **não** estão presentes nesse script.
- Testes locais de parser/HTTP classification e compilação Python: PASS; **não houve teste externo de token do usuário**, pois não foi copiado para o ChatGPT.

## Gates pendentes

`TERMUX_SCOPED_PAT_CHECK=AWAITING_USER`; `LAB_DATABASE_WRITE_TOKEN=NOT_VERIFIED`; `ROLE=NOLOGIN`; `HYPERDRIVE_DEDICADO=NONE`; `WATCHDOG_ARMED=NO`; `MAIN_HOST=CLOSED`; `COMMERCIAL=NO-GO`.

Após `LAB_PAT_CHECK=PASS`, verificar visualmente em Dashboard que o token é restrito à LAB e tem **Database (Read-write)**, não apenas `Database JIT (Read)`. Somente com autorização delimitada e plano de retorno a NOLOGIN preparar uma ferramenta separada para ativar o papel com o verificador SCRAM derivado da senha local; nunca redefinir a senha postgres sem necessidade.

## PAT-PREFIX-FIX — correção do gate local após HOLD

Em 23/11/2026, usuário executou `neroxa_lab_scoped_pat_check_20261123.py --self-test` com `LAB_PAT_SELF_TEST=PASS`, mas `--check` retornou `LAB_PAT_CHECK=HOLD; REASON=NOT_A_SCOPED_PAT; WRITES=NONE` **antes de chamar a API**.

**Causa identificada no código:** versão v1 restringia prefixo a `sbp_fc_`. Documentação oficial Supabase garante somente prefixo `sbp_fc` (por exemplo `sbp_fc...`), portanto sublinhado adicional obrigatório era hipótese inválida e podia rejeitar token legítimo. Referências: https://supabase.com/docs/guides/platform/personal-access-tokens; https://supabase.com/blog/scope-your-personal-access-tokens .

**Correção distribuída na conversa, NÃO em Git:** `neroxa_lab_scoped_pat_check_v2_20261123.py`, SHA-256 **do código** `2a50d46d721cb44c8da7ebb6e18a86a784607d8e7f772b94c7f674dd18733aff`. Nova regra `token.startswith('sbp_fc')`, `len>=24`, nenhum whitespace; teste offline cobre `sbp_fc...` e `sbp_fc_...` e rejeita legado `sbp_...` e placeholders curtos. `python -m py_compile` e `--self-test` PASS. **O teste v2 ainda não foi executado no Termux**, portanto escopo real, validade, projeto e acesso remoto permanecem indeterminados.

**Próximo gate:** o usuário salvar a versão v2 em Downloads e executar `--self-test` + `--check` com o token completo apenas no prompt oculto (não nome do token, não máscara). Compartilhar só `LAB_PAT_CHECK` e `REASON`. Em caso de `403` verificar escopo LAB e `Database (Read)` no painel sem ampliar permissões ao comercial. Nenhuma escrita, reset, alteração de LOGIN ou Hyperdrive neste passo.
