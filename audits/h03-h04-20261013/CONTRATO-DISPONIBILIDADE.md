# Contrato de disponibilidade — INSTANCE_AVAILABILITY_V1

Data: 2026-10-13. Candidata, somente homologação isolada. A proposta foi registrada antes das alterações SQL; este documento consolida a implementação.

## Origem e proveniência

O catálogo candidato do Master anterior não possuía horários comerciais por instância. O loader Delivery devolvia `hours` e `specialHours` vazios. `getStoreStatus` fechava na ausência de horários e, no legado, utilizava o relógio local do navegador. As referências `store_hours`/`special_hours` pertencem ao contrato legado distinto; não comprovam tabelas equivalentes no Master. O timezone de `platform_settings` não é configuração comercial de uma loja.

São **extensões propostas**, não objetos históricos recuperados: `neroxa_storefront_availability`, `neroxa_storefront_weekly_hours`, `neroxa_storefront_special_days` e `neroxa_storefront_special_hours`. Definições em `audits/sql/store-availability.candidate.sql` do Master. Todas vinculadas à instância por FK, RLS e trigger que impede transferência de `instance_id`. Não copiar configuração de uma organização para suas lojas.

## Regra de abertura

1. Registro explícito por instância, `enabled=true`, timezone válido do catálogo PostgreSQL e uma janela aplicável são necessários.
2. Configuração ausente, desabilitada, timezone inválido ou nenhuma janela: fechada. `enabled` nasce false; não existe timezone default.
3. Data especial corrente substitui integralmente a semana e o prolongamento da noite anterior. `closed=true` fecha; `closed=false` sem janelas também fecha.
4. Janelas usam hora civil local, precisão de minuto e intervalos semiabertos [início,fim). Intervalo com início maior que fim atravessa meia-noite. `00:00–24:00` é dia completo explícito. Janelas sobrepostas representam união de disponibilidade; não há promessa de constraint de exclusão.
5. Sem exceção corrente, a janela semanal corrente ou o prolongamento de janela da data anterior pode abrir. Exceção anterior substitui a semana anterior.
6. PostgreSQL converte `clock_timestamp()` com `AT TIME ZONE` da própria instância. Payload, timezone e relógio do comprador não autorizam pedidos. DST segue as regras IANA/PostgreSQL; teste documentado cobre America/Sao_Paulo, não certifica todas as transições DST.

Regras comerciais de bloqueios existentes (instância/domínio/autorização) continuam necessárias. Disponibilidade não concede entitlements nem acesso administrativo.

## Cliente e servidor

Catálogo publica `availability`: contract, instance_id, configured, open, timezone, checked_at e regras públicas de horário, sem owners/memberships. Delivery valida versão, identidade, timestamp e timezone e usa o snapshot do servidor. Consulta atualiza periodicamente; eventual atraso visual não autoriza compra.

`private.neroxa_assert_store_open` protege criação e append. SHARE locks nas quatro tabelas mantêm estabilidade contra edição simultânea durante a transação. Isso é conservador e precisa de avaliação de contenção para escala. PT423 vira HTTP423; pedido novo não é criado. Replay já confirmado é devolvido antes da verificação de abertura, pois não é nova venda. Tracking e histórico permanecem disponíveis com autorização própria.

## Administração e instalação

OWNER/ADMIN/MANAGER exigem concessão explícita da instância pelo helper existente. Administradores da plataforma utilizam o helper existente com MFA AAL2. Não introduzido papel novo. Anônimo/operador não editam disponibilidade. Helpers privados e triggers não recebem EXECUTE público.

Ordem: catálogo completo e candidatos anteriores → GROUP pricing → disponibilidade → recuperação. Após capacidade privada e GROUP append, aplicar `store-availability-capability.candidate.sql`. SQLs fora das migrations automáticas, com verificação das definições esperadas antes de substituir RPCs. Nenhuma configuração real é aberta automaticamente. Fixtures A1/A2/B1 são configuradas explicitamente apenas no runner descartável.

Os SQLs não constituem instalação aprovada no sandbox ou produção. Revisão comercial da agenda de cada loja e preenchimento autorizado são necessários antes de cutover.
