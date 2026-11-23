# NEROXA — WORKER-REVIEW-FAIL-CLOSED-01

**Data:** 2026-11-23 · **Alvo:** PR #50, somente revisão da LAB Food · **Estado:** `WORKER_REVIEW=PASS`; `WORKER_RUNTIME=NOT_INTEGRATED`; `COMERCIAL=NO-GO`.

## Arquivos e origem

- Arquivo original local verificado: `NEROXA-LAB-ORDER-UI-01-corrected-source.tar.gz`, SHA-256 `a24acb8c3148f1a3156852d1f1e1d906eb56110f397b8494d879034b15dda53b`.
- Copiada uma versão **não implantável** de cinco arquivos a `lab-source/worker-review/worker/`. O SHA-256 de cada original e da cópia de revisão está em `lab-source/worker-review/review-manifest.json`.
- `access-keys.ts` contém conjunto de chaves RSA públicas **vazio**; `access-jwt.ts` contém issuer e audience inoperantes; `worker-order-ui-entry.ts` contém hostname, project e role inoperantes. Isso impede autenticação com as configurações atuais e reduz a exposição de metadados operacionais no repositório público.
- `order-lifecycle.ts` e `index.d.mts` permanecem **byte a byte idênticos** aos originais.
- A configuração real, inclusive os pinos JWK **públicos**, permanece apenas no arquivo original de procedência, e não neste PR.
- O Worker de revisão ainda referencia `index.mjs` e o adaptador GO03R da composição original, portanto **não há build autônomo nem deploy válido deste diretório**. O caminho executável `src/` do Food não foi alterado.

## Verificações reproduzidas neste turno

| Gate | Resultado | Alcance |
|---|---|---|
| Hash Git do Worker de revisão, manifesto, testes e README | **8/8 PASS** | Conferência após gravação no GitHub |
| Hash SHA-256 local dos cinco arquivos de Worker e estado inoperante | **5/5 PASS** | `verify_review_snapshot.py`, offline |
| Transpilação sintática de TypeScript dos quatro módulos `.ts` | **4/4 PASS** | Sem compor SSR, módulos `pg` ou Worker final |
| Testes negativos criptográficos e estáticos | **12/12 PASS** | Chaves RSA geradas localmente, sem tokens reais |
| Teste operacional com pinned JWK vazios | **PASS** | JWT sintético válido é rejeitado: `Access signing key not found` |

### Reprodução local sem conexão

Na raiz de um checkout desta branch, com Python 3, Node 22+ e `typescript` já instalado:

```bash
python3 lab-source/worker-review/verify_review_snapshot.py
node --test lab-source/worker-review/security-tests/access-negative-source.test.cjs
```

A suíte usa apenas fixtures geradas na hora; para compilação TypeScript via Node pode ser definida a variável `NEROXA_TYPESCRIPT_PATH` apontando para um módulo TypeScript já instalado. Não é necessário usar qualquer Bearer do operador, Access cookie, JWT real, token Cloudflare ou senha PostgreSQL.

## O que NÃO foi comprovado

- Na Cloudflare real, JWT ausente/adulterado/expirado resultando na negativa adequada com o Worker privado ativado.
- Replay de nonce após consumo no banco PostgreSQL LAB real.
- Uso da credencial operacional **revogada** em uma requisição HTTP de uma sessão Access válida.
- Tentativa de acesso à LAB B usando sessão/identificador da LAB A.
- Build Worker+SSR+Assets a partir deste repositório e testes de CI numa branch isolada.

Os controles acima exigem outra janela protegida, com autorização, grant novo, deadline curto, verificação do binding ao LAB e rollback automático independente. Não executá-los com o host fechado e considerar `NOT_RUN` como prova de segurança.

## Próximo gate

1. Revisar construção e configuração protegida do Worker original sem copiar segredos para GitHub ou fazer deploy público.
2. Preparar harness HTTP de negativas que NÃO precise receber JWT pessoal pelo chat.
3. Só então decidir sobre outra janela LAB curta; preservar o código original, revogação do grant, bloqueio do checkout público e o estado comercial `NO-GO`.

`PR50=DRAFT` · `WORKER_REVIEW=PASS` · `OFFLINE_SECURITY=12/12` · `LIVE_NEGATIVES=NOT_RUN` · `COMMERCIAL=NO-GO`
