-- ============================================================
-- VENTA STATE MACHINE — MercadoLibre-inspired
-- Adds estado_log (JSONB) to ventas for transition audit trail
-- ============================================================

-- 1. Add estado_log column to ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado_log JSONB DEFAULT '[]'::jsonb;

-- 2. Add estado_updated_at and estado_updated_by for quick access
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado_updated_by TEXT;

-- 3. RPC: transition_venta_state
-- Validates transition, appends to log, updates estado
-- Returns error if transition is invalid
CREATE OR REPLACE FUNCTION transition_venta_state(
  p_venta_id   TEXT,
  p_new_estado TEXT,
  p_user_email TEXT DEFAULT 'sistema',
  p_nota       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current  TEXT;
  v_org      TEXT;
  v_log      JSONB;
  v_entry    JSONB;
  v_allowed  TEXT[];
BEGIN
  v_org := get_my_org_id();

  -- Lock the row
  SELECT estado, COALESCE(estado_log, '[]'::jsonb)
  INTO v_current, v_log
  FROM ventas
  WHERE id = p_venta_id AND org_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'venta_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- State machine: define valid transitions
  v_allowed := CASE v_current
    WHEN 'pendiente'  THEN ARRAY['confirmada', 'cancelada']
    WHEN 'confirmada' THEN ARRAY['preparada',  'cancelada']
    WHEN 'preparada'  THEN ARRAY['en_ruta',    'entregada', 'cancelada']
    WHEN 'en_ruta'    THEN ARRAY['entregada',  'cancelada']
    WHEN 'entregada'  THEN ARRAY[]::TEXT[]
    WHEN 'cancelada'  THEN ARRAY[]::TEXT[]
    ELSE ARRAY['confirmada', 'preparada', 'en_ruta', 'entregada', 'cancelada']
  END;

  IF NOT (p_new_estado = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'invalid_transition:%:%', v_current, p_new_estado
      USING ERRCODE = 'P0001';
  END IF;

  -- Build log entry
  v_entry := jsonb_build_object(
    'from',  v_current,
    'to',    p_new_estado,
    'ts',    NOW(),
    'user',  p_user_email,
    'nota',  p_nota
  );

  -- Append to log and update estado
  UPDATE ventas
  SET
    estado             = p_new_estado,
    estado_log         = v_log || v_entry,
    estado_updated_by  = p_user_email,
    updated_at         = NOW()
  WHERE id = p_venta_id AND org_id = v_org;

  RETURN jsonb_build_object(
    'ok',        true,
    'from',      v_current,
    'to',        p_new_estado,
    'ts',        NOW(),
    'log_size',  jsonb_array_length(v_log) + 1
  );
END;
$$;

-- VERIFY:
-- SELECT transition_venta_state('test-id', 'confirmada', 'admin@aryes.com');
-- SELECT estado, estado_log FROM ventas WHERE id = 'test-id';
