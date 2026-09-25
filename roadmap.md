# Roadmap — Sistema white-label de delivery para pizzarias

## Fase 1 — Fundação (em andamento)
- [x] Ativar backend (Lovable Cloud)
- [ ] Migration: schema multi-tenant completo + GRANTs + RLS + índices
- [ ] Seed da pizzaria demo (categorias, produtos, tamanhos, bordas, adicionais, cupons, zonas, horários, pedidos demo)
- [ ] Design system (tokens, tipografia, cores) em src/styles.css
- [ ] Regras de negócio centralizadas (src/lib/pricing.ts, store-hours.ts, order-status.ts) + Zod schemas

## Fase 2 — Loja pública
- [x] Layout da loja (/loja/:slug e / redirecionando para a demo)
- [x] Header, hero, status da loja, categorias, grid de produtos
- [x] Modal de produto (tamanho, meio a meio, borda, adicionais, observações)
- [x] Carrinho persistente
- [ ] Checkout (entrega/retirada, zona, cupom, pagamento) com idempotência
- [ ] Criação do pedido via server function (validação server-side)
- [ ] Confirmação + mensagem WhatsApp + acompanhamento /pedido/:id

## Fase 3 — Contas
- [ ] /login, /cadastro (email/senha + Google)
- [ ] /minha-conta, /minha-conta/pedidos

## Fase 4 — Painel administrativo
- [ ] Layout admin + guarda de rota e permissões
- [ ] Dashboard, pedidos, produtos, categorias, adicionais, cupons, entregas
- [ ] Clientes, entregadores, fidelidade, usuários, aparência, configurações, relatórios, auditoria
- [ ] Pedidos manuais usando o mesmo motor de cálculo
- [ ] Upload de imagens (storage)

## Fase 5 — Qualidade
- [ ] Testes de cálculo, cupom, horários, transição de status
- [ ] Fluxo E2E cliente + admin
- [ ] Auditoria final (responsividade, acessibilidade, erros, hardcode)
