# Bugs e regressões — Primeiro Pedido

| Gravidade | Problema / reprodução                                            | Causa                                                     | Correção / regressão                                                                                                                          | Estado                                                         |
| --------- | ---------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Alta      | RPC recuperada não expressa grafo estrito de transições | Análise da definição recuperada; não comprovação em produção                     | Grafo estrito candidato documentado; teste real rejeita salto e preserva status/histórico                                                     | Implementado; decisão comercial pendente                       |
| Alta      | Resposta atrasada pode chegar depois de mudar instância/sessão   | Mutação/detalhes sem fence de sequência                   | Invalidação de requests/detalhes, vínculo ordem/instância; browser segura A1, muda A2, libera resposta e verifica ausência                    | Reteste nativo aprovado no cenário registrado                  |
| Média     | Painel não mostra itens, tamanho/borda e adicionais              | Lista retorna somente pedido                              | Detail RPC authenticated-only reutiliza autorização real get_admin_orders; section de itens e snapshots                                       | Fluxo real validado                                            |
| Média     | Logout durante polling deixa Entrar desabilitado                 | Loading pertence a request cancelada, sem reset da sessão | Reset de loading/busy/detalhes e senha; fakeA2/B1/outsider autenticados pelo painel                                                           | Correção em candidata, reteste final registrado no relatório   |
| Média     | Tracking desaparece ao concluir                                  | Filtro exclui DELIVERED/CANCELLED                         | Caminho durable mantém o terminal em memória, preservando legado fora da flag                                                                 | Cliente viu DELIVERED real                                     |
| Alta      | Cofre removido após tentativa permite esquecer identidade        | Somente localStorage                                      | Marcador de negação em memória/cookie sem PII; não autoriza lookup, impede nova chave quando detectado                                        | Parcial; perda de toda identidade permanece bloqueio comercial |
| Alta      | Ausência de pedido não prova ausência de request em trânsito     | Falta de serialização operacional                         | Reconcile Auth OWNER/ADMIN/MANAGER explícito ou plataforma Admin AAL2; advisory lock igual ao checkout e fence permanente por chave/instância | Native race cobre ambas ordens de chegada                      |

## Falhas do harness, separadas de bugs do produto

-38444734319: metadata JSON da fixture restore sem fechamento; substituída por JSON.stringify estruturado.
-38445712600: associação nomeava duas colunas e fornecia três valores; corrigida com sort_order verificado. Domínio antecipado foi conferido na fixture autoritativa e utiliza neroxa_system_domains, sem inventar tabela.
-38444886357: harness procurava borda na etapa de tamanho; seleção transferida para etapa Montagem conforme componente existente.
-38447736851: check de logout era imediato, antes de terminar o handler async; espera DOM de login, sem force ou remoção de assert.
-38450197125: ensaio supunha JWT HS256; contrato nativo difere. Não alterada configuração da stack para encaixar o teste.
-38452954576: token emitido com exp curto ainda foi aceito logo depois da exp. Ensaio mede a janela efetiva de validação/cache, com leituras e deadline limitado; não desabilita verificações nem declara revogação imediata.

Todas as falhas permaneceram registradas como falhas; não são evidência de sucesso. O relatório final identifica execução/SHAs que realmente passaram.

## Pendências relevantes

- Perda de cookies+storage+memória/dispositivo: cliente anônimo não pode ser reconhecido com segurança; não resolver por telefone ou chave nova.
- Sem chave original, operador não comprova inexistência e não deve autorizar repetição. Resultado UNKNOWN continua bloqueado.
- TTL/cache/clock leeway de Auth, comportamento de revogação de JWT e celular físico exigem limites explícitos de homologação.
- /painel legado continua intacto e fora da prova de administração segura por instância; não substituir/redirecionar antes de reconciliar consumidores.
