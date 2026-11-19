# Dicionário de Dados e Schema do Supabase — Hetu

Este documento é a **Fonte Única da Verdade** sobre a estrutura relacional do banco de dados do Hetu. Sempre que uma tabela ou coluna for criada, alterada ou removida no Supabase, este arquivo deve ser atualizado imediatamente para orientar o GitHub Copilot e manter a consistência do código TypeScript.

---

## 1. Grupo 1: Tabelas de Apoio e Cadastros Base

### `db_unidades`
- `id` (INT, PK, gerado por identity)
- `nome` (TEXT, NOT NULL)

### `db_categoria_insumo`
- `id` (INT, PK, gerado por identity)
- `nome` (TEXT, NOT NULL)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)

Unidades são compartilhadas e somente usuários autenticados podem lê-las.
Categorias e insumos pertencem ao usuário autenticado (`auth.uid()`), com RLS
limitando leitura, inclusão e atualização ao proprietário. Os nomes de
categorias e insumos são únicos por usuário, sem distinção entre
maiúsculas/minúsculas; não há exclusão pela API. A migração
`supabase/migrations/20261118095900_create_supply_catalog_tables.sql` cria as
tabelas e as unidades iniciais `un`, `g`, `kg`, `ml` e `l`. A migração
`supabase/migrations/20261118103700_scope_supply_catalog_by_user.sql` aplica o
isolamento por usuário e copia o catálogo existente para cada conta Supabase
ativa. Os registros originais mantêm seus IDs para a conta ativa mais antiga;
as cópias recebem novos IDs.

### `db_categoria_produto`
- `id` (INT, PK, gerado por identity)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `nome` (TEXT, NOT NULL)

Se a tabela já existir sem `user_id`, a migração
`supabase/migrations/20261118123000_create_product_production_sales.sql`
atribui as categorias existentes à conta Supabase ativa mais antiga e as copia
para as demais contas ativas, preservando os IDs originais para a primeira conta.

### `db_fornecedores`
- `id_fornecedor` (INT, PK, gerado por identity)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `nome` (TEXT, NOT NULL)
- `endereco` (TEXT)
- `ativo` (TEXT, DEFAULT 'Sim')
- `criado_em` (TIMESTAMPTZ, DEFAULT NOW())
- `atualizado_em` (TIMESTAMPTZ, DEFAULT NOW())

Fornecedores são isolados por usuário por RLS. O nome é único por usuário sem
distinção entre maiúsculas/minúsculas. A exclusão da API é lógica (`ativo =
'Não'`), preservando fornecedores referenciados pelo histórico de compras.

### `db_canais_vendas`
- `id` (INT, PK, gerado por identity)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `nome` (TEXT, NOT NULL)
- `endereco` (TEXT)
- `ativo` (TEXT, DEFAULT 'Sim')

### `db_insumos`
- `id_insumo` (INT, PK, gerado por identity)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `nome` (TEXT, NOT NULL)
- `unidade` (TEXT, NOT NULL)
- `categoria` (TEXT)
- `custo_estimado_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `estoque_atual` (NUMERIC(12,4), DEFAULT 0.00)
- `ativo` (TEXT, DEFAULT 'Sim')

O nome de insumo é único por usuário, sem distinção entre maiúsculas/minúsculas.
Ao renomear uma categoria, o banco atualiza o texto correspondente somente nos
insumos do mesmo usuário.

---

## 2. Grupo 2: Produtos e Engenharia de Custos

### `db_fichas`
- `id_ficha` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `nome_receita` (TEXT, NOT NULL)
- `rendimento` (NUMERIC(10,2), DEFAULT 1.00)
- `custo_embalagem` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_mao_obra` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_armazenamento` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_total` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `id_categoria` (INT, FK composta -> `db_categoria_produto(user_id, id)`)
- `preco_venda` (NUMERIC(10,2), DEFAULT 0.00)
- `estoque_atual` (NUMERIC(10,2), DEFAULT 0.00)
- `ativo` (TEXT, DEFAULT 'Sim')

### `db_fichas_itens`
- `id_item` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_ficha` (INT, FK -> `db_fichas(id_ficha)` ON DELETE CASCADE)
- `id_insumo` (INT, FK composta -> `db_insumos(user_id, id_insumo)`)
- `qtd_insumo` (NUMERIC(10,4), quantidade por unidade produzida)

Produtos, categorias, canais, produção, ajustes de estoque e vendas pertencem
ao usuário autenticado. As tabelas usam RLS e chaves estrangeiras compostas
para impedir vínculos entre dados de contas diferentes. Categorias e canais
permitem CRUD não destrutivo pela API; fichas e operações são gravadas por
funções transacionais que obtêm o usuário por `auth.uid()`.

O custo da ficha é calculado no servidor com os custos atuais dos insumos e os
custos adicionais do lote, normalizados pelo rendimento. A ficha armazena as
quantidades por unidade de produto (`rendimento` normalizado para 1), o custo
unitário e o estoque acabado. A migração
`supabase/migrations/20261118123000_create_product_production_sales.sql`
cria o schema e as funções protegidas `save_ficha`,
`adjust_product_stock`, `register_production`, `register_sale` e `cancel_sale`.
Nas tabelas legadas de produtos, produção e vendas que ainda não tenham
`user_id`, os registros existentes são atribuídos à conta Supabase ativa mais
antiga. Sequências ausentes para IDs também são criadas e sincronizadas.

### `db_producao`
- `id_producao` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `data_producao` (TIMESTAMPTZ, DEFAULT NOW())
- `id_produto` (INT, FK composta -> `db_fichas(user_id, id_ficha)`)
- `qtd_produzida` (NUMERIC(10,2))
- `custo_unitario_momento` (NUMERIC(10,2))
- `custo_total_lote` (NUMERIC(10,2))
- `observacao` (TEXT)

### `db_producao_itens`
- `id_item` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_producao` (INT, FK composta -> `db_producao(user_id, id_producao)`)
- `id_insumo` (INT, FK composta -> `db_insumos(user_id, id_insumo)`)
- `qtd_consumida` (NUMERIC(12,4))
- `custo_unitario_momento` (NUMERIC(10,2))
- `custo_total` (NUMERIC(10,2))

O registro da produção bloqueia a operação se faltar qualquer insumo e atualiza
insumos, estoque do produto acabado e histórico em uma única transação.

### `db_ajustes_estoque_produto`
- `id_ajuste` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_ficha` (INT, FK composta -> `db_fichas(user_id, id_ficha)`)
- `tipo` (TEXT, `saldo_inicial` ou `ajuste`)
- `quantidade_delta` (NUMERIC(10,2), diferente de zero)
- `motivo` (TEXT, obrigatório)
- `criado_em` (TIMESTAMPTZ, DEFAULT NOW())

O estoque inicial e os ajustes manuais são auditáveis; produção e vendas
possuem seus próprios históricos de movimentação.

### `db_fichas_historico_custos`
- `id_historico` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `data_alteracao` (TIMESTAMP WITH TIME ZONE)
- `id_ficha` (INT, FK -> `db_fichas(id_ficha)`)
- `id_insumo_alterado` (INT)
- `preco_insumo_anterior` (NUMERIC(10,2))
- `preco_insumo_novo` (NUMERIC(10,2))
- `impacto_diferenca_brl` (NUMERIC(10,2))
- `novo_custo_total_ficha` (NUMERIC(10,2))
- `id_compra_origem` (INT)
- `id_lote_compra` (UUID)
- `tipo_movimento` (TEXT, `compra` ou `cancelamento`)

---

## 3. Grupo 3: Transações, Compras, Produção e Vendas

### `db_compras_historico`
- `id_compra` (INT, PK, gerado por identity)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_lote` (UUID, identifica o lote com um fornecedor e uma data)
- `data_compra` (TIMESTAMP WITH TIME ZONE)
- `id_insumo` (INT, FK composta -> `db_insumos(user_id, id_insumo)`)
- `id_fornecedor` (INT, FK composta -> `db_fornecedores(user_id, id_fornecedor)`)
- `quantidade` (NUMERIC(12,4), positiva na compra e negativa no estorno)
- `unidade_compra` (TEXT)
- `valor_total` (NUMERIC(10,2), DEFAULT 0.00)
- `valor_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `tipo_movimento` (TEXT, `compra` ou `cancelamento`)
- `status` (TEXT, `registrada`, `cancelada` ou `compensacao`)
- `id_compra_compensada` (INT, único por usuário quando informado)
- `motivo_cancelamento` (TEXT)
- `registrado_em` (TIMESTAMPTZ, DEFAULT NOW())
- `cancelado_em` (TIMESTAMPTZ)
- `cancelado_por` (UUID, FK -> `auth.users(id)` ON DELETE SET NULL)

Compras são registradas somente com fornecedor e insumo ativos já existentes.
Um lote possui um único fornecedor/data e contém de 1 a 100 insumos. A função
`register_purchase_batch` trava os insumos, atualiza estoque e custo médio
ponderado, grava o histórico e recalcula todas as fichas afetadas em uma única
transação. A função `cancel_purchase_batch` trava o lote inteiro, impede
cancelamento duplicado, bloqueia saldo ou custo resultantes negativos e
preserva a auditoria por movimentos compensatórios. Após cada alteração de
custo, `db_fichas_historico_custos` registra o impacto granular por ficha e
insumo. A migração
`supabase/migrations/20261119080000_create_purchasing_foundation.sql` cria a
fundação e as políticas RLS; o usuário autenticado recebe somente leitura das
movimentações e executa mutações pelas funções protegidas.

### `db_vendas_cabecalho`
- `id` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `data_venda` (TIMESTAMPTZ, DEFAULT NOW())
- `id_canal` (INT, FK composta -> `db_canais_vendas(user_id, id)`)
- `subtotal_pedido` (NUMERIC(10,2))
- `desconto` (NUMERIC(10,2), valor monetário calculado no front-end)
- `valor_total_pedido` (NUMERIC(10,2), subtotal menos desconto)
- `status` (TEXT, `concluida` ou `cancelada`)
- `observacoes` (TEXT)
- `cancelada_em` (TIMESTAMPTZ)

### `db_vendas_itens`
- `id_venda_item` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_venda` (INT, FK composta -> `db_vendas_cabecalho(user_id, id)`)
- `id_produto` (INT, FK composta -> `db_fichas(user_id, id_ficha)`)
- `nome_produto` (TEXT, cópia histórica do nome)
- `quantidade` (NUMERIC(10,2))
- `preco_venda_unitario` (NUMERIC(10,2))
- `custo_unitario_historico` (NUMERIC(10,2))
- `desconto` (NUMERIC(10,2), reservado para desconto por item)
- `subtotal` (NUMERIC(10,2))

### `db_vendas_pagamentos`
- `id_pagamento` (INT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `id_venda` (INT, FK composta -> `db_vendas_cabecalho(user_id, id)`)
- `forma_pagamento` (TEXT: `pix`, `dinheiro`, `cartao_debito`,
  `cartao_credito`, `transferencia` ou `outro`)
- `valor` (NUMERIC(10,2), maior que zero)
- `criado_em` (TIMESTAMPTZ, DEFAULT NOW())

O percentual de desconto não é persistido: a interface calcula o valor em
moeda e apenas esse valor é armazenado. Uma venda pode ter vários pagamentos,
mas precisa estar quitada no registro. O cancelamento preserva o histórico de
pagamentos e repõe o estoque; eventuais reembolsos são tratados fora do Hetu.
Para vendas legadas, a migração
`supabase/migrations/20261118135000_reconcile_legacy_sales_schema.sql`
completa os campos ausentes, deriva o subtotal dos itens (ou do total mais o
desconto quando não há itens) e recupera o nome histórico a partir do produto.

---

## 4. Autenticação de dispositivos

### `user_security_settings`
- `user_id` (UUID, PK, FK -> `auth.users(id)` ON DELETE CASCADE)
- `biometric_enabled` (BOOLEAN, DEFAULT TRUE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### `user_passkeys`
- `credential_id` (TEXT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `public_key` (TEXT, chave pública WebAuthn codificada em Base64URL)
- `counter` (BIGINT, DEFAULT 0)
- `transports` (TEXT[], DEFAULT `{}`)
- `device_type` (TEXT, `singleDevice` ou `multiDevice`)
- `backed_up` (BOOLEAN, DEFAULT FALSE)
- `created_at` (TIMESTAMP WITH TIME ZONE)

### `user_passkey_challenges`
- `challenge` (TEXT, PK)
- `user_id` (UUID, FK -> `auth.users(id)` ON DELETE CASCADE)
- `purpose` (TEXT, `registration` ou `authentication`)
- `page_nonce` (UUID)
- `expires_at` (TIMESTAMP WITH TIME ZONE)
- `consumed_at` (TIMESTAMP WITH TIME ZONE, NULL enquanto não utilizado)
- `created_at` (TIMESTAMP WITH TIME ZONE)

As tabelas têm RLS habilitado e não concedem acesso direto a `anon` ou
`authenticated`; somente o servidor as consulta e altera usando uma chave de
serviço privada. Cada desafio WebAuthn é consumido uma única vez para impedir
repetição de uma resposta. A migração correspondente está em
`supabase/migrations/20261117150000_create_user_passkeys.sql`.
A preferência biométrica por conta é criada por
`supabase/migrations/20261117170000_add_biometric_preferences.sql`.