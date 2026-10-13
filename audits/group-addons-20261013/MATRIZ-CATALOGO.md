# Matriz anterior à implementação

Fonte: catálogo completo Master capturado em 09/10, candidatos Master #37 229059e e candidatos Sprints3/5/6 preservados em pizza-engine-audit. Não equivale ao estado remoto atual. PRs #36/#37 seguem DRAFT.

| Entidade/contrato | Verificado | Tratamento candidato |
|---|---|---|
| Produto | id/instance_id/category_id UUID; price numeric(12,2), metadata JSONB, active | Validar instância/categoria ativa/disponibilidade e preço |
| Grupo | id/instance_id UUID, required, min_selections/max_selections, active | Exigir vínculo produto-grupo e mesma instância; limites contam escolhas distintas |
| Adicional | id/group_id UUID, price_delta numeric, active | UUID próprio, nunca produto; delta >=0, precisão definida em centavos |
| Vínculo | PK(product_id,group_id), FKs independentes | Não basta FK: função verifica ambos pertencem à instância |
| GROUP_ADDONS_V1 | group_addon_ids UUID[]; quantidade por item | Uma unidade por adicional; duplicatas negadas. Multiplicidade por adicional exige V2/decisão, bloqueada |
| LEGACY_PRODUCT_V1 | addons[].id = produto | Preservar fluxo sem reinterpretar dados/UUIDs antigos |
| Tamanho/borda | metadata.options: tamanho/borda, choices textuais, price delta | Validar escolha única/ativa e obrigatória; novo snapshot textual, UUID histórico NULL |
| Meio-a-meio | regras highest/average/fixed existentes, propostas de grupos iguais | Bloquear novo contrato até decisão de grupos/preço; não apagar legado |
| Combo | kind COMBO e componentes sem contrato canônico recuperado | Bloquear novo contrato, manter legado separado |
| Snapshot | itens têm nome/preço/JSON, size_id/crust_id UUID; não há selection_snapshot no catálogo | Extensão explícita JSONB versionada, default {} = legado desconhecido |
| Checkout HTTP | domínio→instância, create_public_order, quota/idempotência | GROUP enviado explicitamente; SQL calcula. Expected unit price é pré-condição, nunca fonte do valor |
| Append privado | token por pedido/instância, lock, payload digest, NOT_SETTLED | Usar mesmo preparador/snapshot; nunca ledger/PAID |

Não copiar os corpos Sprint3 integralmente: usam storefront_domain e settings/zones por organização, incompatíveis com store_domain/instance_id atuais. Helpers que exigem private.delivery_product_publishable ou APIs de autorização antigas não serão importados implicitamente.
