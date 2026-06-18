-- ============================================================
-- REDUCIR carga del CDC de Realtime (PASO 2 — sólo si sigue unhealthy)
-- Run in Supabase SQL Editor
-- ============================================================
-- Diagnóstico (logs de Realtime): el worker de postgres_changes (PostgresCdcRls)
-- hace :queue_timeout — su pool de conexiones a la base se satura procesando
-- realtime.list_changes(). REPLICA IDENTITY FULL infla el WAL (escribe la fila
-- vieja COMPLETA en cada UPDATE/DELETE), encareciendo cada poll. Con DEFAULT
-- (usa la PRIMARY KEY) postgres_changes funciona igual y el WAL es mucho más
-- chico. Reversible.
-- ============================================================

-- 1) Volver a REPLICA IDENTITY DEFAULT (usa PK) en las 6 tablas.
ALTER TABLE public.products        REPLICA IDENTITY DEFAULT;
ALTER TABLE public.ventas          REPLICA IDENTITY DEFAULT;
ALTER TABLE public.stock_movements REPLICA IDENTITY DEFAULT;
ALTER TABLE public.rutas           REPLICA IDENTITY DEFAULT;
ALTER TABLE public.b2b_orders      REPLICA IDENTITY DEFAULT;
ALTER TABLE public.clients         REPLICA IDENTITY DEFAULT;

-- 2) Índice en users(email) — la RLS get_my_org_id() filtra por email; sin
--    índice cada evaluación es un seq scan y tranca el pool del CDC.
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- 3) Verificar REPLICA IDENTITY (relreplident: d=default/PK, f=full).
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('products','ventas','stock_movements','rutas','b2b_orders','clients')
ORDER BY relname;

-- Después de correr esto: Restart project y volver a probar la entrega.
