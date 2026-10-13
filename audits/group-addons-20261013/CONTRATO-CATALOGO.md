# Contrato canônico — GROUP_ADDONS_V1

**Candidato isolado; não é autorização de instalação.** Proveniência: catálogo completo Master `master-catalog-20261009.json` (34 relações, 438 colunas, 50 funções, 99 policies), Master #37 `229059e`, candidatos das Sprints3–6 preservados, Delivery integração `1d60611`. A captura histórica não comprova estado atual remoto; nenhuma consulta SQL remota nesta missão.

## Estruturas verificadas

- `neroxa_storefront_products`: `id`, `instance_id`, `category_id` UUID; `price numeric(12,2)`, `metadata jsonb`, `active boolean`, nomes/imagem/slug. FK categoria simples não prova mesma instância; guards Master e preparador conferem o vínculo.
- `neroxa_storefront_addon_groups`: `id`, `instance_id` UUID; `required boolean`, `min_selections/max_selections integer`, `active`. CHECK min>=0 e max>0/max>=min.
- `neroxa_storefront_addons`: `id/group_id UUID`, `price_delta numeric`, `active`; CHECK delta>=0. Não possui coluna instance_id: escopo vem do grupo. Não existe quantidade por adicional neste schema.
- `neroxa_storefront_product_addon_groups`: PK `(product_id,group_id)`, FKs independentes, sort_order. Preparador confere grupo e produto da mesma instância; não infere autorização por organização.
- `neroxa_order_items`: campos históricos product_id/nome/imagem, quantidade/preço/line_total, addons/complements JSONB; `size_id/crust_id UUID`, nomes e crust_price. As opções em metadata usam IDs **textuais**, não UUIDs.

Extensões **propostas, não presumidas existentes**: `selection_snapshot jsonb NOT NULL DEFAULT '{}'` e tabela privada `neroxa_group_order_intents(order_id,payload_sha256)`, com FK para pedido, RLS e todos os privilégios diretos revogados. Não muda o tipo dos campos UUID históricos, owners/roles gerenciados nem memberships. Snapshot existente com tipo/nulabilidade incompatíveis interrompe o candidato; nenhum coercion/rewrite de histórico.

## Entrada

```json
{
  "selection_contract": "GROUP_ADDONS_V1",
  "product_id": "<UUID do produto deste catálogo>",
  "group_addon_ids": ["<UUID do adicional deste catálogo>"],
  "size_id": "grande",
  "crust_id": null,
  "quantity": 2,
  "expected_unit_price": 37.25
}
```

Placeholders não são IDs executáveis. Produto, grupo e adicional são entidades distintas. Grupo é resolvido pela FK do adicional e pelo vínculo produto-grupo; nunca converter `addons[].id` de produto para adicional. IDs duplicados negados. GROUP com addons/complements legados não vazios é negado; contrato desconhecido também. Produto com vínculo de grupo **ou opção required declarada** não pode contornar validação usando checkout/append legados. `required` em metadata é extensão explícita do contrato candidato (JSON flexível, não coluna histórica); não pressupõe a regra comercial de produtos reais ainda não inspecionados.

Subset implementado: produtos simples/pizzas inteiras, opções `tamanho` e `borda` de seleção única em metadata, grupos opcionais/obrigatórios e adicionais gratuitos/pagos. Quantidade por item 1–10; até 50 IDs de adicionais por item (limite técnico), cada adicional uma unidade por produto. Seleções min/max contam escolhas distintas. Configuração incompatível com limites não é anunciada como homologada.

**Bloqueados:** combos/componentes, meio-a-meio, opções de preparo com outro ID, quantidades múltiplas do mesmo adicional. Não há contrato recuperado suficiente para garantir como compartilhar/precificar grupos entre sabores ou multiplicidades. Nenhum legado é apagado: bloqueios do visual aplicam-se somente ao modo avançado opt-in.

## Autoridade monetária e mudança de preço

Preparador privado `private.neroxa_prepare_group_item(uuid,jsonb)` compartilhado por create e append. Todos os objetos relacionados são conferidos: instância, categoria ativa da instância, produto ativo/available, grupo ativo/vinculado, adicional ativo e limites requeridos. Grupo obrigatório inativo bloqueia o produto. Escolhas de tamanho/borda precisam pertencer exatamente ao produto, ser únicas/ativas/disponíveis; opção required precisa de escolha.

Regra recuperada do calculador: **preço base + delta do tamanho + delta da borda + soma dos deltas de adicionais**. Preços não negativos/finitos, `numeric` no PostgreSQL; deltas devem ter centavos exatos. Delta com mais de duas casas é negado até definir arredondamento comercial, em vez de inventar truncamento. Quantidade multiplica o unitário; soma de linhas + taxa da zona da instância produz total do pedido. Não existe gateway/cobrança real.

`expected_unit_price` e, na criação normalizada, `expected_total` são **pré-condições de consentimento**, não fontes do preço. O banco calcula tudo e compara; qualquer diferença gera PT409 e rollback. O subtotal/unit_price arbitrários do cliente não alimentam o cálculo. Taxa alterada também precisa de revisão do total.

HTTP traduz PT409 em 409 + `code=PRICE_CHANGED`; frontend pede atualizar catálogo/revisar sacola. Só esse erro transacional explícito libera a intenção/chave para novo consentimento. Erro HTTP incerto conserva a intenção e não reemite chave automaticamente. Não há reprecificação silenciosa do carrinho; itens antigos precisam ser reconfigurados/removidos e incluídos novamente para aceitar preços atuais. Nenhum valor é confirmado sem o backend aceitar a pré-condição.

Consistência usa SHARE lock conservador nas cinco tabelas de catálogo durante a transação. Cálculo e nomes/preços do snapshot não disputam uma alteração de catálogo dentro da mesma transação. Lock afeta escritores de outras instâncias; desempenho/deadlocks com workflows complexos de catálogo ainda requerem ensaio antes de substituir por locks por linha.

## Snapshot e leitura

Snapshot completo **version=2**, input contract GROUP_ADDONS_V1, pricing_rule BASE_PLUS_DELTAS_V1. A proposta antiga Sprint3 tinha snapshot version1 parcial; não reutilizamos silenciosamente esse número para afirmar completude.

Snapshot contém: instance_id; product_id/nome/preço base; quantity; opções `(option_id,choice_id,nome,price_delta)`; grupos `(group_id,nome,required,min,max)`; adicionais `(addon_id,group_id,group_name,nome,quantity=1,unit_price)`; unit_price e line_total. Imagem também fica na coluna histórica product_image_url. Nomes de tamanho/borda e crust_price são gravados nas colunas existentes; seus IDs textuais ficam no snapshot, enquanto size_id/crust_id UUID permanecem NULL no novo caminho.

`addons` também fornece a projeção de leitura compatível `(id,name,price,group_id,entity_type=ADDON,selection_contract=GROUP_ADDONS_V1)`. A coluna isolada `id` não define semântica: a versão/tag determina ADDON versus produto legado. Tracking recebe `selectionSnapshot`/lineTotal adicionalmente, sem mudar sua assinatura ou autenticação.

Leitores: `{}` = legado/desconhecido, campos antigos permanecem válidos; version1 recuperada é parcial e não deve ser reprecificada/reinterpretada; version2 é snapshot completo. Histórico renderiza snapshots, nunca recalcula pelo cardápio atual. Edição de nome/preço do SKU/adicional não altera o snapshot, demonstrado nos testes. Não há retropreenchimento de IDs presumidos.

## Idempotência, append e ACL

Criação serializa por instância antes de consultar chave. Pedido GROUP registra SHA256 do JSONB canônico na tabela privada; retry idêntico retorna o pedido original inclusive após mudança de preço; payload diferente ou tentativa de converter chave legada em GROUP é negada. IDs/domínio são conferidos antes do replay. Append conserva token por pedido/instância, estado RECEIVED/CONFIRMED, lock, hash de payload e request_key; recibo original impede duplicação.

Append usa exatamente o mesmo preparador e registra evento de histórico para a adição normalizada, uma vez por operação. Estado financeiro **NOT_SETTLED**; adapter nega retorno inesperado em vez de esconder um settlement distinto. Nenhuma importação do ledger #36 nem chamada de confirmação de pagamento.

Novo helper privado sem EXECUTE para PUBLIC/anon/authenticated/service_role; invocado internamente pelos donos das RPCs. Registro de intenção privado com RLS e sem grants diretos. RPCs existentes mantêm assinatura/ACL; gates de revogação de create e append públicos antigos continuam obrigatórios no alvo privado. Não revogar num ambiente atendendo consumidores legados antes de replacement/janela autorizada.

## Ativação apenas em homologação autorizada

Frontend `VITE_NEROXA_GROUP_ADDONS_V1=true`; servidor `NEROXA_GROUP_ADDONS_V1_ENABLED=true`, além das flags e binding privados do gateway/amendments. Default é desativado. Backend deve anunciar selection_contract GROUP_ADDONS_V1 no catálogo; ausência nega sem fallback. Flag pública não autoriza operação: SQL/capacidade/gateway permanecem independentes. Com flag GROUP privada ativa, todos os itens precisam do tag GROUP; retirar/misturar tags não negocia retorno ao legado. Com flag inativa, GROUP é negado. O ensaio HTTP mantém todos os casos legados primeiro e reinicia somente o processo local para o cutover GROUP. Nenhuma variável remota foi alterada.
