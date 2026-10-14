# RELATÓRIO DE PASSAGEM — MISSÃO 02A.2 — 14/10/2026

**Status comercial: NÃO LIBERADO. F01 não encerrada. Missão 02B somente em planejamento.**

## 1. Resumo executivo

A contenção da PR38 funciona no escopo verificado: os 105 testes Node passaram, os quatro testes específicos da rota passaram, build e TypeScript passaram, e HTTP local retornou 200 com a tela suspensa. **A Fase A não é PASS integral:** o lint focalizado no SHA original falhou com 383 erros/2 avisos, sendo 382/2 herdados e um erro novo de formatação. Esse erro novo foi corrigido em follow-up isolado; os 105 testes passaram novamente e o lint ficou em 382/2, sem diagnóstico adicional nas linhas alteradas. A tentativa de confirmar a tela hidratada no Chromium excedeu 45 s e ficou FAIL no ensaio, sem aprovação de navegador. Isso não demonstra regressão de produto, mas não permite declarar o navegador validado.

**O isolamento A/B/C não foi comprovado nesta missão.** O banco permaneceu BLOCKED antes de qualquer download/start: mesmo volume de 32 GB/driver vfs que esgotou disco na extração anterior, agora com ~24 GB livres, versus ~31 GB livres antes da falha passada. Não há capacidade de pico demonstrada. Não foi usado banco remoto como alternativa.

Foram preparados candidatos SQL em rascunhos separados, com perfis e hashes explícitos. Nenhum foi executado em PostgreSQL. Parsing SQL/PLpgSQL passou, mas não comprova resolução de tipos/objetos, aplicação, RLS ou isolamento. A inspeção detectou autorização ampla de staff via `OR neroxa_is_platform_member()` nos candidatos anteriores do Master, incompatível com a exigência de staff sem grant ser negado. Os testes históricos que aceitavam plataforma global não satisfazem a matriz desta missão.

## 2. Repositórios, branches e SHAs

| Fonte | Branch | SHA analisado |
|---|---|---|
| Delivery PR38, draft | security/delivery-02a-panel-gate-20261014 | b324c1499ff3feda7cb6b56fec3c2ac63bc56052 |
| Base PR38 | audit/independent-recovery-v1-20261014 | c18d6803b319de442d5dfb2ed1d58fb367df096d |
| Master candidato | audit/independent-recovery-v1-20261014 | b6f70f1e86ef9f4f5ae8fc9a53d71cb024c4e3db |
| Master PR37, draft | audit/store-isolation-candidate-20261011 | 229059e5702bdad3ffa96d3373d878061ab90261 |

Delivery: `luit77yak-dev/pizza-perfect-plate`. Master: `luit77yak-dev/neroxa-master`. AGENTS.md de ambos foi lido; hashes estão em evidence/source-shas.json. Master PR37 é ancestral do candidato b6f70f1; este tem apenas documentação depois de 1704dc5, pin do workflow DR anterior. Não se adotou um artifact antigo como prova do estado atual.

Diff PR38/base: cinco arquivos, 191 inserções/uma exclusão: tela de suspensão em painel.tsx, quatro contratos estáticos e três documentos. StaffPanel permanece como código inativo; nenhuma policy/grant/RPC foi alterada na PR38. Não foi mudada a base da PR para disparar CI.

## 3. Arquivos alterados nesta missão

- Follow-up Delivery: uma quebra de linha no texto da tela suspensa; `audits/02a2/` com relatório, inventário, matriz, compatibilidade e evidências; vercel.json desabilita auto-deploy **somente da nova branch**.
- SQL legado Delivery em branch distinta: `audits/02a2/sql/legacy-store-surfaces-quarantine.candidate.sql`, manifesto e documentação. Quarentena de revisão **apenas offline**, não cutover live: revoga ACLs de tabela/coluna e RPCs antigas conhecidas; restringe bucket product-images, preservando dados. Pode tornar checkout/tracking/imagens antigos indisponíveis; não aplicar sem alternativa validada e consumidores resolvidos.
- Master em branch distinta: `audits/02a2/scoped-order-access.candidate.sql`, manifesto/documentação. Helper por instância reaproveita membership explícito, exige grant do staff e MFA existente; alinha listagem/status e detalhe; policies restritivas limitam ORs permissivos de pedidos/catálogo, com papéis de escrita diferentes de leitura. Corpo operacional de transições/timestamps/histórico preservado. Não fecha todas as RPCs/Storage/Realtime/CRM.
- Nenhuma alteração em main, is_neroxa_staff, schema remoto, dados reais, deploy ou PR existente. Não foi reativado StaffPanel. `.env` foi retirado temporariamente dos worktrees de execução e restaurado sem ler/imprimir valores ou commitá-los. Instalação inicial Bun anunciou carregamento automático desse arquivo; foi repetida com `--no-env-file`, scripts de lifecycle desabilitados e sem execução de aplicação nessa instalação inicial.

## 4. Testes realmente executados

Node **22.23.0**, Bun **1.3.14**, lock `bun.lock` congelado. Não utilizamos npm install com resolução livre como substituto da instalação reproduzível.

| Verificação no SHA b324c149 | Resultado | Evidência |
|---|---|---|
| bun --no-env-file install --frozen-lockfile --ignore-scripts | PASS, exit 0; lock preservado | install-frozen-clean.log/source-shas.json |
| node --experimental-strip-types --test tests/*.test.mjs | PASS 105/105, exit 0 | node-tests.log |
| teste específico legacy-panel-route-gate.test.mjs | PASS 4/4, estático; incluído nos 105 | gate-tests.log |
| npm run build em Node22 | PASS, exit 0; artefatos locais | build.log |
| node node_modules/typescript/bin/tsc --noEmit | PASS, exit 0 | tsc-final.log |
| node node_modules/eslint/bin/eslint.js src/routes/painel.tsx | FAIL, exit 1; 383 erros/2 avisos | lint-head.json |
| mesma versão/config/deps no painel da base c18d680 | FAIL, exit 1; 382 erros/2 avisos | lint-base.json |
| comparação por linhas inalteradas (+22 linhas de offset) + regra/severidade | PASS para diagnóstico: novo erro apenas linha 23, prettier | lint-comparison.json |
| HTTP TanStack local /painel | PASS parcial: 200 e markup de suspensão | gate-ssr.html, gate-probe.html, gate-http-browser.json |
| Chromium hidratado | FAIL do ensaio por timeout 45 s; aprovação de navegador NOT RUN até concluir ensaio | gate-http-browser.json |
| Follow-up com quebra de linha | PASS 105/105; lint FAIL herdado 382 erros/2 avisos | followup-node-tests.log/lint-followup.json |
| Parser pglast 7.14, SQL e corpos SQL/PLpgSQL | PASS de sintaxe: 85 statements Master, oito legado | sql-syntax.json |
| Instalação/aplicação/queries SQL, Auth/RLS, Storage, Realtime | BLOCKED ambiente; operações NOT RUN | runner-preflight.json |
| Provisionamento/restore/rollback em banco | NOT RUN | COMPATIBILIDADE-E-REVERSAO-02A2.md |

Não somar os quatro testes específicos novamente aos 105. Testes de contratos podem confirmar a existência de um caminho perigoso; PASS de contrato não significa sistema seguro. O build/TypeScript do follow-up não foram repetidos: a única alteração TSX é whitespace, e o build/TypeScript acima pertencem ao SHA exato original.

Tentativas de harness HTTP foram preservadas: timeout inicial curto, conflito de porta no reinício e bloqueio de consultas DNS de wildcard do Vite pela proteção de egress foram corrigidos no harness, não no produto. Ensaio final usou backend-sink loopback, chaves sintéticas inválidas para Auth e modo homologation sem fallback comercial; Node restringe saída e Chromium usa proxy local sem saída para hosts externos. Esse sink **não é banco/mock de RLS**, e não serve para provar autorização. Contagem de chamadas ao sink não foi gravada após timeout do browser; não alegamos prova runtime de zero RPC.

Os primeiros comandos tsc/eslint via npx aninhado falharam como invocação npm; logs foram preservados e substituídos na conclusão pelos comandos diretos Node22 acima.

## 5. Logs e evidências

Pacote local contém logs completos, manifests, hashes, inventário de 215 referências de consumidores e 29 funções selecionadas do catálogo estrutural histórico, além das policies capturadas. O catálogo de 09/10 e ACLs não são catálogo atual de um backend instalado. Nenhuma senha, dump de cliente, credencial comercial ou status.private.env integra o pacote. Hashes de SQL vinculam os dois perfis sem misturá-los.

## 6. Matriz real de isolamento A/B/C

**BLOCKED — nenhuma operação de banco executada nesta missão.** Plano em MATRIZ-POSITIVE.csv e MATRIZ-NEGATIVE.csv; O1 tem A/B, O2 tem C. Sete atores: admin_A/B/C, staff_master_A, staff_master_sem_grant, usuário comum, anon. Os CSVs são expectativas, não resultados aprovados. Seleção pública de catálogo deve ocorrer apenas por projeção pública; tabela privada e endpoint autorizado são caminhos diferentes.

| Área | Positivos previstos | Negativos previstos | Resultado real |
|---|---|---|---|
| Pedidos/itens/histórico e PII | admin A e staff com grant A; RPCs pertinentes | A→B/C, usuário comum/anon/staff sem grant; DELETE financeiro | BLOCKED / NOT RUN |
| Produtos/categorias/opções/complementos | manager da loja, preço servidor | pai/categoria/grupo de outra instância; papel insuficiente; troca de instance/org | BLOCKED / NOT RUN |
| Settings/horários/zonas/taxas | gravação legítima A independente de B | UPDATE WITH CHECK/upsert/adulteração para B | BLOCKED / NOT RUN |
| Imagens/Storage | upload/substituir/excluir A | prefixo de B/C, MIME/limites, anon e URL pública usada como escrita | BLOCKED / NOT RUN |
| RPC legada/definer/views/grants | somente caminhos substitutos autorizados | bypass da UI, ACL herdada/por coluna/PUBLIC, view definer | BLOCKED / NOT RUN |
| Realtime e revogação | evento A para identidade autorizada | evento B, subscription antiga após revoke/logout/stale JWT | BLOCKED / NOT RUN |

Cada operação negativa precisa provar ausência de efeitos diretos e indiretos por contagem/digest antes/depois; HTTP200 vazio pode ser deny de RLS, mas precisa assert de conteúdo. Nenhum acesso cruzado foi reproduzido nesta missão; nenhum foi descartado como possibilidade.

## 7. Permissões legadas identificadas

Ver INVENTARIO-E-MIGRACAO-02A2.md. Pontos críticos: update_order_status por organização; claim_first_owner; tabelas antigas e Storage por organization_id; tracking/append UUID+telefone; RLS permissiva combinada com plataforma global; funções SECURITY DEFINER que ignoram RLS; views/consumidores externos ainda não resolvidos. Ocultar a rota não revoga nenhum desses acessos. Não se pode afirmar consumidores ativos ausentes a partir de busca de código.

## 8. Falhas P0/P1/P2/P3

| ID | Severidade | Estado e implicação |
|---|---|---|
| F01 | P0 gate de segurança | contenção de UI implementada; autorização completa por loja NÃO comprovada; SQL/Storage/caminhos diretos ainda bloqueiam encerramento |
| F01-S | P0 gate de segurança | candidato anterior permite plataforma global em RPC/RLS; diverge de staff sem grant negado; evidência estática, não exploração runtime |
| F02 | P0 gate de privacidade | tracking/append legados por UUID+telefone e SECURITY DEFINER; consumidores/fallbacks exigem migração coordenada |
| B01 | P1 ambiental | runner não suporta pico já observado; matriz real/SQL não executados; não confundir com FAIL de isolamento |
| A01 | P2 | erro novo de formatação no SHA PR38; corrigido somente em follow-up draft |
| A02 | P2 | 382 erros/2 avisos focais herdados; não reformatados nesta missão |
| A03 | P2 ensaio | Chromium timeout; SSR passou, hidratação e navegação não homologadas |
| C01 | P1 funcional | catálogo/preços/imagens/settings/horários/taxas/notificações do painel legado indisponíveis, sem substituto completo validado |
| E01 | P1 recuperação | restore T1 após perda total e perfil financeiro/comercial integral ainda NOT RUN; rollback não pode reabrir legado |
| P3 | sem novo achado específico | refinamentos de UX fora do escopo; nenhum reduz gates de segurança |

P0 aqui identifica bloqueio de segurança de código/contrato; não é declaração de vazamento observado. Qualquer acesso indevido positivo no banco será FAIL/P0 com evidência própria.

## 9. Compatibilidade e reversão

Detalhes e pré-condições em COMPATIBILIDADE-E-REVERSAO-02A2.md. SQL Master usa 19 predecessores identificados por hash e guard de corpo de funções; SQL legado exige outro schema e recusa neroxa_orders. Não concatenar perfis. Novos SQLs não foram compilados/aplicados contra os tipos reais, nem considerados seguros para instalação.

Preservar clientes/assinaturas/contratos/jobs, is_neroxa_staff, IDs e histórico. Provisionamento deve conceder somente acesso explicitamente aprovado à instância. Revogar acessos antigos pode parar consumidores legítimos: enquanto não houver substituto validado, manter caminho indisponível para piloto, sem aplicar revogação live às cegas.

Reversão aceitável: rollback transacional no clone antes do commit; depois, manter suspensão, congelar o destino descartável e restaurar snapshot em outro destino com sucessor seguro. Não reativar StaffPanel, não restaurar grants inseguros no ambiente operacional, não retornar a T0 perdendo T1. Backup/grants/Auth/MFA e isolamento precisam novo ensaio independente.

## 10. Funcionalidades indisponíveis

CRUD legado de catálogo, categorias, tamanhos, preços, complementos, imagens, settings, horários e taxas; notificações antigas; operação comercial do painel. `/admin/pedidos` permanece apenas em validação e cobre pedidos, não substitui o restante do painel. Tracking privado e segurança end-to-end continuam pendentes. Não foi recriado painel inteiro.

## 11. PRs preparadas

PRs novas listadas no adendo final desta seção, com branches e SHAs após commits. Todas draft; sem merge/deploy. PR38 e Master PR37 permanecem draft e com suas bases preservadas. Novas branches incluem bloqueio de auto-deploy antes do push; nenhum workflow foi disparado manualmente.

## 12. Riscos residuais e testes hospedados

- Ambiente local ainda não forneceu prova Auth/RLS/Storage/Realtime, dados migrados, consumer compatibility ou DR. Não depende necessariamente de hospedagem: requer runner descartável adequado.
- Camada hosted ainda exige domínio/Host/Origin confiáveis no ingress, TLS/proxy, antiabuso real, cookies/sessões/MFA em domínios finais, websocket/reconexão/revogação, Storage/CORS/CDN e durabilidade/restore no domínio de falha escolhido. Nenhum deploy foi autorizado ou feito.
- SQL candidato não é solução integral: outras funções definer, CRM/contatos, grants administrativos, novas funções/default privileges, papéis herdados e esquemas híbridos permanecem gates. Alinhar testes históricos que consideravam plataforma global permitida à política explícita desta missão.
- Não assumir que `.env`, flags de secure gateway e backend corretos serão usados sem manifesto/executor que recuse configuração comercial. Chaves de sessão devem ser emitidas pelo Auth descartável, não fabricadas como nos placeholders do teste da tela.

## 13. Próxima decisão necessária — respostas A–G

**A. Contenção da PR38 passou?** PASS funcional restrito em Node/build/TS/HTTP SSR; Fase A completa FAIL no lint original e navegador hidratado não aprovado. Follow-up corrige apenas o erro novo; não apaga os herdados.

**B. Isolamento A/B/C comprovado?** Não. BLOCKED antes do banco; nenhuma certificação RLS.

**C. Acessos perigosos?** Tabelas/RPCs por organização, Storage por organização, tracking/append por telefone, staff global sem grant e definer/views/consumidores alternativos ainda não encerrados.

**D. Menor conjunto para F01?** Manter gate de rota; fechar ACL/policies/caminhos SQL diretos legados com inventário de impacto; aplicar escopo explícito e papéis em todas as RPCs/RLS acessíveis (incluindo staff), Storage e canais; bloquear recursos sem substituto; executar positivos/negativos A/B/C e revogação sem efeitos colaterais. Novo painel inteiro não é pré-condição arquitetural, mas funcionalidades necessárias ao piloto exigem substituição segura antes da operação.

**E. PRs draft?** Três propostas separadas: validação/formatação Delivery, quarentena legada offline Delivery e escopo explícito Master. Links/SHAs no adendo após criação.

**F. Testes hospedados?** Ingress TLS/Host/Origin, antiabuso, sessões/MFA/cookies, Storage/CDN/CORS, Realtime e DR/durabilidade do ambiente escolhido. A matriz de banco básica não deve esperar produção; deve rodar em ambiente descartável adequado.

**G. Decisão da Coordenação?** Viabilizar runner gratuito adequado ou deliberar separadamente sobre infraestrutura antes de qualquer custo; confirmar política de grant explícito do staff e escopo CRM × Delivery; revisar os três drafts e escolher sequência de substituição dos consumidores. Manter F01 aberta, comercial NÃO LIBERADO e 02B somente em planejamento. Esta missão não pede nem concede autorização de produção.
