-- ============================================================================
-- ANALÍTICA WEB DE PAZQUE — tabla web_events
-- ----------------------------------------------------------------------------
-- Guarda el comportamiento de los clientes en el portal B2B: páginas vistas,
-- productos vistos, agregados al carrito, pedidos, búsquedas y tiempo en pantalla.
--
-- Cada org sólo ve lo suyo (columna org_id, igual que el resto de las tablas).
-- RLS: SOLO el service_role (los endpoints del servidor) puede leer/escribir.
-- El portal escribe vía api/track.js y el admin lee vía api/analytics.js — ningún
-- cliente puede leer ni pisar los eventos de otro.
--
-- CÓMO USAR: pegá TODO este bloque en Supabase → SQL Editor → Run. Una sola vez.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.web_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      text        NOT NULL,
  session_id  text,                 -- agrupa eventos de una misma visita (anónimo por dispositivo)
  client_id   uuid,                 -- cliente logueado (si hay sesión OTP); null = anónimo
  event       text        NOT NULL, -- 'page_view' | 'producto_visto' | 'producto_agregado' | 'pedido_confirmado' | 'busqueda' | ...
  path        text,                 -- pantalla/sección donde ocurrió
  props       jsonb       DEFAULT '{}'::jsonb,  -- datos extra del evento (producto, total, ms, etc.)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para que el panel agregue rápido: casi todas las queries filtran por
-- org_id + rango de fechas, y algunas por tipo de evento.
CREATE INDEX IF NOT EXISTS web_events_org_time_idx
  ON public.web_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS web_events_org_event_time_idx
  ON public.web_events (org_id, event, created_at DESC);

-- RLS: activado y SIN políticas públicas → sólo el service_role accede.
ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;

-- (No se crean policies para 'authenticated' ni 'anon' a propósito: el portal
--  entra por OTP, no con JWT de Supabase, así que toda escritura/lectura pasa
--  por los endpoints del servidor, que usan la service key.)

-- Listo. Verificá con:  SELECT count(*) FROM public.web_events;
