# NEROXA — LAB-SECURITY-INACTIVE-STAGE-01

**Data:** 2026-11-23 · **Autorização:** proprietário autorizou preparar **staging inativo** e grant restrito LAB A. A ativação da rota, deploy e testes HTTP permanecem fora do escopo.

## OBJETIVO

Reconstituir de maneira auditável a versão LAB Food/Worker previamente validada sem tocar no deployment original e preparar a emissão privada de nova credencial operacional A. Não usar tokens revogados nem antecipar janela de exposição.

## FEITO

Cloudflare API (conta LAB `8c26d033e8893cf22a84d11c629d9b42`, Worker `neroxa-v1-i04-api-lab`):

1. Read-only preflight: versão original `33c3539b-b50a-48b5-b869-9a4aa6811fed` implantada a 100%; workers.dev=false; previews=false; staging anterior v32 `f7b21f69-ec76-4b95-85e7-ccb9da93f7c8` com 53 módulos, ASSETS, HYPERDRIVE, secret_text LAB_QUOTA_SECRET, version_metadata, prazo já expirado.
2. Tentativa com beta Create Version e `deploy=false` foi **rejeitada HTTP 400, 10305** (`Cannot use an assets binding without assets`); não criou versão. Não foi feito deploy.
3. Usado endpoint de **upload de versão sem deployment** `POST /workers/scripts/{script_name}/versions`, `bindings_inherit=strict`, módulos da v32, `keep_assets=true`, secret_text herdado da versão anterior; novo prazo intencionalmente fechado `LAB_LIFECYCLE_DEADLINE=2000-01-01T00:00:00Z`. Primeira versão inativa `42c17aae-fbd3-44df-a3a5-98b6887a3d7e` preservou assets e bindings mas duplicou módulo `_headers` (inserido automaticamente via assets e enviado explicitamente). Não usar.
4. Segunda versão inativa **corrigida** `de02bde8-0254-4b8a-af20-3dc238169d61`: 52 módulos enviados (excluindo apenas `_headers`, que `keep_assets` adicionou automaticamente). GET com `include=modules` confirmou **53 módulos**: mesmas 53 identidades e mesmos `content_base64`/MIME types da v32, sem qualquer diferença ou duplicata. `ASSETS` presente e sua configuração igual à da versão anterior (worker-first); `HYPERDRIVE` id `e7570caf4da24a53838d3cb9a234d9ac`; `LAB_QUOTA_SECRET` tipo `secret_text` herdado sem revelar valor; `WORKER_VERSION` presente; deadline `2000-01-01T00:00:00Z`.
5. GET após upload: versão original continua **100%** servindo (sem troca de deployment); workers.dev=false e previews=false. O upload não altera a implantação e a versão **não atende tráfego**.

Supabase LAB `gomexvhvecvvfbdzhjct`: consulta `BEGIN READ ONLY ... ROLLBACK` confirmou constraints da tabela `private.neroxa_lab_operator_grants`: token SHA256 único, 64 caracteres hex, FK para instância e validade maior que created_at e até 2 horas. Nenhum novo grant ou nonce foi criado. Históricos A/B mantêm 0 grants ativos segundo preflight anterior.

Gerador local para Termux `neroxa_http_operator_20261123.py` preparado fora do repositório público: Python stdlib, arquivo de token local `0600`, diretórios `0700`, nenhum print de Bearer e nenhum request remoto; teste offline PASS. Usuário deve gerar um **novo token** no próprio aparelho e compartilhar **somente** seu SHA256; a emissão do grant exige um token verificável e deve acontecer junto da janela com expiry curta. **Não** reutilizar digest/hash de grants já revogados.

## PROVA / ESTADO

`STAGE_INACTIVE=PASS`; `STAGE_VERSION=de02bde8-0254-4b8a-af20-3dc238169d61`; `MODULE_CONTENT=53/53_MATCH`; `DUPLICATES=0`; `ASSETS_BINDING=PASS`; `ASSETS_CONFIG=PASS`; `QUOTA_BINDING=INHERITED`; `DEADLINE=2000-01-01_CLOSED`; `DEPLOY=NOT_RUN`; `ORIGINAL_100=PASS`; `WORKERS_DEV=false`; `PREVIEWS=false`; `NEW_OPERATOR_GRANT=NOT_CREATED`; `PUBLIC_CHECKOUT=OFF`; `COMERCIAL=NO-GO`.

**Limite:** o mesmo `content_base64` e a configuração de assets conferem módulos, mas não constituem novo E2E nem prova independente do manifesto remoto de cada arquivo. Uma versão **com prazo fechado não pode ser implantada como janela operacional**. Antes da futura janela, compor nova versão inativa com deadline válido <=15 min, validar Access runtime, novo grant A restrito, rollback independente + fechamento automático e só então solicitar autorização delimitada para deploy/rota/testes.

## BLOQUEIO

Credencial operacional nova **não disponível neste canal**. As anteriores foram revogadas; gravar hash velho viola UNIQUE ou mantém token inválido. Gerar novo Bearer exclusivamente no Termux, sem enviar original. Admissão SQL de grant somente com SHA256 novo e expiração da janela real. Não criar um grant de 2 horas prematuramente que expiraria antes de teste.

## PRÓXIMA AÇÃO

Proprietário executa `neroxa_http_operator_20261123.py --prepare` localmente e informa apenas `LAB_A_TOKEN_SHA256`. Reconciliar novo hash com `private.neroxa_lab_operator_grants` via SELECT para assegurar não usado; preparar a janela protegida e então conceder grant A temporário autorizado, com revogação ao fechar. PR #50 permanece Draft, nenhum merge ou alteração comercial.


## RECIBO DA CREDENCIAL — 23/11/2026 (apenas metadados, sem identificadores públicos)

- Gerador local Termux confirmado pelo proprietário: `LOCAL_OPERATOR_PREP=PASS`, armazenamento local restrito `0600/0700`, `NETWORK=NONE`, `GRANT_CREATED=NO`.
- Valor do novo Bearer, hash SHA-256 e identificador da sessão **não são copiados para o repositório público**, CI, documentação ou artefatos. A prova de unicidade foi consultada no Supabase LAB de forma somente leitura: `MATCHING_GRANTS=0` (nenhum grant ativo, revogado ou histórico para o hash fornecido no canal de homologação).
- Revalidação por `BEGIN READ ONLY ... ROLLBACK`: LAB A, 5 grants revogados/0 ativos; LAB B, 1 revogado/0 ativos.
- Cloudflare GET após o recebimento: original `33c3539b-b50a-48b5-b869-9a4aa6811fed` continua 100%, workers.dev/previews desabilitados, versão staging `de02bde8-0254-4b8a-af20-3dc238169d61` segue com deadline fechado `2000-01-01T00:00:00Z`.
- **Resultado:** `OPERATOR_LOCAL=READY`, `SHA256_UNIQUE=PASS`, `GRANT_CREATED=NO`, `LIVE_WINDOW=HOLD`. Próximo gate: preparar janela protegida real com deadline novo e rollback independente antes de criar grant por tempo restrito. Não abrir host nem implantar versão a partir deste recibo.
