-- ============================================================
-- ARYES STOCK — Precio Listas (price_lists + price_list_items)
-- Safe to re-run: IF NOT EXISTS throughout
-- ============================================================

-- ── 1. Lista definitions (A, B, C + extras) ──────────────────
CREATE TABLE IF NOT EXISTS price_lists (
  id          TEXT        PRIMARY KEY,           -- 'A' | 'B' | 'C' | UUID for custom
  nombre      TEXT        NOT NULL DEFAULT '',
  descuento   NUMERIC(5,2) NOT NULL DEFAULT 0,   -- global % discount off precio_venta
  color       TEXT        NOT NULL DEFAULT '#3b82f6',
  activa      BOOLEAN     NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Per-product custom price overrides ─────────────────────
CREATE TABLE IF NOT EXISTS price_list_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    TEXT        NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_uuid TEXT       NOT NULL,              -- FK → products.uuid (TEXT)
  precio      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- override price (0 = use global discount)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lista_id, product_uuid)                -- one row per list×product
);

CREATE INDEX IF NOT EXISTS price_list_items_lista_idx   ON price_list_items (lista_id);
CREATE INDEX IF NOT EXISTS price_list_items_product_idx ON price_list_items (product_uuid);

-- ── 3. RLS ─────────────────────────────────────────────────────
ALTER TABLE price_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pl_select"  ON price_lists;
DROP POLICY IF EXISTS "pl_write"   ON price_lists;
DROP POLICY IF EXISTS "pli_select" ON price_list_items;
DROP POLICY IF EXISTS "pli_write"  ON price_list_items;

-- All authenticated roles can read lists (operador needs them for picking, vendedor for sales)
CREATE POLICY "pl_select"  ON price_lists       FOR SELECT TO authenticated USING (true);
CREATE POLICY "pli_select" ON price_list_items  FOR SELECT TO authenticated USING (true);

-- Only admin and vendedor can write
CREATE POLICY "pl_write"  ON price_lists
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "pli_write" ON price_list_items
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

-- ── 4. Seed default lists (safe: INSERT … ON CONFLICT DO NOTHING) ──
INSERT INTO price_lists (id, nombre, descuento, color) VALUES
  ('A', 'Lista A - Mayorista', 20, '#3b82f6'),
  ('B', 'Lista B - HORECA',    10, '#8b5cf6'),
  ('C', 'Lista C - Minorista',  0, '#f59e0b')
ON CONFLICT (id) DO NOTHING;
