-- ============================================================
-- STOCK RESERVATIONS + ATP — B2B ONLY — v2 (refined)
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS stock_reservations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    TEXT        NOT NULL REFERENCES products(uuid) ON DELETE CASCADE,
  org_id        TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quantity      NUMERIC     NOT NULL CHECK (quantity > 0),
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','consumed','expired','cancelled')),
  source        TEXT        NOT NULL DEFAULT 'b2b_order'
                            CHECK (source = 'b2b_order'),
  reference_id  TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_sr_product_org_active
  ON stock_reservations(product_id, org_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sr_expires_active
  ON stock_reservations(expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sr_reference
  ON stock_reservations(reference_id);

-- 3. RLS
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_authenticated_read" ON stock_reservations;
CREATE POLICY "sr_authenticated_read" ON stock_reservations
  FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());

-- No direct INSERT from anon — only via RPC SECURITY DEFINER
-- The RPC handles both reservation + order atomically

-- 4. available_stock view — B2B only
CREATE OR REPLACE VIEW available_stock_b2b AS
SELECT
  p.uuid                                                AS product_id,
  p.org_id,
  p.name,
  p.stock                                               AS physical_stock,
  COALESCE(SUM(sr.quantity) FILTER (
    WHERE sr.status = 'active' AND sr.expires_at > NOW()
  ), 0)                                                 AS reserved_stock,
  GREATEST(0,
    p.stock - COALESCE(SUM(sr.quantity) FILTER (
      WHERE sr.status = 'active' AND sr.expires_at > NOW()
    ), 0)
  )                                                     AS available_stock
FROM products p
LEFT JOIN stock_reservations sr
  ON sr.product_id = p.uuid
 AND sr.org_id     = p.org_id
GROUP BY p.id, p.uuid, p.org_id, p.name, p.stock;

-- 5. ATOMIC RPC: create_b2b_order_with_reservations
-- Validates available_stock for all items, creates all reservations,
-- inserts the b2b_order — all in one transaction.
-- If any item fails: full rollback, no partial state.
CREATE OR REPLACE FUNCTION create_b2b_order_with_reservations(
  p_order_id      TEXT,
  p_org_id        TEXT,
  p_cliente_id    TEXT,
  p_cliente_nombre TEXT,
  p_cliente_tel   TEXT,
  p_items         JSONB,
  p_total         NUMERIC,
  p_notas         TEXT DEFAULT '',
  p_idempotency_key TEXT DEFAULT NULL,
  p_ttl_hours     INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item          JSONB;
  v_product_id  TEXT;
  v_qty         NUMERIC;
  v_physical    NUMERIC;
  v_reserved    NUMERIC;
  v_available   NUMERIC;
  v_existing    TEXT;
BEGIN
  -- Idempotency check first
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM b2b_orders
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok',         true,
        'orderId',    v_existing,
        'idempotent', true
      );
    END IF;
  END IF;

  -- PHASE 1: Validate available_stock for ALL items (with FOR UPDATE locks)
  -- No writes happen until every item passes validation
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'productId')::TEXT;
    v_qty        := (item->>'qty')::NUMERIC;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Lock product row
    SELECT stock INTO v_physical
    FROM products
    WHERE uuid   = v_product_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', v_product_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Calculate current reserved (active, not expired)
    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM stock_reservations
    WHERE product_id = v_product_id
      AND org_id     = p_org_id
      AND status     = 'active'
      AND expires_at > NOW();

    v_available := GREATEST(0, v_physical - v_reserved);

    IF v_available < v_qty THEN
      RAISE EXCEPTION 'item_insufficient:%:%:%',
        v_product_id, v_available, v_qty
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- PHASE 2: All items validated — create reservations
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'productId')::TEXT;
    v_qty        := (item->>'qty')::NUMERIC;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO stock_reservations (
      product_id, org_id, quantity, status,
      source, reference_id, expires_at
    ) VALUES (
      v_product_id, p_org_id, v_qty, 'active',
      'b2b_order', p_order_id,
      NOW() + (p_ttl_hours || ' hours')::INTERVAL
    );
  END LOOP;

  -- PHASE 3: Insert the order
  INSERT INTO b2b_orders (
    id, org_id, cliente_id, cliente_nombre, cliente_tel,
    items, total, moneda, notas, estado, idempotency_key
  ) VALUES (
    p_order_id, p_org_id, p_cliente_id, p_cliente_nombre, p_cliente_tel,
    p_items, p_total, 'USD', COALESCE(p_notas, ''), 'pendiente',
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'ok',      true,
    'orderId', p_order_id
  );
END;
$$;

-- 6. expire_stale_reservations — called by cron every hour
CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE stock_reservations
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'expired', v_rows);
END;
$$;

-- VERIFY after running:
-- SELECT COUNT(*) FROM stock_reservations;  -- must be 0
-- SELECT * FROM available_stock_b2b LIMIT 3;  -- must show products
-- SELECT create_b2b_order_with_reservations(...);  -- test with real data
