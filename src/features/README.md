# Organização por funcionalidades

Cada domínio separa a interface em `components`, o acesso a dados em `services`
e a apresentação/formatação em `facades`. Em `cadastros`, cada submódulo mantém
as próprias três camadas.

- `auth`: autenticação Google com Supabase Auth.
- `cadastros`: categorias e insumos estão implementados; fornecedores e canais
  permanecem pendentes.
- `produtos`: produtos e fichas técnicas.
- `producao`: registro de produção.
- `vendas`: saídas e vendas.

Cada módulo separa componentes de interface, serviços de acesso à API e facades
de apresentação. Os endpoints de cadastros autenticam a sessão e exigem o
desbloqueio da página quando a proteção por passkey está ativa.
