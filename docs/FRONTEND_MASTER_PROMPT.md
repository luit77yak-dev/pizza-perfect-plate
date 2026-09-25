# Pizza Perfect Plate — Frontend Master Prompt

## Objetivo

Evoluir o storefront existente sem reescrever o projeto. A experiência deve ser mobile-first, visualmente forte, simples e orientada a conversão.

## Referência de UX incorporada

- Hero compacto com imagem e CTA "Ver cardápio"
- Faixa dinâmica de produtos
- Cardápio com categorias
- Busca por nome, descrição e categoria
- Cards com foto, descrição, preço e ação
- Configurador de produto
- Suporte a tamanhos, bordas, adicionais e meio a meio
- Carrinho persistente
- Barra de carrinho fixa no mobile
- Checkout de entrega ou retirada
- Observações
- Pagamento como intenção, sem gateway no MVP
- Pedido persistido antes do redirecionamento para WhatsApp
- Acompanhamento por status
- Estados de loading, vazio, erro e sucesso
- Animações suaves com respeito a prefers-reduced-motion
- Identidade visual white-label baseada em organization_settings

## Regras

1. Não substituir componentes funcionais sem necessidade.
2. Não hardcodar produtos, preços, WhatsApp ou dados de uma pizzaria.
3. Reutilizar dados vindos do Supabase.
4. Manter regras de negócio centralizadas.
5. Preservar a arquitetura white-label e multi-tenant.
6. Priorizar mobile.
7. Não copiar a identidade visual do exemplo Smash House. Usar apenas a arquitetura de UX como referência.
8. Toda nova funcionalidade deve possuir estados de loading, empty, error e success quando aplicável.
9. Toda alteração deve preservar o fluxo atual de pedido.
10. Antes de grandes mudanças, validar impacto no storefront, checkout, painel e Supabase.

## Estrutura atual relevante

- `src/components/storefront/Storefront.tsx`: storefront público e fluxo de compra.
- `src/hooks/use-local-cart.ts`: carrinho local.
- `src/routes/loja/$slug.tsx`: rota white-label por slug.
- `src/styles.css`: tokens e motion global.
- `src/lib/domain/`: regras e tipos de domínio.
- `src/integrations/supabase/`: integração e autenticação.
- `supabase/migrations/`: evolução reproduzível do banco.

## Próximos incrementos recomendados

### Fase 1 — Frontend público
- Hero e navegação
- faixa dinâmica
- destaques
- busca
- filtros
- cards
- carrinho fixo

### Fase 2 — Pedido
- configurador de pizza
- meio a meio
- tamanhos
- bordas
- adicionais
- checkout
- WhatsApp

### Fase 3 — Operação
- status do pedido
- painel
- produtos
- categorias
- cupons
- entrega
- aparência

### Fase 4 — Qualidade
- acessibilidade
- performance
- testes
- RLS
- auditoria
- responsividade

## Critério de aceitação

O cliente deve conseguir abrir uma loja, encontrar um produto, pesquisar, configurar a pizza, adicionar ao carrinho, escolher entrega ou retirada, informar os dados, criar o pedido e seguir para o WhatsApp sem perder o pedido caso o WhatsApp falhe.

A base deve continuar reutilizável para novas pizzarias da NEROXA.
