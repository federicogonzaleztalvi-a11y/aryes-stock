-- supabase-push-cliente.sql
-- Push notifications al COMPRADOR del portal (modelo Amazon: "tu pedido fue
-- confirmado", "tu pedido fue entregado"). Extiende la tabla push_subscriptions
-- que ya existía para el admin (ver supabase-push.sql) agregando client_id, para
-- poder dirigir una notificación a UN comprador puntual (no a toda la org).
--
-- Correr una vez en Supabase SQL Editor. Es idempotente.

-- 1) Columna para atar la suscripción a un comprador (NULL = suscripción admin).
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS client_id text;

-- 2) Índice para buscar rápido las suscripciones de un comprador al notificarle.
CREATE INDEX IF NOT EXISTS push_subs_org_client_idx
  ON push_subscriptions (org_id, client_id)
  WHERE client_id IS NOT NULL;
