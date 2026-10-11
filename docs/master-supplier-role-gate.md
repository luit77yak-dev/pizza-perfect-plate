# Gate de permissões Master × Supplier — 2026-10-11

**Estado:** proposta de contrato, não autorização de implantação. PR #36 permanece draft. CI verde cobre a política provisória, não estas regras definitivas.

## Fonte de autoridade

- Usar o contrato versionado de papéis do Master (OWNER, ADMIN, MANAGER, OPERATOR) e papéis de plataforma (SUPER_ADMIN, ADMIN, SUPPORT, FINANCE), nunca user_metadata/JWT autoatribuído.
- Exigir organização ativa, membership ativa, grant explícito na instância, instância ACTIVE, assinatura/plano/feature habilitados conforme operação. Membership não concede automaticamente acesso a todas as instâncias.
- Plataforma não equivale a autorização global indistinta: funções de suporte/financeiro não devem receber escrita de catálogo; operações privilegiadas precisam de auditoria e AAL2 onde previsto.
- O banco de testes possui membership simplificada sem coluna role. **Não inventar coluna nem inferir OWNER de membership ativa**; reconciliar com o schema autoritativo do Master antes de gerar migration de roles.

## Matriz alvo para revisão

| Perfil | Catálogo | Pedidos | Configurações/entrega |
| --- | --- | --- | --- |
| OWNER scoped | CRUD com entitlement | operação autorizada | gerenciar conforme entitlement |
| ADMIN org scoped | CRUD com entitlement | operação autorizada | gerenciar conforme entitlement |
| MANAGER scoped | CRUD com entitlement | operação autorizada | edição apenas se contrato autorizar |
| OPERATOR scoped | leitura | operação autorizada | leitura mínima |
| SUPER_ADMIN/ADMIN plataforma | via fluxo privilegiado auditado | via fluxo privilegiado auditado | via fluxo privilegiado auditado |
| SUPPORT/FINANCE | sem escrita de catálogo | apenas permissões específicas | sem escrita de configuração |
| anon | catálogo publicado via RPC limitada | checkout público por capability | sem DML direto |

## Casos de regressão obrigatórios

1. OPERATOR tenta alterar preço, tema, taxa e região de entrega: bloqueado.
2. OWNER da organização A sem grant na instância B da mesma organização: bloqueado.
3. OWNER com grant da instância A tenta ler/escrever B de outra organização: bloqueado.
4. MANAGER autorizado altera produto somente na instância com entitlement de catálogo.
5. SUPPORT e FINANCE não ganham escrita global por membership de plataforma.
6. Admin Neroxa com papel adequado e AAL2 utiliza fluxo auditado, sem bypass genérico.
7. Suspender membership/grant/assinatura revoga acesso no servidor; JWT antigo não reautoriza.
8. Tentativas de troca de organization_id/instance_id e referências cruzadas em UPDATE/INSERT são negadas.
9. Catálogo público continua disponível apenas pelas RPCs previstas.

## Próximo gate

Capturar metadados atuais do **projeto Master correto**, incluindo roles, grants, políticas, funções, ACL e entitlement; comparar com contrato versionado e com a migração provisória `20261011180000_restrict_supplier_writes_until_roles_verified.sql`. Só então substituir a política provisória por implementação mínima com testes PostgreSQL/Auth isolados. **Não aplicar SQL remoto, não mesclar e não implantar nesta etapa.**
