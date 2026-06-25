-- ============================================================================
-- supabase-carrito-abandonado.sql
-- Recordatorio de "carrito abandonado" (estilo Amazon) por email. Genérico:
-- cualquier org puede usarlo (se prende/apaga por org desde Configuración).
--
-- Qué resuelve:
--   Si un cliente del portal B2B dejó productos en el carrito pero no confirmó
--   el pedido, le mandamos un recordatorio por email. Para no spamear ni repetir,
--   guardamos en qué etapa de recordatorio va cada carrito:
--     reminder_stage = 0 → todavía no se avisó (o el cliente lo editó recién)
--     reminder_stage = 1 → ya se mandó el 1er recordatorio (~4h)
--     reminder_stage = 2 → ya se mandó el 2do recordatorio (~24h) — no se avisa más
--   Cada vez que el cliente modifica el carrito, reminder_stage vuelve a 0
--   (lo resetea /api/cart), así un carrito nuevo arranca el ciclo de cero.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE portal_carts
  ADD COLUMN IF NOT EXISTS reminder_stage SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminded_at    TIMESTAMPTZ;

COMMENT ON COLUMN portal_carts.reminder_stage IS
  'Etapa de recordatorio de carrito abandonado: 0=ninguno, 1=mandado ~4h, 2=mandado ~24h. Se resetea a 0 cuando el cliente edita el carrito.';
COMMENT ON COLUMN portal_carts.reminded_at IS
  'Cuándo se envió el último recordatorio de carrito abandonado.';

-- Índice parcial: el cron busca carritos pendientes de recordatorio. Solo
-- indexamos los que faltan avisar (stage < 2) para que la query sea barata.
CREATE INDEX IF NOT EXISTS portal_carts_reminder_idx
  ON portal_carts (updated_at)
  WHERE reminder_stage < 2;

-- ============================================================================
-- Verificación:
--   SELECT org_id, client_id, reminder_stage, reminded_at, updated_at
--   FROM portal_carts WHERE reminder_stage > 0;
-- ============================================================================
