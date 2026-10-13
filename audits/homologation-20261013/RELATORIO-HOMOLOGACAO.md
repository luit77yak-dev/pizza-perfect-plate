# Homologação GROUP_ADDONS_V1 — 2026-10-13

**Resultado: parcial, sem aprovação ponta a ponta.** Navegador real executado, mas backend integrado desta rodada indisponível. Dois bloqueios operacionais permanecem. Produção e instalação em sandbox: NO-GO.

## Ambiente e proveniência

- Delivery: branch derivada `audit/group-addons-homologation-20261013`, base `10f7074f7a12330a5858754930ab5f0decfc9027`. Correções locais versionadas em `28d8a69`; sem push. Runtime anteriormente testado: `56756c13ff2c1617e7ed2efe728622f7e29eecc6`.
- Master preservado: `6ff327cc36dea31198ae612b454685c78451dcde`; runtime SQL `703ef87cb498be67b02d3257fcf1f91d4098b893`. Nenhum SQL novo ou alteração no Master.
- Contrato, matriz, relatório e decisão anteriores em `../group-addons-20261013/`; históricos continuam históricos, não certificam estas alterações.
- Node 24.19.0, Chromium 151.0.7922.173, Playwright já instalado no ambiente, Vite 8.1.5. Não testado em telefone físico ou runtime Vercel.
- Servidor HTTPS somente `127.0.0.1:4173`, certificado fictício local. Validação de certificado relaxada exclusivamente no contexto Chromium desse listener descartável.
- Runner de interface injeta **somente na configuração temporária** `client.fixture.ts`: URL loopback e chave sintética. Produção não recebe esse alias. Browser intercepta catálogo e checkout; todas as demais saídas externas são abortadas. Não usou credenciais privadas de produção.

## Tentativa de backend

CLI Supabase 2.120.0, PG17, TOTP habilitado, seed desabilitado, sem vínculo remoto/migrations de aplicação na configuração inicial. Diretório privado `/tmp/neroxa-homologation-20261013`; rede dedicada com binds loopback e relay existente do Master. Preflight: 18 GB livres em volume de 32 GB.

Extração da imagem `supabase/postgres:17.11.0.004` fez o espaço livre cair a 6,8 GB. Pull interrompido e CLI encerrada, incluindo seu retry interno. Não houve nova tentativa manual. A extração foi revertida e o espaço retornou a aproximadamente 17 GB. **Nenhum PostgreSQL/Auth/PostgREST desta tentativa ficou operacional; nenhum catálogo ou candidato SQL foi instalado.** Imagens pequenas baixadas, rede e processos exclusivos desta tentativa foram removidos; containers e imagens anteriores preservados. Não improvisamos um schema mínimo para anunciar aprovação.

Os testes anteriores [493 verificações](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/38346177959) e [193 de recuperação](https://github.com/luit77yak-dev/neroxa-master/actions/runs/38345378954) são referência dos commits anteriores, não uma reexecução desta rodada.

## Fluxos realmente executados

1. Aplicação real: catálogo fictício renderizado, configuração de pizza com tamanho e adicional pago, inclusão e preservação da sacola após reload. Compilação CSS em dev corrigida e reexecutada.
2. Aplicação real: cinco viewports sem overflow horizontal do documento. Horários vazios resultam em **Fechada hoje**; checkout completo bloqueado, sem forçar `open=true` nessa aplicação.
3. Harness separado: monta o **CheckoutPanel existente**, com fixture explicitamente aberta. Não representa o storefront inteiro nem autorização de servidor. Valida nome/telefone e ausência de endereço de entrega antes de qualquer POST; retirada sem endereço.
4. Harness: HTTP409 PRICE_CHANGED reproduzido antes da correção; após correção, confirmação bloqueada, revisão explícita de R$30→35, nenhuma submissão durante revisão, novo clique exigido e nova chave após conflito transacional conhecido.
5. Harness: taxa fictícia 5→6 somada ao produto atualizado35, total41 visível antes de consentimento. Não comprova alteração administrativa/precificação no banco.
6. Harness: catálogo indisponível na revisão mantém confirmação bloqueada. Resposta503 incerta mantém chave; alteração dos dados impede outra escrita; repetição/clique duplo reutiliza chave. Não inferimos quantidade de pedidos persistidos a partir do mock.
7. Harness: reload após resultado incerto perde chave/intenção; reproduzido como bloqueio conhecido. Nenhum pedido real foi criado para este teste.
8. Foco por Tab alcança telefone; erros `role=alert`, sucesso de revisão `role=status`. Não é auditoria WCAG completa ou prova de focus trap.

## Correções

- Removido `\\n` literal isolado de `src/styles.css` que causava `[lightningcss] Invalid dangling combinator in selector`; overlay Vite impedia clicar nos produtos. Sem redesign.
- Ação explícita de revisão em checkout/append PRICE_CHANGED, com loading, erro acessível e bloqueio de confirmação.
- `reviewCartPrices` valida entidades/seleções e mesma instância antes de atualizar estimativas; rejeita legado, indisponibilidade e preços fracionários/inválidos. Não cobra nem escreve no backend. Seleções e quantidades são preservadas; sem conversão de IDs.
- Storefront conecta revisão ao `refetch` do catálogo e à substituição da sacola/complementos. Catálogo de outra instância ou indisponível não libera confirmação. Taxa vem dos dados recarregados. O harness testa callback e helper; o transporte real desse callback ainda requer backend isolado.

## Evidências e limites

- `browser-results.json`: 30 verificações de componentes aprovadas e uma reprodução esperada do bloqueio de reload; `knownFailures` impede interpretar isso como aprovação operacional.
- `price-before.json` e `screenshots/price-conflict-before-390.png`: ausência anterior da ação de recuperação.
- `screenshots/store-*.png`, `checkout-*.png`, `delivery-fee-review-390.png`: dados fictícios, cinco resoluções.
- 58 testes Node aprovados, preservando os 54 anteriores; TypeScript, build e ESLint dos arquivos alterados aprovados. `git diff --check` aprovado.
- Lint global Delivery e dívida TypeScript Master não foram reexecutados: fontes fora do escopo preservadas; dívidas anteriores continuam abertas.

**Não executados nesta rodada:** Auth/JWT/RLS/PostgREST reais, matriz real A1/A2/B1, domínio/ingress no browser, preço alterado por administrador autenticado, tracking e append ponta a ponta, concorrência no banco, backend privado indisponível com processamento real, troca de loja durante resposta, restauração ou fechamento completo do navegador. Nenhuma alegação de cobertura desses casos.

## Reprodução da interface isolada

Na raiz Delivery, com dependências existentes, Chromium e Playwright disponíveis:

```bash
export HOMOLOGATION_WORKDIR="$(mktemp -d /tmp/neroxa-ui-qa.XXXXXX)"
chmod 700 "$HOMOLOGATION_WORKDIR"
python3 tests/homologation/create-harness.py
HOMOLOGATION_WORKDIR="$HOMOLOGATION_WORKDIR" node tests/homologation/serve.mjs
```

Em outro terminal: `node tests/homologation/browser.mjs`. O módulo Playwright pode ser selecionado por `PLAYWRIGHT_MODULE`. O runner é de **mocks**, servidor privado desabilitado, e não instala Supabase. Encerrar o servidor e remover somente diretório criado, `homologation-harness.tsx/html` e configuração temporária. Não iniciar navegador fora do contexto com interceptação.

Próxima ação: fechar contrato autoritativo de horários/disponibilidade e recuperação de intenção; executar o browser com a stack nativa em runner descartável que suporte a imagem sem esgotar o disco. Não instalar sandbox antes disso.
