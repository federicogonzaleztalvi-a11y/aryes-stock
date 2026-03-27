-- ============================================================
-- PHASE 1 / Step 3: Atomic devolucion via Postgres transaction
-- ============================================================

-- 1. Sequence for devolucion numbers
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(nro_devolucion, '[^0-9]', '', 'g'), '')::INTEGER
  ), 0)
  INTO max_num
  FROM devoluciones;

  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'devolucion_nro_seq') THEN
    EXECUTE format('CREATE SEQUENCE devolucion_nro_seq START %s', max_num + 1);
  ELSE
    PERFORM setval('devolucion_nro_seq', GREATEST(max_num + 1, last_value), false)
    FROM devolucion_nro_seq;
  END IF;
END $$;

-- 2. Atomic RPC
CREATE OR REPLACE FUNCTION create_devolucion(
  p_id             TEXT,
  p_nro_devolucion TEXT,
  p_venta_id       TEXT        DEFAULT NULL,
  p_cliente_nombre TEXT        DEFAULT '',
  p_motivo         TEXT        DEFAULT '',
  p_notas          TEXT        DEFAULT '',
  p_items          JSONB       DEFAULT '[]',
  p_user_email     TEXT        DEFAULT 'sistema'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item        JSONB;
  v_prod_uuid   TEXT;
  v_prod_nombre TEXT;
  v_qty         NUMERIC;
  v_unidad      TEXT;
  v_lote_id     TEXT;
  v_inspeccion  TEXT;
  v_curr_stock  NUMERIC;
  v_new_stock   NUMERIC;
  v_org         TEXT;
  v_ahora       TIMESTAMPTZ := NOW();
  v_fecha       TEXT;
BEGIN
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_org   := get_my_org_id();
  v_fecha := TO_CHAR(v_ahora AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY');

  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty        := COALESCE((v_item->>'cantDevolver')::NUMERIC, 0);
    v_inspeccion := COALESCE(v_item->>'inspeccion', 'rechazado');

    IF v_qty <= 0 THEN CONTINUE; END IF;

    -- Only restore stock for approved items
    IF v_inspeccion = 'aprobado' THEN
      v_prod_uuid   := v_item->>'productoId';
      v_prod_nombre := COALESCE(v_item->>'nombre', '');
      v_unidad      := COALESCE(v_item->>'unidad', 'u');
      v_lote_id     := v_item->>'loteId';

      SELECT stock INTO v_curr_stock
      FROM products
      WHERE uuid = v_prod_uuid AND org_id = v_org
      FOR UPDATE;

      IF FOUND THEN
        v_new_stock := v_curr_stock + v_qty;

        UPDATE products
        SET stock = v_new_stock, updated_at = v_ahora
        WHERE uuid = v_prod_uuid AND org_id = v_org;

        INSERT INTO stock_movements (
          id, tipo, producto_id, producto_nombre,
          cantidad, referencia, notas, fecha, timestamp, org_id
        ) VALUES (
          gen_random_uuid()::text, 'devolucion',
          v_prod_uuid, v_prod_nombre, v_qty,
          p_nro_devolucion,
          'Devolución ' || p_nro_devolucion || ' — ' || p_motivo,
          v_ahora::date::text, v_ahora, v_org
        );

        -- Restore lot quantity if item came from a specific lot
        IF v_lote_id IS NOT NULL AND v_lote_id != '' THEN
          UPDATE lotes
          SET cantidad = cantidad + v_qty, updated_at = v_ahora
          WHERE id = v_lote_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Mark original venta as having a return
  IF p_venta_id IS NOT NULL AND p_venta_id != '' THEN
    UPDATE ventas
    SET tiene_devolucion = true, updated_at = v_ahora
    WHERE id = p_venta_id AND org_id = v_org;
  END IF;

  -- Insert devolucion record
  INSERT INTO devoluciones (
    id, nro_devolucion, venta_id, cliente_nombre,
    motivo, notas, items, estado, fecha, creado_en
  ) VALUES (
    p_id, p_nro_devolucion,
    NULLIF(p_venta_id, ''),
    p_cliente_nombre, p_motivo, p_notas,
    p_items, 'procesada', v_fecha, v_ahora
  );

  -- Audit log
  INSERT INTO audit_log (
    id, timestamp, "user", action, detail, org_id
  ) VALUES (
    gen_random_uuid()::text, v_ahora, p_user_email,
    'devolucion',
    jsonb_build_object(
      'id',            p_id,
      'nroDevolucion', p_nro_devolucion,
      'clienteNombre', p_cliente_nombre,
      'motivo',        p_motivo,
      'items',         jsonb_array_length(p_items)
    )::text,
    v_org
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'id',            p_id,
    'nroDevolucion', p_nro_devolucion
  );

EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$;

-- VERIFY:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name = 'create_devolucion' AND routine_schema = 'public';
