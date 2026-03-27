-- ============================================================
-- MULTI-TENANCY: Organizations table + dynamic RLS
--
-- Replaces the hardcoded org_id = 'aryes' in b2b_orders policy.
-- Now any valid registered organization can use the B2B portal.
--
-- Steps:
-- 1. Create organizations table
-- 2. Insert Aryes as first org
-- 3. Update b2b_orders RLS policy to check against orgs table
-- 4. Add RLS to organizations table
-- ============================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT        PRIMARY KEY,  -- org_id (e.g. 'aryes', 'garcia-dist')
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  plan        TEXT        NOT NULL DEFAULT 'trial',  -- trial / starter / pro
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert Aryes as the first org (safe to re-run)
INSERT INTO organizations (id, name, email, plan)
VALUES ('aryes', 'Aryes', 'federicogonzaleztalvi@gmail.com', 'pro')
ON CONFLICT (id) DO NOTHING;

-- 3. Update b2b_orders policy — allow any active org
-- Drop old hardcoded policy
DROP POLICY IF EXISTS "b2b_portal_insert" ON b2b_orders;

-- New policy: anon can insert if org_id exists in organizations table
CREATE POLICY "b2b_portal_insert" ON b2b_orders
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND active = true
    )
  );

-- 4. RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Public: anyone can check if an org exists (needed for portal login)
CREATE POLICY "orgs_public_select" ON organizations
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- Only authenticated admins can insert/update orgs
CREATE POLICY "orgs_admin_write" ON organizations
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- VERIFY:
-- SELECT * FROM organizations;
-- Expected: 1 row for Aryes
