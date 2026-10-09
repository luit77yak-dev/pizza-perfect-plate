# Refinamento visual mobile — Forno di Pietra

> Nota de publicação: este relatório registra a execução local anterior à autorização de commit/push/PR. As indicações de “sem commits” e “nova autorização” descrevem aquela etapa. Artefatos em `/workspace/audit/` são referências locais, não arquivos incluídos na PR; os resultados e limites estão resumidos neste documento.

2026-10-09 · `feat/delivery-visual-consolidation` · referência: [consolidação anterior](visual-consolidation-20261009.md).

O refinamento foi implementado sobre os arquivos locais existentes, sem reconstruir a interface. A área sem imagem ficou compacta, o preço ganhou destaque, os controles ficaram mais legíveis e os espaçamentos de hero/cardápio/contato foram ajustados. Os testes finais passaram. Nenhum commit, push, merge, deployment, SQL ou acesso a dados reais foi realizado.

## Escopo e arquivos desta execução

| Arquivo | Alteração incremental |
|---|---|
| [Storefront.tsx](../src/components/storefront/Storefront.tsx) | Marcador de mídia ausente e classes semânticas de placeholder, conteúdo e preço, condicionados a Forno. O placeholder decorativo recebeu `aria-hidden`. Nenhum handler foi alterado |
| [forno.css](../src/styles/forno.css) | Dimensões do placeholder, hierarquia dos cards, controles, CTA, espaçamentos e organização do contato |
| `docs/visual-refinement-20261009.md` | Este relatório |

As alterações anteriores da consolidação foram preservadas. A comparação com uma cópia dos arquivos no início desta execução confirmou somente os dois arquivos de código acima como modificados. O diff incremental de Storefront tem 50 linhas, incluindo contexto; não houve substituição pelo código das PRs antigas. Inventário incremental — `/workspace/audit/pizza-refinement/incremental-files.json` (local), diff TSX — `/workspace/audit/pizza-refinement/Storefront.tsx.diff` (local), diff CSS — `/workspace/audit/pizza-refinement/forno.css.diff` (local).

HEAD permanece em `bff5bee289cd4e911a5be012cb7b8731e48e82fd`. A aparência continua opt-in por `instance_slug`; o mapa de ativação não foi modificado. Pizza/Burger e o código administrativo permaneceram intactos. Nenhum arquivo do Neroxa Master foi alterado.

## Melhorias implementadas

- **Cards sem imagem:** quando não existe imagem resolvida do produto ou da categoria, a mídia recebe altura responsiva entre 112 e 144 px, fundo discreto e ícone circular. Imagens existentes seguem o caminho original; URLs, carregamento, proporção e `object-fit` não foram alterados. O refinamento não introduz tratamento novo para erro de carregamento de uma URL existente.
- **Nome e preço:** nome explícito com cor creme e linha mais compacta; preço de 18 px, dourado e números tabulares. Categorias, adicionais, destaque e ação do card continuam presentes, com o mesmo comportamento.
- **Cabeçalho/navegação:** ícones com área mínima de 44 px; navegação mobile de 14 px, espaçamento normal entre letras e alvos de pelo menos 44 px. A identidade verde/creme/dourado foi mantida.
- **Hero:** CTA de pelo menos 52 px e largura total no mobile; borda/sombra discreta e tipografia de 16 px. Espaçamento entre nome, status, título, descrição e informações da loja foi refinado, sem mudar os valores dinâmicos.
- **Cardápio:** menor espaço antes do título e entre apresentação, filtros, busca e cards; título com escala responsiva. Pesquisa, categorias e estado `aria-pressed` continuam funcionando.
- **Contato:** menor padding vertical e título mais contido; informações em linhas no mobile e colunas em telas maiores. Quando a barra mobile de carrinho existe, o espaço inferior é reservado por seletor `:has`, dentro da variante, para evitar sobreposição do último link.

Todas as regras novas exigem `.ppp-customer-shell.ppp-forno-theme`. As classes novas do JSX são condicionais. As resoluções de conflitos continuam na camada de prioridade Forno já existente; não foi criado tema global, engine de temas ou configuração de backend nova.

## Capturas antes/depois

A referência “antes” é uma cópia do estado local **no início desta execução**, incluindo a consolidação anterior. Ambos os lados usam os mesmos dados fictícios, viewport e componentes reais. A main é outra referência independente, utilizada somente para regressão Pizza/Burger.

Galeria comparativa com seleção das cinco larguras — `/workspace/audit/pizza-refinement/comparativo-forno.html` (local) · comparação lado a lado em 390 px — `/workspace/audit/pizza-refinement/comparativo-forno-390.png` (local).

| Viewport | Antes | Depois | Área sem imagem, antes → depois |
|---|---|---|---|
| 320 px | captura — `/workspace/audit/pizza-refinement/before-forno-320.png` (local) | captura — `/workspace/audit/pizza-refinement/after-forno-320.png` (local) | 255 → 112 px |
| 375 px | captura — `/workspace/audit/pizza-refinement/before-forno-375.png` (local) | captura — `/workspace/audit/pizza-refinement/after-forno-375.png` (local) | 304 → 112 px |
| 390 px | captura — `/workspace/audit/pizza-refinement/before-forno-390.png` (local) | captura — `/workspace/audit/pizza-refinement/after-forno-390.png` (local) | 318 → 112 px |
| 768 px | captura — `/workspace/audit/pizza-refinement/before-forno-768.png` (local) | captura — `/workspace/audit/pizza-refinement/after-forno-768.png` (local) | 313 → 112 px |
| 1280 px | captura — `/workspace/audit/pizza-refinement/before-forno-1280.png` (local) | captura — `/workspace/audit/pizza-refinement/after-forno-1280.png` (local) | 317 → 144 px |

Valores arredondados. Em 390 px, a área vazia caiu aproximadamente **65%**, o preço passou de **14 para 18 px** e a área de contato caiu de aproximadamente **405 para 361 px**, mantendo suas informações. O nome manteve 21,6 px; seu destaque melhora pela composição mais compacta, cor e espaçamento, não por aumento da fonte.

Também foram capturadas dez páginas antes/depois com imagens SVG fictícias, em todas as larguras: sufixo `-images.png` no diretório de evidências. As dimensões da mídia, proporção, URL sintética, transformação e `object-fit` coincidiram nos cinco casos com imagem. Medições completas — `/workspace/audit/pizza-refinement/comparison-results.json` (local).

## Testes finais

Node **22.23.3**, dependências da execução anterior instaladas por `npm ci` com lock temporário capturado, sem modificar package.json ou lock do repositório. Build em cópia com env sintético e guard de rede. Harnesses em `127.0.0.1`, catálogo em React Query e RPCs substituídas por funções locais antes da montagem. O browser aborta solicitações externas; nenhuma operação de checkout foi enviada ao backend real. O client atual contém configuração remota fixa, portanto trocar apenas o env não seria isolamento suficiente.

| Verificação | Resultado |
|---|---|
| Build de produção | PASS, `npm run build` |
| Typecheck | PASS, `tsc --noEmit` |
| ESLint | PASS nos onze TS/TSX locais da consolidação, incluindo Storefront, único TSX refinado nesta etapa |
| CSS/formatação | PASS na formatação Prettier; CSS processado no build. O projeto não possui lint CSS dedicado neste procedimento |
| Antes/depois Forno | **10/10 PASS**: cinco larguras, sem/com imagem; mídia sem imagem reduzida, mídia com imagem preservada, preço ≥18 px, CTA ≥52 px, cabeçalho com alvos ≥44 px, sem overflow |
| Responsividade/teclado/admin | **21/21 PASS**: três temas em cinco larguras; CTA inteiro/clicável; rodapé do configurador no viewport; Tab/Shift+Tab; estilos/foco externos ao shell iguais à main |
| Regressão visual Pizza/Burger | **10/10 PASS**, PNGs byte a byte idênticos à main, com dados e condições iguais |
| Cardápio e teclado | **8/8 PASS**: ambas as categorias, CTA via Enter, filtro por categoria, `aria-pressed`, busca, resultado vazio, limpeza e alvos dos filtros ≥44 px |
| Fluxo completo com mocks | **16/16 PASS**: meio a meio, segundo sabor obrigatório, borda, adicional vinculado, acompanhante, quantidade, validação, checkout, tracking, append, Escape e restauração de foco |
| Casos adicionais | **31/31 PASS**: sete status, loja sem horários, mínimo/retirada, progresso e barra mobile do carrinho nas cinco larguras |
| Preservação estrutural | **21/21 PASS**: vinte funções/expressões AST equivalentes a HEAD e verificação dos diretórios/contratos protegidos |
| Adição direta SIMPLE | PASS, execução isolada do handler real; adição rápida também exercitada no append |
| Diff | PASS, `git diff --check` |

Evidências: checks e comandos — `/workspace/audit/pizza-refinement/final-checks.json` (local), build — `/workspace/audit/pizza-refinement/build.log` (local), responsividade — `/workspace/audit/pizza-refinement/browser-results.json` (local), regressão — `/workspace/audit/pizza-refinement/regression-results.json` (local), cardápio — `/workspace/audit/pizza-refinement/catalog-results.json` (local), fluxos — `/workspace/audit/pizza-refinement/flow-results.json` (local), casos adicionais — `/workspace/audit/pizza-refinement/edge-flow-results.json` (local), AST — `/workspace/audit/pizza-refinement/preservation-results.json` (local), hashes finais — `/workspace/audit/pizza-refinement/source-hashes.json` (local).

## Problemas encontrados e tratamento

1. **Filtros menores que 44 px:** a declaração normal de altura mínima perdia para a cascata legada. Corrigida na camada de prioridade, somente Forno; o teste de toque passou após a correção.
2. **Inicialização do harness:** a primeira tentativa encerrou os processos filhos ao finalizar o executor; os testes retornaram conexão recusada. Os servidores foram reiniciados com executor persistente, mantendo loopback e mocks. Não houve contato com produção.
3. **Uma captura Burger inválida:** ficou vazia durante recarga do harness, após alteração da fixture. Isso não foi classificado como regressão da aplicação. A evidência foi preservada, os arquivos foram estabilizados e a comparação completa repetida, resultando em dez imagens idênticas. O probe também passou a aguardar o card renderizado e falhar caso encontre diferença.
4. **Seletor inicial do probe de categorias:** encontrou o filtro e o card contendo a mesma categoria. O teste foi restringido ao grupo de filtros, sem alterar a aplicação.

## Limitações e pendências de PR

- Definir o `instance_slug` que receberá Forno; o mapa segue vazio, preservando opt-in. A ativação real não foi feita.
- Permanecem as pendências preexistentes: total do configurador sem incluir acompanhantes até a inclusão no carrinho e loader retornando horários vazios, condição que bloqueia checkout. Os testes positivos fornecem horários fictícios; não comprovam funcionamento com o catálogo remoto atual. Nenhum cálculo ou bloqueio foi contornado na aplicação.
- O build mantém os 56 avisos CSS legados e o aviso de bundle grande já documentados. Lint global não foi repetido; o PASS é dos arquivos indicados.
- Testes usam Chromium desktop com viewports simulados, sem fontes/fotos externas. Não cobrem aparelhos reais, teclado virtual, leitor de tela, certificação WCAG, pagamentos reais, concorrência ou navegação administrativa autenticada. O uso de `:has` para reservar espaço requer navegador moderno; validado em Chromium, pendente a revisão nos aparelhos suportados.
- Revisar imagens/identidade reais em ambiente autorizado, selecionar testes permanentes para o projeto/CI e revisar o diff completo da consolidação antes de criar a PR. Scripts, fixtures e capturas desta auditoria estão em `/workspace/audit/pizza-refinement/`, fora do repositório.

Recomenda-se futura PR **em draft**, com escopo visual explícito e estas limitações. Não foi criada PR nem iniciado trabalho de publicação. Commits, push, criação da PR e integração dependem de nova autorização.
