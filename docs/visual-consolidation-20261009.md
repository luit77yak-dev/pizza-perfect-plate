# Consolidação visual do Pizza Perfect Plate

> Nota de publicação: este relatório registra a execução local anterior à autorização de commit/push/PR. As indicações de “sem commits” e “nova autorização” descrevem aquela etapa. Artefatos em `/workspace/audit/` são referências locais, não arquivos incluídos na PR; os resultados e limites estão resumidos neste documento.

2026-10-09 · branch local `feat/delivery-visual-consolidation` · sem commits.

A consolidação seletiva foi implementada sobre a `main` atual, preservando o motor existente. Forno di Pietra é uma variante **opt-in**, sem substituir Pizza/Burger. Os checks e fluxos simulados descritos abaixo passaram. Ainda não há aprovação de integração, produção ou acessibilidade integral.

## Base e limites de execução

As referências remotas foram atualizadas. `main`, `origin/main` e HEAD da nova branch apontam para `bff5bee289cd4e911a5be012cb7b8731e48e82fd`, a mesma revisão da auditoria. A #31 contém a #30; não houve reaplicação do premium patch, cherry-pick ou cópia integral dos arquivos antigos. Referência: RELATORIO.md — `/workspace/audit/pizza-pr30-31/RELATORIO.md` (local).

Os dois servidores temporários de UI foram encerrados ao final; dependências temporárias e evidências foram mantidas para revisão/reprodução. Nenhum commit, push, merge, deployment, SQL, acesso a dados reais ou alteração de PR foi realizado. As branches existentes foram preservadas. Neroxa Master não foi editado. Build e testes usaram dependências e cópias temporárias, credenciais fictícias, servidores em `127.0.0.1` e bloqueio de rede externa durante a execução da aplicação.

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/components/storefront/Storefront.tsx` | Seleção opt-in da aparência; cards com nome explícito; textos Forno; barra mobile de carrinho condicionada ao estado; hooks semânticos dos overlays |
| `src/components/storefront/StorefrontHeader.tsx` | Identidade do estabelecimento e navegação mobile Forno com início, cardápio e carrinho |
| `src/components/storefront/StorefrontHero.tsx` | Composição exclusiva Forno, com CTA sem contêiner legado de altura fixa; informações obtidas das configurações atuais |
| `src/components/storefront/StorefrontAbout.tsx` | Conteúdo Forno baseado no nome e descrição da loja; branches Pizza/Burger preservadas |
| `src/components/storefront/StorefrontContact.tsx` | Contato Forno com dados existentes; remove textos Pizza Club dessa variante |
| `src/components/storefront/TrackedOrderPanel.tsx` | Teclado/foco, hooks visuais, etapa atual com `aria-current` |
| `src/features/cart/components/CartPanel.tsx` | Teclado/foco, superfície/rodapé semânticos e progresso visual do mínimo, exibido somente em Forno |
| `src/features/storefront/components/CheckoutPanel.tsx` | Dialog identificado, teclado/foco, superfície semântica e erros com `role=alert` |
| `src/features/storefront/components/ProductConfigurator.tsx` | Teclado/foco, etapas identificadas e rodapé legível; handlers e cálculo preservados |
| `src/features/storefront/appearance.ts` — novo | Única seleção de variante por `instance_slug`, além de prop explícita; Burger mantém precedência |
| `src/features/storefront/hooks/use-customer-dialog.ts` — novo | Foco inicial, Tab/Shift+Tab, Escape e restauração para elementos ainda conectados; considera o overlay superior |
| `src/styles/forno.css` — novo | Tokens e estilos exclusivos Forno; resoluções localizadas de conflitos com CSS legado |
| `src/styles.css` | Import da variante e declaração da camada de prioridade; CSS existente preservado |
| `docs/visual-consolidation-20261009.md` — novo | Este relatório |

Os TSX editados foram formatados com Prettier para passar no lint por arquivo. Parte do diff é formatação. Isso não representa substituição pela versão antiga: a comparação estrutural das funções e expressões críticas com HEAD passou.

## Decisões visuais e de isolamento

A variante tem paleta verde profundo, creme e dourado, cards com nome/preço, foco visível, informações da loja, configurador/carrinho/checkout/acompanhamento coerentes e barra mobile de carrinho. Nome, descrição, CTA, valores e formas de recebimento continuam vindo do modelo atual.

O novo hero usa classes próprias e um fluxo de altura natural. A navegação mobile recebe uma resolução explícita do `display:none!important` legado. Os botões do rodapé podem envolver o texto, sem truncar o CTA. A barra do carrinho fica oculta enquanto os overlays estão abertos, respeita safe-area e tem espaço reservado no conteúdo. A hierarquia Forno dos overlays não depende de repetir classes para aumentar especificidade.

A camada `forno`, declarada antes das camadas legadas, contém somente resoluções `!important` necessárias. O restante da apresentação fica fora dessa camada. Não foram copiados os remendos CSS duplicados da #31 nem seus seletores globais de foco. As regras novas exigem `.ppp-customer-shell.ppp-forno-theme`; a única exceção é esconder o novo progresso `.forno-minimum-progress` nos outros temas, dentro do shell. Não se altera o foco base já existente no painel administrativo.

A seleção é deliberadamente simples: `storefrontAppearances[instance_slug] = "forno"`. O slug vem de `context.instance_slug`, via loader atual; não se altera resolução por domínio. O mapa está vazio porque nenhum estabelecimento foi identificado/autorizado para ativação. A prop `appearance="forno"` foi usada no harness local. Sem configuração, Pizza/Burger mantêm a seleção atual. Não foi criado registry complexo, schema de temas ou requisito de backend novo.

## Preservação funcional comprovada

O client do storefront externo, integração Supabase, loader, domínio, tipos, preços, RPCs SQL, migrations, payloads e código administrativo não foram modificados. Manifestos de dependências e `bun.lock` também ficaram intactos.

A comparação por AST com HEAD verificou 20 funções/expressões de adição rápida/direta, quantidade de complemento, preços, adicionais vinculados, acompanhantes, criação/acréscimo de pedido e elegibilidade de tracking. As árvores equivalem apesar da formatação. A seleção de acompanhantes do configurador mantém SIMPLE **e** categoria permitida, com exclusão de adicionais. O handler de produto simples mantém inclusão direta, sem configurador.

O fluxo simulado verificou pizza meio a meio, bloqueio sem segundo sabor, borda, adicional vinculado, bebida acompanhante, atualização de quantidade, validação de checkout, retirada, tracking e acréscimo ao pedido. Os argumentos observados foram os contratos atuais `create_public_order({p_order})`, `get_public_order_status({p_order_id,p_customer_phone})` e `append_public_order_items_with_payment({p_order_id,p_customer_phone,p_items,p_payment_method})`.

## Validação e evidências

| Verificação | Resultado e alcance |
|---|---|
| Dependências | Node **22.23.3**, Vite **8.1.5**; `npm ci --ignore-scripts --no-audit --no-fund` em diretório temporário, com lock capturado |
| Build de produção | PASS, `npm run build`, em cópia sem env real e com bloqueio de rede |
| Lint alterados | PASS, ESLint nos nove TSX editados e dois TS novos |
| Typecheck | PASS, `tsc --noEmit`, tanto na main de comparação quanto na implementação |
| Responsividade/teclado/admin | **21/21 PASS**: Forno/Pizza/Burger em 320, 375, 390, 768 e 1280 px; sem overflow horizontal; CTA Forno inteiro e clicável; rodapé do configurador no viewport; botões ≥44 px e sem truncamento; Tab/Shift+Tab circulares; foco administrativo fora do shell igual ao baseline |
| Regressão visual Pizza/Burger | **10/10 PASS**: PNGs byte a byte idênticos ao baseline com os mesmos dados e cinco larguras |
| Fluxo completo simulado | **16/16 PASS**: checkout inválido sem RPC, preços/payload, tracking, append, retorno por Escape, carrinho limpo após sucesso e restauração de foco |
| Casos adicionais | **31/31 PASS**: sete status de tracking, fechamento da loja sem horários, mínimo de entrega, retirada abaixo do mínimo, progresso de 80%, barra de carrinho responsiva e oculta no overlay |
| Preservação estrutural | **21/21 PASS**: 20 árvores AST equivalentes e verificação dos diretórios/contratos protegidos |
| Adição direta SIMPLE | PASS: execução isolada do handler real extraído por AST, payload intacto e abertura do carrinho; adição rápida SIMPLE também exercitada pelo fluxo de append |
| Whitespace do diff | PASS, `git diff --check` |

Evidências fora da árvore do aplicativo:

- Checks finais e comandos — `/workspace/audit/pizza-consolidation/final-checks.json` (local), build — `/workspace/audit/pizza-consolidation/build.log` (local), lint — `/workspace/audit/pizza-consolidation/lint-changed.log` (local), typecheck — `/workspace/audit/pizza-consolidation/typecheck-current.log` (local).
- Responsividade/teclado/admin — `/workspace/audit/pizza-consolidation/browser-results.json` (local), comparação de imagens — `/workspace/audit/pizza-consolidation/regression-results.json` (local), fluxos — `/workspace/audit/pizza-consolidation/flow-results.json` (local), casos adicionais — `/workspace/audit/pizza-consolidation/edge-flow-results.json` (local).
- Payloads fictícios observados — `/workspace/audit/pizza-consolidation/flow-calls.json` (local), preservação AST — `/workspace/audit/pizza-consolidation/preservation-results.json` (local), SIMPLE — `/workspace/audit/pizza-consolidation/direct-add-results.json` (local), hashes do código testado — `/workspace/audit/pizza-consolidation/source-hashes.json` (local).
- Forno mobile — `/workspace/audit/pizza-consolidation/forno-390.png` (local), configurador — `/workspace/audit/pizza-consolidation/forno-configurator-390.png` (local), carrinho — `/workspace/audit/pizza-consolidation/forno-cart.png` (local), checkout — `/workspace/audit/pizza-consolidation/forno-checkout.png` (local), tracking — `/workspace/audit/pizza-consolidation/forno-tracking.png` (local).

Os scripts `responsive.cjs`, `regression.cjs`, `flows.cjs`, `edge-flows.cjs`, `preservation.cjs`, `direct-add.cjs`, o harness e o guard de rede estão em `/workspace/audit/pizza-consolidation/`. O harness monta os componentes reais com React Query alimentado por catálogo fictício e substitui RPCs por funções locais antes da montagem; o Chromium aborta solicitações fora de loopback. O client atual é importado e contém configuração remota fixa: mudar apenas o env não bastaria para isolar os testes. O bloqueio de rede e a substituição das RPCs são indispensáveis. A comparação da main usa uma cópia extraída por `git archive HEAD`, sem alterar a branch original. O replay desses scripts requer Playwright/Chromium e os servidores temporários nos ports 59123/59124; não executar o app normal com env real para reproduzir estes testes.

O repositório possui lock Bun. Para a execução em Node 22, o lock npm temporário da auditoria anterior precisou ser reparado por `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, antes do `npm ci`. Lock efetivamente utilizado — `/workspace/audit/pizza-consolidation/audit-package-lock.json` (local). Não se afirma equivalência com uma instalação Bun; nenhuma migração do gerenciador de pacotes foi feita.

## Pendências e limitações

1. **Ativação da identidade:** definir o `instance_slug` que receberá Forno. A variante não está aplicada globalmente nem a qualquer loja real.
2. **Total exibido no configurador, preexistente:** na fixture, a pizza meio a meio 60 + borda 5 + adicional 3 aparece como 68 no configurador; ao adicionar a bebida 8, o carrinho mostra 76. A inclusão da bebida ocorre em `addToCart`, preservado por AST. A divergência de apresentação deve ter uma decisão e correção próprias, sem alterar a regra de preço inadvertidamente.
3. **Horários no loader, preexistente:** `load-store.ts` retorna `hours: []` e `specialHours: []`; `getStoreStatus` considera ausência de horários como loja fechada. O teste negativo confirmou bloqueio de checkout nessa condição. Os fluxos positivos forneceram horários fictícios diretamente no cache para exercitar os componentes; isso não comprova checkout operacional com o catálogo remoto atual. Investigar o contrato de horários separadamente, sem contornar o bloqueio na UI.
4. **CSS legado:** build continua com os mesmos **56 avisos de otimização CSS** encontrados no build anterior da main, incluindo seletores Burger inválidos, além de aviso de bundle >500 kB. Não foram limpos neste trabalho para evitar mudar os temas preservados. Lint global não foi repetido; a auditoria anterior já documenta falhas gerais da main. O PASS desta execução é dos arquivos alterados.
5. **Cobertura:** testes de componentes e fluxos usam Chromium desktop com viewports simulados, catálogo/RPCs fictícios e sem fontes/fotos externas. Não cobrem iOS/Android reais, teclado virtual, leitor de tela, pagamento real, concorrência, persistência de backend, isolamento SQL ou navegação autenticada do painel. O painel foi protegido por ausência de alterações e comparação de estilos/foco, sem acesso administrativo real. Não há certificação WCAG integral.
6. **Harness de auditoria:** evidências e scripts estão fora do repositório; antes da futura PR, decidir quais fixtures/testes tornar permanentes no projeto/CI, sem enviar o lock temporário automaticamente.

## Recomendação

Recomenda-se uma **nova PR em draft** a partir desta branch, depois de revisão do diff e definição explícita da ativação de Forno. Não integrar as branches antigas nem reaplicar a #30. A PR deve delimitar a mudança visual e os resultados locais, apontar as pendências preexistentes e incluir testes permanentes selecionados. Publicação da branch, commits e criação da PR dependem de nova autorização. Este trabalho não autoriza merge/deploy e não declara o delivery pronto para produção.
