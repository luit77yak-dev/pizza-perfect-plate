# Inventário, substituição e impacto — missão 02A.2

Fontes: Delivery PR38 b324c149, base c18d680; Master b6f70f1. Inventário de referências de código, não telemetria de consumidores ativos. **Consumidores externos, caches, versões publicadas e permissões efetivamente instaladas: UNKNOWN/NOT RUN.** Nenhuma revogação remota foi feita. Dados de comprador residem também em pedidos; não confundir contatos de CRM Master com clientes de uma loja.

## Acessos legados e substitutos

| Consumidor / autenticação | Recursos alcançados | Autorização atual no código/SQL | Substituto proposto | Efeito da revogação / gate |
|---|---|---|---|---|
| StaffPanel inativo em `/painel`; Auth senha | organization_members, claim_first_owner | primeiro membership da organização; bootstrap de owner | grants explícitos por instância geridos por backend auditado | onboarding antigo indisponível; não remover bootstrap sem entender Auth trigger e provisionamento |
| StaffPanel produtos/categorias; authenticated | products, categories, product_sizes, product_prices, product_addon_links | filtros/RLS organization_id | neroxa_storefront_products/categories com instance_id e guards de pais | editor de catálogo antigo deixa de funcionar; nenhum novo editor completo validado |
| StaffPanel complementos/preços | product_addons/product_crusts e vínculos | organização | GROUP_ADDONS_V1 e metadados de opções, com domínio/instância | não mapear base_price/product_prices diretamente para price/metadata sem reconciliação financeira |
| StaffPanel settings/horários | organization_settings, store_hours, special_hours | organização; upsert org+weekday/org+date | contrato de disponibilidade/settings por instância | configurações/horários antigos ficam indisponíveis; novo CRUD precisa contrato de timezone, feriados e unicidade |
| StaffPanel pedidos/status | orders, order_items, order_status_history; update_order_status(uuid,uuid,order_status,text) | p_organization_id + is_org_staff | get_admin_orders/detail/update_admin_order_status | operação legítima antiga para; novo painel requer dados migrados e usuário com grant |
| StaffPanel imagens | storage.objects/product-images, produtos | prefixo organization_id/product_id; policies por membership da organização | namespace por instância e autorização no Storage/servidor; imagem pública apenas leitura | substituir/excluir imagens deixa de funcionar; quarentena proposta bloqueia até leitura desse bucket no perfil legado; arquivos preservados |
| StaffPanel notificações | canal admin-order-additions; orders | filtro organization_id | polling atual + notificações por instância; Realtime testado separadamente | notificações antigas suspensas; filtros de canal não são autorização |
| storefront antigo / flags desativadas; anon | create_public_order, append_public_order_items[_with_payment], get_public_order_status, get_public_storefront_settings | RPCs SECURITY DEFINER; org ou UUID+telefone | gateway validado + capacidade de comprador; tracking privado ainda pendente | revogar rompe checkout/tracking/item esquecido antigos; não ativar piloto nesse perfil sem alternativa segura |
| `/admin/pedidos`; Auth senha | RPCs neroxa_* por instância, polling | predicado candidato OR neroxa_is_platform_member() | helper de escopo explícito + RLS restritiva + RPCs alinhadas | staff sem grant deve perder acesso às lojas; grant de plataforma não substitui grant A/B |
| Master staff comercial | clientes/contatos/contratos/assinaturas/jobs/instâncias | is_neroxa_staff e permissões próprias | preservar contrato comercial; definir distinção CRM global × dados privados Delivery | não alterar is_neroxa_staff nem aplicar filtro de loja arbitrário ao CRM; decisão de escopo necessária |

Funções is_org_staff/is_org_manager/has_org_role, next_order_number e triggers de Auth também compõem dependências. Quarentena não pretende remover funções/trigger nem reescrever provisioning. Views ou definer functions não enumeradas podem continuar caminhos de bypass: inventariar catálogo real isolado, ACLs por coluna, heranças de papel e dependências antes da aplicação. `neroxa_clients` no catálogo histórico é uma view; ausência de RLS numa view não deve ser tratada como tabela exposta sem investigar security_invoker e grants.

## Matriz de migração do painel

| Recurso | Serviço/tabelas atuais | Implementação segura aproveitável | Ausência/mudança necessária | Permissões/schema e testes |
|---|---|---|---|---|
| Produtos/categorias | StaffPanel loadProducts/saveProduct; products/categories | catálogo público e neroxa_storefront_products/categories; category guard candidato | editor por instância, sanitização e publicação; não reconstruir painel nesta missão | manager A; A→B/C negado; WITH CHECK e categoria/pai da mesma instância; preservar IDs/histórico |
| Preços/tamanhos/bordas | product_prices/sizes/crusts, base_price | engine de preço, opções e snapshot GROUP | mapper explícito e editor restrito; reconciliar centavos e itens históricos | preço servidor; configuração A não muda B; valor total estável em retry/amendment |
| Complementos | product_addons/links | neroxa_storefront_addon_groups/addons/product_addon_groups | CRUD por grupo pai e vínculo produto/grupo | addon não possui instance_id: herda do grupo; vínculo exige produto/grupo da mesma loja; UPDATE/DELETE e papéis diferenciados |
| Imagens | Storage product-images + image_url | fluxo público de leitura | novo namespace por instância; upload, MIME/tamanho, upsert e exclusão autorizados | INSERT/SELECT/UPDATE/DELETE; caminhos adulterados; cache/URL pública não concede escrita |
| Configurações | organization_settings | neroxa_storefront_settings.instance_id e parser de catálogo | editor/servidor por instância; migração de órfãos sem adivinhação | unicidade instance_id; whitelist pública × campos privados; upsert A não altera B |
| Áreas/taxas | delivery_zones | neroxa_storefront_delivery_zones.instance_id | CRUD por loja e simulação de taxa | vínculos de organização/instância consistentes; total histórico preservado |
| Horários | store_hours/special_hours | store-availability e store-rules por instância | contrato de escrita/armazenamento, timezone e feriados; sem inventar tabela inexistente | horário noturno, loja fechada, retirada/entrega independentes A/B |
| Pedidos/histórico | orders + update_order_status | /admin/pedidos + neroxa_orders/items/history | aplicar autorização explícita em RPC/RLS e validar migração | positivos por loja; staff sem grant negado; transições, autoria e timestamps; sem DELETE financeiro |
| Notificações | Audio/Realtime legado | polling 5s e contador no novo painel | som com gesto e alerta visual; Realtime opcional com autorização própria | A não recebe evento B; stale JWT/revoke/logout; reconexão e deduplicação |

## Divisão em PRs pequenas

1. **Contenção:** PR38 existente; preservar suspensão. Follow-up de validação corrige só formatação nova e documenta resultados.
2. **Autorização SQL:** rascunho Master com grant explícito para staff, wrappers/RLS de pedidos e teto restritivo de catálogo. NOT RUN no banco; não resolve todas as funções definer, CRM, Storage, Realtime ou legado.
3. **Quarentena legada offline:** rascunho Delivery separado; revoga interfaces antigas apenas em clone de perfil legado. Nenhum substituto seguro completo está validado; manter indisponível para piloto. Não usar como cutover live.
4. **CRUD catálogo por instância:** produtos/categorias, depois preço/opções/grupos; cada PR com matriz de pais A/B.
5. **Configurações/taxas/horários**, depois **Storage por instância**, e **notificações** em PRs independentes.
6. **Tracking privado/amendment**, consumidores e migração coordenada; bloquear fallback por telefone e RPCs antigas sem trocar por UUID como segredo.
7. **Executor de grants/provisionamento e DR**: mínima concessão, auditoria, revogação e restore T1; não reativar StaffPanel.

Não há compromisso de implementar todos esses itens nesta missão. Missão 02B permanece somente em planejamento.
