-- ============================================================
-- REVERTIR las policies *_rt_select (user_metadata) — INSEGURAS
-- Run in Supabase SQL Editor
-- ============================================================
-- Por qué se borran:
--   1) El Advisor las marca CRITICAL: referencian auth.jwt()->user_metadata,
--      que el usuario final PUEDE editar (endpoint update de GoTrue). Al ser
--      permisivas (OR), ampliarían el acceso según un claim spoofeable -> fuga
--      cross-tenant. user_metadata NUNCA debe usarse en contexto de seguridad.
--   2) No arreglaban nada: el test con USING(true) tampoco entregó eventos, así
--      que la falla de Realtime es de REPLICACIÓN, no de RLS. (Fix real: que el
--      servicio Realtime reconecte/re-lea la publicación.)
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','ventas','stock_movements','rutas','b2b_orders','clients']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_rt_select', t);
  END LOOP;
END $$;

-- Verificar: NO debe devolver filas.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE '%_rt_select'
ORDER BY tablename;
