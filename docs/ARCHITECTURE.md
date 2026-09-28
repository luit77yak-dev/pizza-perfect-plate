# Arquitetura do projeto

## Objetivo

Organizar o código por domínio/feature sem alterar regras de negócio durante a primeira etapa da refatoração. A prioridade é estabilidade: mudanças estruturais devem ser pequenas, reversíveis e validadas antes de qualquer alteração funcional.

## Estado atual analisado

- **Framework/runtime:** React 19 + TanStack Start/Router + Vite.
- **Backend:** Supabase (Auth, Postgres e RPCs).
- **Storefront:** `src/components/storefront/Storefront.tsx` concentra carregamento da loja, estado do carrinho, seleção de produto, checkout e rastreamento.
- **Painel:** `src/routes/painel.tsx` concentra autenticação, carregamento de catálogo/operação/pedidos/configurações e grande parte da UI administrativa.
- **Domínio:** `src/lib/domain/` contém tipos e regras de preço/dinheiro.
- **Carrinho:** anteriormente isolado em `src/carrinho/hooks/`.
- **UI compartilhada:** `src/components/ui/` contém componentes Radix/shadcn.
- **Banco:** `supabase/migrations/` contém uma sequência grande de migrações incrementais; não será reescrita como parte desta refatoração.

## Limites de responsabilidade desejados

```
src/
├── features/
│   ├── cart/
│   │   └── hooks/
│   ├── storefront/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── admin/
│       ├── components/
│       ├── hooks/
│       └── services/
├── components/
│   ├── ui/                 # primitives visuais compartilhados
│   └── storefront/         # legado durante migração gradual
├── lib/
│   ├── domain/             # regras e tipos de negócio
│   └── ...
├── routes/                 # composição/roteamento, não regra de negócio
└── integrations/
    └── supabase/           # fronteira de infraestrutura
```

## O que já foi aplicado

### 1. Carrinho

A implementação de `useLocalCart` foi estabelecida em:

`src/features/cart/hooks/use-local-cart.ts`

O caminho antigo continua existindo como um **compatibility export**, evitando quebra imediata de consumidores antigos.

O storefront agora importa diretamente da nova fronteira de feature.

### 2. Navegação administrativa

A implementação de `TopPanelNav` foi estabelecida em:

`src/features/admin/components/TopPanelNav.tsx`

`src/components/panel/TopPanelNav.tsx` continua como compatibility export.

A rota `/painel` já consome a nova fronteira.

## Dependências críticas

### Críticas — não mexer sem validação

1. `src/integrations/supabase/client.ts`
   - fronteira única com Supabase;
   - possui tratamento específico para chaves novas e storage de sessão do preview;
   - alteração pode quebrar preview/autenticação.

2. `src/lib/domain/types.ts`
   - tipos usados pelo storefront, carrinho e painel.

3. `src/lib/domain/pricing.ts`
   - cálculo de preço do carrinho e configuração de produto;
   - deve permanecer puro e independente de UI.

4. `src/components/storefront/Storefront.tsx`
   - ainda é o maior ponto de acoplamento do frontend;
   - concentra fluxo de produto → carrinho → checkout → pedido → rastreamento.

5. `src/routes/painel.tsx`
   - arquivo administrativo monolítico;
   - concentra múltiplos módulos e acesso direto ao Supabase.

6. `supabase/migrations/`
   - sequência histórica do banco;
   - não apagar, renomear ou consolidar migrações já aplicadas.

## Ordem segura de evolução

### Fase A — fronteiras sem alteração de comportamento
- Criar feature boundaries.
- Mover/reexportar hooks e componentes pequenos.
- Atualizar imports.
- Validar preview.

### Fase B — decompor Storefront
Separar, sem mudar regras:
- carregamento da loja;
- catálogo;
- configurador de produto;
- carrinho;
- checkout;
- rastreamento.

### Fase C — decompor painel
Separar:
- autenticação;
- catálogo;
- pedidos;
- operação;
- configurações.

### Fase D — serviços de domínio/infraestrutura
Extrair chamadas Supabase de componentes grandes para serviços por feature, preservando os RPCs e payloads atuais.

### Fase E — limpeza
Somente depois de validação:
- remover compatibility exports;
- remover arquivos realmente sem consumidores;
- revisar duplicidades;
- reduzir CSS legado.

## Regra de validação

Cada fase deve terminar com:

1. TypeScript/build, quando o ambiente de execução estiver disponível.
2. Preview do Lovable.
3. Loja demo carregando.
4. Configuração de produto.
5. Carrinho.
6. Checkout para retirada.
7. Checkout para entrega.
8. Criação de pedido.
9. Rastreamento.
10. Login do painel.
11. CRUD de catálogo.
12. Atualização de pedido.

## Riscos atuais

- **Alto:** continuar fazendo alterações funcionais dentro de arquivos monolíticos sem separar responsabilidades.
- **Alto:** editar migrações antigas do Supabase.
- **Alto:** alterar `client.ts` ou RPCs durante a reorganização estrutural.
- **Médio:** mover componentes sem compatibility export.
- **Baixo:** mover hooks/componentes puros e atualizar imports mantendo os caminhos antigos temporariamente.

## Princípio principal

Primeiro mudar **onde o código mora**; depois mudar **o que o código faz**.

A refatoração estrutural não deve ser usada para corrigir simultaneamente checkout, preços, visual ou regras do banco. Isso reduz drasticamente a chance de outra regressão difícil de localizar.
