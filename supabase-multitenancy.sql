-- ============================================================
-- GAP 6: Multi-tenancy — org_id isolation
-- Safe to re-run. DEFAULT 'aryes' = zero data loss.
-- ============================================================

-- Phase 1: Add org_id columns
ALTER TABLE users              ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE products           ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE suppliers          ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE plans              ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE stock_movements    ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE clients            ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE ventas             ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE lotes              ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE devoluciones       ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE conteos            ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE rutas              ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE recepciones        ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE transfers          ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE price_lists        ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE price_list_items   ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';
ALTER TABLE purchase_invoices  ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'aryes';

-- Phase 2: Performance indexes
CREATE INDEX IF NOT EXISTS idx_products_org          ON products (org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org           ON clients (org_id);
CREATE INDEX IF NOT EXISTS idx_ventas_org            ON ventas (org_id);
CREATE INDEX IF NOT EXISTS idx_lotes_org             ON lotes (org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org ON purchase_invoices (org_id);
CREATE INDEX IF NOT EXISTS idx_rutas_org             ON rutas (org_id);
CREATE INDEX IF NOT EXISTS idx_transfers_org         ON transfers (org_id);

-- Phase 3: get_my_org_id() helper
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(org_id, 'aryes') FROM users
  WHERE email = (auth.jwt() ->> 'email') LIMIT 1;
$$;

-- Phase 4: RLS policies with org_id isolation
-- (run supabase-multitenancy-rls.sql separately — idempotent)
