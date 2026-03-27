-- ============================================================
-- PHASE 1 / Step 2: Atomic recepcion via Postgres transaction
--
-- create_recepcion(): atomic goods reception
--   Validates products exist, increments stock, inserts movements,
--   upserts lotes (if expiry date present), inserts recepcion record,
--   writes audit log — all in ONE transaction.
--
-- If anything fails: Postgres rolls back everything.
-- No partial state. No phantom stock without a receipt.
--
-- Symmetric to create_venta: ventas deduct atomically,
-- recepciones replenish atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION create_recepcion(
  p_id          TEXT,
  p_fecha       TEXT        DEFAULT NULL,
  p_proveedor   TEXT        DEFAULT '',
  p_nro_remito  TEXT        DEFAULT '',
  p_notas       TEXT        DEFAULT '',
  p_pedido_id   TEXT        DEFAULT NULL,
  p_items       JSONB       DEFAULT '[]',
  p_user_email  TEXT        DEFAULT 'sistema'
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
  v_vencimiento TEXT;
  v_lote_nro    TEXT;
  v_curr_stock  NUMERIC;
  v_new_stock   NUMERIC;
  v_org         TEXT;
  v_ahora       TIMESTAMPTZ := NOW();
  v_diferencias INTEGER := 0;
  v_prod_found  BOOLEAN;
BEGIN
  -- Auth check
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_org := get_my_org_id();

  -- Validate we have items
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items';
  END IF;

  -- ── STEP 1: Validate all products exist ──────────────────
  -- Lock rows for the duration of this transaction.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'cantidadRecibida')::NUMERIC, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    v_prod_uuid  := v_item->>'productoId';
    v_prod_nombre := COALESCE(v_item->>'nombre', '');

    -- Try match by UUID first, then by name (same logic as the frontend)
    SELECT EXISTS(
      SELECT 1 FROM products
      WHERE (uuid = v_prod_uuid OR LOWER(name) = LOWER(v_prod_nombre))
        AND org_id = v_org
    ) INTO v_prod_found;

    IF NOT v_prod_found THEN
      RAISE EXCEPTION 'product_not_found:%', v_prod_nombre;
    END IF;
  END LOOP;

  -- ── STEP 2: Apply all writes atomically ──────────────────

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty         := COALESCE((v_item->>'cantidadRecibida')::NUMERIC, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    v_prod_uuid   := v_item->>'productoId';
    v_prod_nombre := COALESCE(v_item->>'nombre', '');
    v_unidad      := COALESCE(v_item->>'unidad', 'u');
    v_vencimiento := v_item->>'vencimiento';
    v_lote_nro    := v_item->>'lote';

    -- Re-read current stock with lock
    SELECT uuid, stock INTO v_prod_uuid, v_curr_stock
    FROM products
    WHERE (uuid = v_prod_uuid OR LOWER(name) = LOWER(v_prod_nombre))
      AND org_id = v_org
    ORDER BY (uuid = v_prod_uuid) DESC  -- prefer UUID match
    LIMIT 1
    FOR UPDATE;

    v_new_stock := v_curr_stock + v_qty;

    -- Increment stock
    UPDATE products
    SET stock      = v_new_stock,
        updated_at = v_ahora
    WHERE uuid   = v_prod_uuid
      AND org_id = v_org;

    -- Stock movement
    INSERT INTO stock_movements (
      id, tipo, producto_id, producto_nombre,
      cantidad, referencia, notas, fecha, timestamp, org_id
    ) VALUES (
      gen_random_uuid()::text,
      'recepcion',
      v_prod_uuid,
      v_prod_nombre,
      v_qty,
      COALESCE(NULLIF(p_nro_remito, ''), p_id),
      'Recepción' || CASE WHEN p_pedido_id IS NOT NULL THEN ' (pedido)' ELSE ' (manual)' END
        || CASE WHEN p_nro_remito != '' THEN ' — remito ' || p_nro_remito ELSE '' END,
      v_ahora::date::text,
      v_ahora,
      v_org
    );

    -- Lote (only if expiry date is present)
    IF v_vencimiento IS NOT NULL AND v_vencimiento != '' THEN
      INSERT INTO lotes (
        id, producto_id, producto_nombre,
        lote, fecha_venc, cantidad,
        proveedor, notas, creado_en, updated_at
      ) VALUES (
        gen_random_uuid()::text,
        v_prod_uuid,
        v_prod_nombre,
        COALESCE(NULLIF(v_lote_nro, ''), 'REC-' || extract(epoch from v_ahora)::bigint::text),
        v_vencimiento::date,
        v_qty,
        p_proveedor,
        'Ingreso por recepción',
        v_ahora,
        v_ahora
      );
    END IF;

    -- Count items with differences (cantidadEsperada vs cantidadRecibida)
    IF (v_item->>'diferencia')::NUMERIC != 0 THEN
      v_diferencias := v_diferencias + 1;
    END IF;
  END LOOP;

  -- ── STEP 3: Insert recepcion record ──────────────────────
  INSERT INTO recepciones (
    id, fecha, proveedor, nro_remito,
    notas, pedido_id, items, estado,
    diferencias, creado_en
  ) VALUES (
    p_id,
    NULLIF(p_fecha, '')::date,
    NULLIF(p_proveedor, ''),
    NULLIF(p_nro_remito, ''),
    NULLIF(p_notas, ''),
    NULLIF(p_pedido_id, ''),
    p_items,
    'completada',
    v_diferencias,
    v_ahora
  );

  -- ── STEP 4: Audit log ────────────────────────────────────
  INSERT INTO audit_log (
    id, timestamp, "user", action, detail, org_id
  ) VALUES (
    gen_random_uuid()::text,
    v_ahora,
    p_user_email,
    'recepcion',
    jsonb_build_object(
      'id',          p_id,
      'proveedor',   p_proveedor,
      'nroRemito',   p_nro_remito,
      'items',       jsonb_array_length(p_items),
      'diferencias', v_diferencias
    )::text,
    v_org
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'id',          p_id,
    'diferencias', v_diferencias
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── VERIFY ───────────────────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name = 'create_recepcion'
-- AND routine_schema = 'public';
-- Expected: 1 row
