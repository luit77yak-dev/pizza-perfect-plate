# NEROXA V1 — LAB-WATCHDOG-PRIVATE-DB-LOGIN-PREP-01

**Data:** 23/11/2026 · **Alvo:** Supabase LAB `gomexvhvecvvfbdzhjct` · **Escopo:** preparo local de credencial **sem** ativar LOGIN ou Hyperdrive.

## OBJETIVO

Preparar a custódia local e privada de uma nova senha PostgreSQL forte para o futuro papel de revogação do watchdog, reutilizando a LAB e o PR #50. Não gerar credencial em ChatGPT, GitHub, CI ou Cloudflare. Não reutilizar o Bearer operacional da LAB A ou as credenciais do Hyperdrive Food.

## FEITO

- GET Supabase LAB: projeto `neroxa-f01-f02-sec18-lab`, ref `gomexvhvecvvfbdzhjct`, `ACTIVE_HEALTHY`. Consulta `BEGIN READ ONLY ... ROLLBACK` confirmou papel `neroxa_i04_lab_watchdog_revoke`: `rolcanlogin=false`, `rolinherit=false`, `rolbypassrls=false`, `rolcreaterole=false`, `rolcreatedb=false`. Nenhum grant operacional ativo.
- GET Cloudflare para Hyperdrive identificou somente a configuração `neroxa-v1-i04-lab` (ID `e7570caf4da24a53838d3cb9a234d9ac`), apontando à LAB com papel `neroxa_lab_e2e_runtime`. **Nenhum Hyperdrive separado do watchdog criado.**
- Criado arquivo distribuído **diretamente na conversa**, fora do repositório GitHub: `neroxa_watchdog_db_private_20261123.py`. Usa exclusivamente `python3` standard library, `secrets.token_urlsafe(48)` (384 bits) para gerar senha PostgreSQL aleatória, 64 caracteres base64url; cria arquivo `db-role.secret` `0600` dentro da pasta privada `~/.local/share/neroxa/lab-watchdog-db-role/{SESSION_ID}/` `0700`. Manifesto privado registra SHA-256 para conferência local, role/projeto e marca `NETWORK=NONE`, `REMOTE_CHANGES=NONE`. Nunca imprime senha. Exige proteção contra symlinks e verificações de integridade e permissões.
- Comandos locais disponíveis: `--self-test`, `--prepare`, `--status SESSION_ID`. Nenhum deles altera SQL, configura Cloudflare, obtém acesso administrativo ou ativa o login.
- Testes de execução local do próprio script: `OFFLINE_SELF_TEST=PASS`, `DB_PASSWORD_PREP=PASS` em HOME temporário, `--status=PASS`, diretórios com modo `0700` e arquivos com modo `0600`. **A execução no Termux do proprietário ainda depende do usuário.** Nenhuma sessão ou segredo do teste local deve ser interpretado como credencial operacional válida.

## BLOQUEIOS

`USER_TERMUX_PREP=NOT_YET_CONFIRMED`; `DB_ROLE_LOGIN=NOLOGIN`; `PRIVATE_PASSWORD_PROVISIONED=NO`; `CLOUDFLARE_HYPERDRIVE_WATCHDOG=NOT_CREATED`; `PG_DRIVER_BUNDLED=NO`; `WATCHDOG_RECOVERY_RUNTIME=NOT_VERIFIED`; `LIVE_HTTP_NEGATIVES=NOT_RUN`. O script é apenas para custódia e comprovação de criação de credencial local; **não executa a provisão ou o login**.

## PRÓXIMA AÇÃO

Proprietário baixar `neroxa_watchdog_db_private_20261123.py` da conversa e executar em seu Termux `python3 neroxa_watchdog_db_private_20261123.py --self-test` e `--prepare`. Compartilhar apenas a **saída de status**, nunca a senha, manifesto, arquivo .secret ou clipboard. Em missão autorizada separadamente, preparar caminho de administração privada que habilite `LOGIN` e defina a senha sem expor valor no chat/logs, configurar Hyperdrive **exclusivo** com TLS `verify-full` e privilégios mínimos. Só depois empacotar Worker watchdog inativo e provar recuperação real.

`PR50=DRAFT` · `ORIGINAL_100=PRESERVED_LAST_VERIFIED` · `HOST_CLOSED=PRESERVED_LAST_VERIFIED` · `COMMERCIAL=NO-GO`.
