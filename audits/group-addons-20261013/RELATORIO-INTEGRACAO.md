# GROUP_ADDONS_V1 — integração candidata

**Produção NO-GO. Candidata para próxima homologação isolada do subset, sujeita aos gates abaixo.** Trabalho somente em branches derivadas, sem SQL remoto, produção, deploy, merge, dados/credenciais reais ou pagamentos. PRs Master #37 e Delivery #36/#37 não modificadas e mantidas DRAFT.

## Proveniência e arquitetura

- Master: `audit/group-addons-v1-20261013`, derivada de `229059e` da PR #37.
- Delivery: `audit/group-addons-integration-20261013`, derivada da integração `1d60611`.
- Referências recuperadas: relatórios integração/release, schema histórico completo, candidatos Sprints3–6. Não reexecutamos auditorias Git históricas genéricas nem importamos ledger/Supplier #36.
- [Contrato](CONTRATO-CATALOGO.md), [matriz](MATRIZ-CATALOGO.md) e [decisão](DECISAO-RELEASE.md).

SQL revisável fora das migrations automáticas: `audits/sql/group-addons-pricing.candidate.sql` e `group-addons-capability.candidate.sql`. O primeiro depende da cadeia Master phase2/runtime/ACL e instala preparador, snapshot JSONB, registro privado de intenção, catálogo/reader compatíveis e criação normalizada. O segundo depende da capacidade privada já instalada e compartilha preparador no append, sem alterar token, locks, estado, recibos ou ACL existente.

Instalação testada reconstrói catálogo completo capturado + Supabase nativo; não é replay comprovado da cadeia histórica original de todas as migrations, nem equivalência com produção atual. A tabela privada e a coluna de snapshot são propostas explícitas, não nomes históricos presumidos.

## Correções efetivas

1. GROUP possui IDs reais de adicionais; PRODUCT legado permanece separado. Banco valida todos os vínculos, disponibilidade, obrigatoriedade/limites e quantidade.
2. Preço e snapshot compartilham uma função privada: centavos exatos, base+delta de opção+delta de adicionais, total/taxa no servidor. Preço/total estimados só funcionam como pré-condições; diferença retorna PT409/HTTP409 sem confirmar.
3. Snapshots v2 guardam entidade, instância, nomes, regra, opções textuais, grupos, adicionais, quantidade e preço/total. Não alteram UUIDs históricos nem reprecificam pedidos após edição do cardápio.
4. Criação normalizada tem hash de intenção e serialização antes de replay; alteração de payload/chave legada negada. Append conserva hash/request_key/capacidade e NOT_SETTLED, com histórico único.
5. Legacy append/checkout não contornam grupos passando UUID de produto ou omitindo o tag. Revogação pública antiga permanece no gate isolado, não foi aplicada remotamente.
6. Frontend reaproveita loader e componentes: modo opt-in lê grupos reais, options por produto, carrinho com discriminador, serializer único checkout/append. Itens antigos não são convertidos ou apagados automaticamente. Combo/meio-a-meio ficam indisponíveis somente no modo novo até decisão.
7. Servidor exige flag privada GROUP e anúncio do contrato pelo backend antes de write GROUP. Adapter rejeita estado de settlement inesperado, sem mascarar resultado como NOT_SETTLED.

## Falhas demonstradas e tratadas

- **Primeiro ensaio 38337493694:** guard do append legado não havia sido inserido pelo gerador porque o loop real usava `coalesce(p_items,[])`. Teste demonstrou aceitação no clone. Corrigido em `ee081eb`, guard explícito, mesma regressão preservada; não é acusação de exploração em produção.
- **Segundo ensaio 38338809253:** nova asserção esperava HTTP400 em RPC SETOF autorizada por filtro. Contrato real retorna HTTP200 com zero registros. Correção testa exatamente 200/lista vazia, registra status/rows e acrescenta tentativa de escrita cruzada com estado inalterado; não altera RPC/policy nem aceita erro genérico como prova.
- Guard preventivo adicional: opção required sem grupo também exige contrato explícito; flag privada GROUP ativa nega qualquer downgrade/mistura pelo browser.
- Execução 38345379355 parou no checkout por placeholder de SHA, antes da stack. Corrigido em `56756c1` com SHA completo confirmado, verificação do checkout Master e teste de regressão contra placeholders. Não contamos esse run como validação SQL.
- Compilação local intermediária detectou união incorreta no flatMap e contexto possivelmente undefined. Corrigidos com union explícita e guard, sem any/disable. Snapshot v1 parcial recuperado motivou versão completa **2**, não retropreenchimento.
- Harness agora marca execução incompleta FAIL mesmo se a exceção ocorre antes de uma asserção falsa. Nenhuma redução das 44 verificações Node anteriores nem da matriz nativa original.

## Resultados

Execução final aprovada: [38346177959](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38346177959), Delivery **56756c13ff2c1617e7ed2efe728622f7e29eecc6**, Master pinado **703ef87cb498be67b02d3257fcf1f91d4098b893**. Jobs validate e integrated-auth/auth-matrix SUCCESS. Logs: **275 Auth/RLS +54 gateway +43 capacidade +56 HTTPS +65 GROUP =493, zero falhas**. As 419 verificações anteriores foram preservadas. **54 testes Node aprovados**, incluindo os 44 anteriores, contabilizados separadamente. Evidências sanitizadas nesta pasta com sufixo `38346177959.json`; cleanup da stack confirmado nos logs.

Recuperação final: [38345378954](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38345378954), Master **703ef87**, historical-rehearsal SUCCESS: **36 histórico +193 restore PASS**, **87 tabelas /89 FKs**. Snapshot GROUP v2 em fixture fictícia nova; comparação de definições/dados/RLS/ACLs, Auth no destino, freeze/roll-forward e cleanup. Evidências `historical-38345378954.json` e `recovery-38345378954.json`. Roles globais compartilhadas e freeze de negócio; não prova DR entre clusters ou drain real. Evidências intermediárias permanecem identificadas pelos respectivos run IDs e não substituem a execução final.

Local: Delivery build/TypeScript/lint dos arquivos tocados aprovados; Node54 aprovados. Master33 testes/lint (12 warnings)/build aprovados; tsc **43 erros anteriores**, conferidos novamente. Lint global Delivery: **2155 erros/11 warnings**, contra **2535/11** na integração base; 2151 erros de formatação e os mesmos quatro diagnósticos funcionais preexistentes. Lint global continua reprovado; lint direcionado aprovado. Build local Node24, Actions Node22.23.3. Supabase CLI2.120.0, PG17.11/image17.11.0.004, GoTrue2.197.0, PostgREST16.4 e Kong2.8.1 no runner descartável.

Fakes: organização A lojas A1=`a.ab.invalid`, A2=`b.ab.invalid`; organização B loja B1=`c.ab.invalid`. Grupos/adicionais/valores distintos, usuário nativo Auth apenas em A1. Nomes/domínios fictícios e IDs gerados no clone. Preço adulterado, required/máximo/duplicata, opção inválida, desativação, quantidades, duas organizações, concorrência/replay, mudança de preço, snapshots e append exercitados. Anônimo não executa append; helper privado sem EXECUTE; acesso administrativo cruzado retorna zero linhas e update é negado sem mutação.

## Arquivos e commits

Master: dois SQLs candidatos; `tools/ab-auth/{run,group_addons,order_amendment_capability,checkout_http_enabled,restore_security}.mjs`; workflow de recuperação e bloqueio de auto-deploy exclusivo da nova branch. Commits funcionais: `358ea94`, `ee081eb`, `b169299`, `11e8503`, `1baa030`, `f318960`, `64ea531`, `c067ffd`, `8dda2d1`, `0eefd09`, `5ac5478`, `703ef87`.

Delivery: `core/delivery/{group-order-line,cart-order-lines,product-options}.ts`, `services/{public-catalog,load-public-store}.ts`; `lib/domain/types.ts`; CheckoutPanel/ProductConfigurator/Storefront; handlers/adapters checkout/amendment; testes GROUP; workflows CI/integração e gate de deploy da branch. Commits: `de622b5`, `a799e3c`, `baa9a10`, `90e4cbe`, `f6ba11d`, `1197286`, `56756c1`. Fonte public-catalog.ts recuperada dos candidatos anteriores, não simulador reimplementado. Parte dos diffs é formatação Prettier dos arquivos tocados.

Nenhuma alteração em main, PR visual, Master37 original ou PRs36/37 originais. Não foram criadas PRs novas. Documentação/evidências subsequentes não alteram runtime.

## Limitações e próxima ação

Sem browser/celular real; o frontend está conectado e compilado, mas a experiência de escolha/revisão de preço requer QA com transporte local/mocks. Backend storefront público permanece o externo Master; não abrir browser apontando dados de teste para loja real. Nenhum runtime Vercel foi homologado/deployado.

Não homologados: combos/meio-a-meio/multiplicidade, preparo fora de tamanho/borda, edição administrativa consolidada/Supplier, ledger/pagamento, tracking por capacidade em lugar do telefone, recuperação de token/intenção após reload, performance de locks de catálogo. Catálogo pode conter configurações legadas incompatíveis; plano de migração dos writers GROUP obrigatórios é necessário antes do cutover.

Preservar a configuração histórica sem instância bloqueada; dados atuais/owners/grants remotos e consumidores/jobs externos não foram reconfirmados nesta missão. Hashes do manifest pinam candidatos, não afirmam schema remoto.

Próxima ação executável: revisar candidatos + homologar browser/transportes locais de configuração e preço alterado com A1/A2/B1, sem habilitar pagamentos; decidir contratos bloqueados separadamente. Somente após aprovação específica preparar instalação em sandbox reconciliado e janela de consumidores; produção permanece NO-GO.
