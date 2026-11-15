# Organização por funcionalidades

Cada domínio separa a interface em `components`, o acesso a dados em `services`
e a apresentação/formatação em `facades`. Em `cadastros`, cada submódulo mantém
as próprias três camadas.

- `auth`: autenticação Google com Supabase Auth.
- `cadastros`: insumos, fornecedores, categorias e canais.
- `produtos`: produtos e fichas técnicas.
- `producao`: registro de produção.
- `vendas`: saídas e vendas.

Os arquivos `.gitkeep` mantêm as pastas vazias no Git até a implementação dos
primeiros componentes, serviços e facades.
