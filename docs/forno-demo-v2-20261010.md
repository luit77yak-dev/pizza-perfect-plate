# Neroxa Delivery — demonstração integrada V2

## Escopo e arquitetura

Branch local `feat/forno-visual-demo`, baseada no commit publicado `1294f3c04b4fb484d16b2d751e4f679908e291de`, PR #35 em draft. Esta etapa não cria commit, push ou deployment e não altera produção, Supabase, migrations, autenticação, domínio ou componentes das lojas reais.

Antes: `FornoPanelDemo` tinha pedidos, bairros e cartões de catálogo próprios; `VisualDemo` criava outro catálogo e um carrinho em memória. Grupos obrigatórios, bebidas com volumes e preços meio a meio não tinham contrato administrativo compartilhado. O cabeçalho aceita `logoUrl`, mas não o renderiza; a demo apresenta o logo no início do cardápio sem modificar esse componente compartilhado.

Agora: `data/model.ts` contém o contrato Zod estrito V2, fixtures iniciais, referências, precificação, snapshots e operações demonstrativas. `data/store.ts` coordena o estado do navegador; `catalog-adapter.ts` converte somente os campos necessários a Header/Hero. `catalog.ts` contém apenas defaults tipados, sem segundo catálogo duplicado. O configurador novo é exclusivo da demo e reutiliza o hook acessível de diálogos, tipos de carrinho e cálculo existente de pizzas meio a meio. Header, Hero e CartPanel são reutilizados sem alterações.

## Funcionalidades

- Produtos/pizzas/bebidas/combos: criar, editar, excluir, preço/descrição/imagem, categoria, ordem, disponibilidade e ativação.
- Categorias: criar/editar/excluir, ordenar e desativar. Exclusão exige mover os produtos primeiro.
- Grupos reutilizáveis por produto e/ou categoria: tamanhos/volumes, bordas, adicionais, sabores meio a meio e bebidas em combo; ativação, mínimo/máximo e opções gratuitas/pagas com nome, descrição e imagem. Mínimo zero é opcional; mínimo positivo é obrigatório. Sabores, bordas e tamanhos usam máximo um; adicionais/combos permitem vários itens distintos. Não há quantidade repetida da mesma opção.
- Tamanho/volume e borda usam **acréscimo** ao preço base. Sabores referenciam pizzas e usam maior metade, média ou preço fixo do produto principal sobre os preços base; os acréscimos selecionados do produto principal são aplicados à pizza inteira depois dessa regra. Não há personalização independente por metade nesta versão. Combo referencia bebida e volume, usando o preço atual da bebida mais acréscimo do volume; o campo de preço da opção é ignorado e explicado no formulário. Sem volume, usa o preço base da bebida. Exclusão de produtos/grupos/volumes limpa referências relacionadas; nenhuma associação por nome é presumida.
- Loja: nome, descrição, contato e endereço fictícios, logo, sete horários, aberto/fechado manual, entrega/retirada, bairros e taxas compartilhados.
- Aparência: cores, logo e banner locais, prévia, restauração da identidade inicial Forno. Validação de contraste mínimo 4,5:1 para texto/destaque em fundo/superfície. Não representa certificação completa WCAG de todas as combinações.
- Pedidos/clientes: pesquisa de nomes fictícios e histórico derivado dos pedidos, filtros e expansão, transições de entrega/retirada, inclusão antes da saída, destaque e ciência. Os valores já pagos ficam separados dos adicionais pendentes.
- Carrinho da aba e checkout **simulado**: confirmação cria apenas pedido fictício no armazenamento deste navegador, sem pagamento ou solicitação HTTP; o painel recebe o pedido e o acompanhamento da loja reflete os estados locais. Nome do visitante é fixo e fictício; não há coleta de dados reais.
- Central de notificações: contador, leitura individual/em lote, dispensa individual, limpar, deduplicação por chave, limite de 20, expiração de 24 horas e som opcional desligado por padrão. Avisos não ficam empilhados sobre todas as telas.
- Cabeçalho mobile em uma linha, alvos de toque preservados, menu lateral com foco contido/Escape/fundo inerte. Estilos adicionais restritos a `.forno-panel` ou `.ppp-customer-shell.ppp-visual-demo`.

## Persistência, validação e isolamento

Chave exclusiva: `neroxa:visual-demo:forno:v2`. Schema estrito inclui versão, geração de reset e revisão; valida tipos, limites, dinheiro finito não negativo com duas casas, referências, unicidade, dias, cores, imagens e pagamentos. Dados inválidos, JSON quebrado, versões desconhecidas ou conteúdo excessivo recuperam os dados iniciais com aviso. Não lê carrinhos, pedidos ou sessões reais do navegador. Reset troca a geração e invalida carrinhos abertos.

localStorage mantém **somente dados fictícios**. `storage` sincroniza abas da mesma origem. Cada transação relê o estado persistido disponível antes de aplicar a alteração, reduzindo sobrescrita de estado desatualizado. Não há locking/merge distribuído: escritas exatamente simultâneas seguem a última gravação e podem perder uma alteração. Essa é uma limitação explícita da demonstração, não uma solução de concorrência para o Delivery Engine.

Armazenamento negado ou sem quota usa memória da aba e avisa que persistência/sincronização não estão garantidas. Limites: 100 produtos, 30 categorias, 50 grupos, 50 opções/grupo, 50 bairros, 200 pedidos, 20 notificações, 200 KB por imagem e aproximadamente 2,2 milhões de caracteres no documento serializado. Imagens são somente data URLs raster locais PNG/JPEG/WebP: URLs remotas e SVG são rejeitados. Nunca incluir dados pessoais reais no armazenamento.

O carrinho mantém snapshots dos preços e seleções. Qualquer alteração de catálogo (inclusive desativação, exclusão ou reset) impede confirmação do carrinho antigo e orienta limpar/refazer; não recalcula nem cobra silenciosamente. Alterações de aparência/contato não reprecificam itens. Taxas são lidas da configuração local na confirmação simulada; pedidos anteriores mantêm seu snapshot.

SSR recebe sempre fixtures iniciais estáveis; localStorage só é lido após montagem. O store não aceita mutações sem browser e prontidão, e não cria persistência de visitantes no servidor. A proteção server-side existente continua negando produção/runtime desconhecido e headers falsificados. Esta etapa não altera proteção ou variáveis da Vercel; o preview publicado anteriormente não contém a V2.

## Validação

Build em arquivo isolado do HEAD mais alterações locais, preset Vercel Node 24, `.env` sintético e bloqueio de rede externa. Nenhum build/teste foi executado com credenciais de produção. Browser Chromium executa o artefato Node da Vercel em loopback, bloqueia origens externas e instrumenta fetch do servidor. Fontes Google preexistentes são bloqueadas; nenhuma nova dependência de rede foi introduzida.

Resultados finais e capturas: `/workspace/audit/forno-v2/`. Suite de domínio: `node tests/visual-demo-v2.test.mjs`; gate: `node tests/visual-demo.test.mjs`. Browser exige Playwright/Chromium externos ao pacote e o argumento de diretório local `.vercel/output`; não aceita URL hospedada. Regressão: `tests/forno-panel.browser.test.mjs`; integração V2: `tests/visual-demo-v2.browser.test.mjs`.

As rodadas intermediárias identificaram nomes acessíveis instáveis em selects/textareas e ausência de logo no cabeçalho compartilhado; os problemas foram corrigidos no escopo da demo e as suites foram reexecutadas após as correções. Lint global possui dívida previamente documentada; esta etapa verifica os arquivos alterados e não reformata áreas externas.

## Arquivos

Alterados nesta etapa: `FornoPanelDemo.tsx`, `VisualDemo.tsx`, `catalog.ts`, `src/routes/visual-demo.tsx`, `tests/forno-panel.browser.test.mjs`.

Novos: `DemoManagement.tsx`, `DemoConfigurator.tsx`, `demo-v2.css`, `data/model.ts`, `data/store.ts`, `data/catalog-adapter.ts`, `tests/visual-demo-v2.test.mjs`, `tests/visual-demo-v2.browser.test.mjs`, este relatório. Os arquivos de componentes/dados estão em `src/features/visual-demo/`.

Os ajustes anteriores em `visual-demo.css` e `docs/visual-demo-20261010.md` foram preservados, sem novas edições nesta etapa.

## Limitações e integração futura

- Dados administrativos e pedidos são demonstrativos; não há segurança transacional, autenticação de operador, inventário, conciliação ou gateway. Horários são informativos; a chave manual aberto/fechado governa a demo. Não promete agendamento automático/fusos.
- Rascunhos de formulários já abertos não são sobrescritos por mudanças de outra aba; o estado salvo e o cardápio sincronizam. Uma edição posterior pode substituir a edição anterior do mesmo objeto.
- A próxima integração real exige adapter autorizado por organização/instância, contratos definitivos de grupos, preços canônicos no servidor, validação de status/actor, idempotência, concorrência, auditoria e pagamentos segregados. Nunca reutilizar confiança nos preços/localStorage desta demo como autorização de pedidos reais.
- Testes visuais locais não equivalem a validação hospedada, leitor de tela ou audição física em celular. Publicação e verificação do preview dependem de nova autorização.

## Checks finais registrados

- TypeScript: passou (`tsc --noEmit`).
- ESLint dos arquivos TS/TSX e testes modificados: passou. CSS/arquivos selecionados passaram na checagem de Prettier. `git diff --check`: passou.
- Gate server-side: 9 asserções passaram.
- Domínio e segurança V2: 61 verificações passaram (CRUD/referências, preços, meio a meio, volumes/combos, limites/ativação, snapshots e checkout, recuperação, IDs reservados, contraste e notificações).
- Regressão do painel: 230 verificações passaram no artefato final, em 320, 390, 430, 768 e 1280 px.
- Build Vercel local final: passou em Node 24.19.0, sem credenciais reais ou fetch externo. Avisos preexistentes de CSS/chunks permanecem.
- Integração V2 final: **104 verificações passaram**, em `browser-final/results.json`: CRUD de produtos/imagens/preços/categorias/bebidas, adicionais reutilizáveis e limites, combos/volumes, loja/cores/logo/banner, taxa de entrega, checkout e tracking locais, clientes, notificações, reload, duas abas, reset, dados inválidos, armazenamento bloqueado, contexto separado e SSR/hidratação. Telas 320, 375, 390 e 430 px sem overflow; cabeçalho até 90 px. **Zero fetch de backend no servidor, nenhum POST/RPC/auth no navegador e zero erros de JavaScript/hidratação.**

As capturas intermediárias aprovadas em `browser/panel-390.png` e `browser/store-390.png` foram inspecionadas: linguagem visual Forno preservada e cabeçalho do painel compacto. Capturas finais ficam em `browser-final/`. As capturas de antes do painel estão em `/workspace/audit/forno-panel/final/browser/`.

Capturas finais inspecionadas: [painel 320 px](/workspace/audit/forno-v2/browser-final/panel-320.png), [painel 390 px](/workspace/audit/forno-v2/browser-final/panel-390.png), [loja 390 px](/workspace/audit/forno-v2/browser-final/store-390.png). Executor: Node 24.19.0, Chromium 151.0.7922.173 (Debian 13). Não há validação hospedada da V2 nem publicação nesta etapa.

Estado final: HEAD continua `1294f3c04b4fb484d16b2d751e4f679908e291de`; alterações V2 permanecem locais e não staged. Nenhum comando de commit, push, merge, deployment, SQL ou alteração remota foi executado.

## Revalidação para publicação autorizada — 2026-10-10

Selecionados exclusivamente os 14 arquivos V2 descritos acima. Os diffs anteriores de `visual-demo.css` e `docs/visual-demo-20261010.md` permaneceram fora do index. Revisão do escopo e busca de padrões de credenciais não encontraram segredos, dados reais ou mudanças em Supabase, migrations, autenticação, configurações ou regras dos fluxos reais. PR #35 permanece draft, com base `feat/delivery-visual-consolidation`.

Revalidação passou: TypeScript, ESLint dos arquivos alterados, Prettier, `git diff --check`, 9 asserções do gate, 61 verificações de domínio, 230 verificações de regressão do painel e 104 verificações de integração V2. O build Vercel/Node 24.19.0 foi reconstruído a partir de HEAD mais somente os arquivos selecionados, sem o diff anterior de CSS, usando variáveis sintéticas e bloqueio de fetch externo. Browser validou SSR/hidratação, mobile 320/375/390/430 px, sincronização, recuperação, checkout/tracking fictícios e ausência de operações reais. Evidências desta rodada: `/workspace/audit/forno-v2-publish/`.

A publicação autorizada será feita exclusivamente para `feat/forno-visual-demo`, via integração Git/Preview existente, sem merge ou alterações em produção. A validação hospedada e o SHA serão informados ao término; os checks acima são locais e não antecipam a aprovação do preview.
