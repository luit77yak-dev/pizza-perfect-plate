# NEROXA — LAB-SECURITY-HTTP-PREP-01

**Data:** 23/11/2026. **PR:** #50, branch `evidence/lab-order-ui-e2e-20261123`. **Escopo:** preparação de testes negativos, sem HTTP remoto.

## Entrega

- Harness de browser explicitamente inerte por padrão, sem JWT/cookie exportado, seis POSTs no máximo, uso da sessão Cloudflare Access existente somente numa janela autorizada.
- Matrix de negativas operacionais: controle positivo de grant A, acesso A→B 403, grant revogado A 403/SQLSTATE 42501, ausência de Bearer 401, catálogo 200 com nonce único e replay 409.
- Entradas sigilosas limitadas a campos `password` no navegador do operador, sem repo, parâmetro CLI ou console. Validação de host `.workers.dev`, HTTPS, origin atual, instâncias UUID A/B distintas, expiração até 15 minutos e aprovação em duas etapas (externa + confirmação local).
- Testes unitários em mock sem rede, integrados à CI de PR somente leitura.

## Limites

O modo mock prova apenas o comportamento do executor, **não** que a LAB real bloqueou algo. A criação/consumo dos nonces gera escrita no PostgreSQL LAB, exigindo autorização própria na janela real. O teste de grant revogado requer prova externa da revogação e a negativa A→B depende de grant A válido. O JWT inválido no Worker Cloudflare não pode ser provado pela simples alteração de cabeçalho em navegador com Access; fica `NOT_RUN` até procedimento protegido separado.

Permanecem `LAB_ORDER_UI_E2E=PASS` histórico e `WORKER_RUNTIME=NOT_INTEGRATED` no PR de revisão; nenhum deploy, SQL, mudança Cloudflare, Git merge ou integração comercial autorizada. `PUBLIC_CHECKOUT=OFF`, `COMERCIAL=NO-GO`.