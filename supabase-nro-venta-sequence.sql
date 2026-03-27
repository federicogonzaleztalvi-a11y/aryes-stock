-- ============================================================
-- REMEDIATION: nroVenta race condition
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Create sequence starting after current max nro_venta
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(nro_venta, '[^0-9]', '', 'g'), '')::INTEGER
  ), 0)
  INTO max_num
  FROM ventas;

  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'venta_nro_seq') THEN
    EXECUTE format('CREATE SEQUENCE venta_nro_seq START %s', max_num + 1);
  ELSE
    PERFORM setval('venta_nro_seq', GREATEST(max_num + 1, last_value), false)
    FROM venta_nro_seq;
  END IF;
END $$;

-- 2. RPC: returns next nro_venta atomically (authenticated only)
CREATE OR REPLACE FUNCTION next_nro_venta()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF auth.jwt() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT nextval('venta_nro_seq') INTO next_num;
  RETURN 'V-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- 3. UNIQUE constraint (belt-and-suspenders)
-- Skips constraint creation if it already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ventas_nro_venta_unique'
    AND conrelid = 'ventas'::regclass
  ) THEN
    ALTER TABLE ventas
      ADD CONSTRAINT ventas_nro_venta_unique UNIQUE (nro_venta)
      NOT VALID;
  END IF;
END $$;

-- Verify:
-- SELECT next_nro_venta();
-- SELECT next_nro_venta();
-- Both should return consecutive V-XXXX values
