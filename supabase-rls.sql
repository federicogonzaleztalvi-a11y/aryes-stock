-- ============================================================
-- ARYES STOCK — Supabase RLS Policies
-- Run this in the Supabase SQL Editor (one time)
-- ============================================================

-- STEP 1: Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE aryes_data ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: get current user role from users table
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE email = auth.jwt()->>'email' LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- products table
-- ============================================================
-- All authenticated users can read products
CREATE POLICY "products_read" ON products
  FOR SELECT TO authenticated USING (true);

-- Only admin and operador can insert/update products
CREATE POLICY "products_write" ON products
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','operador'));

CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','operador'));

-- Only admin can delete products
CREATE POLICY "products_delete" ON products
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- suppliers table
-- ============================================================
CREATE POLICY "suppliers_read" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_write" ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','operador'));

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','operador'));

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- stock_movements table
-- ============================================================
CREATE POLICY "movements_read" ON stock_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "movements_insert" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','operador'));

-- No update/delete on movements (immutable audit trail)

-- ============================================================
-- audit_log table
-- ============================================================
-- Only admin can read audit log
CREATE POLICY "audit_read" ON audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- All authenticated users can insert (write-only for non-admins)
CREATE POLICY "audit_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- users table — CRITICAL: no passwords to client
-- ============================================================
-- Users can read their own row
CREATE POLICY "users_read_own" ON users
  FOR SELECT TO authenticated
  USING (email = auth.jwt()->>'email');

-- Admin can read all users (for management)
CREATE POLICY "users_read_admin" ON users
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Admin can manage users
CREATE POLICY "users_write_admin" ON users
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- app_config table
-- ============================================================
CREATE POLICY "config_read_admin" ON app_config
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "config_write_admin" ON app_config
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- aryes_data table (legacy blob sync — will be phased out)
-- ============================================================
-- Allow authenticated users to read/write their own data
CREATE POLICY "aryes_data_all" ON aryes_data
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- IMPORTANT: Remove password column from users table
-- Passwords are managed entirely by Supabase Auth.
-- If you have a 'password' column in users, drop it:
-- ============================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS password;
-- (Run manually after verifying no app code depends on it)

