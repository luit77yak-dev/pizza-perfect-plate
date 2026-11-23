# NEROXA V1 — SECURITY-NEGATIVE-UNIT-01

**Data:** 2026-11-23. **Alvo:** Worker privado LAB A preservado no pacote `NEROXA-LAB-ORDER-UI-01-corrected-source.tar.gz`, derivado do GO03R integrado (SHA-256 `090167fd3c7b4ecf23bb0b7ef9bfe31d61d63e3d027eade42c9cee666e0c323e`).

## Resultado comprovado

`SECURITY_NEGATIVE_UNIT=PASS; 10/10; NETWORK=NONE; REMOTE_WRITES=NONE`.

Testes executados no Node v22.16.0, usando os arquivos reais `lab-source/worker/access-jwt.ts`, `order-lifecycle.ts`, `worker-order-ui-entry.ts` do pacote da homologação. O teste injeta **uma chave RSA gerada exclusivamente para a execução local**; não utiliza nem exporta credenciais, cookies, tokens ou certificados privados reais do Cloudflare Access.

| Controle | Resultado local |
|---|---|
| Assinatura RS256 válida com par de chaves descartável (controle positivo) | PASS |
| JWT ausente ou malformado | PASS: negado |
| Payload adulterado sem nova assinatura | PASS: negado |
| JWT expirado e `nbf` futuro | PASS: negados |
| Emissor ou audiência incorretos | PASS: negados |
| `kid` não confiável ou algoritmo incorreto | PASS: negados |
| Credencial operacional fora do formato Bearer esperado | PASS: negada |
| UUID inválido ou transição de estado fora do contrato | PASS: negado |
| Mapeamento de SQLSTATE de autorização `42501` | PASS: HTTP 403 |
| Presença dos guards de origem, deadline, nonce e bloqueio de checkout público (inspeção estática) | PASS: presentes |

### Reprodução offline

O teste está em `lab-source/security-tests/access-negative-source.test.cjs` neste PR. É necessário **extrair o pacote de fontes verificado** e apontar a variável para o diretório `lab-source/worker` que contém a origem real (a cópia privada do Worker ainda não foi versionada neste PR).

```bash
export NEROXA_LAB_WORKER_DIR=/CAMINHO/EXTRAIDO/lab-source/worker
export NEROXA_TYPESCRIPT_PATH="$(node -p "require.resolve('typescript')")"
node --test lab-source/security-tests/access-negative-source.test.cjs
```

Resultado observado: `tests 10; pass 10; fail 0`. Nenhum token sensível entra no script.

## Fronteira da evidência — ainda NÃO comprovado

- **Host real Cloudflare Access:** JWT inválido/expirado, ausência de Access e comportamento de assets no host real nesta janela: `NOT_RUN`.
- **Nonce consumido duas vezes** contra PostgreSQL/HYPERDRIVE real: `NOT_RUN`. A verificação textual de `neroxa_claim_cloudflare_grant` **não substitui** um teste de replay real.
- **Grant operacional já revogado:** SQL confirma revogação da janela anterior, mas resposta negativa HTTP com JWT pessoal válido após revogação: `NOT_RUN`.
- **Isolamento LAB A → LAB B no browser atual:** `NOT_RUN` neste checkpoint. As provas históricas de APIs anteriores não são automaticamente provas de cada ramo da v32.
- **Código implantável/merge comercial:** `NOT_READY`; esta suíte não executa Worker/DB/CI remoto.

O repositório GitHub Food é **público**. Antes de publicar as fontes completas do Worker devemos decidir se os parâmetros específicos de Access, host e pins JWK públicos precisam ser preservados em local não público ou externalizados num build LAB isolado. Os JWK em questão são chaves **públicas**, não credenciais privadas, mas a revisão de exposição e configuração ainda é obrigatória.

**Próximo gate:** revisar separação de configuração, preparar o build LAB como artefato sem secrets e testar negativas no host protegido em uma janela aprovada com rollback automático. Manter `PUBLIC_CHECKOUT=OFF`, `MAIN_UNCHANGED` e `COMERCIAL=NO-GO`.
