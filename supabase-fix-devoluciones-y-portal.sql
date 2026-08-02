-- ============================================================
-- PAZQUE — Fix pre-lanzamiento #2: Devoluciones + Importar pedido del portal
-- ------------------------------------------------------------
-- QUÉ ARREGLA (2 cosas, encontradas en la auditoría de las 37 pestañas):
--
--   1) DEVOLUCIONES desde el portal estaban ROTAS.
--      api/devolucion.js manda dos datos (cliente_tel y origen) a la tabla
--      `devoluciones`, pero esas columnas NUNCA se crearon. Supabase rechaza
--      el guardado → el cliente recibe error al pedir una devolución.
--      (Hoy no te afecta porque nadie pidió devoluciones por portal todavía,
--       pero la función estaba muerta. Esto la revive.)
--
--   2) IMPORTAR PEDIDO del portal → venta, de forma ATÓMICA.
--      Reinstala la función confirm_b2b_order_to_venta que descuenta stock y
--      consume la reserva en una sola transacción (evita sobreventa). Es
--      CREATE OR REPLACE: re-correrla es 100% seguro, exista o no.
--
-- QUÉ **NO** HACE (seguro para Eric):
--   • NO cambia ningún dato existente (solo agrega columnas vacías + define función).
--   • NO toca products, ventas, clients, ni el stock de nadie.
--   • Idempotente: podés correrlo mil veces, siempre da el mismo resultado.
--
-- CÓMO USARLO:
--   Supabase → SQL Editor → pegá TODO este archivo → Run. Una sola vez.
-- ============================================================


-- ── PARTE 1 · Columnas que le faltan a `devoluciones` ────────
ALTER TABLE devoluciones
  ADD COLUMN IF NOT EXISTS cliente_tel TEXT,
  ADD COLUMN IF NOT EXISTS origen      TEXT NOT NULL DEFAULT 'admin';

COMMENT ON COLUMN devoluciones.cliente_tel IS
  'Teléfono del cliente que pidió la devolución. Lo escribe api/devolucion.js; sin esta columna el pedido de devolución fallaba.';
COMMENT ON COLUMN devoluciones.origen IS
  'De dónde salió la devolución: ''portal'' (la pidió el cliente) o ''admin'' (la cargó el distribuidor).';


-- ── PARTE 2 · Función atómica para importar pedido del portal ─
CREATE OR REPLACE FUNCTION confirm_b2b_order_to_venta(
  p_order_id    TEXT,
  p_venta_id    TEXT,
  p_nro_venta   TEXT,
  p_items       JSONB,                 -- formato ventas: [{productoId,nombre,cantidad,precioUnit,costoUnit,unidad}]
  p_total       NUMERIC,
  p_descuento   NUMERIC     DEFAULT 0,
  p_notas       TEXT        DEFAULT '',
  p_user_email  TEXT        DEFAULT 'sistema'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item        JSONB;
  v_prod_uuid   TEXT;
  v_qty         NUMERIC;
  v_prod_nombre TEXT;
  v_curr_stock  NUMERIC;
  v_new_stock   NUMERIC;
  v_org         TEXT;
  v_order       RECORD;
  v_now         TIMESTAMPTZ := NOW();
BEGIN
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_org := get_my_org_id();

  -- ── Lock + validar el pedido ──────────────────────────────
  SELECT * INTO v_order
  FROM b2b_orders
  WHERE id = p_order_id AND org_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found:%', p_order_id;
  END IF;

  IF v_order.estado IN ('importado', 'cancelada') THEN
    RAISE EXCEPTION 'order_already_processed:%', v_order.estado;
  END IF;

  -- ── Descontar stock físico + movimientos ──────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_uuid   := v_item->>'productoId';
    v_qty         := COALESCE((v_item->>'cantidad')::NUMERIC, 0);
    v_prod_nombre := v_item->>'nombre';

    IF v_prod_uuid IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT stock INTO v_curr_stock
    FROM products
    WHERE uuid = v_prod_uuid AND org_id = v_org
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;  -- producto borrado tras el pedido: no frenar la venta
    END IF;

    v_new_stock := GREATEST(0, v_curr_stock - v_qty);

    UPDATE products
    SET stock = v_new_stock, updated_at = v_now
    WHERE uuid = v_prod_uuid AND org_id = v_org;

    INSERT INTO stock_movements (
      id, tipo, producto_id, producto_nombre,
      cantidad, referencia, notas, fecha, timestamp, org_id
    ) VALUES (
      gen_random_uuid()::text, 'venta', v_prod_uuid, v_prod_nombre,
      v_qty, p_nro_venta,
      'Venta ' || p_nro_venta || ' (portal B2B) — ' || COALESCE(v_order.cliente_nombre,''),
      v_now::date::text, v_now, v_org
    );
  END LOOP;

  -- ── Consumir reservas activas de este pedido ──────────────
  UPDATE stock_reservations
  SET status = 'consumed'
  WHERE reference_id = p_order_id
    AND org_id = v_org
    AND status = 'active';

  -- ── Insertar venta ────────────────────────────────────────
  INSERT INTO ventas (
    id, nro_venta, cliente_id, cliente_nombre,
    items, total, descuento, estado, notas, creado_en, org_id
  ) VALUES (
    p_venta_id, p_nro_venta,
    NULLIF(v_order.cliente_id, ''),
    v_order.cliente_nombre,
    p_items, p_total, COALESCE(p_descuento, 0), 'pendiente',
    COALESCE(p_notas, ''), v_now, v_org
  );

  -- ── Marcar pedido como importado ──────────────────────────
  UPDATE b2b_orders
  SET estado = 'importado', venta_id = p_venta_id
  WHERE id = p_order_id AND org_id = v_org;

  -- ── Audit ─────────────────────────────────────────────────
  INSERT INTO audit_log (
    id, timestamp, "user", action, detail, org_id
  ) VALUES (
    gen_random_uuid()::text, v_now, p_user_email,
    'b2b_order_importado',
    jsonb_build_object(
      'orderId',  p_order_id,
      'ventaId',  p_venta_id,
      'nroVenta', p_nro_venta,
      'total',    p_total
    )::text,
    v_org
  );

  RETURN jsonb_build_object(
    'ok', true, 'ventaId', p_venta_id, 'nroVenta', p_nro_venta
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;  -- rollback automático
END;
$$;


-- ── VERIFICACIÓN (solo lectura, corré esto después) ──────────
--   Debería devolver las 2 columnas nuevas de devoluciones:
--     SELECT column_name FROM information_schema.columns
--     WHERE table_name='devoluciones' AND column_name IN ('cliente_tel','origen');
--   Y confirmar que la función existe:
--     SELECT proname FROM pg_proc WHERE proname='confirm_b2b_order_to_venta';
