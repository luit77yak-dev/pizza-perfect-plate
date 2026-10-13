# Integração candidata da Neroxa Delivery Engine — 13/10/2026

**Resultado: GO restrito para próxima homologação isolada do núcleo atual; NO-GO para integração comercial/cutover e para ativar ledger, catálogo rico ou pagamentos.** Candidata independente `audit/delivery-engine-integration-20261013`, baseada no head #37. Não houve merge automático, alteração de PR, SQL remoto, alteração de produção, domínio, variável remota, dado real ou pagamento. Master intocado. Auto-deploy Vercel desabilitado somente para a nova branch pelo arquivo candidato; nenhum deploy solicitado.

## Fontes e comparação

Conferidos relatórios Master `audits/release-20261013/{RELATORIO,CONSUMIDORES}.md`, código e estado atual das PRs. Master #37 `229059e`, Delivery #36 `afb26bc`, #37 `e8bd746`, todos DRAFT. Main Delivery atual `bff5bee`. Não presumimos que 419/192 anteriores aprovavam esta candidata.

[Matriz de decisões](DECISOES.md), [inventário completo por arquivo/hash](comparison.json) e [contrato alvo/hashes SQL](target-contract.json). São 94 caminhos envolvidos; cinco modificados por ambas frente à main. Diff completo entre heads também inclui renomes/exclusões e mudanças já contidas na base. Hash igual é identidade de bytes, não prova de execução.

## Arquitetura implementada

- **Engine compartilhada:** enums de pedidos, atendimento, produtos e pagamento recuperados da #36 e adaptados aos contratos #37 (`CARD_ON_SITE`, bebidas/combos/acompanhamentos). `lib/domain/types.ts` reexporta o vocabulário canônico, sem copiar papéis ou inventar memberships. As capabilities todas `true` da #36 não foram importadas: não comprovariam disponibilidade.
- **Catálogo:** os dois loaders no head #37 eram idênticos, comprovado por diff. `core/delivery/services/load-public-store.ts` passa a ser a fonte única, com reexport de compatibilidade em features. Continua domínio→contexto/instância→catálogo do backend externo; nenhuma conversão de UUID de produto em adicional.
- **Regras visuais reutilizadas:** `store-rules.ts` e labels de status da #36 compartilhados sem mudar tema. Helpers visuais não passam a ser autoridade de preço; o SQL continua calculando valores.
- **Pedido:** preservados carrinho/chaves de tracking por instância, checkout HTTP opt-in, quota persistente, criação idempotente, domínio e IDs conferidos no servidor. Acrescentados POST obrigatório, nome/telefone/modalidade e endereço completo para entrega; retirada não exige endereço. Valor negativo na resposta é rejeitado.
- **Retries:** intenção de checkout e append fixada em memória; resposta incerta não permite reutilizar silenciosamente a chave com itens/dados alterados, nem gerar chave nova automaticamente. Identificações não são gravadas por esse guard. Limite: fechar/reabrir componente ou reload não recupera a intenção; recuperação completa continua pendente.
- **Adições:** somente capacidade privada #37 no caminho seguro, sessionStorage, hash servidor, prazo e instância/pedido, request key, lock e snapshots. `NOT_SETTLED` preservado; nenhuma ponte para marcar charge `PAID`.
- **Backend:** gateway ativo exige correspondência entre `SUPABASE_URL` e `NEROXA_DELIVERY_BACKEND_URL` privada, além das flags/segredo existentes. Ausência/divergência nega antes do cliente privilegiado. Painel verifica URL primária contra backend público Master antes de login/carga. URLs públicas não autorizam atores; esses guards evitam configuração divergente, não atestam runtime/edge nem a validade de uma chave remota. As variáveis reais não foram alteradas/verificadas nesta missão.
- **Admin moderno:** escolha explícita de UUID da instância, ou domínio atual quando vazio; `get_admin_orders` autenticada verifica grants e MFA/papel no Master. Não existe lista nova de instâncias baseada em membership de organização. Respostas obsoletas após troca são descartadas; seleção anterior é apagada; alteração exige pedido da instância selecionada. UI completa e lista de concessões ainda precisam de homologação.
- **Legado:** `/painel` permaneceu byte a byte igual à base #37. Seus CRUDs/realtime/storage e consumidores permanecem preservados, mas não certificados para duas lojas. Não houve remoção/redirecionamento.

## O que não foi importado e por quê

1. **Ledger/settlement #36:** `decide_order_addition_request` autoriza por membership ativa de organização ou plataforma, sem a concessão operacional por instância demonstrada no Master. Isso contraria o contrato proposto; não afirmamos exploração em runtime. Aprovação cria charge PENDING, enquanto append #37 materializa itens e recibo NOT_SETTLED. Não são a mesma transação. Token #36 é hexadecimal de 64 caracteres; #37 base64url de 43; tabelas/RPCs e ciclos de revogação diferem. Copiar ambas as migrations abriria dois mecanismos incompatíveis.
2. **SupplierPanel #36:** depende de `get_supplier_panel_context`, não comprovado como contrato compatível neste alvo; configurações/zonas ainda consultadas por organização, adicionais sem filtro de instância no consumidor (dependem de RLS). Não promovemos o painel à rota legada.
3. **GROUP_ADDONS_V1/rich pizza:** catálogo físico expõe grupos/adicionais, enquanto calculador legado trata `addons[].id` como produto; tamanhos/bordas textuais podem conflitar com casts UUID no snapshot de itens. Validação completa de opções obrigatórias, min/max, duplicatas e meio-a-meio não foi integrada nem certificada. É bloqueio de contrato, não autorização para adaptar preços no browser.
4. **Temas/UI e recursos exclusivos #36:** permanecem no commit/PR original com proveniência no inventário; não foram excluídos ou substituídos pela candidata. Nenhum redesign.

O alvo SQL continua a cadeia candidata do Master pinado, fora de instalação remota. Não foram copiadas as 16 migrations #36 para a pasta automática nem alterados A01/A05, RLS ou grants para fazer testes passarem. Manifest registra a ordem realmente exercitada e hashes; **não é roteiro de instalação em produção**. Revogação pública de create/append é testada somente nos clones após os testes legados; num ambiente atendendo clientes exige replacement pronto e janela coordenada.

## Evidências desta candidata

Código funcional `009a198` e `8d5d2f4`. O segundo commit é o estado avaliado abaixo. Documentação posterior não muda runtime.

| Validação                         | Resultado comprovado                                                                                                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node22 contratos/negativos        | **44/44 PASS**, 37 anteriores preservados e sete novos; inclui endereço, identidade, método, backend divergente, vocabulário, total negativo e retry alterado                                                                                                                            |
| Lint arquivos alterados           | **PASS, zero erros**; efeitos do painel agora têm dependências explícitas                                                                                                                                                                                                                |
| TypeScript                        | **PASS após regeneração de rotas no build**, local e CI; execução antes do build falhou apenas pelas duas rotas API ausentes no metadata inicial                                                                                                                                         |
| Build                             | **PASS** local e Node22 CI; local Node24, Actions Node22.23.3                                                                                                                                                                                                                            |
| HTTP desabilitado                 | **PASS**, checkout e append retornam 503, sem operação de pedido                                                                                                                                                                                                                         |
| Native Auth/JWT/MFA/RLS/PostgREST | **275 PASS / 0 FAIL**, catálogo histórico completo Master + candidatos, não fixture mínima                                                                                                                                                                                               |
| Gateway privado / bypass RPC      | **54 PASS / 0 FAIL**, preço no banco, idempotência/concorrência e isolamento A1/A2/B1                                                                                                                                                                                                    |
| Capacidade privada                | **43 PASS / 0 FAIL**, autorização/expiração/replay, outras lojas, estado/itens e NOT_SETTLED                                                                                                                                                                                             |
| TanStack HTTPS efetivo            | **47 PASS / 0 FAIL**, rotas ativas contra backend descartável, quota, tentativa cruzada, replay e adicionais                                                                                                                                                                             |
| Segurança integrada total         | **419 PASS / 0 FAIL**, nova execução [38334319078](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38334319078) no `8d5d2f4`; primeira execução [38334071864](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38334071864) também verde no `009a198` |
| Lint global                       | **FAIL preexistente:** base #37 2779 erros/13 warnings; candidata 2535/11, sendo 2531 Prettier e quatro erros não-format. Comparação de diagnósticos não-format: zero novos/zero removidos; [evidência](lint-comparison.json)                                                            |
| Master TypeScript                 | 43 erros anteriores documentados permanecem; Master não foi alterado e não alegamos correção/prova nova de tsc                                                                                                                                                                           |
| diff --check                      | PASS                                                                                                                                                                                                                                                                                     |

CLI 2.120.0, PostgreSQL17.11/image17.11.0.004, GoTrue2.197.0, PostgREST16.4, Kong2.8.1. Stack nova descartável de Actions, loopback imposto pelo relay, rede dedicada, sem migrations/seeds de aplicação no bootstrap nem vínculo remoto. O checkout de catálogo completo e candidatos ocorre depois. Cleanup da stack concluído nos logs. O servidor HTTPS de teste recebeu apenas a URL privada esperada de seu Supabase local; alteração do harness ocorre no runner, não no Master.

Resumos sanitizados e lista de verificações estão neste diretório. Contagem dos resumos é a autoridade; a lista extraída de linhas `PASS` não contém todos os checks que não imprimem esse prefixo. Logs brutos privados/dumps/secrets não foram incluídos. Acesso CLI aos logs do job reutilizável falhou por redirect de rede; os logs reais foram recuperados pelo conector GitHub autorizado e conferidos. Resultado INCONCLUSIVO nos JSON significa release comercial não certificado.

## Recuperação

Nova execução do ensaio existente Master `229059e` **PASS: 36 verificações históricas e 192 de restauração/segurança**, conforme logs conferidos: [38334560442](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38334560442). Ensaio real: 86 tabelas, 88 FKs, comparação de dados e definições/ACL/RLS, freeze de escritas, dump custom e companion ACL, autenticação do destino e roll-forward idempotente. Cleanup da stack comprovado. JSONs sanitizados `historical-38334560442.json` e `recovery-38334560442.json`. Roles globais compartilhadas no cluster descartável e congelamento limitado às tabelas de negócio; não equivale a DR entre clusters nem drain real dos produtores. Não há mudança SQL nesta candidata; ensaio cobre schema/recuperação Master, não DR completo de ledger #36 ou client sessionStorage.

## Riscos restantes e próxima execução

**Alta — bloqueiam cutover:** reconciliar configuração histórica sem instância por decisão autorizada, nunca mapear arbitrariamente; compatibilizar cálculo/snapshot/UUIDs de grupos e opções; administrar por concessão explícita de instância sem depender do painel legado; ponte ledger/recibo/autorizações e settlement somente com evidência válida, mantendo pagamentos desligados.

**Alta — gates de implantação externos:** URL e credenciais reais dos backends, runtime Vercel e edge/trusted routing, pause/drain de consumidores legados e APIs externas. Host/Origin iguais não são autenticação. Código dos deployments legados não foi certificado por este teste. Nenhuma investigação financeira ou alteração remota nesta missão.

**Média — continuidade/privacidade:** tracking ainda UUID+telefone; perda da resposta/token não reemite credencial; recuperação de intenção após reload, teste de UI autenticada, armazenamento inválido e regressão browser ainda pendentes. Browser/celular real não foi testado. Preferir tracking com capacidade dedicada e contrato de recuperação antes de remover API antiga.

**Qualidade/reprodutibilidade:** dívidas globais de lint Delivery e TypeScript Master abertas. Nenhuma dependência nova. Instalação usa npm sem lock npm, conforme CI; bun.lock existe, Bun indisponível localmente. Não afirmar reproduzibilidade completa da árvore de pacotes.

Próxima ação concreta: em branch candidata, compatibilizar GROUP_ADDONS_V1 com calculador e snapshot do Master mediante contrato recuperado; adicionar fixtures ricas A1/A2/B1 e testes de opções/limites/valores. Depois adaptar Supplier por grants explícitos e vincular aprovação a recibos idempotentes de append, ainda sem settlement. Só então homologar runtime Vercel/controladores de instâncias com backend isolado. Não instalar as duas cadeias por ordem de timestamp.

**Esta branch não substitui automaticamente #36/#37, não torna PR pronta para merge e não autoriza produção.** PRs existentes permanecem DRAFT.

## Arquivos e proveniência dos commits

- `009a198`: contratos canônicos, validação/binding, seleção administrativa, matriz, inventário, gate de deploy da candidata e workflow isolado.
- `8d5d2f4`: loader único com reexport, labels neutros recuperados da #36, guard de retry e regressões (44 testes).
- Commit documental subsequente: relatório, manifest/hashes e evidências das execuções. Nenhum runtime alterado depois do `8d5d2f4`.

Arquivos runtime: `src/core/delivery/{contracts,content,customer-details,backend-binding,request-intent}.ts`, `core/delivery/services/store-rules.ts`; reexports `features/storefront/{services/load-store,domain/storefront-utils}.ts`; `lib/domain/types.ts`; `features/storefront/components/CheckoutPanel.tsx`; `components/storefront/TrackedOrderPanel.tsx`; `routes/admin/pedidos.tsx`; `server/{checkout-gateway,checkout-gateway.server,order-amendment.server}.ts`; `integrations/storefront-backend/client.ts` (export da URL pública existente, nenhuma chave nova).

Validação: `tests/{engine-integration,store-context}.test.mjs`; `.github/workflows/{ci,integrated-delivery-auth}.yml`; `vercel.json` (bloqueio exclusivo da branch); `audits/integration-20261013/*`. Parte do diff é formatação Prettier dos arquivos tocados, sem substituí-los pelo conteúdo antigo das PRs.

Comandos locais: `npm exec --yes --package=node@22 -- node --experimental-strip-types --test tests/*.test.mjs`, `npx eslint <arquivos alterados>`, `npm run build`, `npx tsc --noEmit`, `git diff --check`; comparação global `npx eslint . --format json` nos dois worktrees. CI faz build antes de typecheck para gerar metadata das rotas; metadata gerado incidentalmente não foi incluído no commit.
