-- ============================================================
-- driver_token — secreto por-ruta para autenticar el PATCH del repartidor
--
-- Problema que resuelve (auditoría 2026-06-15, hallazgo CRÍTICO C4):
-- El endpoint público /api/tracking-public aceptaba PATCH sobre `rutas`
-- validando SOLO ruta(UUID)+org. Pero el MISMO UUID de ruta se expone a
-- TODOS los clientes de esa ruta en el link de tracking
-- (/tracking?ruta=...&org=...&cliente=...). Es decir, cualquier cliente que
-- recibió su link de seguimiento podía reescribir el array `entregas` entero
-- de la ruta (marcar entregas como hechas, borrar datos de otros, etc).
--
-- Solución: un secreto por-ruta (`driver_token`) que viaja SOLO en el link del
-- repartidor (&t=...), nunca en el link de tracking del cliente. El endpoint
-- exige que el PATCH presente el token correcto cuando la ruta lo tiene.
--
-- Compatibilidad: rutas viejas tienen driver_token NULL → el endpoint las deja
-- pasar (con warning) para no romper repartos en curso. Las rutas nuevas (y las
-- que el admin comparte desde "Vista conductor") reciben token y quedan protegidas.
--
-- Run en Supabase SQL Editor.
-- ============================================================

ALTER TABLE rutas ADD COLUMN IF NOT EXISTS driver_token TEXT;

-- El token nunca se expone vía RLS al cliente: tracking-public lo lee con
-- SERVICE_ROLE y lo quita de la respuesta GET antes de devolverla.

-- ── VERIFY ───────────────────────────────────────────────────
-- SELECT id, driver_token FROM rutas LIMIT 5;
