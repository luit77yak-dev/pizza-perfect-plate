# NEROXA — LAB-ORDER-UI-01 | reprodução focal de fontes e testes

**Data:** 2026-11-23  
**Escopo:** reprodução offline, somente leitura de infraestrutura.  
**Resultado:** `SOURCE_SNAPSHOT_SHA=12/12 PASS`; `LOCAL_TESTS=30/30 PASS`; `RUNTIME_INTEGRATION=NOT_RUN`.

## Fonte exata

`NEROXA-LAB-ORDER-UI-01-GO03R-INTEGRADO(1).zip`  
SHA-256: `090167fd3c7b4ecf23bb0b7ef9bfe31d61d63e3d027eade42c9cee666e0c323e`.

Origem dos 12 arquivos preservados: `composition/go03r/food/src/` dentro do ZIP.

Os arquivos foram importados **sem alteração de bytes** para `lab-source/food-overlay/src/`. A leitura de retorno dos 12 GitHub blobs confirmou SHA-1 idêntico ao Git blob calculado sobre os bytes originais (**12/12 PASS**); o SHA-256 esperado consta do manifesto em `docs/lab/e2e/`.

## Reprodução local de testes

Foram extraídos da mesma fonte apenas `composition/lab-order-ui-01/` e `helper/test-env.cjs` para diretório temporário local. Foi usado Node.js **v22.16.0** e a instalação de TypeScript já disponível, sem rede nem instalação.

Com o diretório de testes preparado:

```bash
export NEROXA_TYPESCRIPT_PATH="$(node -p "require.resolve('typescript')")"
node --require ./helper/test-env.cjs --test lab-order-ui-01/tests/*.test.cjs
```

Resultado efetivamente observado:

```text
1..30
# tests 30
# pass 30
# fail 0
# cancelled 0
# skipped 0
```

A primeira execução falhou apenas porque o auxiliar tentava resolver o TypeScript em um caminho do ambiente original, inexistente nesta cópia. A execução final com a variável `NEROXA_TYPESCRIPT_PATH` apontando para o TypeScript instalado passou 30/30, sem alterar as asserções dos testes.

## Limites

- Os 30 testes usam as fontes e `test-build` do **ZIP original**, não um build recompilado da branch GitHub.
- O PR #50 ainda é **DRAFT**, e os 12 arquivos estão numa pasta fora da árvore executável de produção; não são uma aplicação implantável.
- O E2E funcional da LAB A foi comprovado independentemente no Chrome e no Supabase, com dois pedidos fictícios novos e históricos completos. Essa reprodução local não acrescenta prova de JWT negativo no host Cloudflare ou de isolamento cruzado via navegador.
- Não houve deploy, SQL, alterações Access, push em `main`, nem qualquer escrita no comercial.

**Próximo gate:** review da separação runtime LAB e importação do Worker/testes, seguida dos controles de segurança restantes. `COMERCIAL=NO-GO`.
