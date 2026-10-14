# Neroxa Delivery — Plano de validação Auth/RLS/Storage/Realtime 02A

**PENDENTE** — não executar contra produção. Última tentativa da auditoria de 14/10 falhou no Docker `vfs` por `no space left on device` antes de iniciar banco. Não declarar PASS desta matriz.

## Pré-condições

1. Runner descartável com espaço comprovado para **pico de extração** das imagens PostgreSQL/Supabase, não apenas tamanho final. Sem contratar infraestrutura sem aprovação.
2. Impedir egress para endpoints comerciais; remover/desabilitar fallback de `localhost/preview` para backend comercial durante ensaios. Nunca importar `.env` real.
3. Reconstituir os **SHAs exatos** de Delivery e Master, manifesto/ordem de migrations candidata, seed fictício e configurações de autenticação isoladas.
4. Snapshot descartável antes dos ensaios; nenhum dado ou credencial real.
5. Registrar logs sanitizados, versão da CLI, checksums SQL, resultado de cada assert e cleanup.
6. Se pré-condições falharem, marcar BLOCKED, não tentar soluções improvisadas no banco remoto.

## Fixtures

- Organização O1: instâncias A e B; organização O2: instância C.
- `admin_A` somente A, `admin_B` somente B, `admin_C` somente C, `staff_master_A` com grant específico A, `staff_master_no_grant` sem instância, `viewer` e `anon`.
- Produtos/categorias/itens/pedidos/imagens **distintos**, com IDs determinísticos de teste; registrar valores e linhas antes/depois dos denies.

## Matriz obrigatória

| Ator | Alvo | Operações | Esperado |
| --- | --- | --- | --- |
| `admin_A` | A | SELECT e alterações legítimas pertinentes | ALLOW somente com grant e papel adequados |
| `admin_A` | B (mesma org) | SELECT/INSERT/UPDATE/DELETE, RPC status/detalhe | DENY e zero mutação |
| `admin_A` | C (outra org) | Mesmo conjunto | DENY e zero mutação |
| `admin_B` | A | Mesmo conjunto | DENY e zero mutação |
| `staff_master_A` | A/B | Mesmo conjunto | A somente; B negada |
| `staff_master_no_grant` | A | Mesmo conjunto | DENY |
| `viewer`/`anon` | A/B/C | tabelas privadas e RPCs admin | DENY |

Cobrir `orders`/`neroxa_orders`, itens, contatos, catálogo, categorias/tamanhos/complementos, settings, horários, zonas, arquivos e histórico. Para cada operação negada, confirmar **nenhuma linha alterada**; para permitida, confirmar escopo e identidade do autor.

## Ensaios específicos

- Alterar manualmente `instance_id` e `organization_id` de requisições; fazer categoria de B referenciada por produto A, e vice-versa.
- Chamar **diretamente** `update_order_status` e RPCs legadas sem passar por `/painel`; testar ACLs `anon`, `authenticated`, `PUBLIC`, `SECURITY DEFINER` e `search_path`.
- Verificar RLS `USING`/`WITH CHECK`, views security invoker/definer, joins pai-filho e triggers contra pais cruzados.
- Tentar upload, atualização e exclusão de `product-images` da loja B autenticado como admin A; validar prefixos/caminhos e políticas Storage.
- Testar Realtime de eventos A/B, perda/revogação de membership e assinaturas antigas após logout.
- Executar checkout público autorizado em instância A como regressão; comprovar que a contenção da rota antiga não altera serviço de checkout.

## Condições de aceitação

**Zero** vazamento cruzado A↔B/C, negadas sem efeitos colaterais, acessos legítimos A e B mantidos e evidências reproduzíveis por operação. Uma falha de acesso cruzado é P0 e bloqueia qualquer avanço. Mesmo com todos os testes passando, F02/Storage/Realtime e E2E hosted continuam gates separados.

## Reversão e segurança

A branch 02A altera apenas montagem da rota/testes/docs; não há SQL para reverter. **Nunca reativar `StaffPanel` como rollback de um release**, pois isso reabre o caminho conhecido. Na ausência de alternativa segura, manter a página de suspensão até migração completa do CRUD e SQL. Como não haverá deploy, descartar/reverter esta branch não muda serviços atuais.
