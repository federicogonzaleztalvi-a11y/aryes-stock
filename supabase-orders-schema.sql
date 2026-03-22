-- ============================================================
-- ARYES STOCK — Orders & Plans Tables
-- Run BEFORE supabase-rls.sql (RLS references these tables)
-- ============================================================

-- ── orders table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE SET NULL,
  product_name     TEXT NOT NULL DEFAULT '',
  supplier_id      TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name    TEXT DEFAULT '',
  qty              NUMERIC NOT NULL DEFAULT 0,
  unit             TEXT DEFAULT 'kg',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','delivered','cancelled')),
  ordered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_arrival TIMESTAMPTZ,
  total_cost       TEXT DEFAULT '0',
  lead_breakdown   JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_product_idx ON orders(product_id);

-- ── plans table ──────────────────────────────────────────────
-- Plans are per-product coverage plans: {[productId]: {coverageMonths, ...}}
-- Stored as individual rows for queryability
CREATE TABLE IF NOT EXISTS plans (
  product_id       TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  coverage_months  NUMERIC NOT NULL DEFAULT 2,
  data             JSONB DEFAULT '{}'::jsonb,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

