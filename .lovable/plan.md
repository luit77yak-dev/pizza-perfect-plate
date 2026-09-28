# Diagnóstico: prévia não atualiza (somente leitura, nada foi alterado)

## Causa
Erro de sintaxe (arquivo cortado/colado errado). O Vite não consegue ler o arquivo e a prévia não carrega.

1. `src/components/storefront/Storefront.tsx`, linha ~959 (principal)
   ```text
   function getTrackedOrderStatusLabel(status?: OrderStatus) {
     switch (status) {
       case "RECEI;          <- texto cortado aqui
     data: StoreData;        <- começa o meio de outra função (ProductConfigurator)
   ```
   Parte da função `getTrackedOrderStatusLabel` e o começo do `ProductConfigurator` foram apagados e o restante foi colado junto. Por isso aparecem "Unterminated string" (959) e "'}' expected" (2059).
   - Esse defeito **não** foi criado pelo commit 4285964: ele já existia no commit anterior 9b81d8a (linha 896). O 4285964 só adicionou 63 linhas acima e o erro desceu para 959.
   - O commit mais recente (81b17ce "Work in progress") só mexe em `src/integrations/supabase/types.ts` e não é a causa.

2. `src/components/storefront/StorefrontSkeleton.tsx`, linhas 4-5 e 21 (secundário)
   `return (` aparece duas vezes e há um `}` sobrando no final. Veio do commit 36be7e6 ("extract loading skeleton").

Dependências, configuração e sincronização estão normais (pacotes instalados, servidor ativo). O problema é só de sintaxe nesses dois arquivos.

## Correção sugerida (só se você aprovar)
- Recuperar `getTrackedOrderStatusLabel` e o começo de `ProductConfigurator` de um commit antigo em que o arquivo ainda estava inteiro, e colar no lugar da linha 959.
- No Skeleton, apagar o `return (` repetido e o `}` sobrando.
