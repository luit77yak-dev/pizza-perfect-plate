# Recuperação GROUP populada — 2026-10-13

**PASS no escopo isolado:** [workflow38446304492](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38446304492), Mastere8884e3047d50a14481ac588e34a04ad8900b81b. SQLs da versão integrada posterior são idênticos; diferenças posteriores são nos scripts de browser/expiração.

202 checks aprovados, preservando os193 anteriores.93 tabelas e97 foreign keys verificadas. Evidência: evidence/recovery/restore-report.json e report.json. PostgreSQL, pg_dump e pg_restore17.11; Node22.23.3.

## Estado anterior ao dump

Schema histórico completo candidato, Auth nativo e quatro usuários fictícios. Foi criado um **produto GROUP distinto dos produtos legados**, categoria da A1, preço30, tamanho Grande+5, borda Recheada+2, adicional obrigatório+3, quantidade2. Unidade40, subtotal80, taxa calculada pela área válida recuperada do banco. Cliente/endereço/telefone exclusivamente fictícios.

Pedido criado pela create_public_order, não INSERT manual de snapshot. selection_snapshot.version=2, contract=GROUP_ADDONS_V1, IDs específicos de produto/grupo/adicional. Intenção possui chave UUID, SHA autoritativo do payload integral e lease. Operador A1 com JWT real confirmou o pedido por PostgREST antes do backup. Nenhuma alteração financeira.

O domínio group-restore-a1.invalid é fixture sintética em neroxa_system_domains.system_instance_id, separado do domínio recovery-a1.invalid do ensaio anterior. Não há operação DNS real. Não reinterpretados UUIDs legados.

## Restauração efetiva

Custom archive criado/verificado dentro do contêiner e restaurado em banco separado template0. Preservados owners/ACLs, RLS e expressões, funções, triggers, constraints, índices, extensões e defaults, comparados por fingerprints de definições/propriedades. Digest de dados inclui private.neroxa_group_order_intents e histórico: a população nova é comparada, não somente estrutura ou quantidades.

Destino inicia GoTrue e PostgREST próprios apontando exclusivamente ao banco restaurado. Auth autentica novamente os usuários fictícios; JWTs do destino exercitam RLS. Os serviços originais não recebem restauração.

Checks GROUP adicionais comprovam:

- Hash e prazo da intenção iguais antes/depois.
- Recuperação service-only com prova integral retorna pedido, snapshot GROUP e total esperado.
- Retry da mesma chave retorna o mesmo ID e não aumenta contagem.
- Prova de outra instância é rejeitada403.
- Payload alterado com mesma chave é rejeitado400.
- Operador A1 lê detalhe, quantidade2 e line_total80.
- Operador A2 recebe null no detalhe A1.

Os testes anteriores cobrem isolamento interorganização, freeze de writes, recuperação de dados e roll-forward. Todos foram preservados e executados. Imagens e versões de Auth/REST constam na evidência. Cleanup do workflow aprovado.

## Limites

Origem/destino são bancos distintos **no mesmo cluster PostgreSQL descartável**. Roles globais são compartilhadas e não restauradas pelo pg_dump. Isto não prova DR entre clusters independentes, infraestrutura diferente, PITR ou backup restaurável de um sandbox remoto. Auth e todos os registros são fictícios.

Nenhum dump completo, senha, chave ou token foi publicado. Apenas fingerprints, resultados e metadata sanitizada. Esta prova não autoriza instalação remota ou produção.
