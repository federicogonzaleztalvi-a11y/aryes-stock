-- ============================================================
-- ARYES STOCK — SETUP COMPLETO
-- Pegar TODO esto en Supabase SQL Editor y ejecutar.
-- Es seguro re-ejecutar: usa IF NOT EXISTS y CREATE OR REPLACE.
-- ============================================================

-- ── PASO 1: Verificar y crear tablas orders y plans ──────────

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  product_id       TEXT,
  product_name     TEXT NOT NULL DEFAULT '',
  supplier_id      TEXT,
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

CREATE INDEX IF NOT EXISTS orders_status_idx  ON orders(status);
CREATE INDEX IF NOT EXISTS orders_product_idx ON orders(product_id);
CREATE INDEX IF NOT EXISTS orders_ordered_idx ON orders(ordered_at DESC);

CREATE TABLE IF NOT EXISTS plans (
  product_id      TEXT PRIMARY KEY,
  coverage_months NUMERIC NOT NULL DEFAULT 2,
  data            JSONB DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PASO 2: Verificar que products.id y suppliers.id son PK ──
-- Si ya son PK esto no hace nada (IF NOT EXISTS).
-- Si no lo son, los agrega ahora.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='products' AND constraint_type='PRIMARY KEY'
  ) THEN
    ALTER TABLE products ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY to products.id';
  ELSE
    RAISE NOTICE 'products.id already has PRIMARY KEY — OK';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='suppliers' AND constraint_type='PRIMARY KEY'
  ) THEN
    ALTER TABLE suppliers ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY to suppliers.id';
  ELSE
    RAISE NOTICE 'suppliers.id already has PRIMARY KEY — OK';
  END IF;
END $$;

-- ── PASO 3: Helper de roles ───────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE email = (auth.jwt() ->> 'email') LIMIT 1;
$$;

-- ── PASO 4: Habilitar RLS en todas las tablas ─────────────────

ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE aryes_data      ENABLE ROW LEVEL SECURITY;

-- ── PASO 5: Limpiar políticas anteriores (idempotente) ────────

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── PASO 6: Políticas por tabla ───────────────────────────────

-- products
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','operador'));
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- suppliers
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','operador'));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- orders
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','operador'));
CREATE POLICY "orders_delete" ON orders FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- plans
CREATE POLICY "plans_select" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_write"  ON plans FOR ALL    TO authenticated USING (get_my_role() IN ('admin','operador')) WITH CHECK (get_my_role() IN ('admin','operador'));

-- stock_movements (inmutable — solo insert)
CREATE POLICY "movements_select" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));

-- audit_log
CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- users
CREATE POLICY "users_select_own"   ON users FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = email);
CREATE POLICY "users_select_admin" ON users FOR SELECT TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "users_manage_admin" ON users FOR ALL    TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- app_config
CREATE POLICY "config_admin" ON app_config FOR ALL TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- aryes_data (legacy, sigue siendo usada para sync de notificaciones)
CREATE POLICY "aryes_data_auth" ON aryes_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── PASO 7: Verificación final ────────────────────────────────

SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN ('products','suppliers','orders','plans','stock_movements','audit_log','users','app_config','aryes_data')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

