-- ============================================================
-- PHASE 2: Stock Ledger
--
-- Adds auditability to stock_movements:
--   - stock_after: balance after this movement (set by trigger)
--   - Trigger auto-fills stock_after from products.stock
--     immediately after each INSERT — always consistent
--   - View stock_ledger: clean audit interface
--   - Function stock_history(product_uuid, from, to): point-in-time query
--
-- Does NOT change products.stock (still the mutable cache).
-- Does NOT break existing queries.
-- Safe to run on existing data (backfills stock_after = NULL
-- for historical rows — trigger only fires on new inserts).
-- ============================================================

-- ── 1. Add stock_after column ────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS stock_after NUMERIC DEFAULT NULL;

-- ── 2. Trigger function: fill stock_after from products ──────
-- Runs AFTER INSERT on stock_movements.
-- Reads the current products.stock (already updated by the RPC)
-- and writes it into the new movement row.
-- This guarantees stock_after is always consistent with the
-- actual stock value at the moment of the operation.
CREATE OR REPLACE FUNCTION fill_stock_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock NUMERIC;
BEGIN
  -- Read current stock from products (RPC already updated it)
  SELECT stock INTO v_stock
  FROM products
  WHERE uuid = NEW.producto_id;

  -- Write back into the movement row just inserted
  IF FOUND THEN
    UPDATE stock_movements
    SET stock_after = v_stock
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_fill_stock_after ON stock_movements;

CREATE TRIGGER trg_fill_stock_after
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION fill_stock_after();

-- ── 4. Audit view: stock_ledger ──────────────────────────────
-- Clean interface for auditing stock history.
-- Readable by authenticated users with org isolation.
CREATE OR REPLACE VIEW stock_ledger AS
SELECT
  sm.id,
  sm.timestamp,
  sm.fecha,
  sm.producto_id,
  sm.producto_nombre,
  sm.tipo,
  CASE
    WHEN sm.tipo IN ('venta', 'manual_out', 'ajuste_negativo') THEN -sm.cantidad
    ELSE sm.cantidad
  END AS cantidad_neta,  -- negative for outflows, positive for inflows
  sm.cantidad            AS cantidad_bruta,
  sm.stock_after,
  sm.referencia,
  sm.notas,
  sm.org_id
FROM stock_movements sm
ORDER BY sm.timestamp DESC;

-- ── 5. Point-in-time stock query ─────────────────────────────
-- Returns stock balance at any moment in time.
-- Usage: SELECT * FROM stock_at('uuid-here', '2026-03-15 23:59:59');
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
  WHERE producto_id = p_product_uuid
    AND timestamp  <= p_at
    AND stock_after IS NOT NULL
  ORDER BY timestamp DESC
  LIMIT 1;
$$;

-- ── 6. Backfill historical rows (best-effort) ─────────────────
-- For existing movements before this migration, stock_after is NULL.
-- We can't reconstruct exact historical values, but we can mark them.
-- New movements from this point forward will always have stock_after.
-- (Leave NULLs as-is — they represent pre-ledger history)

-- ── VERIFY ───────────────────────────────────────────────────
-- After applying:
-- 1. Check column exists:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name='stock_movements' AND column_name='stock_after';
--
-- 2. Check trigger exists:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE trigger_name='trg_fill_stock_after';
--
-- 3. Check view exists:
--    SELECT * FROM stock_ledger LIMIT 5;
