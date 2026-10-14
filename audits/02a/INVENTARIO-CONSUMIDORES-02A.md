# Neroxa Delivery — inventário de consumidores 02A

Data: 2026-10-14. Escopo: **F01: `/painel` legado por organização**. Evidência textual em `pizza-perfect-plate@c18d6803`, antes da alteração. Os números abaixo referem-se à versão base e podem mudar com a inserção da contenção.

| Consumidor | Local base (linha) | Recurso | Escopo observado | Acesso esperado / risco |
| --- | --- | --- | --- | --- |
| `/painel` login | `src/routes/painel.tsx:191-216` | `organization_members`, `claim_first_owner` | `organization_id`, primeiro membership | Não concede instância; potencial mistura A/B |
| `/painel` catálogo | `src/routes/painel.tsx:219-234` | `products`, `categories`, `product_sizes`, `product_prices`, `product_addon_links` | `organization_id` | leitura/CRUD devem validar `instance_id` e pais cruzados |
| `/painel` alterações catálogo | `src/routes/painel.tsx:239-306,759-835,1100-1133` | create/update/delete de produtos, categorias e tamanhos | `organization_id` | mutations por instância + RLS/SQL |
| `/painel` adicionais | `src/routes/painel.tsx:415-603` | complementos, bordas, áreas/taxas | `organization_id` | não compartilhar configurações A/B |
| `/painel` horários/settings | `src/routes/painel.tsx:309-412` | `store_hours`, `special_hours`, `organization_settings` | `organization_id` | separar settings públicos de privados por instância |
| `/painel` pedidos | `src/routes/painel.tsx:605-619` | `orders`, itens/histórico | `organization_id` | privado por instância, inclusive joins |
| `/painel` notificações | `src/routes/painel.tsx:635-703` | Realtime/order additions | filtro `organization_id` | subscription + ACL por instância |
| `/painel` imagens | `src/routes/painel.tsx:839-902` | Storage `product-images` | caminho `organization_id/product_id/...` | CRUD Storage deve usar isolamento por instância; SQL separado |
| `/painel` status | `src/routes/painel.tsx:905-920` | RPC `update_order_status` | `p_organization_id` | revogar ou migrar para `update_admin_order_status` com grant |
| `/admin/pedidos` novo | `src/routes/admin/pedidos.tsx:71-190,275-310` | `get_admin_orders`, `get_admin_order_detail`, `update_admin_order_status` | `p_instance_id` | contrato de cliente; verificar ACL/RLS remotamente em clone isolado |

### Contenção nesta proposta

- `/painel` agora monta **somente** `SuspendedLegacyPanel`: nenhuma operação de negócio antiga é acionada pela rota.
- Interface informa suspensão e oferece apenas link para `/admin/pedidos` (pedidos, ainda em validação).
- As funções legadas **permanecem no arquivo como código inativo** para permitir revisão incremental e preservar diff pequeno. Devem ser removidas quando houver substituto seguro.
- A mudança **não** bloqueia RPCs diretas, clientes antigos, endpoints alternativos, Storage, grants nem RLS. **F01 não está integralmente resolvida**, apenas reduzida na rota.
- A área de catálogo/admin fora de `/admin/pedidos` ficará indisponível via rota legada; regressão funcional **intencional** e bloqueante para operação comercial.

### Próximos inventários (não alterar nesta PR)

- **F02:** tracking/append legado por UUID+telefone via storefront e RPCs `SECURITY DEFINER`.
- **F09/02C:** Storage por pasta de organização, Realtime, ACL/RLS efetivos.
- Validar outras rotas/consumidores históricos que possam chamar RPCs diretamente; procurar `organization_id`, `update_order_status`, `organization_members` em todo o projeto e SQL histórico.

### Limite da prova

A revisão é **estática** e baseada no candidato de auditoria, sem conexão ao serviço real. Não atesta esquema instalado, permissões PostgreSQL, nem inexistência de acesso cruzado A↔B.
