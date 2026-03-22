-- ============================================================
-- ARYES STOCK — Row Level Security Policies (FINAL)
-- Run this entire script in the Supabase SQL Editor.
-- Safe to re-run: uses CREATE OR REPLACE and IF NOT EXISTS.
-- ============================================================

-- ── HELPER FUNCTION ─────────────────────────────────────────
-- Reads the current user's role from the users table.
-- SECURITY DEFINER means it runs as the function owner (postgres),
-- bypassing RLS on the users table itself for this lookup.
-- This is intentional and safe for internal use.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE email = (auth.jwt() ->> 'email') LIMIT 1;
$$;

-- ── ENABLE RLS ON ALL TABLES ────────────────────────────────
-- These are safe to run even if RLS is already enabled.
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE aryes_data      ENABLE ROW LEVEL SECURITY;
-- orders and plans tables (created in Phase 4):
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans  ENABLE ROW LEVEL SECURITY;

-- ── DROP EXISTING POLICIES (idempotent re-run) ───────────────
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── products ─────────────────────────────────────────────────
-- All authenticated users can read (vendedor needs prices)
CREATE POLICY "products_select" ON products
  FOR SELECT TO authenticated USING (true);

-- admin and operador can insert/update
CREATE POLICY "products_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'operador'));

-- only admin can delete
CREATE POLICY "products_delete" ON products
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── suppliers ────────────────────────────────────────────────
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── orders ───────────────────────────────────────────────────
-- All authenticated users can read orders
CREATE POLICY "orders_select" ON orders
  FOR SELECT TO authenticated USING (true);

-- admin and operador can create/update orders
CREATE POLICY "orders_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "orders_update" ON orders
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'operador'));

-- only admin can delete orders
CREATE POLICY "orders_delete" ON orders
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── plans ────────────────────────────────────────────────────
CREATE POLICY "plans_select" ON plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plans_write" ON plans
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'operador'))
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

-- ── stock_movements ──────────────────────────────────────────
-- Read: all authenticated
CREATE POLICY "movements_select" ON stock_movements
  FOR SELECT TO authenticated USING (true);

-- Insert only — movements are immutable once written
CREATE POLICY "movements_insert" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

-- ── audit_log ────────────────────────────────────────────────
-- Only admin can read
CREATE POLICY "audit_select" ON audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- All authenticated users can insert (all actions are logged)
CREATE POLICY "audit_insert" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── users ────────────────────────────────────────────────────
-- Each user can read their own row (needed for role lookup at login)
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

-- Admin can read all users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Admin can manage users
CREATE POLICY "users_manage_admin" ON users
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── app_config ───────────────────────────────────────────────
CREATE POLICY "config_admin" ON app_config
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── aryes_data (legacy blob — still used for notifications/plans fallback) ──
CREATE POLICY "aryes_data_auth" ON aryes_data
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── VERIFY the function works ───────────────────────────────
-- Run this after applying policies to confirm no errors:
-- SELECT get_my_role();
-- (Should return your role if logged in via app, NULL if run as postgres)

