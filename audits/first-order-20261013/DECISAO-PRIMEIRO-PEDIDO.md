# Decisão — Primeiro Pedido Completo

## Decisões independentes

1. **GO restrito para considerar homologado o fluxo de entrega em ambiente isolado**, condicionado ao workflow final aprovado apontado no relatório: compra real fictícia, preço/taxa PostgreSQL, persistência única, painel Auth e conclusão refletida no tracking. Não é homologação universal de todas as perdas de identidade/infraestrutura.
2. **GO para continuar homologação do painel mínimo operacional.** Não declarar painel comercial completo, substituir /painel legado ou ampliar GRANTs. Proprietário A1 e negativas A2/B1/outsider foram testados com Auth real.
3. **GO apenas para preparar/revisar o pacote de instalação em sandbox. Instalação remota continua NO-GO.** Reconciliar schema reduzido, oito migrations anteriores+novos candidatos, executor/owners/ACL, dados e backup restaurável. Nenhuma autorização de aplicação inferida.
4. **NO-GO para produção.** Sem autorização comercial/deploy, recuperação anônima universal, DR entre clusters, validação física mobile, consumidores legados, reconciliação órfã e demais gates de cutover pendentes.

## Recuperação: limite obrigatório

Chave conhecida + autorização administrativa: neroxa_reconcile_checkout retorna CONFIRMED para pedido persistido ou FENCED_ABSENT depois de serializar e bloquear para sempre a mesma chave/instância. Não gera outra chave, não apaga histórico, não captura pagamento e não emite token de append.

Sem chave/prova, inclusive perda de cookies+storage+memória ou outro perfil, o sistema não pode distinguir visitante novo de tentativa antiga. Classificação UNKNOWN e repetição não autorizada. Operador pode consultar seu painel e preservar informações/recibos existentes por canais administrativos; ausência de busca por telefone não comprova falha de pedido. Se for necessário suspender recebimento por segurança, utilizar disponibilidade autorizada da instância; reabrir não substitui fencing de requests antigos. Não há liberação automática desse cenário nesta candidata.

Marcador cookie/memória é somente uma negação adicional, sem PII ou autorização. Lease da intenção24h não é janela comercial de retenção nem direito de apagar tentativa desconhecida. Cookie de negação propõe365 dias, sujeito a revisão de privacidade; navegador pode apagá-lo, portanto não é solução universal.

## Próximos gates

- Revisar comercialmente grafo de estados, cancelamento, agenda e retenção.
- Reconciliar /painel e consumidores publicados antes do rollout coordenado.
- Identidade/reconciliação durável e fencing para perda total de estado, sem lookup público por telefone.
- Backup/restauração independente do sandbox aprovado e pacote de instalação com preflight seguro.
- QA em celular físico e operação assistida; MFA plataforma preservado mas não inferir nova homologação GUI de todos os papéis a partir de usuário OWNER.

PRs originais permanecem DRAFT. Esta decisão não concede merge, deploy, SQL remoto ou pagamentos.

Execução final confirmada: Actions38455409691 SUCCESS; entrega+painel73/73 e segurança operacional24/24. Evidências em evidence/native e manifest. O GO restrito do item1 está sustentado por esse par de commits, sem aprovar os cenários universais de recuperação ainda bloqueados.
