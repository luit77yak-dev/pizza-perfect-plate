# Revisão do painel demonstrativo Forno di Pietra

## Escopo e estado

Trabalho exclusivamente em `feat/forno-visual-demo`, PR #35 em draft, base `feat/delivery-visual-consolidation`. Os commits remotos `32e20f5`, `99b0e03` e `fd8574b` foram recebidos por fast-forward, preservando os ajustes mobile locais anteriores. HEAD permanece `fd8574b7636dabb416801ab395cb72c981562a19`.

O painel existente foi aperfeiçoado; suas oito áreas e a estrutura original foram mantidas. Não houve commit, push, merge de PR, deployment, SQL, alteração de credenciais/configurações ou acesso a dados reais nesta execução.

## Problemas comprovados e correções

| Evidência inicial | Correção |
| --- | --- |
| Artefato Vercel inicial: `/visual-demo/painel` responde 200, mas contém o cardápio e não a introdução do painel. `visual-demo.tsx` renderizava `VisualDemo` sem `Outlet`. | Pai virou layout com `Outlet`; o cardápio permanece no índice `/visual-demo/`. A rota do painel foi preservada, sem recriá-la. Árvore de rotas regenerada. |
| TypeScript: filtro desestruturado inferia `string \| undefined`; a rota adicionada não existia na árvore versionada. | Tuplas literais tipadas, filtro `Status \| "ALL"` e registro gerado atualizado. |
| CSS do painel não estava integralmente sob um contêiner. Na captura inicial, regras globais de header deixavam fundo claro e título com pouco contraste. | Todos os seletores próprios ficam sob `.forno-panel`; neutralização do header legado somente nesse painel. Verde profundo, creme, dourado e tipografia serifada acompanham o cardápio. |
| Menu mobile deslocado para fora da tela, sem controle de foco, Escape ou inatividade do fundo. | Reutilização de `useCustomerDialog`, foco contido/restaurado, `inert`, semântica de diálogo, Escape e bloqueio de rolagem do fundo. Menu fechado não deixa sombra na página. |
| Simular atualização sob outro filtro podia ocultar o pedido atualizado. | Filtro volta a Todos e pedido #1042 é expandido. Filtros Confirmados e Entregues também estão disponíveis, com `aria-pressed`. |
| `NOVO` identificava somente a última linha e persistia após ciência. | Cada item incluído é identificado enquanto não reconhecido; ciência limpa marcas, destaque e contador. Novas inclusões não remarcam itens já reconhecidos. |
| Total de pedidos marcados PAID aumentava com itens ainda não confirmados. | Valor pago fictício fica separado do total; adicionais geram saldo pendente, sem aprovação automática. Resumo e linha financeira identificam o adicional pendente. |
| Bairros/taxas eram somente leitura e a área Minha loja exibia quantidade fixa. | Inclusão, edição, cancelamento e remoção locais; validação de nome, duplicidade, taxa finita/não negativa/até 9.999 e estado vazio. Quantidade de bairros dinâmica. Alterações não recalculam pedidos existentes. |
| Alguns controles tinham 38–40 px e cabeçalho/linhas eram apertados em telas pequenas. | Alvos de pelo menos 44 px, cabeçalho adaptável, filtros quebrando em linhas e dados longos contidos. Sem overflow horizontal da página nos tamanhos testados. |

O bloqueio antecipado no `src/server.ts` passou a cobrir a família `/visual-demo/*`. O gate já existente foi mantido, inclusive no painel. A limitação inicial do prefixo **não é tratada como exposição confirmada**: havia proteção `beforeLoad`. O artefato corrigido foi testado para 404 em produção, mesmo com headers falsificados, e negação em runtime desconhecido.

## Testes e resultados

- **TypeScript:** `node node_modules/typescript/bin/tsc --noEmit` passou.
- **Build:** `npm run build`, preset Vercel, Node 24.19.0, saída `nodejs24.x`, passou. Build realizado em cópia isolada com variáveis sintéticas e bloqueio de rede externa. Permanecem avisos preexistentes de CSS/chunks.
- **ESLint dos arquivos alterados:** passou; `git diff --check` passou.
- **Lint global:** falha preexistente. HEAD recebido: 2.305 erros/13 avisos; estado revisado: 2.221 erros/13 avisos. Restam 2.217 problemas de Prettier e quatro outros erros em arquivos fora desta alteração. Nenhum novo arquivo com erros; `FornoPanelDemo.tsx` deixou de constar entre eles. Não foi feita formatação ampla do restante do produto.
- **Gate existente:** nove asserções passaram.
- **Integração de painel:** `tests/forno-panel.browser.test.mjs` executa o artefato Vercel local, não aceita URL hospedada e bloqueia fetch externo. Chromium em **320 × 640, 390 × 900, 430 × 900, 768 × 900 e 1280 × 900**. A rodada final aprovou **230 verificações**, registradas em `browser/results.json`.
- **Regressão do cardápio:** SSR/hidratação, configurador, adicional e carrinho em 390 px passaram sobre o mesmo artefato corrigido. Checkout continua desabilitado; nenhuma chamada de backend.

Cobertura funcional do painel:

1. SSR correto do painel e índice do cardápio independente; hidratação sem erro JavaScript.
2. Navegação por todas as oito áreas; menu inacessível quando fechado; foco preso ao menu aberto, fundo inerte, Escape e retorno ao botão.
3. Indicadores, expansão/recolhimento, filtros com e sem resultados, pagamentos pagos/pendentes consistentes.
4. Inclusões repetidas, atualização visível sob filtro anterior, destaque, ciência, novas inclusões após ciência e alertas limitados a quatro.
5. Avanço sequencial em entrega; bloqueio de inclusão após saída; estado terminal sem próxima ação; retirada pula a etapa de entrega.
6. Som desligado por padrão, habilitação explícita, chamada a resume/start/close instrumentada e desligamento sem novos disparos. Alertas visuais independentes do áudio.
7. Bairros: rejeição de taxa negativa/duplicidade, criação, edição de taxa, remoção e estado vazio.
8. Ausência de overflow nas oito áreas, header escuro e contraste do título; estado independente em outra página/visitante.
9. Armazenamento real do navegador ignorado; zero fetch de backend no servidor; todas as requisições locais observadas são GET; nenhum RPC/auth/pagamento. Tentativas externas limitadas às fontes Google já existentes, bloqueadas no teste.

Reprodução depois de um build local isolado:

```sh
PLAYWRIGHT_MODULE=/caminho/para/playwright \
CHROMIUM_EXECUTABLE=/caminho/para/chromium \
FORNO_TEST_EVIDENCE=/tmp/forno-evidencias \
node tests/forno-panel.browser.test.mjs /copia-isolada/.vercel/output
```

Playwright e Chromium estavam disponíveis no executor; não foram adicionadas dependências ao pacote. O teste exige essa infraestrutura e o artefato isolado. Não executar builds/testes com dados ou variáveis de produção.

## Evidências

- Antes das correções: `/workspace/audit/forno-panel/baseline/runtime.json` — 200, `panelRendered=false`, `storefrontRendered=true`, zero fetch externo.
- Depois: `/workspace/audit/forno-panel/final/checks.json`, `build-vercel.log`, `typecheck.log`, `lint.log`, `lint-all-summary.json`, `browser/results.json`, `full-route-results.json`.
- [Visão geral mobile](/workspace/audit/forno-panel/final/browser/overview-320.png), [pedidos mobile](/workspace/audit/forno-panel/final/browser/orders-390.png), [bairros mobile](/workspace/audit/forno-panel/final/browser/delivery-320.png), [desktop](/workspace/audit/forno-panel/final/browser/overview-1280.png).

## Arquivos desta etapa

- `src/features/visual-demo/FornoPanelDemo.tsx`: correções e funcionalidades simuladas sobre o componente recebido.
- `src/features/visual-demo/forno-panel.css`: escopo, identidade e layout/acessibilidade.
- `src/routes/visual-demo.tsx`: layout pai preservando gate.
- `src/routes/visual-demo/index.tsx`: índice do cardápio.
- `src/routeTree.gen.ts`: registro gerado.
- `src/server.ts`: guard da família de rotas.
- `tests/forno-panel.browser.test.mjs`: integração isolada e casos negativos.
- Este relatório.

`src/routes/visual-demo/painel.tsx` foi inspecionado e mantido. As modificações anteriores em `visual-demo.css` e `docs/visual-demo-20261010.md` permanecem intactas. O aumento de linhas no componente/CSS inclui formatação dos arquivos originalmente compactados; não representa reconstrução do painel.

## Preview e pendências

Preview existente da PR #35, commit `fd8574b`, deployment READY:

https://pizza-perfect-plate-mfvwi0foh-neroxa2.vercel.app/visual-demo/painel

Consulta somente leitura confirmou Vercel Authentication habilitada (`all_except_custom_domains`) e PR em draft. **Esse preview não contém as correções locais desta execução.** A rota corrigida foi validada no artefato Vercel local; validação hospedada posterior depende de publicação autorizada.

Pendências: publicação/validação remota autorizadas, dívida de lint global e teste manual de áudio em dispositivo real/leitor de tela. O áudio foi instrumentado e não certificado por audição física. Não foram consultadas lojas reais, testadas operações financeiras reais ou certificadas regras de autorização do produto administrativo real. Catálogos/indicadores continuam fixtures demonstrativas, sem persistência após reload.

Conclusão: painel local validado com limitações explícitas; nenhum resultado desta revisão aprova backend, produção ou prontidão integral do Delivery.

## Revalidação para publicação autorizada

Em 2026-10-10, a publicação exclusiva das correções do painel foi autorizada. TypeScript, nove asserções do gate, ESLint dos arquivos alterados e diff check passaram novamente. Build Vercel isolado do conteúdo selecionado para commit e 230 verificações de navegador passaram, assim como a regressão do cardápio/configurador/carrinho. As mudanças anteriores em `visual-demo.css` e `docs/visual-demo-20261010.md` foram preservadas fora do commit. O script externo de preparação do build foi corrigido para incluir alterações staged; uma primeira execução havia testado acidentalmente o código anterior. Nenhuma falha ficou pendente na validação do conteúdo selecionado.

A validação hospedada deve ser associada ao SHA publicado, sem considerar o preview antigo como evidência das correções. Não há autorização de merge ou publicação em produção.
