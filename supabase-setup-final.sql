-- ============================================================
-- ARYES STOCK — SETUP COMPLETO v2
-- Basado en el esquema real de la base de datos.
-- Pegar TODO en Supabase SQL Editor y ejecutar.
-- ============================================================

-- ── PASO 1: Agregar columnas faltantes a tablas existentes ───

-- users: agregar email (necesaria para RLS y para el lookup del login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Poblar email desde username si están vacíos (asume que username ES el email)
UPDATE users SET email = username WHERE email IS NULL AND username LIKE '%@%';

-- suppliers: agregar updated_at y payment_method que el código envía
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '';

-- products: el id es INTEGER pero el código genera UUIDs (TEXT).
-- Solución: agregar columna uuid_id para los nuevos productos
-- Y mantener id INTEGER para los existentes.
-- En realidad lo más limpio es agregar una columna 'uuid' separada
-- y hacer que el código use el id integer cuando edita existentes.
-- PERO: la forma más simple sin romper nada es:
-- Cambiar products.id a TEXT (requiere recrear la tabla)
-- O: agregar columna 'uuid' TEXT UNIQUE para que el código haga upsert por uuid.

-- Agregamos columna uuid a products para que el código pueda hacer upsert
ALTER TABLE products ADD COLUMN IF NOT EXISTS uuid TEXT;
-- Crear unique constraint para que upsert funcione por uuid
CREATE UNIQUE INDEX IF NOT EXISTS products_uuid_idx ON products(uuid) WHERE uuid IS NOT NULL;

-- ── PASO 2: Adaptar tabla orders al esquema del código ────────
-- La tabla orders existente tiene: id, supplier_id, status, items(jsonb), created_at, notes
-- El código escribe: product_id, product_name, supplier_name, qty, unit, ordered_at, 
--                    expected_arrival, total_cost, lead_breakdown
-- Agregamos las columnas que faltan

ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_id       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name     TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_name    TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qty              NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit             TEXT DEFAULT 'kg';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordered_at       TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_arrival TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cost       TEXT DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lead_breakdown   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- ── PASO 3: Crear tabla plans (nueva) ────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  product_id      TEXT PRIMARY KEY,
  coverage_months NUMERIC NOT NULL DEFAULT 2,
  data            JSONB DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PASO 4: Verificar PRIMARY KEY en products y suppliers ─────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='suppliers' AND constraint_type='PRIMARY KEY' AND table_schema='public'
  ) THEN
    ALTER TABLE suppliers ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY to suppliers.id';
  ELSE
    RAISE NOTICE 'suppliers.id already has PRIMARY KEY — OK';
  END IF;
END $$;

-- products.id es INTEGER — confirmar que tiene PK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='products' AND constraint_type='PRIMARY KEY' AND table_schema='public'
  ) THEN
    ALTER TABLE products ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY to products.id';
  ELSE
    RAISE NOTICE 'products.id already has PRIMARY KEY — OK';
  END IF;
END $$;

-- ── PASO 5: Helper de roles (usa email, con fallback a username) ──

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM users
  WHERE email = (auth.jwt() ->> 'email')
     OR username = (auth.jwt() ->> 'email')
  LIMIT 1;
$$;

-- ── PASO 6: Habilitar RLS ─────────────────────────────────────

ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE aryes_data      ENABLE ROW LEVEL SECURITY;

-- ── PASO 7: Limpiar políticas anteriores ─────────────────────

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── PASO 8: Crear políticas RLS ───────────────────────────────

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
CREATE POLICY "plans_write"  ON plans FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','operador'))
  WITH CHECK (get_my_role() IN ('admin','operador'));

-- stock_movements (inmutable)
CREATE POLICY "movements_select" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));

-- audit_log
CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- users: cada uno lee su propia fila; admin lee todas y gestiona
CREATE POLICY "users_select_own"   ON users FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email OR (auth.jwt() ->> 'email') = username);
CREATE POLICY "users_select_admin" ON users FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY "users_manage_admin" ON users FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- app_config
CREATE POLICY "config_admin" ON app_config FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- aryes_data (legacy sync)
CREATE POLICY "aryes_data_auth" ON aryes_data FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── PASO 9: Verificación final ────────────────────────────────

SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN ('products','suppliers','orders','plans','stock_movements',
                      'audit_log','users','app_config','aryes_data')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Ver columnas agregadas a users:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

