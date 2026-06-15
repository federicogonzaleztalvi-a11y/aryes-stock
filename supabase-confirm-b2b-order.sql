-- ============================================================
-- confirm_b2b_order_to_venta — B2B order → venta, ATÓMICO
--
-- Problema que resuelve (auditoría 2026-06-15, hallazgo CRÍTICO C1):
-- Al importar un pedido del portal B2B a una venta, el frontend
-- (PortalAdminTab.importarAVenta) hacía un INSERT directo en `ventas`
-- SIN descontar stock físico ni consumir la reserva (stock_reservations).
-- Resultado: la reserva quedaba 'active' hasta expirar por TTL (6h) y el
-- stock físico nunca bajaba → riesgo de sobreventa del mismo stock.
--
-- Esta RPC hace TODO en una sola transacción:
--   1. Valida que el pedido exista, sea de la org y esté 'pendiente'
--   2. Descuenta stock físico por cada item (GREATEST(0,...))
--   3. Inserta stock_movements tipo 'venta'
--   4. Marca como 'consumed' las reservas activas de ese pedido
--   5. Inserta la venta (estado 'pendiente')
--   6. Marca el b2b_order como 'importado' + venta_id
--   7. Audit log
-- Si algo falla: rollback total, sin estado parcial.
--
-- Nota de consistencia available_stock:
--   antes:  available = physical - reserved
--   después: available = (physical - qty) - (reserved - qty) = physical - reserved
--   → available_stock para otros compradores no cambia. Correcto.
--
-- Run en Supabase SQL Editor.
-- ============================================================

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

-- ── VERIFY ───────────────────────────────────────────────────
-- 1) Crear un pedido de prueba desde el portal (genera reserva 'active').
-- 2) Importarlo desde el panel → debe:
--    SELECT status FROM stock_reservations WHERE reference_id='<orderId>';  -- 'consumed'
--    SELECT stock FROM products WHERE uuid='<prod>';                        -- bajó
--    SELECT estado FROM b2b_orders WHERE id='<orderId>';                    -- 'importado'
--    SELECT * FROM ventas WHERE id='<ventaId>';                             -- existe
