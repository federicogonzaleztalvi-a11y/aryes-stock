-- ============================================================
-- ENABLE REALTIME — Multi-device sync
-- Run in Supabase SQL Editor (one-time)
-- ============================================================
--
-- Síntoma que esto arregla: el canal de Realtime se SUSCRIBE bien
-- ("Subscribed to PostgreSQL") pero NO llega ningún cambio a los otros
-- dispositivos. Verificado: un UPDATE real no dispara ningún evento aunque
-- el canal esté SUBSCRIBED.
--
-- Causa: para entregar cambios de una tabla CON RLS, Realtime tiene que
-- evaluar la fila contra la policy del usuario. Eso requiere:
--   1) que la tabla esté en la publicación `supabase_realtime`, y
--   2) REPLICA IDENTITY FULL (si falta, Realtime no "ve" la fila completa
--      en el WAL, no puede correr la RLS y DESCARTA el evento en silencio).
-- ============================================================

-- 1) Asegurar que las tablas estén en la publicación (idempotente).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','ventas','stock_movements','rutas','b2b_orders','clients']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) REPLICA IDENTITY FULL — REQUERIDO para que Realtime entregue eventos
--    en tablas con RLS (sin esto se pierden silenciosamente todos los cambios).
ALTER TABLE public.products        REPLICA IDENTITY FULL;
ALTER TABLE public.ventas          REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.rutas           REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_orders      REPLICA IDENTITY FULL;
ALTER TABLE public.clients         REPLICA IDENTITY FULL;

-- 3) Verificar: deben aparecer las 6 tablas.
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
