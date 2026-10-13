# Decisão H03/H04 — 2026-10-13

| Destino                  | Decisão                  | Fundamento                                                                                                                                                                                                   |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nova homologação isolada | **GO restrito**          | 493 checks anteriores reexecutados +40 nativos novos +21 browser, todos aprovados em commits exatos; pedido real fictício de retirada, perda de resposta, reabertura, duas abas e acompanhamento exercitados |
| Instalação no sandbox    | **NO-GO nesta execução** | Candidatos novos não reconciliados/aprovados para o schema remoto reduzido; backup/restauração e sequência/executor de instalação continuam gates independentes; nenhum SQL remoto executado                 |
| Produção                 | **NO-GO**                | Sem autorização, fencing após perda integral do storage, reconciliação histórica/cutover, consumidores/deployments, escopo de recuperação e homologação comercial pendentes                                  |

H03: contrato per-instance proposto, ausência fecha, relógio PostgreSQL autoritativo, timezone/exceções e criação/append testados. É extensão candidata, não confirmação de agenda real já existente.

H04: cenário de storage preservado resolve timeout/reload/reabertura e duas abas sem duplicação, com prova completa e endpoint privado. Storage indisponível bloqueia antes de enviar; expiração bloqueia reconciliação automática. **Não classificar H04 como resolução universal**: limpar todo storage, perder o payload original ou perder capacidade de append continuam limites explícitos.

Primeiro Pedido Completo: **PASS apenas para retirada fictícia no ambiente descartável e cenário executado**. Não autoriza primeira loja comercial. Browser não é mock nesse fluxo; contagem/identidade/valores foram conferidos no PostgreSQL e status com JWT Auth real.

Prioridades seguintes:

1. Provar recuperação de intenção GROUP populada após dump/restore e proteger caminho operacional de fencing/cancelamento de tentativas desconhecidas, com ACL/auditoria.
2. Executar entrega com endereço completo e mudança de taxa no browser conectado ao backend; validar dispositivos móveis reais e DST exigido pela loja.
3. Fechar configuração comercial explícita da agenda/retensão, pacote de instalação e backup restaurável do sandbox; manter órfão histórico bloqueado.
4. Só então submeter instalação de testes à aprovação específica. Pagamentos, produção, merge e deploy permanecem fora do escopo.

PRs originais continuam DRAFT. Fonte/evidências: RELATORIO-H03-H04.md e evidence-manifest.json. Nenhuma aprovação de produção inferida de CI verde.
