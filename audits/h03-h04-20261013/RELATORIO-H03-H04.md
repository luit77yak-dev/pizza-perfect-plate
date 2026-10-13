# H03 + H04 — resultado verificável

2026-10-13. **GO restrito para continuar homologação isolada. Sandbox e produção: NO-GO.** O fluxo de retirada com catálogo GROUP, preço autoritativo, pedido persistido, recuperação e acompanhamento foi executado em Chromium conectado ao Supabase descartável. Não é aprovação comercial nem instalação autorizada.

## Estado recuperado e proveniência

`28d8a69` existe localmente, foi inspecionado e preservado na ancestralidade Delivery. As correções de CSS/revisão explícita de preço não foram presumidas no GitHub: partiram do worktree verificável. Base Delivery1093cbdb e Master6ff327c, com os commits GROUP56756c13 e703ef87 na ancestralidade.

Branches novas, independentes: `audit/h03-h04-20261013` em ambos os repositórios. Sem alterações à main ou às branches das PRs originais. Vercel `git.deploymentEnabled` para esta branch foi desabilitado antes do primeiro push. Nenhum comando de deploy ou SQL Supabase remoto foi executado.

**Par testado:** Master `e338e4ee4ee8ce7e4532799025d3f723f3a4ebf5`; Delivery `6f5b37e997948106772be5dd00242dfd77290a28`.

- [CI + integração + Chromium](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38432605009): jobs validate e integrated-auth aprovados, cleanup aprovado.
- [Restauração](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38431446701): aprovada em Master `b1fe64936ff9b3965ddd6bbef11376d345c4c156`. As três definições SQL são byte a byte iguais às de e338e4e; posteriores alterações Master são exclusivamente regressões do harness. Hashes em `evidence-manifest.json`.

PRs consultadas após a execução: Master37 DRAFT229059e; Delivery36 DRAFTafb26bc; Delivery37 DRAFTe8bd746. Todas abertas, heads originais preservados; não criada nova PR.

## Problemas e correções

| Problema                                            | Causa                                                                          | Correção e prova                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H03: catálogo sem contrato de horário por instância | Loader retornava arrays vazios; schema candidato não possuía agenda compatível | Extensão explícita INSTANCE_AVAILABILITY_V1, RLS por instância, timezone obrigatório, default fechado; 40 checks nativos incluindo fechamento, exceções, noite anterior, ausência, isolamento e append |
| H04: chave perdida em reload                        | Ref do componente era única memória de intenção                                | Cofre mínimo sem PII, Web Locks, fingerprint e tombstones; navegador fechado/reaberto recuperou mesma chave e único pedido no PostgreSQL                                                               |
| Replay desconhecido liberado por rejeição posterior | Retry rejeitado não prova ausência da primeira chamada em trânsito             | PENDING preservado; payload diferente/expiração bloqueiam substituição; testes Node e PostgreSQL                                                                                                       |
| Polling utilizaria quota de criação                 | Leitura nova compartilhava 5 tentativas/10min com checkout                     | Quota de leitura privada independente; 30/min por contato, 120/min por loja; 31ª leitura rejeitada e contador checkout intacto                                                                         |
| Ação de recuperação inacessível                     | Header fixo interceptava clique do banner                                      | Banner abaixo do header; clique normal Chromium após reabertura chega ao checkout, sem force                                                                                                           |
| Risco de apagar alterações posteriores da sacola    | Limpeza integral após resposta assíncrona                                      | clearPurchased remove somente linhas enviadas e inalteradas, com vínculo à instância                                                                                                                   |

Falhas do harness também registradas, sem enfraquecer segurança:

1. Run38428964325: teste Node exigia SHA703ef87 antigo; atualizado para SHA candidato exato. Catálogo não carregava porque alias genérico @ tinha precedência. Corrigida ordem do alias, sem habilitar cliente remoto.
2. Run38430204821: fixture `.client.` violava proteção de import SSR; nome neutro de fixture e cliente anon local compatível. Selector procurava Finalizar, mas componente possui Continuar para checkout; ajustado ao contrato real.
3. Run38430921756: header cobria Recuperar tentativa. Falha real de interface corrigida no Delivery.
4. Run38431925520: variável do payload original era indevidamente zerada pelo próprio harness; retenção em RAM corrigida para o teste de duas abas. A criação e recuperação por reabertura já tinham passado nesse run, mas não foi declarado aprovado.
5. Run38432605009: suíte completa aprovada após correções, sem reduzir assertions.

## Implementação e arquivos

Master: três candidatos fora de supabase/migrations — `audits/sql/store-availability.candidate.sql`, `checkout-recovery.candidate.sql`, `store-availability-capability.candidate.sql`. Preservam assinaturas/ACL das RPCs anteriores com pré-condições sobre corpos esperados. Criam quatro tabelas de agenda e contador privado de leituras; lease nullable nas intenções existentes, sem backfill. Novos helpers privados têm search_path vazio e nenhum EXECUTE público. Recuperação/quota pública executável somente por service_role no servidor. Sem mudanças nos privilégios gerenciados de supabase_admin.

Harness Master: `tools/ab-auth/run.mjs`, `order_amendment_capability.mjs`, `restore_security.mjs`, novos `h03_h04.mjs` e `h03_browser.mjs`; workflow historical-rehearsal habilita apenas candidata explícita.

Delivery: `availability.ts`, `durable-checkout-intent.ts`, `cart-order-lines.ts`, loader público, CheckoutPanel, Storefront, StorefrontContact, useLocalCart; gateway e adapter server-side, mapping de loja fechada para append, rota `/api/order-recover` e routeTree gerada. Workflows fixam SHA Master completo; testes novos availability/durable e pin de contrato atualizado. Alias do runner legado também corrigido. Não implementados Supplier, ledger, gateway financeiro ou recursos GROUP bloqueados.

Commits principais: Master0f9dccc (agenda/recovery), b1fe649 (quota leitura), e338e4e (harness final); Delivery243b61e (integração), d38287d (quota),64967e3 (ação acessível),6f5b37e (pin final). Commits intermediários rastreáveis mantidos; documentação/evidências posteriores não mudam runtime.

## Ambiente e resultados

Runner GitHub ubuntu descartável, repositórios públicos; nenhuma infraestrutura paga criada. CLI2.120.0, imagem PostgreSQL17.11.0.004, versão efetiva17.11, Auth supabase/gotrue:v2.197.0, PostgREST:v16.4, Kong2.8.1, Node22.23.3. Browser Playwright1.58.2 com Google Chrome disponível no runner; versão exata Chrome não foi registrada. Node local24.19.0, Chromium local151 para regressão mock.

Catálogo histórico completo conhecido do Master reconstruído, candidatos aplicados em ordem validada, com Auth real, JWTs locais e RLS/PostgREST. Não foi fixture mínima apresentada como replay de produção. Snapshot histórico não comprova o schema atual remoto. A1/A2 da organização A e B1 da B, hosts a/b/c.ab.invalid, cada qual com catálogo distinto. Nenhuma requisição do navegador foi permitida a backend real; origens externas não permitidas foram abortadas (fontes Google bloqueadas).

| Execução                                                  | Resultado                              | Evidência                                                         |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Node Delivery, preservando58 anteriores                   | 64/64, sem falhas                      | CI validate e execução local node --test tests/*.test.mjs         |
| Master Vitest local                                       | 33/33                                  | npm test, quatro arquivos                                         |
| JWT/RLS + gateway + capacidade + GROUP + HTTPS anteriores | 493/493 reexecutados (275+54+43+65+56) | evidence/native/*.json, run38432605009                            |
| H03/H04 PostgreSQL/Auth/PostgREST novos                   | 40/40                                  | evidence/native/h03-h04.json                                      |
| Browser conectado ao banco real descartável               | 21/21                                  | evidence/native/h03-browser.json                                  |
| Recuperação lógica                                        | 193/193,92 tabelas,94 FKs              | evidence/recovery/restore-report.json                             |
| Browser legado com mocks, flags novas OFF                 | 31/31, zero exceções                   | evidence/legacy-browser/browser-results.json                      |
| Delivery TypeScript, lint dos arquivos envolvidos, build  | PASS                                   | CI validate final; também verificações locais                     |
| Master build                                              | PASS local                             | npm run build                                                     |
| Master TypeScript                                         | 43 diagnósticos preexistentes          | npx tsc --noEmit; nenhum arquivo TS/TSX comercial Master alterado |
| git diff --check e sintaxe dos scripts                    | PASS                                   | execuções locais                                                  |

Os artefatos anteriores que usam classification INCONCLUSIVO mantêm essa classificação: 493 asserções aprovadas no escopo isolado não aprovam compatibilidade comercial/produção. O artefato novo separa PASS_NATIVE e PASS_FIRST_ORDER_NATIVE de productionApproved=false. Lint global Delivery permanece dívida fora do escopo; não desativadas regras para ocultá-la.

### Fluxo efetivamente executado no navegador

A1: catálogo real → pizza com tamanho e adicional obrigatório gratuito → sacola → retirada com nome/telefone fictícios. Storage bloqueado impediu todo POST. Proprietário AuthA autorizado alterou preço30→35 via PostgREST; checkout retornouPRICE_CHANGED sem inserir pedido. Usuário revisou preços e viu35 antes de confirmar. O teste enviou checkout HTTPS real, recebeu resposta200 no interceptor e a descartou **depois da persistência**, confirmando incremento único no banco. Fechou o navegador inteiro e abriu o mesmo perfil; reentrou dados originais, reutilizou chave e recebeu acompanhamento do mesmo pedido, sem incremento. Duas abas reais concorreram com Web Locks e mesma prova, permanecendo um único pedido. Administrador autorizado confirmou status no RPC; acompanhamento refletiu automaticamente pela leitura privada. Nenhum nome/telefone/endereço fictício desse fluxo apareceu em localStorage.

A2: transporte abortado antes de encaminhar ao servidor, sem pedido no banco; reenvio com clique duplo conservou chave e criou um único pedido. Intenção A1 não foi reutilizada. Isolamento B1, produtos/adicionais/pedidos cruzados e autorização são cobertos pelo backend real e pelas matrizes preservadas, não por erro genérico ou mocks.

### Capturas

[Tracking390 real](evidence/native/browser/tracking-390.png), [360](evidence/native/browser/tracking-360.png), [412](evidence/native/browser/tracking-412.png), [768](evidence/native/browser/tracking-768.png), [1440](evidence/native/browser/tracking-1440.png). Sem overflow horizontal do documento nos cinco viewports.

Capturas do catálogo/checkout em evidence/legacy-browser/screenshots são **componentes reais com transporte mock**, identificadas separadamente; não são prova de persistência. Celular físico, teclado virtual e suspensão do sistema móvel não foram testados.

## Restauração e limites

pg_dump/pg_restore17.11 com custom archive dentro do contêiner; banco destino separado descartável, template0, executor local supabase_admin. Comparação inclui conteúdo de dados e fingerprints de schemas, relações, colunas, policies/expressões, triggers, constraints, índices, funções, extensões, grants e defaults. Auth/PostgREST dedicados ao destino exercitaram RLS, isolamento e roll-forward. Roles globais compartilhadas no cluster descartável não são restauradas pelo pg_dump; o ensaio não certifica transferência para cluster com roles diferentes.

As novas estruturas e ACL são comparadas, mas recuperação de uma **intenção GROUP populada após restore** ainda precisa de cenário próprio: a prova atual não deve ser expandida além das193 verificações. Expiração de intenções foi comprovada no backend nativo da execução integrada, não inferida do dump.

## Riscos que permanecem

- Alto: evicção/limpeza integral do storage, outro dispositivo/perfil e fencing operacional de intenção desconhecida ainda não resolvidos. Não oferecer chave nova ou limpeza automática como solução.
- Alto: instalação/cutover coordenado e consumers legados ainda precisam aprovação; configuração órfã histórica continua preservada e bloqueada, sem atribuição arbitrária de instância.
- Médio: payload precisa ser reentrado exatamente; perda de dados originais, mudança de preço após tentativa incerta ou expiração exigem operador. Fluxo privilegiado de reconciliação não foi implementado.
- Médio: token de append perdido não é reemitido; leitura recuperada não concede append. Nenhum pagamento foi ativado ou considerado capturado.
- Médio: agenda/DST abrangente, edição administrativa de horários, escala dos locks e retenção de counters precisam homologação/decisão próprias. Requisitos comerciais não foram inventados.
- Médio: banco sandbox reduzido e schema remoto atual não foram reconsultados/escritos; pacote novo não é instalação homologada no sandbox.

Próxima execução: ampliar cenários de recuperação com GROUP populado após restore, delivery/endereço/taxa no browser real e reconciliação/fencing, depois revisar pacote/executor/backup do sandbox. Nenhuma nova implantação nesta missão.
