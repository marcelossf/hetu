# Dicionário de Dados e Schema do Supabase — Hetu

Este documento é a **Fonte Única da Verdade** sobre a estrutura relacional do banco de dados do Hetu. Sempre que uma tabela ou coluna for criada, alterada ou removida no Supabase, este arquivo deve ser atualizado imediatamente para orientar o GitHub Copilot e manter a consistência do código TypeScript.

---

## 1. Grupo 1: Tabelas de Apoio e Cadastros Base

### `db_unidades`
- `id` (INT, PK)
- `nome` (TEXT, NOT NULL)

### `db_categoria_insumo`
- `id` (INT, PK)
- `nome` (TEXT, NOT NULL)

### `db_categoria_produto`
- `id` (INT, PK)
- `nome` (TEXT, NOT NULL)

### `db_fornecedores`
- `id_fornecedor` (INT, PK)
- `nome` (TEXT, NOT NULL)
- `endereco` (TEXT)
- `ativo` (TEXT, DEFAULT 'Sim')

### `db_canais_vendas`
- `id` (INT, PK)
- `nome` (TEXT, NOT NULL)
- `endereco` (TEXT)
- `ativo` (TEXT, DEFAULT 'Sim')

### `db_insumos`
- `id_insumo` (INT, PK)
- `nome` (TEXT, NOT NULL)
- `unidade` (TEXT, NOT NULL)
- `categoria` (TEXT)
- `custo_estimado_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `estoque_atual` (NUMERIC(10,2), DEFAULT 0.00)
- `ativo` (TEXT, DEFAULT 'Sim')

---

## 2. Grupo 2: Produtos e Engenharia de Custos

### `db_fichas`
- `id_ficha` (INT, PK)
- `nome_receita` (TEXT, NOT NULL)
- `rendimento` (NUMERIC(10,2), DEFAULT 1.00)
- `custo_embalagem` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_mao_obra` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_armazenamento` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_total` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `id_categoria` (INT, FK -> `db_categoria_produto(id)`)
- `preco_venda` (NUMERIC(10,2), DEFAULT 0.00)
- `estoque_atual` (NUMERIC(10,2), DEFAULT 0.00)
- `ativo` (TEXT, DEFAULT 'Sim')

### `db_fichas_itens`
- `id_item` (INT, PK)
- `id_ficha` (INT, FK -> `db_fichas(id_ficha)` ON DELETE CASCADE)
- `id_insumo` (INT, FK -> `db_insumos(id_insumo)`)
- `qtd_insumo` (NUMERIC(10,4), DEFAULT 0.0000)

### `db_fichas_historico_custos`
- `id_historico` (INT, PK)
- `data_alteracao` (TIMESTAMP WITH TIME ZONE)
- `id_ficha` (INT, FK -> `db_fichas(id_ficha)`)
- `id_insumo_alterado` (INT)
- `preco_insumo_anterior` (NUMERIC(10,2))
- `preco_insumo_novo` (NUMERIC(10,2))
- `impacto_diferenca_brl` (NUMERIC(10,2))
- `novo_custo_total_ficha` (NUMERIC(10,2))
- `id_compra_origem` (INT)

---

## 3. Grupo 3: Transações, Compras, Produção e Vendas

### `db_compras_historico`
- `id_compra` (INT, PK)
- `data_compra` (TIMESTAMP WITH TIME ZONE)
- `id_insumo` (INT, FK -> `db_insumos(id_insumo)`)
- `id_fornecedor` (INT, FK -> `db_fornecedores(id_fornecedor)`)
- `quantidade` (NUMERIC(10,2), DEFAULT 0.00)
- `unidade_compra` (TEXT)
- `valor_total` (NUMERIC(10,2), DEFAULT 0.00)
- `valor_unitario` (NUMERIC(10,2), DEFAULT 0.00)

### `db_producao`
- `id_producao` (INT, PK)
- `data_producao` (TIMESTAMP WITH TIME ZONE)
- `id_produto` (INT, FK -> `db_fichas(id_ficha)`)
- `qtd_produzida` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_unitario_momento` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_total_lote` (NUMERIC(10,2), DEFAULT 0.00)
- `observacao` (TEXT)

### `db_vendas_cabecalho`
- `id` (INT, PK)
- `data_venda` (TIMESTAMP WITH TIME ZONE)
- `id_canal` (INT, FK -> `db_canais_vendas(id)`)
- `valor_total_pedido` (NUMERIC(10,2), DEFAULT 0.00)
- `desconto` (NUMERIC(10,2), DEFAULT 0.00)
- `publico` (TEXT)
- `observacoes` (TEXT)

### `db_vendas_itens`
- `id_venda_item` (INT, PK)
- `id_venda` (INT, FK -> `db_vendas_cabecalho(id)` ON DELETE CASCADE)
- `id_produto` (INT, FK -> `db_fichas(id_ficha)`)
- `quantidade` (NUMERIC(10,2), DEFAULT 0.00)
- `preco_venda_unitario` (NUMERIC(10,2), DEFAULT 0.00)
- `custo_unitario_historico` (NUMERIC(10,2), DEFAULT 0.00)
- `desconto` (NUMERIC(10,2), DEFAULT 0.00)
- `subtotal` (NUMERIC(10,2), DEFAULT 0.00)

---

## 4. Autenticação de dispositivos

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