-- Cópia pontual: leia as instruções no README antes de executar.
-- Preencha os UUIDs de Authentication > Users. NÃO use e-mails ou tokens.
DO $copia$
DECLARE
  v_origem UUID := NULL;  -- Exemplo: '00000000-0000-0000-0000-000000000001'
  v_destino UUID := NULL; -- Exemplo: '00000000-0000-0000-0000-000000000002'
BEGIN
  IF v_origem IS NULL OR v_destino IS NULL OR v_origem = v_destino THEN
    RAISE EXCEPTION 'Informe UUIDs distintos para origem e destino.';
  END IF;
  IF (SELECT count(*) FROM auth.users
      WHERE id IN (v_origem, v_destino) AND deleted_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Origem e destino devem ser usuários ativos existentes.';
  END IF;

  -- Impede alterações concorrentes durante a leitura e a substituição.
  LOCK TABLE public.db_categoria_insumo, public.db_categoria_produto,
    public.db_insumos, public.db_fornecedores, public.db_fichas,
    public.db_fichas_itens, public.db_ajustes_estoque_produto,
    public.db_compras_historico, public.db_fichas_historico_custos
    IN SHARE ROW EXCLUSIVE MODE;

  IF NOT EXISTS (SELECT 1 FROM public.db_fichas WHERE user_id = v_origem)
     AND NOT EXISTS (SELECT 1 FROM public.db_compras_historico WHERE user_id = v_origem) THEN
    RAISE EXCEPTION 'Origem sem fichas e compras; confira os UUIDs antes de continuar.';
  END IF;

  CREATE TEMP TABLE copia_categorias_produto (
    origem INT PRIMARY KEY, destino INT NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE copia_insumos (
    origem INT PRIMARY KEY, destino INT NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE copia_fornecedores (
    origem INT PRIMARY KEY, destino INT NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE copia_fichas (
    origem INT PRIMARY KEY, destino INT NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE copia_compras (
    origem INT PRIMARY KEY, destino INT NOT NULL UNIQUE
  ) ON COMMIT DROP;

  INSERT INTO public.db_categoria_insumo (user_id, nome)
  SELECT v_destino, s.nome FROM public.db_categoria_insumo s
  WHERE s.user_id = v_origem AND NOT EXISTS (
    SELECT 1 FROM public.db_categoria_insumo d
    WHERE d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  );
  UPDATE public.db_categoria_insumo d SET nome = s.nome
  FROM public.db_categoria_insumo s
  WHERE s.user_id = v_origem AND d.user_id = v_destino
    AND lower(btrim(d.nome)) = lower(btrim(s.nome));

  INSERT INTO public.db_categoria_produto (user_id, nome)
  SELECT v_destino, s.nome FROM public.db_categoria_produto s
  WHERE s.user_id = v_origem AND NOT EXISTS (
    SELECT 1 FROM public.db_categoria_produto d
    WHERE d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  );
  UPDATE public.db_categoria_produto d SET nome = s.nome
  FROM public.db_categoria_produto s
  WHERE s.user_id = v_origem AND d.user_id = v_destino
    AND lower(btrim(d.nome)) = lower(btrim(s.nome));
  INSERT INTO copia_categorias_produto
  SELECT s.id, d.id FROM public.db_categoria_produto s
  JOIN public.db_categoria_produto d
    ON d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  WHERE s.user_id = v_origem;

  INSERT INTO public.db_insumos
    (user_id, nome, unidade, categoria, custo_estimado_unitario, estoque_atual, ativo)
  SELECT v_destino, s.nome, s.unidade, s.categoria, s.custo_estimado_unitario, s.estoque_atual, s.ativo
  FROM public.db_insumos s
  WHERE s.user_id = v_origem AND NOT EXISTS (
    SELECT 1 FROM public.db_insumos d
    WHERE d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  );
  UPDATE public.db_insumos d SET
    nome = s.nome, unidade = s.unidade, categoria = s.categoria,
    custo_estimado_unitario = s.custo_estimado_unitario,
    estoque_atual = s.estoque_atual, ativo = s.ativo
  FROM public.db_insumos s
  WHERE s.user_id = v_origem AND d.user_id = v_destino
    AND lower(btrim(d.nome)) = lower(btrim(s.nome));
  INSERT INTO copia_insumos
  SELECT s.id_insumo, d.id_insumo FROM public.db_insumos s
  JOIN public.db_insumos d
    ON d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  WHERE s.user_id = v_origem;

  INSERT INTO public.db_fornecedores (user_id, nome, endereco, ativo, criado_em, atualizado_em)
  SELECT v_destino, s.nome, s.endereco, s.ativo, s.criado_em, s.atualizado_em
  FROM public.db_fornecedores s
  WHERE s.user_id = v_origem AND NOT EXISTS (
    SELECT 1 FROM public.db_fornecedores d
    WHERE d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  );
  UPDATE public.db_fornecedores d SET
    nome = s.nome, endereco = s.endereco, ativo = s.ativo, criado_em = s.criado_em
  FROM public.db_fornecedores s
  WHERE s.user_id = v_origem AND d.user_id = v_destino
    AND lower(btrim(d.nome)) = lower(btrim(s.nome));
  INSERT INTO copia_fornecedores
  SELECT s.id_fornecedor, d.id_fornecedor FROM public.db_fornecedores s
  JOIN public.db_fornecedores d
    ON d.user_id = v_destino AND lower(btrim(d.nome)) = lower(btrim(s.nome))
  WHERE s.user_id = v_origem;

  IF EXISTS (
    SELECT 1 FROM public.db_fichas s
    LEFT JOIN copia_categorias_produto c ON c.origem = s.id_categoria
    WHERE s.user_id = v_origem AND s.id_categoria IS NOT NULL AND c.origem IS NULL
  ) THEN
    RAISE EXCEPTION 'Ficha de origem com categoria não encontrada.';
  END IF;
  INSERT INTO public.db_fichas (
    user_id, nome_receita, rendimento, custo_embalagem, custo_mao_obra,
    custo_armazenamento, custo_total, custo_unitario, id_categoria,
    preco_venda, estoque_atual, ativo
  )
  SELECT v_destino, s.nome_receita, s.rendimento, s.custo_embalagem, s.custo_mao_obra,
    s.custo_armazenamento, s.custo_total, s.custo_unitario, c.destino,
    s.preco_venda, s.estoque_atual, s.ativo
  FROM public.db_fichas s
  LEFT JOIN copia_categorias_produto c ON c.origem = s.id_categoria
  WHERE s.user_id = v_origem AND NOT EXISTS (
    SELECT 1 FROM public.db_fichas d
    WHERE d.user_id = v_destino AND lower(btrim(d.nome_receita)) = lower(btrim(s.nome_receita))
  );
  UPDATE public.db_fichas d SET
    nome_receita = s.nome_receita, rendimento = s.rendimento,
    custo_embalagem = s.custo_embalagem, custo_mao_obra = s.custo_mao_obra,
    custo_armazenamento = s.custo_armazenamento, custo_total = s.custo_total,
    custo_unitario = s.custo_unitario, id_categoria = c.destino,
    preco_venda = s.preco_venda, estoque_atual = s.estoque_atual, ativo = s.ativo
  FROM public.db_fichas s
  LEFT JOIN copia_categorias_produto c ON c.origem = s.id_categoria
  WHERE s.user_id = v_origem AND d.user_id = v_destino
    AND lower(btrim(d.nome_receita)) = lower(btrim(s.nome_receita));
  INSERT INTO copia_fichas
  SELECT s.id_ficha, d.id_ficha FROM public.db_fichas s
  JOIN public.db_fichas d
    ON d.user_id = v_destino AND lower(btrim(d.nome_receita)) = lower(btrim(s.nome_receita))
  WHERE s.user_id = v_origem;

  IF EXISTS (
    SELECT 1 FROM public.db_fichas_itens i
    LEFT JOIN copia_fichas f ON f.origem = i.id_ficha
    LEFT JOIN copia_insumos s ON s.origem = i.id_insumo
    WHERE i.user_id = v_origem AND (f.origem IS NULL OR s.origem IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.db_ajustes_estoque_produto a
    LEFT JOIN copia_fichas f ON f.origem = a.id_ficha
    WHERE a.user_id = v_origem AND f.origem IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.db_compras_historico p
    LEFT JOIN copia_insumos s ON s.origem = p.id_insumo
    LEFT JOIN copia_fornecedores f ON f.origem = p.id_fornecedor
    WHERE p.user_id = v_origem AND (s.origem IS NULL OR f.origem IS NULL)
  ) THEN
    RAISE EXCEPTION 'Há itens, ajustes ou compras de origem com referências inválidas.';
  END IF;

  INSERT INTO copia_compras
  SELECT p.id_compra, nextval(pg_get_serial_sequence('public.db_compras_historico', 'id_compra'))
  FROM public.db_compras_historico p WHERE p.user_id = v_origem;
  IF EXISTS (
    SELECT 1 FROM public.db_compras_historico p
    LEFT JOIN copia_compras c ON c.origem = p.id_compra_compensada
    WHERE p.user_id = v_origem AND p.id_compra_compensada IS NOT NULL AND c.origem IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.db_fichas_historico_custos h
    LEFT JOIN copia_fichas f ON f.origem = h.id_ficha
    LEFT JOIN copia_insumos s ON s.origem = h.id_insumo_alterado
    LEFT JOIN copia_compras c ON c.origem = h.id_compra_origem
    WHERE h.user_id = v_origem AND
      (f.origem IS NULL OR s.origem IS NULL OR
       (h.id_compra_origem IS NOT NULL AND c.origem IS NULL))
  ) THEN
    RAISE EXCEPTION 'Há cancelamentos ou históricos de custo de origem com referências inválidas.';
  END IF;

  DELETE FROM public.db_fichas_itens i
  USING copia_fichas f WHERE i.user_id = v_destino AND i.id_ficha = f.destino;
  INSERT INTO public.db_fichas_itens (user_id, id_ficha, id_insumo, qtd_insumo)
  SELECT v_destino, f.destino, s.destino, i.qtd_insumo
  FROM public.db_fichas_itens i
  JOIN copia_fichas f ON f.origem = i.id_ficha
  JOIN copia_insumos s ON s.origem = i.id_insumo
  WHERE i.user_id = v_origem;

  -- Históricos do destino são substituídos integralmente, não mesclados.
  DELETE FROM public.db_fichas_historico_custos WHERE user_id = v_destino;
  DELETE FROM public.db_ajustes_estoque_produto WHERE user_id = v_destino;
  DELETE FROM public.db_compras_historico WHERE user_id = v_destino;

  INSERT INTO public.db_ajustes_estoque_produto
    (user_id, id_ficha, tipo, quantidade_delta, motivo, criado_em)
  SELECT v_destino, f.destino, a.tipo, a.quantidade_delta, a.motivo, a.criado_em
  FROM public.db_ajustes_estoque_produto a
  JOIN copia_fichas f ON f.origem = a.id_ficha WHERE a.user_id = v_origem;

  INSERT INTO public.db_compras_historico (
    id_compra, user_id, id_lote, data_compra, id_insumo, id_fornecedor,
    quantidade, unidade_compra, valor_total, valor_unitario, tipo_movimento,
    status, id_compra_compensada, motivo_cancelamento, registrado_em,
    cancelado_em, cancelado_por
  )
  SELECT m.destino, v_destino, p.id_lote, p.data_compra, s.destino, f.destino,
    p.quantidade, p.unidade_compra, p.valor_total, p.valor_unitario, p.tipo_movimento,
    p.status, compensada.destino, p.motivo_cancelamento, p.registrado_em,
    p.cancelado_em, p.cancelado_por
  FROM public.db_compras_historico p
  JOIN copia_compras m ON m.origem = p.id_compra
  JOIN copia_insumos s ON s.origem = p.id_insumo
  JOIN copia_fornecedores f ON f.origem = p.id_fornecedor
  LEFT JOIN copia_compras compensada ON compensada.origem = p.id_compra_compensada
  WHERE p.user_id = v_origem;

  INSERT INTO public.db_fichas_historico_custos (
    user_id, data_alteracao, id_ficha, id_insumo_alterado, preco_insumo_anterior,
    preco_insumo_novo, impacto_diferenca_brl, novo_custo_total_ficha,
    id_compra_origem, id_lote_compra, tipo_movimento
  )
  SELECT v_destino, h.data_alteracao, f.destino, s.destino, h.preco_insumo_anterior,
    h.preco_insumo_novo, h.impacto_diferenca_brl, h.novo_custo_total_ficha,
    c.destino, h.id_lote_compra, h.tipo_movimento
  FROM public.db_fichas_historico_custos h
  JOIN copia_fichas f ON f.origem = h.id_ficha
  JOIN copia_insumos s ON s.origem = h.id_insumo_alterado
  LEFT JOIN copia_compras c ON c.origem = h.id_compra_origem
  WHERE h.user_id = v_origem;

  RAISE NOTICE 'Cópia concluída: % insumos, % fornecedores, % fichas e % movimentos de compra.',
    (SELECT count(*) FROM copia_insumos), (SELECT count(*) FROM copia_fornecedores),
    (SELECT count(*) FROM copia_fichas), (SELECT count(*) FROM copia_compras);
END
$copia$;
