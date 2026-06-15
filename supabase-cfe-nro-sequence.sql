-- ============================================================
-- REMEDIATION: CFE numbering race condition (point #4)
-- Per-org atomic counter stored in app_config (key cfe_seq_<org>).
-- Run in Supabase SQL Editor AFTER IO budget recovers. Safe to re-run.
-- The front-end falls back to a client-side counter until this is run,
-- so emission keeps working in the meantime.
-- ============================================================

-- 1. RPC: returns next CFE sequence number for the caller's org atomically.
--    Row-locks the app_config row (INSERT ... ON CONFLICT DO UPDATE) so two
--    concurrent emisores can never read the same value. Returns the formatted
--    number "<code>-NNNNNN". Authenticated only.
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

  -- Atomic read-modify-write: insert seed=1 or bump the existing value by 1,
  -- returning the post-increment value under a row lock.
  INSERT INTO app_config (key, value, org_id)
  VALUES (seq_key, '1', p_org)
  ON CONFLICT (key) DO UPDATE
    SET value = (COALESCE(NULLIF(app_config.value, '')::INTEGER, 0) + 1)::TEXT
  RETURNING NULLIF(value, '')::INTEGER INTO next_num;

  RETURN p_code || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- 2. UNIQUE constraint on invoices.numero (belt-and-suspenders).
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

-- Verify:
-- SELECT next_cfe_nro('aryes-ltda-6223', 'CFE');
-- SELECT next_cfe_nro('aryes-ltda-6223', 'CFE');
