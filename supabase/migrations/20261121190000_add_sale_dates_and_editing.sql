ALTER TABLE public.db_vendas_cabecalho
  ALTER COLUMN data_venda SET DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.register_sale_with_date(
  p_id_canal INT,
  p_subtotal NUMERIC,
  p_desconto NUMERIC,
  p_observacoes TEXT,
  p_itens JSONB,
  p_pagamentos JSONB,
  p_data_venda DATE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id_venda INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_data_venda IS NULL
    OR p_data_venda < DATE '0100-01-01'
    OR p_data_venda > DATE '9999-12-31'
  THEN
    RAISE EXCEPTION 'INVALID_SALE_DATE' USING ERRCODE = '22023';
  END IF;

  v_id_venda := public.register_sale(
    p_id_canal, p_subtotal, p_desconto, p_observacoes, p_itens, p_pagamentos
  );
  UPDATE public.db_vendas_cabecalho
  SET data_venda = (p_data_venda::TIMESTAMP + INTERVAL '15 hours') AT TIME ZONE 'UTC'
  WHERE id = v_id_venda AND user_id = v_user_id;

  RETURN v_id_venda;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sale_details(
  p_id_venda INT,
  p_data_venda DATE,
  p_observacoes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_data_venda TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_id_venda IS NULL OR p_id_venda < 1 THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_data_venda IS NOT NULL AND (
    p_data_venda < DATE '0100-01-01'
    OR p_data_venda > DATE '9999-12-31'
  ) THEN
    RAISE EXCEPTION 'INVALID_SALE_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_observacoes IS NOT NULL AND pg_catalog.length(p_observacoes) > 1000 THEN
    RAISE EXCEPTION 'INVALID_SALE_NOTES' USING ERRCODE = '22023';
  END IF;

  SELECT sale.data_venda INTO v_data_venda
  FROM public.db_vendas_cabecalho AS sale
  WHERE sale.id = p_id_venda AND sale.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_data_venda IS NOT NULL AND p_data_venda IS NULL THEN
    RAISE EXCEPTION 'INVALID_SALE_DATE' USING ERRCODE = '22023';
  END IF;

  UPDATE public.db_vendas_cabecalho
  SET data_venda = CASE
        WHEN p_data_venda IS NULL THEN NULL
        WHEN v_data_venda IS NOT NULL
          AND ((v_data_venda AT TIME ZONE 'UTC') - INTERVAL '3 hours')::DATE = p_data_venda
          THEN v_data_venda
        ELSE (p_data_venda::TIMESTAMP + INTERVAL '15 hours') AT TIME ZONE 'UTC'
      END,
      observacoes = NULLIF(pg_catalog.btrim(COALESCE(p_observacoes, '')), '')
  WHERE id = p_id_venda AND user_id = v_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_sale_with_date(INT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_sale_details(INT, DATE, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_sale_with_date(INT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, DATE)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sale_details(INT, DATE, TEXT)
  TO authenticated;
