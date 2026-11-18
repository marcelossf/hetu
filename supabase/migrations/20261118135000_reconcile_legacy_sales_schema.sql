ALTER TABLE public.db_vendas_cabecalho
  ADD COLUMN IF NOT EXISTS subtotal_pedido NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;

UPDATE public.db_vendas_cabecalho AS sale
SET desconto = 0
WHERE sale.desconto IS NULL;

UPDATE public.db_vendas_cabecalho AS sale
SET subtotal_pedido = COALESCE(
  (
    SELECT ROUND(SUM(item.subtotal), 2)
    FROM public.db_vendas_itens AS item
    WHERE item.id_venda = sale.id
      AND item.user_id = sale.user_id
  ),
  sale.valor_total_pedido + sale.desconto,
  0
)
WHERE sale.subtotal_pedido IS NULL;

UPDATE public.db_vendas_cabecalho
SET valor_total_pedido = subtotal_pedido - desconto
WHERE valor_total_pedido IS NULL;

UPDATE public.db_vendas_cabecalho
SET status = 'concluida'
WHERE status IS NULL;

ALTER TABLE public.db_vendas_cabecalho
  ALTER COLUMN subtotal_pedido SET DEFAULT 0.00,
  ALTER COLUMN subtotal_pedido SET NOT NULL,
  ALTER COLUMN desconto SET DEFAULT 0.00,
  ALTER COLUMN desconto SET NOT NULL,
  ALTER COLUMN valor_total_pedido SET DEFAULT 0.00,
  ALTER COLUMN valor_total_pedido SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'concluida',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.db_vendas_cabecalho'::REGCLASS
      AND conname = 'db_vendas_cabecalho_status_check'
  ) THEN
    ALTER TABLE public.db_vendas_cabecalho
      ADD CONSTRAINT db_vendas_cabecalho_status_check
      CHECK (status IN ('concluida', 'cancelada'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.db_vendas_cabecalho'::REGCLASS
      AND conname = 'db_vendas_cabecalho_user_canal_fkey'
  ) THEN
    ALTER TABLE public.db_vendas_cabecalho
      ADD CONSTRAINT db_vendas_cabecalho_user_canal_fkey
      FOREIGN KEY (user_id, id_canal)
      REFERENCES public.db_canais_vendas (user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.db_vendas_itens
  ADD COLUMN IF NOT EXISTS nome_produto TEXT;

UPDATE public.db_vendas_itens AS item
SET nome_produto = product.nome_receita
FROM public.db_fichas AS product
WHERE item.id_produto = product.id_ficha
  AND item.user_id = product.user_id
  AND item.nome_produto IS NULL;

UPDATE public.db_vendas_itens
SET nome_produto = 'Produto #' || id_produto::TEXT
WHERE nome_produto IS NULL;

ALTER TABLE public.db_vendas_itens
  ALTER COLUMN nome_produto SET NOT NULL;

DO $$
DECLARE
  sequence_name TEXT;
  identity_kind TEXT;
  maximum_id BIGINT;
  sequence_value BIGINT;
  sequence_is_called BOOLEAN;
BEGIN
  sequence_name := pg_get_serial_sequence(
    'public.db_vendas_pagamentos',
    'id_pagamento'
  );

  SELECT attribute.attidentity::TEXT
  INTO identity_kind
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.db_vendas_pagamentos'::REGCLASS
    AND attribute.attname = 'id_pagamento'
    AND NOT attribute.attisdropped;

  IF sequence_name IS NULL THEN
    sequence_name := 'public.db_vendas_pagamentos_id_pagamento_seq';
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s', sequence_name);
    EXECUTE format(
      'ALTER TABLE public.db_vendas_pagamentos ALTER COLUMN id_pagamento SET DEFAULT nextval(%L)',
      sequence_name
    );
    EXECUTE format(
      'ALTER SEQUENCE %s OWNED BY public.db_vendas_pagamentos.id_pagamento',
      sequence_name
    );
  ELSIF identity_kind = '' THEN
    EXECUTE format(
      'ALTER TABLE public.db_vendas_pagamentos ALTER COLUMN id_pagamento SET DEFAULT nextval(%L)',
      sequence_name
    );
  END IF;

  SELECT MAX(id_pagamento)
  INTO maximum_id
  FROM public.db_vendas_pagamentos;

  EXECUTE format(
    'SELECT last_value, is_called FROM %s',
    sequence_name
  )
  INTO sequence_value, sequence_is_called;

  IF maximum_id IS NOT NULL AND (
    sequence_value < maximum_id
    OR (sequence_value = maximum_id AND NOT sequence_is_called)
  ) THEN
    PERFORM setval(sequence_name::REGCLASS, maximum_id, true);
  END IF;
END;
$$;
