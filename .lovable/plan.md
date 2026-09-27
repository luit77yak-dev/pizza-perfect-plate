# Corrigir contraste do cabeçalho da loja

## Objetivo
Melhorar a leitura do cabeçalho público em desktop e celular, sem alterar o painel ou qualquer funcionalidade.

## Alterações
- Aplicar uma superfície escura sofisticada e consistente ao cabeçalho, separada da fotografia de fundo.
- Usar tons claros para nome, navegação e ícones, reservando um verde mais luminoso para detalhes e estados.
- Reforçar o botão de pedido/carrinho e seus estados hover, active e focus.
- Preservar dimensões compactas e boa leitura no celular.
- Validar visualmente nos dois tamanhos e conferir a compilação.

## Detalhes técnicos
- As mudanças ficarão limitadas às regras `.ppp-reference-header` em `src/styles.css`.
- Nenhuma lógica, dado ou tela administrativa será alterada.
