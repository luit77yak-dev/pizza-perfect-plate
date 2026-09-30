# Neroxa Master — Architecture Foundation

## Objetivo

Criar o núcleo administrativo da Neroxa como uma camada separada da operação das organizações/clientes.

O Master administra a plataforma Neroxa. Cada organização continua administrando seu próprio negócio.

## Princípios

1. Não misturar dados comerciais da Neroxa com dados operacionais dos clientes.
2. Não confiar no frontend para autorização.
3. Toda autorização sensível deve ser aplicada no banco/RLS.
4. Assinaturas preservam o valor efetivamente contratado; alterações futuras de planos não alteram contratos existentes automaticamente.
5. Cobranças são entidades independentes das assinaturas.
6. Alterações críticas devem gerar auditoria.
7. O Master será modular por domínio funcional.
8. Nenhuma integração de pagamento será acoplada ao primeiro modelo de cobrança.
9. Migrações devem ser reproduzíveis e testáveis.
10. O MVP existente não deve ser refatorado apenas para acomodar o Master.

## Limites de responsabilidade

### Neroxa Master

- clientes/organizações
- leads e propostas
- contratos
- planos
- funcionalidades de planos
- add-ons
- assinaturas
- cobranças
- pagamentos
- inadimplência
- serviços avulsos
- implantação
- domínios
- suporte
- usuários internos
- permissões
- auditoria

### Aplicação da organização

- cardápio/produtos
- pedidos
- operação
- entregas
- configurações da loja
- usuários e permissões da organização

A relação entre as camadas será feita por `organization_id`.

## Modelo conceitual

```
NEROXA
  |
  +-- Master
  |    +-- CRM
  |    +-- Clientes
  |    +-- Planos
  |    +-- Contratos
  |    +-- Assinaturas
  |    +-- Financeiro
  |    +-- Implantação
  |    +-- Domínios
  |    +-- Suporte
  |    +-- Auditoria
  |
  +-- Organizations
       +-- Organização A
       +-- Organização B
       +-- Organização C
```

## Entidades comerciais previstas

### plans

Catálogo de planos comercializáveis.

Campos conceituais:
- id
- name
- description
- active
- billing_interval
- base_price
- created_at
- updated_at

### plan_features

Recursos disponíveis em cada plano.

Campos conceituais:
- id
- plan_id
- feature_key
- enabled
- limits/configuration

### subscriptions

Contrato recorrente efetivo de uma organização.

Campos conceituais:
- id
- organization_id
- plan_id
- status
- contracted_price
- billing_interval
- billing_day
- started_at
- ends_at
- created_at
- updated_at

O preço contratado fica armazenado na assinatura para preservar o histórico comercial.

### subscription_items

Componentes recorrentes da assinatura.

Exemplos:
- plano base
- automação WhatsApp
- domínio personalizado
- recurso adicional

Campos conceituais:
- id
- subscription_id
- item_type
- name
- quantity
- unit_price
- active
- started_at
- ended_at

### invoices

Cobranças geradas para uma assinatura ou serviço.

Campos conceituais:
- id
- organization_id
- subscription_id
- status
- subtotal
- discount
- total
- due_date
- issued_at
- paid_at
- cancelled_at

### invoice_items

Composição imutável da cobrança.

Isso permite que uma cobrança histórica continue correta mesmo se o plano ou preço mudar depois.

### payments

Registro de pagamentos efetivamente recebidos.

Campos conceituais:
- id
- invoice_id
- amount
- method
- status
- paid_at
- external_reference
- created_at

Integrações externas serão adicionadas posteriormente.

### service_orders

Serviços avulsos ou cobranças não recorrentes.

Exemplos:
- nova página
- personalização
- implantação adicional
- serviço técnico

### proposals

Propostas comerciais antes do contrato.

### contracts

Registro formal do acordo comercial e sua versão.

## Implantação

### implementation_projects

Projeto de implantação associado à organização.

### implementation_tasks

Checklist por etapa, por exemplo:
- dados cadastrais
- identidade visual
- catálogo
- WhatsApp
- domínio
- pagamentos
- testes
- aprovação
- publicação

## Segurança

O Master terá autenticação própria e autorização por função/permissão.

Não será usado `user_metadata` para decisões de autorização.

Tabelas expostas ao Data API deverão ter RLS e grants mínimos necessários. O Supabase recomenda RLS em todas as tabelas expostas e testes explícitos das políticas. 

Chaves administrativas/service role nunca serão usadas no frontend.

## Auditoria

Ações críticas deverão registrar:
- ator
- organização afetada, quando aplicável
- ação
- entidade
- id da entidade
- valores anterior/novo quando necessário
- motivo, quando aplicável
- timestamp

Exemplos:
- alteração de plano
- alteração de preço contratado
- suspensão
- reativação
- cancelamento
- alteração de permissões
- alteração de domínio
- registro/estorno de pagamento

## Ciclo de vida comercial

```
LEAD
  -> PROPOSTA
  -> NEGOCIAÇÃO
  -> CONTRATADO
  -> IMPLANTAÇÃO
  -> ATIVO
  -> PAUSADO / INADIMPLENTE
  -> CANCELADO
```

O histórico não deve ser destruído ao mudar de estado.

## Ciclo financeiro

```
ASSINATURA
  -> COBRANÇA
  -> PENDENTE
  -> PAGO
```

Em caso de atraso:

```
PENDENTE
  -> ATRASADO
  -> NEGOCIAÇÃO
  -> SUSPENSO
```

A suspensão automática não será implementada na primeira versão.

## Estrutura de frontend

A implementação do Master deverá ser modular:

```
src/
  features/
    master/
      dashboard/
      clients/
      crm/
      contracts/
      subscriptions/
      billing/
      plans/
      implementation/
      domains/
      support/
      audit/
      settings/
```

Cada domínio deve manter seus componentes, serviços, hooks, tipos e validações próximos uns dos outros.

Evitar um painel monolítico ou um único arquivo de rota com toda a lógica.

## Ordem de implementação

### Fase 0 — Fundação
- arquitetura
- autenticação
- papéis/permissões
- modelo de dados
- RLS
- auditoria
- testes de segurança

### Fase 1 — Clientes
- organizações
- contatos
- status
- domínios

### Fase 2 — Catálogo comercial
- planos
- features
- add-ons
- serviços avulsos

### Fase 3 — Contratos e assinaturas
- contratos
- assinatura
- itens recorrentes
- histórico

### Fase 4 — Financeiro
- invoices
- itens
- pagamentos
- inadimplência

### Fase 5 — Implantação
- projetos
- tarefas
- publicação

### Fase 6 — Dashboard
Construído sobre dados reais das fases anteriores.

### Fase 7 — Automação
- notificações
- cobrança automática
- gateway
- webhooks
- regras de suspensão

## Critério para considerar a fundação pronta

Antes de criar o dashboard visual:

- esquema validado
- RLS validado
- permissões testadas
- isolamento Master/organização testado
- auditoria funcionando
- migrações reproduzíveis
- nenhuma credencial privilegiada no frontend
- fluxo básico de cliente -> assinatura -> cobrança definido

## Relação com o MVP atual

O painel administrativo existente do Pizza Perfect Plate não será convertido diretamente no Master.

O MVP continuará sendo uma aplicação de organização.

O Master será uma camada superior da plataforma e poderá administrar várias organizações por meio de `organization_id`.

A primeira implementação não deve alterar o fluxo atual de pedidos, checkout ou operação.
