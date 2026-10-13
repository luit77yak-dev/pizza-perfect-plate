# Matriz anterior à implementação

Fonte: catálogo completo Master capturado em 09/10, candidatos Master #37 229059e e candidatos Sprints3/5/6 preservados em pizza-engine-audit. Não equivale ao estado remoto atual. PRs #36/#37 seguem DRAFT.

| Entidade/contrato | Verificado                                                                              | Tratamento candidato                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Produto           | id/instance_id/category_id UUID; price numeric(12,2), metadata JSONB, active            | Validar instância/categoria ativa/disponibilidade e preço                                               |
| Grupo             | id/instance_id UUID, required, min_selections/max_selections, active                    | Exigir vínculo produto-grupo e mesma instância; limites contam escolhas distintas                       |
| Adicional         | id/group_id UUID, price_delta numeric, active                                           | UUID próprio, nunca produto; delta >=0, precisão definida em centavos                                   |
| Vínculo           | PK(product_id,group_id), FKs independentes                                              | Não basta FK: função verifica ambos pertencem à instância                                               |
| GROUP_ADDONS_V1   | group_addon_ids UUID[]; quantidade por item                                             | Uma unidade por adicional; duplicatas negadas. Multiplicidade por adicional exige V2/decisão, bloqueada |
| LEGACY_PRODUCT_V1 | addons[].id = produto                                                                   | Preservar fluxo sem reinterpretar dados/UUIDs antigos                                                   |
| Tamanho/borda     | metadata.options: tamanho/borda, choices textuais, price delta                          | Validar escolha única/ativa e obrigatória; novo snapshot textual, UUID histórico NULL                   |
| Meio-a-meio       | regras highest/average/fixed existentes, propostas de grupos iguais                     | Bloquear novo contrato até decisão de grupos/preço; não apagar legado                                   |
| Combo             | kind COMBO e componentes sem contrato canônico recuperado                               | Bloquear novo contrato, manter legado separado                                                          |
| Snapshot          | itens têm nome/preço/JSON, size_id/crust_id UUID; não há selection_snapshot no catálogo | Extensão explícita JSONB versionada, default {} = legado desconhecido                                   |
| Checkout HTTP     | domínio→instância, create_public_order, quota/idempotência                              | GROUP enviado explicitamente; SQL calcula. Expected unit price é pré-condição, nunca fonte do valor     |
| Append privado    | token por pedido/instância, lock, payload digest, NOT_SETTLED                           | Usar mesmo preparador/snapshot; nunca ledger/PAID                                                       |

Não copiar os corpos Sprint3 integralmente: usam storefront_domain e settings/zones por organização, incompatíveis com store_domain/instance_id atuais. Helpers que exigem private.delivery_product_publishable ou APIs de autorização antigas não serão importados implicitamente.

## Estado implementado e limites

| Recurso                            | Estado                              | Evidência / condição                                                                                             |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Produto simples normalizado        | Implementado no subset              | Checkout autoritativo e fluxo HTTP real no clone                                                                 |
| Grupo obrigatório/opcional         | Implementado                        | Ausência, excesso, ativo, vínculo e seleção vazia opcional testados                                              |
| Adicionais gratuitos/pagos         | Implementado                        | Delta zero, decimal exato, preço falsificado e delta com casas extras testados                                   |
| Tamanho/borda textuais             | Implementado como opção única delta | Tamanho e borda com deltas/IDs textuais testados no SQL; homologação browser pendente                            |
| Múltiplos adicionais distintos     | Implementado                        | Limites e duplicatas; até 50 IDs por item                                                                        |
| Quantidade por adicional >1        | Bloqueado                           | Não existe esse modelo no schema recuperado; V1 tem uma unidade por ID                                           |
| Quantidade por item                | Implementado, 1–10                  | Negativa/acima de limite negadas, total multiplicado no SQL                                                      |
| Meio-a-meio / combo                | Bloqueado no novo caminho           | Decisões de grupos compartilhados, quantidades/componentes e preço não aprovadas; legado permanece separado      |
| Snapshot completo                  | Implementado, version2              | V1 anterior parcial não reinterpretada; histórico {} preservado                                                  |
| Checkout / append privado          | Implementado                        | Mesmo preparador, idempotência, capacidade, estado e NOT_SETTLED                                                 |
| Histórico / recuperação            | Implementado no escopo do clone     | Restore lógico com dados, funções, RLS/ACL e snapshot normalizado                                                |
| Interface existente                | Conectada, QA parcial               | Loader de grupos, serializer compartilhado, options por produto e erros; não houve teste em browser/celular real |
| Painel/Supplier / gestão de grupos | Não consolidado nesta missão        | Não inventar get_supplier_panel_context, papéis ou grants; administração real por instância segue pendente       |
| Ledger / captura financeira        | Não integrado                       | Nunca inferir PAID de aprovação/append                                                                           |

O preparador base+tamanho+borda+grupo não resolve automaticamente preços comerciais de combos/meio-a-meio. Reutilização de grupo entre produtos usa vínculos reais, não herança automática de categoria. Não há tabela de vínculo grupo-categoria recuperada.

**Impacto de cutover:** writers legados para SKU com vínculos de grupo passam a ser negados no candidato. É guard contra contorno das regras, não equivalência retrocompatível de API. Instalar SQL antes de migrar esses consumidores interromperia operações. Histórico legado continua legível e sem reinterpretação. Não instalar remotamente nesta missão.
