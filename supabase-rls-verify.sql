-- ============================================================
-- VERIFICATION — Run AFTER supabase-rls-rutas-b2b.sql
-- Confirms all RLS policies are active on rutas and b2b_orders
-- Expected: 8 rows total (4 per table)
-- ============================================================

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('rutas', 'b2b_orders')
ORDER BY tablename, cmd;

-- Expected output:
-- tablename  | policyname         | roles           | cmd    | qual
-- -----------+--------------------+-----------------+--------+------------------------------
-- b2b_orders | b2b_portal_insert  | {anon}          | INSERT | (with check: org_id='aryes')
-- b2b_orders | b2b_wms_delete     | {authenticated} | DELETE | org_id=get_my_org_id()
-- b2b_orders | b2b_wms_select     | {authenticated} | SELECT | org_id=get_my_org_id()
-- b2b_orders | b2b_wms_update     | {authenticated} | UPDATE | org_id=get_my_org_id()
-- rutas      | rutas_delete       | {authenticated} | DELETE | org_id=get_my_org_id() AND role=admin
-- rutas      | rutas_insert       | {authenticated} | INSERT | org_id=get_my_org_id() AND role IN (admin,operador)
-- rutas      | rutas_select       | {authenticated} | SELECT | org_id=get_my_org_id()
-- rutas      | rutas_update       | {authenticated} | UPDATE | org_id=get_my_org_id() AND role IN (admin,operador)
-- (8 rows)

-- If you see 0 rows: the remediation SQL was NOT applied yet
-- If you see 8 rows: RLS is active and correct
