# Organização por funcionalidades

Cada domínio separa a interface em `components`, o acesso a dados em `services`
e a apresentação/formatação em `facades`. Em `cadastros`, cada submódulo mantém
as próprias três camadas.

- `auth`: autenticação Google com Supabase Auth.
- `cadastros`: categorias, insumos e canais de venda estão implementados;
  fornecedores permanecem pendentes.
- `produtos`: categorias de produto, produtos, fichas técnicas e ajustes
  auditáveis de estoque.
- `producao`: registro transacional de produção, com baixa de insumos e
  bloqueio por estoque insuficiente.
- `vendas`: registro de vendas, pagamentos divididos, desconto percentual
  calculado no front-end e cancelamento com reposição de estoque.

Cada módulo separa componentes de interface, serviços de acesso à API e facades
de apresentação. Os endpoints de cadastros autenticam a sessão e exigem o
desbloqueio da página quando a proteção por passkey está ativa.
