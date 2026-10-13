# Decisão de homologação

- **GO restrito para continuar homologação isolada:** correções CSS e revisão de preço funcionam nos componentes, com58 testes Node e30 verificações de navegador positivas. Uma reprodução adicional confirma o limite de recuperação após reload.
- **NO-GO para instalar em sandbox:** não houve banco/Auth/PostgREST operacional nesta rodada; fluxo inteiro ainda bloqueado por horários, recuperação de intenção e QA integrada A1/A2/B1.
- **NO-GO produção:** nenhuma autorização de deploy/merge/SQL decorre deste trabalho. PRs originais e main preservadas; pagamentos não habilitados.

## Ordem das próximas ações

1. Reconciliar contrato de horários/disponibilidade com o catálogo Master e regras do servidor. Não usar ausência de horários como autorização de abertura.
2. Definir recuperação mínima da intenção após resposta incerta/reload/fechar checkout, sem gerar chave nova silenciosamente e sem persistir dados pessoais desnecessários. Testar armazenamento bloqueado e reabertura.
3. Acoplar browser ao ensaio Supabase nativo em runner descartável com capacidade efetiva para imagem PG17; pin de Master703ef87 e candidata Delivery com estas correções. Reusar catálogo completo e ordem validada, não fixture mínima de segurança.
4. Executar A1/A2/B1 com ingress de domínios fictícios, Auth/RLS reais, alteração autenticada de preços/taxas, checkout persistido, painel/tracking/append e respostas incertas. Conferir banco e interface, não somentestatus HTTP.
5. Completar grupos opcionais/min/max/gratuitos, bordas/tamanhos, quantidade/remoção, focus trap e celular físico. Combos/meio-a-meio/ledger seguem bloqueados.

Critério de avanço para sandbox: fluxo completo sem falha monetária/isolation, recuperação de pedido incerto comprovada, todos os casos obrigatórios executados ou impedimentos explicitamente aceitos mediante decisão própria. Evidências493/193 anteriores permanecem referência, não aprovação automática desta candidata.
