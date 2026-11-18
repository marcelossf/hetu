ALTER TABLE public.db_categoria_insumo
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.db_insumos
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.db_categoria_insumo_nome_ci_key;
DROP INDEX IF EXISTS public.db_insumos_nome_ci_key;

DO $$
DECLARE
  owner_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.db_categoria_insumo
    WHERE user_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.db_insumos
    WHERE user_id IS NULL
  ) THEN
    SELECT id
    INTO owner_id
    FROM auth.users
    WHERE deleted_at IS NULL
    ORDER BY created_at, id
    LIMIT 1;

    IF owner_id IS NULL THEN
      RAISE EXCEPTION
        'Cannot assign existing supply catalog rows: no active Supabase users exist';
    END IF;

    -- Preserve legacy IDs for the oldest active account, then copy its catalog.
    UPDATE public.db_categoria_insumo
    SET user_id = owner_id
    WHERE user_id IS NULL;

    UPDATE public.db_insumos
    SET user_id = owner_id
    WHERE user_id IS NULL;

    INSERT INTO public.db_categoria_insumo (nome, user_id)
    SELECT category.nome, target_user.id
    FROM public.db_categoria_insumo AS category
    CROSS JOIN auth.users AS target_user
    WHERE category.user_id = owner_id
      AND target_user.deleted_at IS NULL
      AND target_user.id <> owner_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.db_categoria_insumo AS existing
        WHERE existing.user_id = target_user.id
          AND lower(btrim(existing.nome)) = lower(btrim(category.nome))
      );

    INSERT INTO public.db_insumos (
      nome,
      unidade,
      categoria,
      custo_estimado_unitario,
      estoque_atual,
      ativo,
      user_id
    )
    SELECT
      supply.nome,
      supply.unidade,
      supply.categoria,
      supply.custo_estimado_unitario,
      supply.estoque_atual,
      supply.ativo,
      target_user.id
    FROM public.db_insumos AS supply
    CROSS JOIN auth.users AS target_user
    WHERE supply.user_id = owner_id
      AND target_user.deleted_at IS NULL
      AND target_user.id <> owner_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.db_insumos AS existing
        WHERE existing.user_id = target_user.id
          AND lower(btrim(existing.nome)) = lower(btrim(supply.nome))
      );
  END IF;
END;
$$;

ALTER TABLE public.db_categoria_insumo
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.db_insumos
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS db_categoria_insumo_user_nome_ci_key
  ON public.db_categoria_insumo (user_id, lower(btrim(nome)));

CREATE UNIQUE INDEX IF NOT EXISTS db_insumos_user_nome_ci_key
  ON public.db_insumos (user_id, lower(btrim(nome)));

CREATE INDEX IF NOT EXISTS db_categoria_insumo_user_id_idx
  ON public.db_categoria_insumo (user_id);

CREATE INDEX IF NOT EXISTS db_insumos_user_id_idx
  ON public.db_insumos (user_id);

CREATE OR REPLACE FUNCTION public.sync_db_insumos_categoria_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.db_insumos
    SET categoria = NEW.nome
    WHERE categoria = OLD.nome
      AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS db_categoria_insumo_sync_name ON public.db_categoria_insumo;
CREATE TRIGGER db_categoria_insumo_sync_name
AFTER UPDATE OF nome ON public.db_categoria_insumo
FOR EACH ROW
EXECUTE FUNCTION public.sync_db_insumos_categoria_name();

DROP POLICY IF EXISTS "Authenticated users can read ingredient categories"
  ON public.db_categoria_insumo;
CREATE POLICY "Users can read their ingredient categories"
  ON public.db_categoria_insumo
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create ingredient categories"
  ON public.db_categoria_insumo;
CREATE POLICY "Users can create their ingredient categories"
  ON public.db_categoria_insumo
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update ingredient categories"
  ON public.db_categoria_insumo;
CREATE POLICY "Users can update their ingredient categories"
  ON public.db_categoria_insumo
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read ingredients" ON public.db_insumos;
CREATE POLICY "Users can read their ingredients"
  ON public.db_insumos
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create ingredients" ON public.db_insumos;
CREATE POLICY "Users can create their ingredients"
  ON public.db_insumos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update ingredients" ON public.db_insumos;
CREATE POLICY "Users can update their ingredients"
  ON public.db_insumos
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
