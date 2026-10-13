# Recuperação e idempotência — candidata H04

Data: 2026-10-13. Proposta registrada antes do SQL e refinada após testes. Flags inicialmente desligadas. Não autoriza produção.

## Comportamento anterior

Checkout mantinha chave e `bindRequestIntent` em refs; reload/unmount apagavam ambos. O PostgreSQL GROUP já armazenava SHA do JSONB completo e recusava payload diferente com a mesma chave. O gateway não reemite a capacidade de append no replay. Tracking por telefone legado não é prova adequada de recuperação.

## Ciclo da intenção

Antes do primeiro POST, `withDurableCheckoutIntent` adquire Web Lock exclusivo por instância e persiste versão, instância, UUID aleatório, SHA-256 do payload, referência SHA dos lineIds, timestamps e estado PENDING. Valida escrita e leitura de retorno antes de enviar. Nenhum nome, telefone, endereço, payload integral ou token de append é salvo pelo cofre. O hash é pseudonimização, não certificação de anonimato.

Chave local: `neroxa:checkout-intent:v1:<instance_id>`. Fingerprint usa JSON canônico no navegador; banco calcula independentemente o hash do JSONB integral recebido, incluindo a chave. Hashes cliente e banco não são comparados entre si: cada lado valida consistência com seu registro original.

Resposta confirmada válida, com snapshot da instância correta: marca CONFIRMED, sem apagar imediatamente o tombstone. Mesmo carrinho em outra aba reutiliza a mesma chave. Nova compra após confirmação exige referência distinta dos lineIds. Carrinho PENDING diferente é bloqueado.

Timeout, HTTP503, resposta perdida ou inválida: permanece PENDING. Não cria outra chave. Reload/reabertura restaura chave e exige reentrada do payload original. Mudança de dados, itens, total ou modalidade impede retry. Serializer de recuperação preserva o snapshot original mesmo se SKU for desativado; o servidor devolve apenas replay comprovado ou valida integralmente uma criação nova.

PRICE_CHANGED com rollback explícito só descarta automaticamente uma intenção criada **nessa primeira tentativa**. Se já havia tentativa incerta, rejeitar o retry não comprova que a primeira saiu de trânsito: conserva PENDING até reconciliação. Revisão do catálogo não submete pedido automaticamente.

## Autorização da recuperação

RPC service-only `neroxa_recover_group_order(instance,key,p_order)` exige instância/chave correspondentes e SHA do payload integral igual ao registro privado. Endpoint same-origin `/api/order-recover` reutiliza validação de domínio, identidade da loja e corpo do gateway, sem criação de pedido. Chave isolada ou telefone isolado não retornam resultado; anon/authenticated não executam RPC diretamente.

Tracking novo usa a prova original somente em memória; não restaura histórico legado por telefone nem persiste PII do novo pedido. Após reload, recuperar mediante dados originais reentrados. Banco permanece autoridade de preço, itens, estado e snapshot. Não há progresso automático de status.

Capacidade de append permanece privada e independente. Uma resposta inicial perdida não permite reemitir/rotacionar token. Recuperar o pedido não concede automaticamente novo direito de append.

## Expiração, storage e concorrência

Lease de 24h para novas intenções no banco e no navegador. Coluna nullable para registros antigos, sem backfill/renovação automática. Intenção desconhecida expirada ou corrompida mantém bloqueio; HTTP410 não autoriza novo pedido. Pedidos/histórico não são apagados. Reconciliação privilegiada e fencing ainda exigem procedimento próprio.

Storage ou Web Locks indisponíveis: negar antes de enviar. Falha ao salvar confirmação mantém chave original conservadoramente. Lock protege abas da mesma origem; banco mantém idempotência entre chamadas concorrentes. `clearPurchased` remove somente linhas efetivamente compradas e inalteradas, preservando itens acrescentados posteriormente e callbacks de outra instância.

**Limitação não fechada:** limpeza/evicção de todo armazenamento, outro dispositivo ou perfil diferente não podem ser detectados só pelo localStorage. Um fluxo futuro precisa de identidade persistente/cookie protegida ou reconciliação operacional com fencing. Não prometer deduplicação global de compras sem essa evidência. Não oferecer botão de apagar intenção desconhecida.

## Quotas de leitura

O polling existente de 5 segundos não pode consumir a quota de criação (5 tentativas/10 min). Foi proposta e implementada quota privada independente de recuperação: 30 leituras/contato/minuto e 120/instância/minuto, com HMAC e namespace recovery; sem telefone em claro. RLS/ACL e execução service-only, incremento transacional. A quota de criação anterior não é alterada. Limites de leitura são proposta técnica de homologação, sujeitos à avaliação de capacidade. Jobs de limpeza e retenção não estão habilitados nesta candidata.

## Configuração de teste e compatibilidade

Servidor: GROUP, gateway, REQUIRE_DURABLE_CHECKOUT_INTENTS e CHECKOUT_RECOVERY_ENABLED explícitos; backend primário coincide com backend Delivery e segredo HMAC sintético. Cliente: GROUP, gateway e DURABLE_CHECKOUT_INTENTS explícitos. Ativar somente no processo descartável. Variáveis públicas não autorizam operações: gate e validações no servidor/banco são independentes.

Legado permanece separado por flags; não migrar pedidos antigos, reabrir RPCs bloqueadas ou tratar UUID de produto como adicional. SQLs são candidatos revisáveis no Master. SSR, JWT, RLS, HTTP e browser devem ser testados em commits exatos antes de qualquer avanço.
