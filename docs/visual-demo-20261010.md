# Forno di Pietra — demonstração visual local

Branch `feat/forno-visual-demo`, criada no worktree `/workspace/pizza-visual-demo` a partir de `feat/delivery-visual-consolidation`, commit `5d16b0682f2bdb374d1c8109f1d5ac2cf454053a` da PR #34. Nenhum commit ou operação remota foi realizado. O trabalho não commitado em `feat/authorized-preview-demo` permanece no diretório original.

## Implementação e arquivos

- `src/routes/visual-demo.tsx`: rota `/visual-demo`, gate server-side também em `beforeLoad` para navegação interna, título e `noindex`.
- `src/server.ts`: HTTP 404 antecipado para a rota bloqueada, inclusive com barra final; resposta sem cache.
- `src/features/visual-demo/access.ts`: autorização por ambiente do servidor; permite desenvolvimento local sem metadados Vercel ou `VERCEL_ENV=preview` compatível. Produção, metadados conflitantes e ambiente ausente/desconhecido são negados. Hostnames, headers e variáveis públicas não autorizam.
- `src/features/visual-demo/catalog.ts`: catálogo exclusivamente fictício, pizzas, bebida, tamanho, borda e adicional; nenhum método de pagamento configurado.
- `src/features/visual-demo/VisualDemo.tsx`: reutiliza Header, Hero, ProductConfigurator, CartPanel e cálculos existentes. Carrinho em memória por montagem da página; não lê nem grava armazenamento das lojas reais. Aviso persistente; checkout desabilitado e callback inerte. Sem tracking, autenticação, pedidos ou pagamentos.
- `src/features/visual-demo/visual-demo.css`: ajustes exclusivos de `.ppp-visual-demo` para acomodar o aviso sem cobrir a navegação/overlays; mantém a variante Forno existente.
- `src/routeTree.gen.ts`: registro gerado da nova rota.
- `tests/visual-demo.test.mjs`: testes negativos/positivos do gate.
- Este relatório.

A resolução por domínio, loaders reais, componentes compartilhados, temas Pizza/Burger, backend, migrations, RPCs e regras de negócio permanecem sem alterações em relação à branch de origem. Isso é confirmado pelo diff; não houve teste com lojas ou dados reais.

## Validação

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — passou.
- Build: `npm run build`, preset Vercel, Node 24.19.0, artefato `nodejs24.x` — passou; execução em cópia isolada com configurações Supabase sintéticas e bloqueio de rede externa.
- ESLint dos arquivos TS/TSX alterados e teste — passou; `git diff --check` — passou.
- `node tests/visual-demo.test.mjs`: 9 asserções do gate aprovadas, incluindo produção, ausência/conflito de metadados e tentativa de autorização por hostname/header.
- Playwright/Chromium, 390 × 844: SSR/hidratação, aviso, placeholders compactos, ausência de overflow horizontal, personalização, carrinho, checkout desabilitado, Escape, isolamento entre abas e armazenamento real ignorado. Nenhuma tentativa externa no harness dos componentes e nenhum módulo de backend carregado nesse harness.
- Artefato efetivo Vercel executado localmente: produção retorna 404 em `/visual-demo` e `/visual-demo/` apesar de headers falsificados; preview sintético retorna SSR 200 com catálogo fictício, sem fetch externo no servidor.
- Browser sobre o artefato Vercel local: SSR/hidratação, configurador e carrinho funcionaram; zero chamadas Supabase, RPC, auth ou pagamentos; sem erros JavaScript. A folha Google Fonts já existente no root foi interceptada/bloqueada, sem alterar a configuração compartilhada.

Evidências locais em `/workspace/audit/pizza-visual-demo/`: `checks.json`, `build-vercel.log`, `browser-results.json`, `runtime-results.json`, `full-route-results.json`, scripts de harness e capturas `forno-390.png`, `configurator-390.png`, `cart-390.png`. Não foram adicionados artefatos de build ou credenciais ao worktree.

## Limitações e pendências

- Nenhum deployment foi criado ou acessado; metadados Preview/Production foram simulados localmente. Validar posteriormente no ambiente hospedado, somente com autorização.
- Esta rota visual não implementa autenticação de visitantes/allowlist de deployments da outra iniciativa de demo autorizada. Qualquer preview Vercel compatível pode exibi-la; produção permanece bloqueada. Uma restrição adicional de visitantes precisará do gate autorizado antes de publicação com esse requisito.
- Carrinho é deliberadamente descartado ao recarregar. Checkout aparece indisponível pelo estado fechado do componente existente; não existe checkout simulado nesta rota.
- Catálogo pequeno e fictício; não é teste de backend nem certificação completa de todos os temas, dispositivos ou acessibilidade.
- Fontes externas já existentes no root não foram removidas; o requisito de isolamento refere-se às operações de Supabase/RPC/pagamento. Capturas locais usam fontes disponíveis/fallback.
- Build apresenta avisos preexistentes de CSS/chunks. Não foram feitas refatorações para tratá-los.

Resultado: implementação local concluída. PR #34 e branches existentes preservadas. Nenhum commit, push, PR, merge, deployment, SQL ou alteração em produção.
