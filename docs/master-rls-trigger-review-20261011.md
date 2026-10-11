# Revisão RLS/triggers Master — 2026-10-11

Consulta de metadados **somente leitura** no projeto Master `iefaoaqzltvpfabyeelj`; não representa aprovação de implantação.

## Evidências
- CI `38150083781`: success no head `7438ba0a4d7c39e4b07137207e8a0cbd201860db` (antes deste documento).
- Nenhum trigger **não interno** nas tabelas `neroxa_storefront_products`, `neroxa_storefront_categories`, `neroxa_storefront_settings`, `neroxa_storefront_delivery_zones`. FKs e outros mecanismos internos continuam relevantes.
- As políticas das sete tabelas de catálogo, complementos, configurações e áreas de entrega retornaram `PERMISSIVE`. Para uma operação, permissões permissivas aplicáveis se combinam por OR; não basta adicionar outra policy permissiva restritiva.
- `neroxa_storefront_products`: coexistem policies de plataforma (SUPER_ADMIN/ADMIN) e de organização (OWNER/ADMIN/MANAGER). A policy de plataforma de INSERT/UPDATE contém `c.instance_id = c.instance_id` (tautologia), sem checar a instância do produto. A policy de organização não verifica categoria. O trigger candidato `20261011190000_product_category_instance_integrity.sql` pretende impedir a inconsistência independentemente dessas policies.
- `neroxa_storefront_categories`: plataforma e OWNER/ADMIN/MANAGER podem escrever; `neroxa_storefront_settings` e `neroxa_storefront_delivery_zones` usam autorização por organização, incluindo MANAGER. Não há concessão por instância explícita nas condições de settings/zones.
- Complementos (`addon_groups`, `addons`, `product_addon_groups`) têm políticas de gerenciamento por OWNER/ADMIN/MANAGER, com associação de instância nos links de produto/grupo.
- A fixture CI não reproduz todas essas policies; o teste `master_role_matrix.sql` verifica os helpers de roles em PostgreSQL isolado, **não** a efetiva permissão DML sob o conjunto real de policies.

## Gate de liberação pendente
1. Reproduzir as policies reais (nomes, comandos, USING/WITH CHECK, grants e FORCE RLS) em banco descartável, com os oito papéis e testes DML reais, não apenas chamadas de helper.
2. Verificar comportamento em múltiplas instâncias **da mesma organização**, múltiplas organizações, suspensão e instância ARCHIVED; decidir se haverá grants por instância e entitlements por plano.
3. Revisar integridade em dados legados com SELECT read-only e validar FK, índice, locks e desempenho antes de aplicar trigger candidato.
4. Revisar todas as referências cruzadas, inclusive grupos/addons, e os privilégios de função/triggers; comparar contra o Master versionado.
5. Não aplicar migration da fixture de Delivery diretamente no Master, nem mesclar PR #36 ou implantar sem fechamento explícito.
