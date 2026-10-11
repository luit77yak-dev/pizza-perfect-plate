# Confronto somente leitura — Master real × Delivery PR36 (2026-10-11)

Projetos confirmados: Master `iefaoaqzltvpfabyeelj`; sandbox Delivery `uvyinrojuhizjqbuzdcy`. Consulta limitada a metadados, sem DML/DDL remoto.

## Evidência atual do Master
- `neroxa_organization_members.role`: enum `neroxa_organization_role`, valores OWNER, ADMIN, MANAGER, OPERATOR.
- `neroxa_platform_members.role`: enum `neroxa_platform_role`, valores SUPER_ADMIN, ADMIN, SUPPORT, FINANCE.
- Funções existentes: `neroxa_has_org_role(uuid,neroxa_organization_role[])`, `neroxa_has_platform_role(neroxa_platform_role[])`.
- `neroxa_system_instances`: organization_id, plan_id, subscription_id, status; não foi identificada uma tabela de grants por instância nesta consulta.
- Produtos: policies de plataforma e organização coexistem; políticas RLS permissivas são combinadas por OR. Adicionar policy restritiva não elimina autorização mais ampla preexistente.
- Policies `organization manager storefront settings write` e `organization manager delivery zones write` permitem OWNER/ADMIN/MANAGER com base apenas no organization_id. O contrato proposto de grants por instância/entitlement ainda não é comprovado nessas policies.
- A policy `neroxa storefront products insert/update` contém condição `c.instance_id = c.instance_id`, que é tautológica e **não compara** `c.instance_id` com `neroxa_storefront_products.instance_id`. Necessário corrigir em migração específica revisada e adicionar regressão cross-instance.

## Impacto na PR36
- O sandbox de Delivery tem membership simplificada sem coluna role, diferente do Master. O CI verde da fixture não comprova compatibilidade do Master real.
- Não instalar `20261011180000_restrict_supplier_writes_until_roles_verified.sql` no Master. A migração substitui nomes de policies da fixture, mas não remove as policies permissivas reais; também dependeria de helpers/tabelas diferentes.
- Evitar criar segunda autoridade de roles. Usar funções e enums autoritativos do Master e autorização por instância/grant/entitlement quando o contrato estiver confirmado.
- Preparar testes de política efetiva para OPERATOR, MANAGER, OWNER, ADMIN plataforma, SUPPORT/FINANCE, cross-org, cross-instance, category_id de outra instância, e mudança de tenant em UPDATE.
- Não inferir autorização por instância de membership de organização. Não autorizar implantação, merge ou DDL remoto antes de revisar grants/ACL/triggers/funções e reproduzir Auth/PostgREST.

**Status:** divergência confirmada; correção e testes ainda pendentes. Esta nota é um gate documental, não migration executável.
