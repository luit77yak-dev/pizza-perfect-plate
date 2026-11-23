# NEROXA — LAB-SECURITY-HTTP-LIVE-ADMISSION-01

**Data:** 2026-11-23 (Brasília) · **PR:** #50 Draft · **Tipo:** auditoria remota de leitura, sem execução HTTP da candidata.

## OBJETIVO

Conferir as precondições reais para futura janela protegida dos negativos HTTP LAB A/B preparados em `lab-source/security-http/`. **Não** abrir worker, criar grants, implantar versões, migrar SQL ou alterar produção nesta missão.

## FEITO / PROVA

Consultas GET Cloudflare e SQL `BEGIN READ ONLY ... ROLLBACK` restritas à LAB existente:

| Gate | Resultado de 23/11/2026 | Leitura correta |
| --- | --- | --- |
| Cloudflare Worker original | versão original preservada, deployment de restauração a 100% | `ROLLBACK_TARGET=RECONCILED` (API de rollback **não** executada neste turno) |
| URLs | workers.dev=false, previews=false | `HOST=CLOSED`, não existe janela HTTP atual |
| Access | aplicativo self-hosted cobre o ID do Worker, política Allow por e-mail e política non_identity por Service Token; sem Bypass identificado nas políticas listadas | `ACCESS_CONFIG=RECONCILED`; **runtime Access NOT_VERIFIED** |
| Service Tokens | os 2 cadastrados expiraram em 19 e 20/11 | não reutilizar tokens antigos; navegador humano segue como método de autenticação candidato |
| Hyperdrive LAB | configurações existentes: origem LAB, TLS verify-full, cache desabilitado, limite origem 5 | não há prova de handshake da futura candidata |
| Supabase LAB | projeto ACTIVE_HEALTHY, PostgreSQL 17.11 | nenhum SQL de escrita executado |
| LAB A / LAB B | instâncias ACTIVE; **0 grants ativos em cada**. A: 5 revogados; B: 1 revogado | `OPERATOR_GRANT_A=NOT_ACTIVE` |
| Domínio no PostgreSQL LAB | hostname da candidata vinculado à instância A, status VERIFIED no catálogo | validação de cadastro, **não** prova de roteamento/Access em runtime |
| Nonces Cloudflare | 96 registros, 0 dentro de validade no instante consultado | os testes novos consumirão nonces somente mediante autorização específica |
| Versão testada no E2E anterior | candidata anterior ainda contém ASSETS/HYPERDRIVE/LAB_QUOTA_SECRET/version metadata, mas deadline expirou às 13:09:34 UTC de 23/11 | não reutilizar nem declarar versão apta a executar |

Não ler valores de tokens, segredo de quota, Bearer, JWT, cookies, JWKs pessoais ou hashes de grants. Nenhum segredo foi incluído neste documento.

## BLOQUEIO REAL

`LIVE_WINDOW=HOLD` por **ausência de grant operacional A válido**, **prazo expirado da candidata existente** e **host atualmente fechado**. Um teste real requer ainda prova de bloqueio anônimo do Access e mecanismo de rollback independente pronto. Esses bloqueios não desqualificam os E2E históricos, mas impedem começar os negativos agora.

`LAB_ORDER_UI_E2E=PASS_HISTORICAL` · `SECURITY_HTTP_MOCK=7/7_PASS` · `LIVE_HTTP_NEGATIVES=NOT_RUN` · `JWT_CLOUDFLARE_RUNTIME=NOT_RUN`.

## PRÓXIMA AÇÃO MÍNIMA — em missão separadamente autorizada

1. Revalidar versão original e roteamento Access; preparar nova candidata inativa da composição protegida existente com deadline de **até 15 minutos** e quota criptografada, sem alterar o 100% original durante o staging.
2. Validar um único grant novo, temporário, restrito a LAB A e um grant anterior revogado, com custódia apenas no canal privado e leitura independente de `revoked_at`. Preservar LAB B e pedidos anteriores.
3. Preparar e verificar rollback independente + fechamento workers.dev/previews, expiração e revogação; verificar transporte navegador pessoal e que requests não autenticadas recebem desafio Access. Reabertura de host, deploy temporário, criação de grant e escritas de nonce precisam de autorização explícita e delimitada **antes** da janela.
4. Só então executar os seis casos HTTP da suíte preparada, conferir registros por SELECT, encerrar o host e confirmar original novamente a 100%.

Não interpretar esta auditoria documental como autorização de implantação. Não atualizar `main`, não fazer merge do PR, não executar SQL comercial nem afirmar `COMERCIAL=GO`. `PR50=DRAFT`, `PUBLIC_CHECKOUT=OFF`, `COMERCIAL=NO-GO`.
