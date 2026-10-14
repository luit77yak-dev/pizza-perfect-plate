# Neroxa Delivery — Resultados preliminares da missão 02A

Data: 2026-10-14. Proposta de contenção de F01 somente na rota; **não é homologação de banco**.

## Ambiente e origem

- Repositório: `luit77yak-dev/pizza-perfect-plate`.
- Base: `audit/independent-recovery-v1-20261014` @ `c18d6803b319de442d5dfb2ed1d58fb367df096d`.
- Branch candidata: `security/delivery-02a-panel-gate-20261014`.
- Master PR #37: não alterada. Nenhuma merge, migração, deploy ou banco remoto alterado.
- GitHub Contents API para edição da branch; shell local sem acesso de rede ao GitHub. Sem instalação de dependências ou execução hospedada nesta ação.

## Alteração proposta

- `src/routes/painel.tsx`: rota monta aviso de suspensão em lugar do componente `StaffPanel`; sem chamar funções administrativas legadas pelo navegador dessa rota. Código antigo permanece inativo.
- `tests/legacy-panel-route-gate.test.mjs`: contratos estáticos para impedir retorno do componente inseguro e confirmar encaminhamento limitado a `/admin/pedidos`.
- `audits/02a/*`: inventário, plano de validação real e este registro.

## Evidência / limitações

- A inspeção de código confirmou filtros e writes por `organization_id` na implementação legada; novo painel de pedidos usa RPC com `p_instance_id`.
- Verificação estrutural da versão gravada no GitHub: **7/7 verificações de leitura** passaram (route component, ausência de mount do legado, ausência de chamadas legadas dentro da tela de suspensão, link limitado, aviso comercial, fixtures A/B de mesma organização presentes no teste, código legado mantido inativo). Isso **não equivale à execução de `node --test` nem à matriz Auth/RLS**.
- O workflow `.github/workflows/ci.yml` observa PRs com base `main`; esta PR é intencionalmente contra a branch candidata auditada. Na consulta inicial à API Actions, **0 runs** desta branch; CI portanto **não executado**, não PASS.
- PR criada: https://github.com/luit77yak-dev/pizza-perfect-plate/pull/38 — draft, base `audit/independent-recovery-v1-20261014`, 5 arquivos, 189 adições e 1 remoção (revisão inicial).
- Suite inteira, build, TypeScript e lint: **PENDENTES**, sem afirmar PASS com base nos logs anteriores.
- Auth/RLS/Storage/Realtime para A/B na mesma organização: **PENDENTES** em banco descartável; este patch não revoga grants nem resolve acesso RPC direto.
- Regressão intencional: edição de catálogo, configurações e som legados ficam suspensos em `/painel`; esta UI não substitui a gestão da loja.
- F02 tracking por telefone, permissões SQL, Storage por organização e recuperação T1: fora desta PR e ainda bloqueantes para piloto.

## Critério de revisão da PR

PR **draft** contra o candidato auditado (não a main), com diff de escopo pequeno. Revisores devem verificar que `/painel` nunca monta `StaffPanel`, que login e pedidos no painel novo não são atingidos e que dados antigos não sofreram mutação. Em caso de CI falho, registrar logs e corrigir antes de considerar a PR apta à revisão técnica.

**Estado:** contenção candidata; risco geral F01 não encerrado, piloto bloqueado.
