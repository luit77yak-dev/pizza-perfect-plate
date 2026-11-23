# NEROXA Food — fontes corrigidas LAB-ORDER-UI-01 (somente revisão)

**Estado: SOURCE_SNAPSHOT=PASS; INTEGRATION_TO_RUNTIME=NOT_DONE; COMMERCIAL=NO-GO.**

Este diretório contém uma **cópia byte a byte** dos 12 arquivos da composição GO03R corrigida que foi usada na candidata LAB A v32 e comprovada em E2E real de pedidos em 23/11/2026.

## Por que os arquivos não foram colocados em `src/`?

Este repositório também é usado pelo Food comercial. As rotas `src/routes/admin/pedidos.tsx` e `src/routes/loja/pedido-lab.tsx` foram criadas como **overlay de um build privado**, protegido por Cloudflare Access e deadline. Sobrescrevê-las diretamente no Food publicado alteraria o comportamento comercial sem uma revisão de isolamento.

Por isso as fontes estão intencionalmente em `lab-source/food-overlay/src/`. A presença nesta pasta **não conecta**, habilita ou publica qualquer endpoint. É uma etapa segura de preservação e code review — não a conclusão da integração de runtime.

## Proveniência conferida

- Origem integral: `NEROXA-LAB-ORDER-UI-01-GO03R-INTEGRADO(1).zip`, SHA-256 `090167fd3c7b4ecf23bb0b7ef9bfe31d61d63e3d027eade42c9cee666e0c323e`.
- Caminho dentro da origem: `composition/go03r/food/src/`.
- Base Food: `integration/v1-cloudflare-food-20261120`, commit `a125b4857c151a7e9f6404aa309c39eee6377dfc`.
- Manifesto SHA-256: `docs/lab/e2e/LAB-ORDER-UI-01-2026-11-23.manifest.json`.
- Os 12 Git blob SHA-1 foram conferidos contra o `git hash-object` equivalente dos bytes originais. Resultado: **12/12 PASS**.

## Validação local, sem dependências

Da raiz de um checkout desta branch:

```bash
python3 lab-source/verify_corrected_source.py
```

Resultado esperado: `SOURCE_SHA256=PASS; FILES=12; MODE=OFFLINE; WRITES=NONE`.

**Não** execute estes handlers comercialmente nem aplique SQL a partir deste diretório. Os SQL 04/05 já foram admitidos no LAB, não devem ser reaplicados. O bundle de testes/worker permanece no pacote de origem enquanto não ocorrer uma revisão específica de importação e de implantação LAB.

## Próximos gates do PR #50

1. Code review das rotas de overlay, autenticação no Access, sessão do operador e API privada; comprovar que não há import/efeito no runtime comercial.
2. Registrar testes estáticos de segurança/isolamento de origem (JWT inválido/expirado, nonce reutilizado, grant revogado, acesso LAB B) antes de nova janela.
3. Incorporar de maneira explícita e protegida o Worker de LAB e o conjunto de testes do bundle; exigir branch e gates de CI para um build separado. Não confundir o checkout v6 de fixture com o carrinho comercial.
4. Manter o PR draft até os gates de revisão e GO/NO-GO. Nenhum deploy, merge para `main` ou alteração comercial autorizada por estas evidências.

A homologação funcional `LAB_ORDER_UI_E2E=PASS` e o rollback `PASS` permanecem preservados.

## Worker privado para code review (inoperante por padrão)

O diretório [`worker-review/`](./worker-review/) preserva os módulos da API LAB em versão revisável, **com a configuração Cloudflare Access real retirada** e todos os JWTs bloqueados por um conjunto de chaves vazio. Veja [`WORKER-REVIEW-FAIL-CLOSED-01`](../docs/lab/e2e/WORKER-REVIEW-FAIL-CLOSED-01.md) para hashes, 12/12 testes offline e negativas HTTP ainda pendentes. Não é runtime deployável e não modifica `src/` comercial.
