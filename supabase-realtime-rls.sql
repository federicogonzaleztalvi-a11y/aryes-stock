-- ============================================================
-- REALTIME RLS — política SELECT evaluable por Realtime
-- Run in Supabase SQL Editor (one-time)
-- ============================================================
--
-- Síntoma que esto arregla: el canal de Realtime se SUSCRIBE bien
-- ("Subscribed to PostgreSQL"), la tabla está en la publicación y tiene
-- REPLICA IDENTITY FULL, hay un cambio real en el WAL... y aun así NO llega
-- NINGÚN evento a los dispositivos.
--
-- Causa raíz: para entregar un cambio de una tabla con RLS, Realtime evalúa
-- la fila contra la policy SELECT del usuario suscripto. Nuestras policies
-- org-scoped usan get_my_org_id() — una función SECURITY DEFINER que hace un
-- subquery a la tabla `users`. Realtime NO puede correr ese tipo de policy en
-- su contexto de chequeo por-fila del WAL, así que DESCARTA todos los eventos
-- en silencio (el canal sigue SUBSCRIBED, pero entrega cero).
--
-- Fix: agregar una policy SELECT que Realtime SÍ sabe evaluar — comparación
-- DIRECTA de org_id contra el claim del JWT (sin funciones ni subqueries).
-- El JWT es un token GoTrue real y lleva user_metadata.org_id (lo confirma
-- LoginScreen.jsx, que lee d.user.user_metadata.org_id).
--
-- Es ADITIVA y PERMISIVA: las policies permisivas se combinan con OR, así que
-- esto NO restringe ni rompe ninguna lectura REST existente — sólo agrega el
-- camino que Realtime necesita. Idempotente (DROP IF EXISTS antes de CREATE).
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','ventas','stock_movements','rutas','b2b_orders','clients']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_rt_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      || 'USING (org_id = (auth.jwt() -> ''user_metadata'' ->> ''org_id''))',
      t || '_rt_select', t
    );
  END LOOP;
END $$;

-- Verificar: deben aparecer 6 filas, una por tabla, con el claim en qual.
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%_rt_select'
ORDER BY tablename;
