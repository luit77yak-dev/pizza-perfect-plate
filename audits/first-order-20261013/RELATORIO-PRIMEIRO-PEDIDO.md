# Primeiro Pedido Completo — homologação isolada

2026-10-13. **Fluxo funcional de entrega, painel Auth e acompanhamento comprovado em ambiente descartável. Produção permanece NO-GO.** Ver decisão separada em DECISAO-PRIMEIRO-PEDIDO.md; não confundir painel mínimo e prova limitada de recuperação com certificação comercial.

## Proveniência e ambiente

Heads H03/H04 verificados antes das alterações: Masterf5d8eaa371b8cd92b2ed965326f34e15ba87007f e Delivery55a701fccbadc1687924456df563ef976806ddc7. Ancestrais runtime e338e4e/6f5b37e preservados. Novas branches em ambos: audit/first-complete-order-20261013. Auto-deploy dessa branch desabilitado em vercel.json antes do primeiro push.

PRs originais: Master37 DRAFT229059e; Delivery36 DRAFTafb26bc e37 DRAFTe8bd746. Main, branches de referência e PRs visuais não modificadas. Não criada PR nova, não realizado merge/deploy/SQL remoto; sem dados ou credenciais de produção.

Runner Linux GitHub Actions público descartável, CLI2.120.0, PostgreSQL17.11 (imagem17.11.0.004), GoTrue2.197.0, PostgREST16.4, Kong2.8.1 e Node22.23.3. Playwright1.58.2 usa Google Chrome do runner; versão exata Chrome não foi registrada. Local: Node24.19.0. Celular físico não usado.

Schema histórico completo candidato do Master, conforme captura2026-10-09 e candidatos anteriores, reconstruído na ordem dos scripts run.mjs/restore_security.mjs. Não é fixture mínima nem comprovação do schema atual remoto. Fixtures A1/A2 da organização A e B1 de organização B. Domínios a/b/c.ab.invalid somente no hosts do runner e transporte localhost HTTPS. Configurações/endereço/áreas/preços/timezones por loja, sem cadastro real. Auth/PGRST reais e gateway exclusivamente localhost.

Interceptação de browser permite somente frontend e API descartável. Demais origens abortadas; fontes Google aparecem como bloqueadas. Emissão de tokens, senhas fictícias, perfis browser e dumps ficam em arquivos privados/contêineres, excluídos de artifacts. Cleanup de recursos próprios é passo obrigatório do workflow.

## Fluxo principal sem intervenção técnica do cliente

1. Cliente abre domínio A1, catálogo retornado pelo PostgreSQL e escolhe Pizza H03a inteira: Grande+5, Recheada+2, adicional obrigatório Pago H03+2 e opcional pago+3, sobre base30.
2. Sacola é aberta e quantidade alterada para2. Unidade42, subtotal84.
3. Entrega: Cliente Entrega fictício, telefone00000000002, Rua Entrega fictícia100, Bairro Entrega0. Todos explicitamente fictícios. Taxa inicialmente4.
4. Proprietário A1 com JWT real muda a taxa para7 via PostgREST. Confirmação stale rejeitada PRICE_CHANGED, sem pedido. Cliente revisa e vê91 antes de consentir de novo.
5. Nova confirmação cria uma única ordem, retorna snapshot e abre tracking automaticamente. SQL compara instância, subtotal84, taxa7, total91, rua/número/bairro, item quantidade2/unidade42 e selection_snapshot.version2/contractGROUP_ADDONS_V1. HTTP200 sozinho não é usado como prova.
6. Proprietário faz login real em /admin/pedidos, vê cliente, endereço, itens, tamanho/borda/adicionais e valores. O painel é componente existente aperfeiçoado, não mock.
7. Tentativa de saltar direto a DELIVERED é rejeitada pelo banco; status/histórico intactos. Pelo GUI, confirma, prepara, marca pronto, sai para entrega e conclui. Cliente vê cada estado no tracking, incluindo DELIVERED mantido em memória. SQL confirma todos os estados e cinco eventos novos. Repetição do final não duplica histórico.

Não há intervenção técnica, injeção de pedido fake, progresso automático de status ou pagamento real nesse fluxo. Setup da fixture e mudança de taxa são operações de teste declaradas; checkout/painel/tracking são os componentes reais.

## Painel e autorização

Route moderna /admin/pedidos já possuía login e get_admin_orders por instância. Mantida seleção explícita por UUID/contexto do domínio; não introduzida concessão baseada somente na organização. A RPC é autoridade do acesso, não a seleção visual.

Novo get_admin_order_detail(uuid,uuid), authenticated-only, exige auth.uid e consulta autorizada existente antes de devolver ordem, itens/snapshots e histórico. No navegador: instância e pedido da resposta precisam corresponder; sequências invalidam respostas atrasadas. Status também valida sequência/busy e o vínculo retornado.

A1 com resposta segurada real → seleção A2 → resposta A1 liberada: A1 não reaparece. HTTP503 de lista é falha de transporte injetada, remove dados antigos. Não se apresenta isso como desligamento físico do banco. Owner A2, Owner B1 e outsider autenticam-se pelo GUI: detalhe A1=null, mudança e fencing rejeitados42501, estado A1 permanece DELIVERED. Logout limpa dados; loading/busy/senha são resetados. Expiração real nativa também remove a sessão operacional.

/painel legado usa organização e nomes de entidades diferentes; foi inspecionado e preservado, não homologado como seguro para duas lojas. SupplierPanel/ledger não foram importados. Interface atual é **mínimo operacional de pedidos**, sem novo CRUD completo/provisionamento/MFA UI.

## Recuperação e fencing

Preservados H04, hash integral, key scoped, Web Locks, privacy e retry. A regressão real reexecuta timeout antes de gravação, resposta perdida depois do commit, reabertura do browser, duas abas e clique duplo, conservando uma chave e um pedido.

Marcador adicional de pendência na memória/cookie: nenhum nome/telefone/endereço/token de append, somente negação. localStorage.clear não permite nova chave enquanto marcador existe; após reload com cookie preservado, repetição também é bloqueada. Teste compara POSTs e contagem, sem restaurar cofre artificialmente para liberar o fluxo principal.

Reconciliação authenticated-only por OWNER/ADMIN/MANAGER com grant da instância, ou plataforma ADMIN/SUPER_ADMIN AAL2. auth.uid determina actor, não parâmetro do browser. Mesmo advisory lock do checkout: pedido existente→CONFIRMED; chave sem ordem→fence permanente FENCED_ABSENT. Create verifica fence sob lock; late request não cria ordem. Corrida real aceita exatamente as duas ordens legais: create vence e existe uma ordem, ou fence vence e existe zero. Audit privado guarda instância/key/actor/outcome/tempo. Nenhum direito de append/pagamento é criado.

**Perda completa de todas as identidades continua não solucionada.** Cookie não é autorização nem proteção universal; outro perfil/dispositivo pode ser indistinguível de visitante novo. Sem chave original/prova, UNKNOWN e repetição não liberada operacionalmente. Não apagar intenção, deduzir falha por telefone ou criar chave nova como solução. Estabelecer identidade durável/reconciliação operacional antes de release comercial.

## Restore populado

[Workflow38446304492](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38446304492):202 checks,93 tabelas e97 FKs. Produto GROUP novo e pedido DELIVERY real por RPC, Grande/borda/adicional/qty2, subtotal80+taxa do banco, intenção/hash/lease e confirmação Auth antes do dump. Destino tem Auth/PGRST próprios, compara definições e dados e reenvia mesma key sem duplicar. Operador A2 não lê detalhes A1. Relatório dedicado e JSON de evidência anexados.

Origem/destino compartilham cluster e roles globais. Não prova DR independente, PITR, backup remoto ou recuperação de toda infraestrutura. Fontee8884e3; SQLs/scripts restore não mudaram nos commits posteriores.

## Código e commits

Master: candidatos operational-order-detail, operational-order-transitions e checkout-reconciliation em audits/sql, fora das migrations automáticas. Preflight de corpo esperado antes de substituir RPCs; search_path e ACL seguros nos helpers novos. Não modificados defaults/roles gerenciados supabase_admin. Grafo sequencial é proposta candidata explícita, não decisão comercial implantada. run/restore_security/h03_h04 atualizados; first_order_browser/security são scripts de teste, não storefront dentro do Master.

Delivery: src/routes/admin/pedidos.tsx (itens/auth/races/loading), src/components/storefront/Storefront.tsx (terminal no caminho durable), src/core/delivery/durable-checkout-intent.ts (marcador de negação), teste de eviction e workflows/pins. Sem alterações em migrations automáticas, preço/ledger/pagamento, main ou demonstração visual.

Principais commits: Masterf75e957 (SQL/restore/painel),e8884e3 (fixture corrigida),86c8f8d/6b26476 (expiração nativa),26b3c54 (keyboard/endereço); Deliveryf66b9b0 (integração),fed4adb/3cd8758 (logout/expiração),c695929 (pin final de testes). Manifest final registra SHAs e hashes exatos; docs posteriores não alteram runtime.

## Verificações e limites

Resultados finais são registrados em evidence-manifest.json e evidence/native/*.json, com workflow de commits exatos. Preservados493 checks integrados,40 H03/H04 e21 browser anteriores. Node65/65 (um novo caso eviction), Master Vitest33/33. Delivery TypeScript, lint direcionado e build no CI validate aprovado. Master43 diagnósticos TypeScript preexistentes não foram ocultados; nenhum componente TS/TSX comercial Master alterado. Lint global Delivery permanece dívida conhecida. Diff check/sintaxe dos scripts aprovados.

Expiração é emitida pelo próprio GoTrue temporário, com lease curto e signer/config da stack mantidos. Credencial válida é aceita antes de expirar; leituras medem rejeição efetiva pelo PGRST, incluindo leeway/cache nativos. Na execução anterior aprovada,401 foi observado31 segundos adicionais depois da espera inicial. Não afirmar revogação instantânea ao exp nem mudar verificador para obter verde. GoTrue temporário é removido em finally.

Capturas reais: evidence/native/first-browser/{catalog,configurator,cart,checkout,tracking,panel}-{360,390,412,768,1440}.png. No overflow do documento nas cinco resoluções, cliente e painel. Não implica todos os cortes internos/WCAG, teclado virtual, suspensões Android ou celular físico. Teclado/foco são checks específicos do browser, não auditoria completa.

## Próxima ação

Revisar pacote/contratos e plano de homologação assistida; reconciliar legado e preparar backup/instalação sandbox separadamente. Sem instalação nesta execução. Produção, settlement e merge continuam NO-GO. Demais limitações e estados estão na MATRIZ-OPERACIONAL.md e DECISAO-PRIMEIRO-PEDIDO.md.

## Execução final aprovada — 2026-10-13

[Actions38455409691](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38455409691), jobs validate e integrated-auth concluídos com SUCCESS, inclusive remoção da stack. Par imutável: Master `26b3c54f89f5e1a90f28c5f463b1543db99c3e0e`; Delivery `c695929cbc36389f3fdbadf25acdc3a7ed22dae3`. Node65/65, 493/493 verificações integradas preservadas, H03/H04 40/40, navegador anterior21/21, operações nativas24/24 e entrega+painel Chromium73/73. Build, TypeScript e lint direcionado aprovados. Zero falhas nos relatórios anexados e zero exceções JavaScript nos dois ensaios Chromium. Expiração nativa resultou401 após31 segundos adicionais observados; não é revogação instantânea.

CLI2.120.0; PostgreSQL17.11 imagem17.11.0.004; GoTrue2.197.0; PostgREST16.4; Node22.23.3. Hashes de candidatos e evidências em evidence-manifest.json. Resultado geral da matriz histórica permanece rotulado INCONCLUSIVO quanto à compatibilidade com produção; PASS de checks isolados não altera esse limite.

Capturas inspecionadas: [checkout390](evidence/native/first-browser/checkout-390.png), [painel390](evidence/native/first-browser/panel-390.png), [tracking390](evidence/native/first-browser/tracking-390.png). São screenshots full-page com overlays/rolagem interna; não exibem simultaneamente todos os campos ou ações. Inspeção mostra legibilidade e detalhes do pedido no painel, mas não prova ausência de cortes internos nem acessibilidade completa. O teste de fluxo efetivamente rolou/interagiu com controles, e o teclado comprovou apenas nome→telefone e e-mail→senha. Não houve celular físico.

O restore202/202 testou o commit e8884e3: os três SQLs e os scripts de restauração são idênticos nos commits posteriores até26b3c54. As novas alterações posteriores foram no ensaio de navegador/expiração, não no algoritmo de restore. Commits posteriores de documentação não são outro runtime homologado.
