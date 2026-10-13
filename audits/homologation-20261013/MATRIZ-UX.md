# Matriz UX

Desktop:1440×900. Viewports:360×800,390×844,412×915,768×1024. Chromium real, transporte interceptado; nenhum celular físico.

| Funcionalidade                  | Desktop                          | Mobile                       | Resultado / limite                                                                 |
| ------------------------------- | -------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Catálogo/categorias/produto     | Renderiza                        | Renderiza nas resoluções     | Fixture A1; domínios reais de teste não homologados                                |
| Tamanho + adicional pago        | Configuração executada           | Executada390                 | Sem matriz completa de tamanhos/bordas/grupos opcionais                            |
| Min/max/grupos gratuitos        | Não percorrido completamente     | Não percorrido completamente | Validações de domínio anteriores preservadas; não contar como QA UI novo           |
| Sacola/reload                   | Persistência executada           | Persistência executada390    | Não comprova isolamento A2/B1 ou múltiplas abas                                    |
| CSS/overflow do documento       | Aprovado                         | Aprovado5viewports           | Não equivale a ausência de todos os overflows internos                             |
| Checkout da aplicação completa  | Bloqueado                        | Bloqueado                    | Horários sempre vazios; loja fechada                                               |
| Campos obrigatórios             | Harness aprovado                 | Harness aprovado390          | Entrega sem endereço não faz POST; retirada sem endereço válida                    |
| Mudança de preço30→35           | Harness aprovado                 | Harness aprovado             | Atualização explícita, segundo clique necessário; banco não testado                |
| Taxa5→6 /total41                | Harness aprovado390              | Harness aprovado390          | Fixture de tarifa; não operação administrativa autenticada                         |
| Falha na revisão                | Harness bloqueia                 | Harness bloqueia390          | Não desbloqueia confirmação                                                        |
| Resposta incerta /alterar dados | Harness bloqueia                 | Harness bloqueia390          | Mesma chave no retry; não comprova única linha no banco                            |
| Reload após resposta incerta    | Falha de recuperação reproduzida | Mesmo componente             | Nova chave após reload; risco de duplicação, sem prova de pedidos reais duplicados |
| Tracking/append/painel          | Não executado                    | Não executado                | Exigem backend isolado e caminho completo desbloqueado                             |
| A1/A2/B1 /capacidade cruzada    | Não executado                    | Não executado                | Unitários anteriores não substituem banco+browser                                  |
| Teclado                         | Tab ao telefone aprovado         | Sem teclado virtual físico   | Erros anunciáveis; focus trap/IME não certificados                                 |
| Identidade da loja              | Produtos dinâmicos               | Produtos dinâmicos           | Marca Pizza Club fixa no tema observada, não corrigida por redesign                |
