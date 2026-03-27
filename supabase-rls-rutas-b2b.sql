-- ============================================================
-- REMEDIATION: RLS policies for rutas and b2b_orders
-- Audit finding: tables had ENABLE ROW LEVEL SECURITY but
-- zero CREATE POLICY statements — authenticated users could
-- read/write all rows from all orgs.
--
-- Safe to re-run: all DROP POLICY IF EXISTS before CREATE.
-- Apply in Supabase SQL Editor.
-- ============================================================

-- ── 1. RUTAS ─────────────────────────────────────────────────
-- rutas has org_id column (added via supabase-multitenancy.sql)
-- All access scoped to the requesting user's org via get_my_org_id()
--
-- SELECT: admin and operador can see routes (repartidor needs to see his routes)
-- INSERT: admin and operador (create route plans)
-- UPDATE: admin and operador (mark deliveries, reorder stops, add notes)
-- DELETE: admin only (irreversible — affects delivery history)

DROP POLICY IF EXISTS "rutas_select" ON rutas;
DROP POLICY IF EXISTS "rutas_insert" ON rutas;
DROP POLICY IF EXISTS "rutas_update" ON rutas;
DROP POLICY IF EXISTS "rutas_delete" ON rutas;

ALTER TABLE rutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rutas_select" ON rutas
  FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());

CREATE POLICY "rutas_insert" ON rutas
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_my_org_id()
    AND get_my_role() IN ('admin', 'operador')
  );

CREATE POLICY "rutas_update" ON rutas
  FOR UPDATE TO authenticated
  USING (org_id = get_my_org_id())
  WITH CHECK (
    org_id = get_my_org_id()
    AND get_my_role() IN ('admin', 'operador')
  );

CREATE POLICY "rutas_delete" ON rutas
  FOR DELETE TO authenticated
  USING (
    org_id = get_my_org_id()
    AND get_my_role() = 'admin'
  );

-- ── 2. B2B_ORDERS ─────────────────────────────────────────────
-- b2b_orders has org_id column.
-- SPECIAL CASE: inserts come from api/pedido.js using the anon key
-- (the B2B portal has no user JWT — clients authenticate via OTP only).
-- Selects and updates come from the WMS admin (authenticated user).
--
-- INSERT: anon role allowed (portal B2B inserts without user JWT)
--   WITH CHECK on org_id prevents injection of arbitrary orgs
--   from a valid anon key — org must be 'aryes' (current single-tenant)
--   TODO: when multi-tenant, change to a whitelist table check
--
-- SELECT: authenticated only, scoped to own org
-- UPDATE: authenticated admin/vendedor only, own org (import to WMS)
-- DELETE: authenticated admin only, own org

DROP POLICY IF EXISTS "b2b_portal_insert" ON b2b_orders;
DROP POLICY IF EXISTS "b2b_wms_select"    ON b2b_orders;
DROP POLICY IF EXISTS "b2b_wms_update"    ON b2b_orders;
DROP POLICY IF EXISTS "b2b_wms_delete"    ON b2b_orders;
-- Drop legacy policy names from session setup if they exist
DROP POLICY IF EXISTS "portal insert"     ON b2b_orders;
DROP POLICY IF EXISTS "portal read own"   ON b2b_orders;

ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;

-- Portal (anon): can insert orders for the 'aryes' org only
-- This prevents a malicious client from spoofing a different org
-- even when they have a valid anon key
CREATE POLICY "b2b_portal_insert" ON b2b_orders
  FOR INSERT TO anon
  WITH CHECK (org_id = 'aryes');

-- WMS admin: select all orders for their org
CREATE POLICY "b2b_wms_select" ON b2b_orders
  FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());

-- WMS admin/vendedor: update order status (pendiente → importada)
CREATE POLICY "b2b_wms_update" ON b2b_orders
  FOR UPDATE TO authenticated
  USING (org_id = get_my_org_id())
  WITH CHECK (
    org_id = get_my_org_id()
    AND get_my_role() IN ('admin', 'vendedor')
  );

-- WMS admin: delete (rare, only for test/spam orders)
CREATE POLICY "b2b_wms_delete" ON b2b_orders
  FOR DELETE TO authenticated
  USING (
    org_id = get_my_org_id()
    AND get_my_role() = 'admin'
  );

-- ── 3. VERIFY ────────────────────────────────────────────────
-- Run after applying to confirm all policies are active:
--
-- SELECT tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('rutas', 'b2b_orders')
-- ORDER BY tablename, cmd;
--
-- Expected: 4 rows for rutas, 4 rows for b2b_orders = 8 total
