# Candidato de reparo de replay histórico — não promover

Base Delivery #40 7fe0e05ca899de3182872921591cbaccd840e58c. A última função usa v_crust inexistente apesar de declarar v_crust_price/name. Selecionar price/name nessas variáveis já tipadas corrige a compilação e preserva os campos do snapshot e o cálculo autoritativo. Esta edição histórica é somente para instalação **fresh** do perfil candidato em clone; não reexecutar migration em banco instalado. Uma futura implantação exigirá migration incremental revisada e preflight do corpo antigo.

Nenhum schema Master é importado. Regerar o manifesto das 31 migrations deste SHA e verificar cada original/derivado. Validar corpos normalmente: check_function_bodies=on. Omitir somente UPDATE histórico de URL de imagem na reconstrução sem dados reais; documentar a diferença, sem chamar o derivado de replay byte a byte literal.

Storage: o executor postgres não é owner de storage.objects no Supabase nativo. Consultar pg_class/pg_roles e policies no clone. Remover só ALTER TABLE não torna CREATE POLICY permitido ao não-owner. Não transferir owner, não elevar executor e não alterar proteção nativa para conseguir PASS. A quarentena Delivery #40 permanece integral e deve falhar/ficar BLOCKED até uma etapa de administração Storage suportada e autorizada, com identidade owner legítima e contrato operacional. Separar responsabilidade de schema público/Storage não equivale a instalar a quarentena completa. Não há rollback por GRANT inseguro.

Não pronta para merge: comprovação real de replay/checkout pendente; isolamento nativo por instância ausente; quarentena suspende consumidores sem substituto integral.
