-- ============================================================
-- PHASE 1: Atomic venta operations via Postgres transactions
--
-- create_venta(): atomic venta creation
--   Validates stock, deducts, inserts movements, creates venta,
--   writes audit log — all in ONE transaction. Either everything
--   succeeds or nothing changes. No partial state possible.
--
-- cancel_venta(): atomic venta cancellation
--   Restores stock, inserts reversal movements, marks venta
--   cancelled — all in ONE transaction.
--
-- Both use SECURITY DEFINER + auth.jwt() check.
-- Called via: POST /rest/v1/rpc/create_venta
-- ============================================================

-- ── create_venta ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_venta(
  p_id             TEXT,
  p_nro_venta      TEXT,
  p_cliente_id     TEXT,
  p_cliente_nombre TEXT,
  p_items          JSONB,
  p_total          NUMERIC,
  p_descuento      NUMERIC   DEFAULT 0,
  p_notas          TEXT      DEFAULT '',
  p_fecha_entrega  TEXT      DEFAULT NULL,
  p_creado_en      TIMESTAMPTZ DEFAULT NOW(),
  p_user_email     TEXT      DEFAULT 'sistema'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item         JSONB;
  v_prod_uuid    TEXT;
  v_prod_nombre  TEXT;
  v_qty          NUMERIC;
  v_costo_unit   NUMERIC;
  v_unidad       TEXT;
  v_curr_stock   NUMERIC;
  v_new_stock    NUMERIC;
  v_org          TEXT;
BEGIN
  -- Auth check
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_org := get_my_org_id();

  -- ── STEP 1: Validate stock for ALL items ──────────────────
  -- Lock rows to prevent concurrent modifications during this check.
  -- This is the gate — nothing writes until all items are validated.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_uuid  := v_item->>'productoId';
    v_qty        := (v_item->>'cantidad')::NUMERIC;
    v_prod_nombre := v_item->>'nombre';

    SELECT stock INTO v_curr_stock
    FROM products
    WHERE uuid   = v_prod_uuid
      AND org_id = v_org
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', v_prod_uuid;
    END IF;

    IF v_curr_stock < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock:%:disponible %:solicitado %',
        v_prod_nombre, v_curr_stock, v_qty;
    END IF;
  END LOOP;

  -- ── STEP 2: Apply writes (all or nothing from here) ────────

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_uuid  := v_item->>'productoId';
    v_qty        := (v_item->>'cantidad')::NUMERIC;
    v_costo_unit := COALESCE((v_item->>'costoUnit')::NUMERIC, 0);
    v_unidad     := COALESCE(v_item->>'unidad', 'u');
    v_prod_nombre := v_item->>'nombre';

    -- Re-read current stock (already locked in step 1)
    SELECT stock INTO v_curr_stock
    FROM products
    WHERE uuid = v_prod_uuid AND org_id = v_org;

    v_new_stock := GREATEST(0, v_curr_stock - v_qty);

    -- Deduct stock
    UPDATE products
    SET stock      = v_new_stock,
        updated_at = p_creado_en
    WHERE uuid   = v_prod_uuid
      AND org_id = v_org;

    -- Insert stock movement
    INSERT INTO stock_movements (
      id, tipo, producto_id, producto_nombre,
      cantidad, referencia, notas, fecha, timestamp, org_id
    ) VALUES (
      gen_random_uuid()::text,
      'venta',
      v_prod_uuid,
      v_prod_nombre,
      v_qty,
      p_nro_venta,
      'Venta ' || p_nro_venta || ' — ' || p_cliente_nombre,
      p_creado_en::date::text,
      p_creado_en,
      v_org
    );
  END LOOP;

  -- Insert venta record
  INSERT INTO ventas (
    id, nro_venta, cliente_id, cliente_nombre,
    items, total, descuento, estado,
    notas, fecha_entrega, creado_en, org_id
  ) VALUES (
    p_id, p_nro_venta,
    NULLIF(p_cliente_id, ''),
    p_cliente_nombre,
    p_items, p_total, p_descuento, 'pendiente',
    p_notas,
    NULLIF(p_fecha_entrega, ''),
    p_creado_en,
    v_org
  );

  -- Audit log
  INSERT INTO audit_log (
    id, timestamp, "user", action, detail, org_id
  ) VALUES (
    gen_random_uuid()::text,
    p_creado_en,
    p_user_email,
    'venta_creada',
    jsonb_build_object(
      'id',            p_id,
      'nroVenta',      p_nro_venta,
      'clienteNombre', p_cliente_nombre,
      'total',         p_total,
      'items',         jsonb_array_length(p_items)
    )::text,
    v_org
  );

  RETURN jsonb_build_object(
    'ok',        true,
    'id',        p_id,
    'nro_venta', p_nro_venta
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction rolls back automatically on any exception.
    -- Re-raise with structured message for client parsing.
    RAISE;
END;
$$;

-- ── cancel_venta ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_venta(
  p_venta_id    TEXT,
  p_user_email  TEXT DEFAULT 'sistema'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta       RECORD;
  v_item        JSONB;
  v_prod_uuid   TEXT;
  v_qty         NUMERIC;
  v_unidad      TEXT;
  v_prod_nombre TEXT;
  v_curr_stock  NUMERIC;
  v_new_stock   NUMERIC;
  v_org         TEXT;
  v_now         TIMESTAMPTZ := NOW();
BEGIN
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_org := get_my_org_id();

  -- Fetch and lock the venta row
  SELECT * INTO v_venta
  FROM ventas
  WHERE id     = p_venta_id
    AND org_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'venta_not_found:%', p_venta_id;
  END IF;

  IF v_venta.estado = 'cancelada' THEN
    RAISE EXCEPTION 'already_cancelled:%', p_venta_id;
  END IF;

  -- Restore stock for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_venta.items)
  LOOP
    v_prod_uuid  := v_item->>'productoId';
    v_qty        := (v_item->>'cantidad')::NUMERIC;
    v_unidad     := COALESCE(v_item->>'unidad', 'u');
    v_prod_nombre := v_item->>'nombre';

    SELECT stock INTO v_curr_stock
    FROM products
    WHERE uuid   = v_prod_uuid
      AND org_id = v_org
    FOR UPDATE;

    IF FOUND THEN
      v_new_stock := v_curr_stock + v_qty;

      UPDATE products
      SET stock      = v_new_stock,
          updated_at = v_now
      WHERE uuid   = v_prod_uuid
        AND org_id = v_org;

      -- Reversal movement
      INSERT INTO stock_movements (
        id, tipo, producto_id, producto_nombre,
        cantidad, referencia, notas, fecha, timestamp, org_id
      ) VALUES (
        gen_random_uuid()::text,
        'devolucion',
        v_prod_uuid,
        v_prod_nombre,
        v_qty,
        v_venta.nro_venta,
        'Cancelación venta ' || v_venta.nro_venta,
        v_now::date::text,
        v_now,
        v_org
      );
    END IF;
  END LOOP;

  -- Mark venta as cancelled
  UPDATE ventas
  SET estado     = 'cancelada',
      updated_at = v_now
  WHERE id = p_venta_id AND org_id = v_org;

  -- Audit log
  INSERT INTO audit_log (
    id, timestamp, "user", action, detail, org_id
  ) VALUES (
    gen_random_uuid()::text, v_now, p_user_email,
    'venta_cancelada',
    jsonb_build_object(
      'id',       p_venta_id,
      'nroVenta', v_venta.nro_venta,
      'total',    v_venta.total
    )::text,
    v_org
  );

  RETURN jsonb_build_object(
    'ok',      true,
    'id',      p_venta_id,
    'estado',  'cancelada'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── VERIFY ───────────────────────────────────────────────────
-- After applying, test via app (authenticated user required):
-- SELECT create_venta(...) -- should create atomically
-- SELECT cancel_venta(...) -- should restore stock atomically
