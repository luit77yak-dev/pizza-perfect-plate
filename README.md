# Pizza Perfect Plate

# PROJETO: SISTEMA WHITE-LABEL DE DELIVERY PARA PIZZARIAS

## 1. OBJETIVO DO PROJETO

Crie uma aplicação web full-stack, moderna, responsiva e pronta para produção para uma pizzaria.

IMPORTANTE:

Este projeto NÃO deve ser tratado apenas como um site institucional ou protótipo visual.

Ele deve ser construído como um sistema real de delivery que posteriormente poderá ser reutilizado para diferentes pizzarias através de configuração, sem necessidade de reescrever o código.

A arquitetura deve ser WHITE-LABEL.

Isso significa que nome da empresa, logo, cores, fontes, produtos, categorias, preços, endereço, WhatsApp, horários, taxas, regras de entrega e outras configurações devem ser administráveis.

O primeiro projeto deve funcionar como uma pizzaria de demonstração.

Não deixar funcionalidades falsas, botões sem ação ou informações críticas apenas em mock.

Utilizar dados reais do banco para todas as funcionalidades principais.

---

# 2. OBJETIVO COMERCIAL

O sistema será utilizado como um produto/serviço vendido para empresas.

Portanto:

- evitar informações hardcoded

- evitar lógica específica demais para uma única pizzaria

- criar componentes reutilizáveis

- permitir personalização através do painel administrativo

- separar configuração da lógica do sistema

- permitir futuramente múltiplas empresas/pizzarias na mesma aplicação

- preparar a arquitetura para multi-tenant

A aplicação deve permitir que uma nova pizzaria seja configurada sem precisar alterar componentes principais do frontend.

---

# 3. ESCOPO DO MVP

Implementar PRIMEIRO apenas o MVP funcional.

Não implementar funcionalidades avançadas antes de garantir que o fluxo principal esteja funcionando perfeitamente.

O MVP deve possuir:

1. Página pública da pizzaria

2. Cardápio

3. Categorias

4. Produtos

5. Pizza tradicional

6. Pizza premium

7. Pizza doce

8. Pizza meio a meio

9. Tamanhos

10. Bordas

11. Adicionais

12. Carrinho

13. Cupons

14. Retirada no local

15. Entrega

16. Cálculo de taxa de entrega

17. Checkout

18. Seleção de forma de pagamento

19. Envio do pedido para WhatsApp

20. Acompanhamento por status do pedido

21. Cadastro/login do cliente

22. Histórico de pedidos

23. Painel administrativo

24. Gerenciamento de produtos

25. Gerenciamento de categorias

26. Gerenciamento de pedidos

27. Gerenciamento de cupons

28. Gerenciamento de taxas de entrega

29. Gerenciamento de horários

30. Configuração visual da pizzaria

31. Gerenciamento de usuários e permissões

32. Dashboard administrativo

33. Logs de alterações importantes

---

# 4. NÃO IMPLEMENTAR NO MVP

Não implementar agora:

- GPS em tempo real do entregador

- mapa de localização do entregador

- pagamento online real

- gateway de cartão

- PIX automático

- inteligência artificial para atendimento

- aplicativo mobile nativo

- programa de assinatura

- múltiplas filiais complexas

- marketplace

- sistema de avaliações públicas

- avaliações falsas/demonstrativas

- contagem regressiva falsa de urgência

- estoque complexo

- recursos avançados de marketing

Esses recursos podem ser preparados para uma futura versão 2.

A arquitetura, entretanto, deve permitir expansão futura.

---

# 5. TECNOLOGIA

Utilizar:

- React

- TypeScript

- Tailwind CSS

- shadcn/ui

- Framer Motion

- Lucide Icons

- Supabase

- Supabase Auth

- PostgreSQL

- React Query/TanStack Query

- Zod para validação

- Sonner para notificações

Utilizar componentes pequenos e reutilizáveis.

Evitar componentes gigantes.

---

# 6. BANCO DE DADOS E MULTI-TENANCY

Criar arquitetura preparada para múltiplas empresas.

Criar uma entidade:

organizations

Cada pizzaria será uma organization.

Criar:

organizations

profiles

organization_members

organization_settings

Todas as entidades pertencentes a uma pizzaria devem possuir:

organization_id

Exemplos:

categories

products

product_sizes

product_addons

orders

order_items

coupons

delivery_zones

drivers

loyalty_accounts

order_status_history

store_hours

special_hours

audit_logs

---

# 7. ESTRUTURA DE USUÁRIOS

Utilizar Supabase Auth para autenticação.

Criar perfis e membros da organização separadamente do usuário de autenticação.

Tipos de usuário:

OWNER

ADMIN

ATTENDANT

KITCHEN

DRIVER

CUSTOMER

Não confiar apenas no frontend para autorização.

As permissões precisam ser verificadas também no backend/banco através das políticas de segurança.

---

# 8. SEGURANÇA DO SUPABASE

Implementar Row Level Security (RLS) em todas as tabelas expostas.

As políticas devem garantir isolamento entre organizações.

Um usuário pertencente à organização A nunca pode visualizar ou modificar dados da organização B.

Clientes só podem acessar seus próprios dados e pedidos.

Funcionários só podem acessar os dados da organização à qual pertencem.

Administradores possuem permissões superiores apenas dentro da própria organização.

Utilizar auth.uid() e membership/role checks nas políticas.

Criar políticas separadas para SELECT, INSERT, UPDATE e DELETE quando necessário.

Criar índices nas colunas utilizadas pelas políticas de RLS.

Criar testes de RLS para permitir e negar acessos.

NUNCA colocar:

- service_role key

- secret key

- credenciais administrativas

no frontend.

Qualquer operação privilegiada deve ocorrer no servidor ou Edge Function.

---

# 9. ROTAS

Criar estrutura semelhante a:

/

/loja/:slug

/login

/cadastro

/pedido/:id

/minha-conta

/minha-conta/pedidos

/admin

/admin/pedidos

/admin/produtos

/admin/categorias

/admin/cupons

/admin/entregas

/admin/clientes

/admin/entregadores

/admin/fidelidade

/admin/usuarios

/admin/aparencia

/admin/configuracoes

/admin/relatorios

/admin/auditoria

As rotas administrativas devem exigir autenticação e autorização.

---

# 10. PÁGINA PÚBLICA

A página pública deve ser MOBILE FIRST.

Priorizar a experiência de pedido.

Não transformar a página em um site institucional cheio de seções.

Fluxo:

HEADER

HERO

BANNER DE CUPOM

CATEGORIAS

PRODUTOS

MODAL DO PRODUTO

CARRINHO FLUTUANTE

CHECKOUT

CONFIRMAÇÃO

FOOTER

---

# 11. HEADER

Criar header moderno.

Exibir:

- logo

- nome da pizzaria

- status aberto/fechado

- botão do carrinho

No mobile, manter o header compacto.

---

# 12. HERO

Criar uma área visual forte, mas compacta.

Permitir configurar:

- imagem

- título

- subtítulo

- botão principal

As informações devem vir do banco/configuração.

Não hardcodar textos específicos da pizzaria.

---

# 13. STATUS DA LOJA

O sistema deve verificar automaticamente:

- horário de funcionamento

- dia da semana

- horários especiais

- loja aberta/fechada

Quando estiver fechada:

mostrar claramente:

"Estamos fechados no momento."

Exibir próximo horário de abertura quando disponível.

Não permitir pedidos imediatos quando a loja estiver fechada, exceto se o recurso de agendamento estiver habilitado.

---

# 14. CATEGORIAS

Criar categorias configuráveis.

Exemplos:

Tradicionais

Premium

Doces

Bebidas

Combos

Adicionais

Cada categoria deve possuir:

- nome

- descrição opcional

- imagem opcional

- ordem

- status ativo/inativo

---

# 15. PRODUTOS

Cada produto deve possuir:

- nome

- descrição

- imagem

- categoria

- ativo/inativo

- destaque

- disponibilidade

- ordem

- preços configuráveis

- tamanhos

- adicionais

O administrador deve conseguir editar tudo pelo painel.

---

# 16. PIZZA MEIO A MEIO

Criar suporte real para pizza meio a meio.

O cliente deve conseguir:

1. escolher tamanho

2. escolher primeiro sabor

3. escolher segundo sabor

4. visualizar os dois sabores

5. escolher borda

6. escolher adicionais

7. adicionar ao carrinho

Criar uma configuração administrativa:

half_pizza_pricing_rule

Valores possíveis:

- highest_half

- average_halves

- fixed_price

Valor padrão:

highest_half

Essa regra deve ser aplicada automaticamente no cálculo do pedido.

Não deixar a regra de preço hardcoded.

---

# 17. TAMANHOS

Criar tamanhos configuráveis.

Exemplo:

- Pequena

- Média

- Grande

- Família

Cada tamanho pode possuir preço diferente.

Não assumir que todas as pizzarias terão os mesmos tamanhos.

---

# 18. BORDAS

Criar bordas configuráveis.

Exemplos:

- Tradicional

- Catupiry

- Cheddar

- Chocolate

Cada uma pode ter preço adicional.

O administrador pode:

- criar

- editar

- remover

- ativar/desativar

---

# 19. ADICIONAIS

Criar sistema de adicionais.

Exemplo:

- Bacon

- Catupiry

- Cheddar

- Calabresa

- Milho

- Cebola

Cada adicional deve possuir:

- nome

- preço

- ativo/inativo

Permitir futuramente regras de quantidade.

---

# 20. MODAL DO PRODUTO

Ao clicar em um produto:

abrir modal/sheet responsivo.

Mostrar:

- imagem

- nome

- descrição

- tamanho

- sabores quando aplicável

- borda

- adicionais

- observações

- preço atualizado em tempo real

- botão adicionar ao carrinho

O preço deve atualizar imediatamente quando o cliente alterar opções.

---

# 21. CARRINHO

O carrinho deve:

- adicionar produtos

- remover produtos

- alterar quantidade

- mostrar subtotal

- mostrar desconto

- mostrar taxa de entrega

- mostrar total

Persistir o carrinho localmente de forma segura.

Não armazenar informações sensíveis desnecessariamente.

---

# 22. ENTREGA

Criar sistema configurável de zonas de entrega.

Tabela:

delivery_zones

Campos:

- organization_id

- name

- neighborhoods

- minimum_order

- delivery_fee

- active

Permitir configurar diferentes taxas por região.

Exemplo:

Centro = R$ 5

Setor A = R$ 7

Setor B = R$ 10

Os dados são apenas exemplos.

O administrador poderá editar.

---

# 23. RETIRADA

Permitir:

Entrega

Retirada no local

Quando retirada for selecionada:

- remover taxa de entrega

- mostrar endereço da loja

- mostrar instruções de retirada

---

# 24. CUPONS

Criar sistema real de cupons.

Tipos:

PERCENTAGE

FIXED

FREE_DELIVERY

Campos:

- código

- descrição

- tipo

- valor

- valor mínimo

- limite de utilização

- data inicial

- data final

- ativo

- organization_id

Validar tudo no backend.

Não confiar apenas no cálculo realizado pelo frontend.

---

# 25. CHECKOUT

Checkout simples e rápido.

Campos:

- nome

- telefone

- endereço

- número

- complemento

- bairro

- referência

- observação

- forma de entrega

- forma de pagamento

Formas de pagamento configuráveis:

- dinheiro

- PIX

- cartão na entrega

- cartão no local

IMPORTANTE:

No MVP NÃO implementar pagamento online real.

A seleção da forma de pagamento representa apenas a intenção de pagamento.

---

# 26. PEDIDO

Criar número amigável do pedido.

Exemplo:

#1024

Separar:

id interno UUID

de

order_number

O cliente deve visualizar o número amigável.

---

# 27. STATUS DO PEDIDO

No MVP, "rastreamento" significa acompanhamento do status do pedido, NÃO GPS.

Status:

RECEIVED

CONFIRMED

PREPARING

READY

OUT_FOR_DELIVERY

DELIVERED

CANCELLED

Criar histórico de mudanças.

Mostrar para o cliente uma timeline:

Pedido recebido

Pedido confirmado

Em preparo

Pronto

Saiu para entrega

Entregue

Registrar:

- status

- timestamp

- usuário responsável

---

# 28. WHATSAPP

Após o checkout:

gerar mensagem estruturada contendo:

Pedido #1024

Cliente:

Telefone:

Itens:

Produto

Tamanho

Quantidade

Adicionais

Subtotal:

Desconto:

Entrega:

Total:

Forma de entrega:

Endereço:

Forma de pagamento:

Observação:

Abrir WhatsApp da pizzaria.

Utilizar o número configurado no painel administrativo.

Não hardcodar o número.

Não utilizar emojis na mensagem.

Criar tratamento para caso o WhatsApp não esteja disponível.

---

# 29. CONFIRMAÇÃO

Depois de criar o pedido:

mostrar uma página de confirmação.

Exibir:

- número do pedido

- resumo

- valor

- status

- botão acompanhar pedido

- botão abrir WhatsApp

Se o envio para WhatsApp falhar, o pedido continua registrado no banco.

O cliente não deve perder o pedido por causa de falha externa.

---

# 30. CONTA DO CLIENTE

Criar:

/minha-conta

Permitir:

- visualizar perfil

- visualizar pedidos

- visualizar detalhes

- repetir pedido futuramente

- visualizar endereços

Nunca permitir que o cliente acesse pedidos de outro cliente.

---

# 31. PAINEL ADMINISTRATIVO

Criar painel administrativo profissional.

Layout:

sidebar desktop

bottom navigation ou menu compacto no mobile.

Menu:

Dashboard

Pedidos

Produtos

Categorias

Adicionais

Cupons

Entregas

Clientes

Entregadores

Fidelidade

Aparência

Usuários

Relatórios

Configurações

Auditoria

---

# 32. DASHBOARD

Exibir:

- pedidos de hoje

- faturamento de hoje

- pedidos em andamento

- pedidos concluídos

- ticket médio

- produtos mais vendidos

- vendas por período

Permitir filtros:

Hoje

7 dias

30 dias

Período personalizado

Não inventar dados.

Utilizar dados reais do banco.

Em ambiente demo, utilizar seed data explicitamente identificada como demonstração.

---

# 33. GERENCIAMENTO DE PEDIDOS

Criar painel de pedidos.

Visualização:

Recebidos

Confirmados

Em preparo

Prontos

Saiu para entrega

Entregues

Cancelados

Permitir alterar status.

Impedir transições inválidas quando necessário.

Exemplo:

Pedido entregue não deve voltar para "recebido" sem confirmação administrativa.

Mostrar detalhes completos do pedido.

---

# 34. PEDIDOS MANUAIS

Permitir que atendentes criem pedidos pelo painel administrativo.

Isso será útil para pedidos recebidos por telefone ou presencialmente.

Utilizar o mesmo motor de cálculo utilizado pelo checkout público.

Não duplicar regras de preço.

---

# 35. PRODUTOS ADMIN

Permitir:

Criar produto

Editar produto

Excluir/desativar

Alterar preço

Alterar imagem

Alterar categoria

Alterar disponibilidade

Destacar produto

Alterar ordem

Adicionar confirmação antes de exclusões destrutivas.

---

# 36. UPLOAD DE IMAGENS

Utilizar Supabase Storage.

Criar políticas de acesso adequadas.

Permitir upload de:

- logo

- produtos

- banner

- imagens da loja

Comprimir/redimensionar imagens quando apropriado.

Nunca deixar imagens quebradas.

Se nenhuma imagem estiver cadastrada, utilizar placeholder visual consistente.

---

# 37. APARÊNCIA

Criar painel:

"Aparência da loja"

Permitir alterar:

- nome

- logo

- favicon

- cor principal

- cor secundária

- fonte

- imagem principal

- texto do hero

- descrição

- WhatsApp

- endereço

- redes sociais

Utilizar CSS variables/tokens.

Não espalhar códigos hexadecimais diretamente pelos componentes.

---

# 38. CONFIGURAÇÕES

Criar:

Dados da empresa

Horários

Horários especiais

Endereço

WhatsApp

Taxas

Pedido mínimo

Tempo estimado

Métodos de pagamento

Retirada

Entrega

Regras da pizza meio a meio

---

# 39. USUÁRIOS E PERMISSÕES

Criar gerenciamento de membros.

Permissões:

OWNER:

acesso total

ADMIN:

acesso administrativo

ATTENDANT:

pedidos e clientes

KITCHEN:

visualização e atualização da produção

DRIVER:

pedidos atribuídos

CUSTOMER:

apenas seus próprios dados

As permissões devem ser aplicadas no backend/RLS, não somente escondendo menus no frontend.

---

# 40. ENTREGADORES

No MVP criar gerenciamento simples.

Campos:

- nome

- telefone

- ativo

- organization_id

Permitir atribuir pedido a um entregador.

Não implementar GPS ainda.

---

# 41. FIDELIDADE

Criar estrutura simples para fidelidade.

O administrador poderá configurar:

pontos por R$ gasto

Exemplo:

1 ponto a cada R$ 1

Criar:

loyalty_accounts

loyalty_transactions

No MVP não precisa existir um sistema extremamente complexo de recompensas.

Preparar arquitetura para expansão.

---

# 42. AUDITORIA

Criar audit_logs.

Registrar alterações importantes:

- criação de produto

- alteração de preço

- exclusão/desativação

- criação de cupom

- alteração de taxa

- alteração de configurações

- mudança de permissões

- alteração de status de pedido

Guardar:

- usuário

- ação

- entidade

- entity_id

- data

- informações relevantes

---

# 43. ESTADOS DA INTERFACE

TODAS as telas precisam ter:

Loading

Empty

Error

Success

Nunca deixar tela branca.

Exemplo:

Se não existem pedidos:

"Você ainda não possui pedidos."

Se ocorreu erro:

"Não foi possível carregar os pedidos."

Adicionar botão:

"Tentar novamente"

---

# 44. VALIDAÇÃO

Utilizar Zod ou solução equivalente.

Validar:

- telefone

- preço

- quantidade

- cupom

- endereço

- pedido

- permissões

- inputs administrativos

Limitar valores absurdos.

Nunca confiar apenas em validação frontend.

---

# 45. REGRAS DE NEGÓCIO CENTRALIZADAS

Criar funções reutilizáveis para:

calculateHalfPizzaPrice()

calculateProductPrice()

calculateOrderSubtotal()

calculateDiscount()

calculateDeliveryFee()

calculateOrderTotal()

validateCoupon()

validateDeliveryZone()

validateStoreOpen()

validateOrderStatusTransition()

Não duplicar essas regras em diferentes componentes.

---

# 46. UX

Experiência extremamente simples.

O cliente deve conseguir realizar um pedido com poucos passos.

Prioridade:

1. Ver produtos

2. Escolher produto

3. Adicionar

4. Ver carrinho

5. Informar entrega

6. Confirmar

7. Enviar WhatsApp

Evitar excesso de popups.

Evitar formulários enormes.

---

# 47. DESIGN

Visual moderno, premium e profissional.

Inspirado em pizzarias artesanais italianas e brasileiras.

NÃO copiar identidade visual, layout ou assets de marcas existentes.

Utilizar:

- tipografia elegante

- grandes imagens de produtos

- bastante espaço

- cards limpos

- microinterações

- animações sutis

Não utilizar emojis como elementos de interface.

Utilizar Lucide Icons.

Não utilizar caracteres como ícones.

---

# 48. RESPONSIVIDADE

Testar obrigatoriamente:

375px

390px

430px

768px

1024px

1440px

Prioridade máxima para mobile.

Todos os botões devem possuir área de toque confortável.

---

# 49. ACESSIBILIDADE

Implementar:

- navegação por teclado

- foco visível

- aria-labels

- contraste adequado

- labels em inputs

- mensagens de erro acessíveis

- modais fecháveis por teclado

- hierarquia correta de headings

---

# 50. PERFORMANCE

Evitar:

- renders desnecessários

- consultas duplicadas

- imagens gigantes

- componentes monolíticos

- chamadas desnecessárias ao banco

Utilizar React Query para server state.

Utilizar cache quando apropriado.

Lazy load onde fizer sentido.

---

# 51. TRATAMENTO DE ERROS

Implementar:

Error Boundary

Estados de loading

Retry de requisições

Feedback visual

Tratamento de erros do Supabase

Tratamento de erro no WhatsApp

Tratamento de sessão expirada

Tratamento de pedido duplicado

Não criar pedidos duplicados quando o usuário clicar várias vezes no botão.

---

# 52. IDEMPOTÊNCIA

O checkout deve possuir proteção contra envio duplicado.

Se o usuário clicar várias vezes em "Finalizar pedido", não criar múltiplos pedidos iguais.

Implementar mecanismo de idempotência ou outra estratégia equivalente no backend.

---

# 53. SEO

Na loja pública configurar:

title

description

Open Graph

favicon

canonical quando apropriado

Utilizar o nome da pizzaria dinamicamente.

---

# 54. DEMO MODE

Criar suporte para ambiente de demonstração.

Quando demo mode estiver ativo:

- utilizar dados seed

- não enviar pedidos reais para WhatsApp

- informar claramente que é uma demonstração

- permitir testar todo o fluxo

Isso é MUITO importante porque esse sistema será utilizado para apresentar o produto para potenciais clientes.

---

# 55. DADOS DE DEMONSTRAÇÃO

Criar uma pizzaria demo com:

nome

logo placeholder

cores

categorias

produtos

tamanhos

bordas

adicionais

cupons

zonas de entrega

pedidos fictícios identificados como demo

Criar dados suficientes para que o dashboard pareça funcional.

Não fingir que dados de demonstração são dados reais.

---

# 56. TESTES

Criar testes para:

- cálculo de pizza meio a meio

- cálculo de adicionais

- cálculo de desconto

- cálculo de taxa

- cálculo de total

- validação de cupom

- pedido mínimo

- loja aberta/fechada

- transição de status

- permissões

- RLS

Criar pelo menos um fluxo E2E:

Cliente:

abrir loja

selecionar pizza

configurar

adicionar ao carrinho

finalizar

criar pedido

visualizar confirmação

E fluxo administrativo:

login

visualizar pedido

alterar status

ver pedido atualizado

---

# 57. BANCO E MIGRATIONS

Todas as alterações estruturais do banco devem ser feitas através de migrations.

Não depender de alterações manuais impossíveis de reproduzir.

Criar relacionamentos e foreign keys.

Utilizar UUIDs para IDs internos.

Criar timestamps:

created_at

updated_at

Quando necessário:

deleted_at

---

# 58. IMPORTANTE SOBRE V2

Preparar arquitetura para:

- pagamento online

- PIX automático

- GPS do entregador

- notificações push

- WhatsApp API

- programa avançado de fidelidade

- PWA

- aplicativo mobile

- múltiplas lojas

- analytics avançado

- IA para atendimento

- campanhas promocionais

- QR Code do cardápio

MAS NÃO IMPLEMENTAR essas funcionalidades agora.

Primeiro entregar um MVP completamente funcional.

---

# 59. CRITÉRIO DE QUALIDADE

Não considerar o projeto concluído apenas porque a interface está bonita.

O projeto só estará concluído quando:

- frontend funciona

- backend funciona

- banco funciona

- autenticação funciona

- autorização funciona

- RLS funciona

- CRUDs funcionam

- checkout funciona

- cálculo funciona

- WhatsApp funciona

- painel funciona

- mobile funciona

- erros são tratados

- dados são persistidos

- permissões são respeitadas

---

# 60. REGRA FINAL DE IMPLEMENTAÇÃO

Antes de criar novos componentes:

analise a arquitetura.

Antes de criar novas tabelas:

analise relacionamentos.

Antes de criar regras de negócio:

centralize as regras.

Antes de finalizar:

execute uma auditoria completa procurando:

- bugs

- links quebrados

- botões sem ação

- dados hardcoded

- problemas de responsividade

- problemas de autenticação

- problemas de autorização

- problemas de RLS

- problemas de UX

- problemas de performance

- erros de TypeScript

- erros de console

Corrija tudo que encontrar.

NÃO apenas liste os problemas.

CORRIJA os problemas.

---

# RESULTADO ESPERADO

Entregar um sistema de delivery profissional, reutilizável, white-label, seguro, responsivo e preparado para ser vendido como serviço para diferentes pizzarias.

A aplicação deve parecer um produto comercial real, e não um template genérico ou protótipo.

Comece pela arquitetura, banco de dados, autenticação e estrutura principal.

Depois implemente o fluxo público de pedidos.

Depois implemente o painel administrativo.

Depois faça a auditoria e os testes.

NÃO pule etapas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a04da7a0-d6e7-481b-9076-71083d6bc4d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
