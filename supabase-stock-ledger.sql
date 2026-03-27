-- ============================================================
-- PHASE 2: Stock Ledger
--
-- Adds auditability to stock_movements:
--   stock_after: balance after each movement (filled by trigger)
--   Trigger reads products.stock after RPC updates it
--   stock_at(): point-in-time stock query
--
-- No VIEW (timestamp is a reserved word, causes issues in views).
-- Use stock_at() or query stock_movements directly with "timestamp".
-- ============================================================

-- 1. Add stock_after column
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS stock_after NUMERIC DEFAULT NULL;

-- 2. Trigger function
CREATE OR REPLACE FUNCTION fill_stock_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock NUMERIC;
BEGIN
  SELECT stock INTO v_stock
  FROM products
  WHERE uuid = NEW.producto_id;

  IF FOUND THEN
    UPDATE stock_movements
    SET stock_after = v_stock
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_fill_stock_after ON stock_movements;

CREATE TRIGGER trg_fill_stock_after
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION fill_stock_after();

-- 4. Point-in-time stock query
-- Usage: SELECT stock_at('product-uuid', '2026-03-15 15:00:00');
CREATE OR REPLACE FUNCTION stock_at(
  p_product_uuid TEXT,
  p_at           TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT stock_after
  FROM stock_movements
  WHERE producto_id  = p_product_uuid
    AND stock_after  IS NOT NULL
    AND "timestamp" <= p_at
  ORDER BY "timestamp" DESC
  LIMIT 1;
$$;

-- VERIFY:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'stock_movements' AND column_name = 'stock_after';
-- Expected: 1 row
--
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE trigger_name = 'trg_fill_stock_after';
-- Expected: 1 row
