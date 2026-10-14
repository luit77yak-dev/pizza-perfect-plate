# Compatibilidade e reversão segura — revisão, não execução

**Status: NOT RUN no banco.** Dois perfis mutuamente distintos no manifesto. Hashes e GUC não comprovam destino nem autorização; executor deve validar loopback, ausência de project-ref e credenciais apenas descartáveis antes de qualquer SQL.

## Perfis e ordem

- **Master M:** b6f70f1 (apenas documentação após 1704dc5) com replay integral do catálogo estrutural histórico 09/10; 19 predecessores em ordem no manifesto, até operational-order-transitions. Aplicar scoped-order-access somente depois. Não usar fixture mínima como equivalência do Master. Scripts adicionais de checkout/quotas/capabilities têm seus próprios gates; não são certificados por esta PR.
- **Delivery L:** PR38 b324c149 com 31 migrations legadas e schema `orders/products/organization_members`. Quarentena recusa o perfil `neroxa_orders` ou schema híbrido. Não concatenar os dois candidatos SQL no mesmo banco. Um destino híbrido exige novo inventário/manifesto aprovado.
- Dependências incompatíveis devem falhar antes de mutar. O novo candidato Master verifica MD5 dos corpos originais de get_admin_orders, detail e update_admin_order_status e aceita reaplicação do próprio corpo; respeita o contrato anterior de retorno, transições, timestamps e histórico. As policies de escopo são AS RESTRICTIVE para impedir OR com policies amplas; operadores não ganham CRUD de catálogo por serem platform members.
- Staff autorizado usa registro explícito `neroxa_instance_members` na loja A + papel adequado; staff ativo da plataforma requer MFA/AAL2 pelo helper existente e não pode usar fallback de membership organizacional. Usuário comum continua exigindo membership ativo da organização e da instância. A concessão/remoção desses registros deve ter executor auditado; não há novo endpoint de auto-grant nesta missão.

## Impactos

Master comercial conserva is_neroxa_staff, contratos, assinaturas e jobs. Entretanto staff antes autorizado globalmente pelo neroxa_is_platform_member passará a depender de grant de loja para dados Delivery. Provisionamento precisa criar/vincular apenas grants explicitamente aprovados, sem conceder acesso a todas as lojas da organização. Criar instância/domínio/assinatura não deve implicitamente abrir catálogo privado. Contatos CRM e neroxa_system_instances podem continuar sujeitos a regras comerciais globais: isso precisa decisão específica e testes; não alegamos isolamento completo desses recursos pelo SQL novo.

Pedidos/itens/valores não são apagados ou recalculados. Update de status preserva o corpo operacional, substituindo somente o predicado de autorização; detail continua delegando a get_admin_orders. RLS não protege contra definer que ignore o helper: auditar cada função de escrita/leitura, inclusive criação/append/tracking e URLs de Storage. DEFAULT PRIVILEGES futuras e papéis herdados precisam varredura independente. O rascunho de quarentena remove ACLs de tabela e coluna e RPCs conhecidas, mas não certifica views/consumidores externos nem eventos Realtime em assinaturas existentes.

## Ensaio seguro, quando houver runner adequado

1. Validar espaço **de pico**, inodes, memória/cgroup, driver e registry antes do pull. Neste runner vfs o pico anterior já excedeu o volume; não repetir nem mudar o daemon. Escolher capacidade maior comprovada e gratuita, ou obter decisão sobre infraestrutura antes de contratar.
2. Bloquear egress comercial. Remover `.env` de runtime de teste sem ler/expor valores; modo homologation exige URL local e chaves emitidas pelo Auth descartável. Desativar fallback localhost/preview. Chaves sintéticas usadas no teste da tela não servem para Auth/RLS.
3. Verificar manifesto/SHA e baseline. Criar O1/A/B, O2/C e sete identidades reais pelo Auth; emitir JWT reais e AAL2 staff. Antes de cada etapa salvar estrutura/ACLs e digests de dados fictícios.
4. Ensaiar positivos e negativos em arquivos separados; cada deny precisa HTTP/SQLSTATE, identidade, contagem/hash de linhas e efeitos indiretos antes/depois. Testar revogação na mesma sessão, views, definer, Storage e Realtime. Atualizar a matriz antiga: o teste que esperava platform global permitido deve virar deny sem grant, nunca ser ignorado para dar PASS.
5. Aplicar candidato no clone em transação, provocar erro e provar rollback atômico. Reaplicar conforme manifesto e comparar estado. Não utilizar GRANTs amplos para fazer teste passar.
6. Exercitar painel novo, catálogo e gateway com credenciais fictícias. Não revogar em ambiente servindo clientes até haver alternativa validada e inventário de consumidores ativo resolvido. Nesta missão não existe autorização para esse ambiente.
7. Restore em cluster independente: pedidos/itens/histórico/grants/Auth/totais antes e depois, sem restaurar tokens válidos da SOURCE na TARGET. Validar login/MFA/revogação no destino.
8. Criar escritas T1, salvar checkpoint sobrevivente fora do domínio de falha, restaurar em terceiro destino e comparar IDs/totais e isolamento. O ensaio histórico protege falha transacional, não perda total T1. Sem delta após checkpoint, RPO não é zero.

## Reversão

Falha antes do commit: ROLLBACK local e comparar digests. Falha após commit: congelar apenas o clone, manter rota suspensa e acesso piloto indisponível, restaurar snapshot em **outro destino descartável**, reaplicar somente sucessor seguro e validar. Não restaurar policies/grants inseguros num destino operacional para recuperar funcionalidade. Não reativar StaffPanel, não fazer downgrade de PK por organização e não voltar a T0 se T1 existir. Reversão da UI retorna à tela suspensa; rollback do SQL só ocorre em clone isolado ou por roll-forward revisado, nunca automaticamente na produção.

## Gates residuais

SQL e pré-condições ainda não executados; compilação contra tipos/tabelas, Auth/RLS, concorrência, revogação, Storage/Realtime e compatibilidade integral são NOT RUN/BLOCKED. Parser não é prova de migração. O pacote não deve ser promovido ou aplicado remotamente.
