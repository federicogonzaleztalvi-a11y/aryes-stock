-- ============================================================
-- MIGRACIONES AUDITORÍA 2026-06-15 — TODO EN UNO
-- Pazque (org real: aryes-ltda-6223)
--
-- Cómo correr: Supabase → SQL Editor → pegar TODO → Run.
-- Todo es idempotente (seguro de re-ejecutar).
--
-- ORDEN: van de más livianas a más pesadas. Si el Disk IO Budget
-- está saturado y algo da "connection timeout", corré los bloques
-- 1→3 (livianos) y dejá el BLOQUE 4 (UNIQUE constraint, escanea
-- la tabla invoices) y el BLOQUE 5 (índices de IO) para cuando el
-- IO se recupere.
-- ============================================================


-- ============================================================
-- BLOQUE 1 — driver_token (CRÍTICO C4)  [metadata, instantáneo]
-- Secreto por-ruta para autenticar el PATCH del repartidor.
-- ============================================================
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS driver_token TEXT;


-- ============================================================
-- BLOQUE 2 — confirm_b2b_order_to_venta (CRÍTICO C1)  [solo def. de función]
-- Importar pedido B2B → venta de forma ATÓMICA: descuenta stock,
-- consume la reserva, inserta la venta, marca el pedido. Sin esto
-- el stock no baja y hay riesgo de sobreventa.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_b2b_order_to_venta(
  p_order_id    TEXT,
  p_venta_id    TEXT,
  p_nro_venta   TEXT,
  p_items       JSONB,
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
      CONTINUE;
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

  UPDATE stock_reservations
  SET status = 'consumed'
  WHERE reference_id = p_order_id
    AND org_id = v_org
    AND status = 'active';

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

  UPDATE b2b_orders
  SET estado = 'importado', venta_id = p_venta_id
  WHERE id = p_order_id AND org_id = v_org;

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
    RAISE;
END;
$$;


-- ============================================================
-- BLOQUE 3 — next_cfe_nro (CFE atómico)  [solo def. de función]
-- Numeración CFE per-org sin colisiones bajo concurrencia.
-- ============================================================
CREATE OR REPLACE FUNCTION next_cfe_nro(p_org TEXT, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
  seq_key  TEXT := 'cfe_seq_' || p_org;
BEGIN
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO app_config (key, value, org_id)
  VALUES (seq_key, '1', p_org)
  ON CONFLICT (key) DO UPDATE
    SET value = (COALESCE(NULLIF(app_config.value, '')::INTEGER, 0) + 1)::TEXT
  RETURNING NULLIF(value, '')::INTEGER INTO next_num;

  RETURN p_code || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;


-- ============================================================
-- BLOQUE 4 — UNIQUE invoices.numero  [PESADO: escanea invoices]
-- ⚠️ Este es el único que puede colgarse si el IO está saturado,
--    porque valida unicidad escaneando toda la tabla.
--    Si da timeout, comentá este bloque y corrélo aparte cuando
--    el Disk IO Budget se recupere. La RPC de arriba funciona sin él.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_numero_unique'
    AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_numero_unique UNIQUE (numero);
  END IF;
END $$;


-- ============================================================
-- BLOQUE 5 — Índices de IO  [PESADO: construye índices, escanea tablas]
-- Reducen seq scans (Disk IO) en las tablas calientes de forma
-- PERMANENTE. Idempotente. Cada CREATE INDEX dispara recarga de
-- esquema en PostgREST. Correr SOLO con el Disk IO Budget ya
-- recuperado (no encimar con throttle activo).
-- ============================================================

-- Poller de pedidos B2B (cada 3 min):
-- b2b_orders?org_id=eq.X&estado=eq.pendiente&order=creado_en.desc
CREATE INDEX IF NOT EXISTS idx_b2b_orders_org_estado
  ON b2b_orders (org_id, estado, creado_en DESC);

-- Catálogo + sync: products?org_id=eq.X
CREATE INDEX IF NOT EXISTS idx_products_org
  ON products (org_id);

-- OTP login: clients?org_id=eq.X&phone=...
CREATE INDEX IF NOT EXISTS idx_clients_org_phone
  ON clients (org_id, phone);

-- ATP / reservas activas:
-- stock_reservations?org_id=eq.X&status=eq.active&expires_at=gte.now
CREATE INDEX IF NOT EXISTS idx_stock_res_org_status
  ON stock_reservations (org_id, status, expires_at);

-- Recomendados / historial: ventas?org_id=eq.X&cliente_id=...
CREATE INDEX IF NOT EXISTS idx_ventas_org_cliente
  ON ventas (org_id, cliente_id);


-- ============================================================
-- VERIFY (correr después, son SELECTs livianos)
-- ============================================================
-- SELECT id, driver_token FROM rutas LIMIT 5;        -- columna existe
-- SELECT next_cfe_nro('aryes-ltda-6223', 'CFE');     -- devuelve CFE-000001
-- (confirm_b2b_order_to_venta se prueba importando un pedido real desde el panel)
