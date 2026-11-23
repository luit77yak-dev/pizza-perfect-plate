# NEROXA — LAB-WATCHDOG-RECOVERY-01

**Data:** 23/11/2026 · **Escopo:** LAB I04, recuperação preventiva, PR #50 Draft · **Comercial:** NO-GO.

## OBJETIVO

Configurar somente o disparo periódico seguro do watchdog existente, **mantendo-o desarmado**, e validar uma lógica alternativa de recuperação que não dê falso PASS sem revogação da LAB A nem bloqueie retentativas após falhas transitórias.

## FEITO — auditoria do código e pré-admissão remota

Cloudflare Worker `neroxa-i04-watchdog-lab-09`, versão implantada `962e36d9-1b3f-425f-bb0e-703b7cba1e8b`, foi lido em GET `include=modules`, sem expor os bindings cifrados:

1. O handler `scheduled()` retorna imediatamente quando `I04_WATCHDOG_ARMED !== 'true'`. Os bindings atualmente implantados são `I04_WATCHDOG_ARMED=false`, `I04_GUARD_ENABLED=false`, deadline `2099-01-01T00:00:00Z`. Nenhum caminho de API/SQL do watchdog é alcançado quando desarmado.
2. A função de recuperação atual desativa workers.dev/previews e tenta restaurar a versão original, com leitura posterior para conferir. **Ela não contém nenhuma revogação SQL dos grants** da LAB A.
3. O bloqueio `claimOneShot()` usa `INSERT ... ON CONFLICT DO NOTHING` em D1 e registra o primeiro claim antes do rollback. Após uma falha, chamadas subsequentes para a mesma operation key são bloqueadas, inclusive se o estado nunca foi recuperado. **Isso impede tratar o handler atual como rollback tolerante a falhas.**

Após preflight obrigatório (Worker principal original a 100%, workers.dev/previews desligados, cron anterior vazio, watchdog original implantado e ambos os flags desarmados), configurado via **PUT Cron Triggers** para o watchdog o único schedule `* * * * *` (a cada minuto).

**GET de leitura após a alteração:** schedule único confirmado `* * * * *`; watchdog continua versão antiga em 100%, `ARMED=false`, `GUARD_ENABLED=false`; Worker LAB principal continua versão `33c3539b-b50a-48b5-b869-9a4aa6811fed` a 100%, workers.dev=false, previews=false. Não houve execução manual do evento, alteração no Worker principal nem ativação da janela. Cloudflare informa que o Cron pode demorar **até 15 minutos** para se propagar; um GET de schedules não constitui prova de tick executado nem promessa de encerramento ao segundo.

Supabase LAB `gomexvhvecvvfbdzhjct` consultado em `BEGIN READ ONLY ... ROLLBACK`: LAB A 0 grants ativos, 5 revogados; LAB B 0 ativos, 1 revogado. Nenhuma escrita ou segredo lido.

## MUDANÇA FUNCIONAL VERIFICÁVEL NO PR #50

Adicionados `lab-source/watchdog-review/recovery-contract.cjs` e `recovery-contract.test.cjs`; GitHub Actions agora executa o novo teste no mesmo job sem rede.

O contrato em modo revisão/DI exige **três resultados com leitura de confirmação independente**: host fechado, token temporário da LAB A revogado e versão original a 100%. As três ações são tentadas independentemente; falha em uma não impede as outras. Retentativas ocorrem a cada novo tick caso não haja confirmação, sem usar o D1 one-shot como impedimento ao rollback. Antes do deadline ou com flags de autorização ausentes, o contrato não invoca efeitos. Se faltar adaptador SQL para revogação, retorna `HOLD_RETRY_NEXT_TICK` e **nunca `RECOVERY_VERIFIED`**.

**Prova offline:** [GitHub Actions #45222544922](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/45222544922) `completed/success`. O novo teste apresentou `11/11 PASS`, incluindo não execução quando desarmado, prazo incorreto, idempotência, falha parcial de Cloudflare, indisponibilidade de SQL, readback falso e retentativa após falha. Hashes originais, Worker review e harness HTTP anteriores também PASS.

## BLOQUEIO E LIMITES

- **Contrato de revisão ainda NÃO integrado ao Worker implantado**; não há nova versão do watchdog implantada ou armada.
- **Não existe mecanismo SQL remoto de revogação no código do watchdog atual.** Precisa de adaptador restrito à LAB A (preferencialmente credencial PostgreSQL com privilégio mínimo, endpoint privado ou função de revogação com escopo) e revisão da autorização. Não improvisar token `service_role` ou segredo no Git público.
- A recuperação atual usa D1 one-shot e não se recupera necessariamente após tentativa incompleta; novo contrato elimina esse bloqueio apenas no *modelo/teste*, não no runtime.
- O Cron recém configurado pode demorar a propagar; agendamentos periódicos isoladamente **não fornecem prazo rígido de recuperação**. Exigir deadline fail-closed no Worker e backup independente de encerramento de acesso.
- `LIVE_HTTP_NEGATIVES=NOT_RUN`, `ACCESS_ANONYMOUS_RUNTIME=NOT_VERIFIED`, `ROLLBACK_INTEGRATED=NOT_VERIFIED`, `GRANT_A_NEW=NOT_CREATED`. Não fazer deploy, abrir URLs, ativar grants ou tocar no banco comercial nesta missão.

## PRÓXIMA AÇÃO

Implementar/admitir o adaptador de revogação de **um único grant da LAB A**, com credencial privada restrita e teste de independência; integrar o contrato ao watchdog em uma versão **inativa**; exercitar a recuperação com host fechado e leitura de volta sem alterar o Worker principal. Só depois, mediante outra autorização delimitada e provas de Access/rollback, considerar a janela HTTP real de até 15 minutos.

`WATCHDOG_CRON_CONFIGURED=PASS`; `WATCHDOG_ARMED=NO`; `RECOVERY_CONTRACT_OFFLINE=11/11_PASS`; `RECOVERY_RUNTIME=NOT_VERIFIED`; `PR50=DRAFT`; `PUBLIC_CHECKOUT=OFF`; `COMERCIAL=NO-GO`.
