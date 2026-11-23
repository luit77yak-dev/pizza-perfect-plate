# NEROXA V1 — LAB-SECURITY-WINDOW-PREFLIGHT-01

**Data:** 2026-11-23 · **Escopo:** PR #50 Draft, LAB isolada · **Estado:** `WINDOW_ADMISSION=HOLD`, `COMERCIAL=NO-GO`.

## Objetivo

Preparar a janela protegida de até 15 minutos sem expor o Worker, conceder grants, copiar segredos, alterar bancos ou antecipar o prazo de uma versão inativa. Verificar o bloqueio mais importante antes de eventual admissão: **fechamento automático independente do operador**.

## Evidência remota atual (somente leitura)

Conferência Cloudflare por API GET na conta LAB:

| Gate | Observação | Interpretação |
| --- | --- | --- |
| Worker `neroxa-v1-i04-api-lab` | Original `33c3539b-b50a-48b5-b869-9a4aa6811fed` continua 100% no deployment `1f2f8c3e-1666-468e-a7fa-d7a0592ca054` | Versão original preservada |
| Worker principal | workers.dev=false, previews=false; schedules=`[]` | Host fechado; sem Cron Trigger do principal |
| Staging fechado | `de02bde8-0254-4b8a-af20-3dc238169d61`, prazo `2000-01-01T00:00:00Z` | Inoperante e **não apto** à janela live |
| Watchdog `neroxa-i04-watchdog-lab-09` | Deployment `29845452-ebaa-4f05-908b-5386bfe2a37d`, versão `962e36d9-1b3f-425f-bb0e-703b7cba1e8b` a 100% | Monitor existente, mas isso não demonstra execução automática |
| Watchdog — programação | schedules=`[]`; possui `scheduled` handler no código | Nenhum cron configurado; handler sozinho não executa periodicamente |
| Watchdog — flags | `I04_GUARD_ENABLED=false`; `I04_WATCHDOG_ARMED=false`; `I04_WATCHDOG_DEADLINE_ISO=2099-01-01T00:00:00Z` | Watchdog **desarmado**; não protege uma janela de 15 min no estado atual |
| Cloudflare Access | App self-hosted com política allow de operador e non_identity service token (sem política bypass listada) | A configuração existe, mas **prova runtime de desafio anônimo ainda pendente** |
| Supabase LAB | `gomexvhvecvvfbdzhjct`, SELECT em transação `READ ONLY`: grants A ativos 0, revogados 5; B ativos 0, revogados 1 | O novo Bearer permanece apenas no Termux; nenhum grant foi admitido |

Nenhum valor de token, SHA-256 da credencial, session ID, JWT, cookie ou segredo é registrado aqui.

## Mudança funcional verificável — fail-closed admission gate

Adicionado `lab-source/security-http/window-admission-gate.cjs` (função pura, **sem chamadas de rede**) e testes `window-admission-gate.test.cjs`. O verificador exige:

- Original 100% e host/previews fechados **antes** da janela; staging anterior inoperante e íntegro.
- Isolamento LAB A/B e Hyperdrive com `verify-full`.
- Identidade e políticas Access coerentes **mais provas reais em runtime** (não inferidas de configuração).
- Nova candidata, distinta do staging fechado, validada e com deadline futuro de no máximo 15 minutos.
- Grant A temporário e correspondente ao prazo, B sem grants, grant revogado disponível para negativo.
- Watchdog *armado*, com trigger configurado e **provas separadas** de restauração do original, fechamento do host e revogação automática dos grants.
- Ausência de credenciais e hashes no recibo enviado ao verificador.

O retorno é somente `HOLD` ou `REVIEW_READY_NOT_AUTHORIZED`, com `authority=NONE`. **Nem um recibo sintético perfeito fornece autorização de deploy**.

A suíte offline foi incorporada ao CI do PR junto dos testes anteriores. [Run #45220540469](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/45220540469): job SUCCESS para escopo, hashes, Worker fail-closed, suíte HTTP mock e gate de admissão offline. Nenhuma prova HTTP remota foi executada.

## Bloqueio e próxima execução segura

`LIVE_WINDOW=HOLD` por watchdog desarmado e sem scheduler, Access runtime ainda não demonstrado, nova candidata temporizada não criada e grant A ainda não ativado. **Não** programar janela somente com `LAB_LIFECYCLE_DEADLINE`, porque ele fecha o handler LAB, mas não prova fechamento da rota nem revogação dos grants.

**Próxima missão:** preparar e validar, sob autorização específica de alteração de Cloudflare LAB, o watchdog independente (seu trigger, suas permissões mínimas e a recuperação do original); exigir rollback testado com host fechado antes de qualquer abertura. Apenas depois admitir versão com prazo de até 15 minutos, grant A temporário e sessão Access, mediante aprovação delimitada adicional para deploy, alteração de URL e seis requisições HTTP com consumo de nonces.

`PR50=DRAFT` · `STAGING_INACTIVE=PASS` · `WATCHDOG_ARMED=NO` · `CRON_TRIGGER=NONE` · `LIVE_HTTP_NEGATIVES=NOT_RUN` · `PUBLIC_CHECKOUT=OFF` · `COMMERCIAL=NO-GO`.
