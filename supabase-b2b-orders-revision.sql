-- ============================================================
-- PAZQUE — Columnas de "marcar pedido para revisión" en b2b_orders
-- ------------------------------------------------------------
-- QUÉ HACE:
--   Agrega b2b_orders.requiere_revision (BOOLEAN) y anomaly_reasons (JSONB).
--
-- POR QUÉ (bug encontrado 2026-07-29):
--   api/_create-order.js viene haciendo PATCH a estas columnas para marcar
--   pedidos anómalos (total 3x el promedio, primer pedido con monto alto) y
--   —desde el paquete 1— también cuando el precio del cliente no coincide con
--   el catálogo (Fix #4). Pero las columnas NUNCA existieron, así que el PATCH
--   fallaba en silencio (.catch vacío) y el flag no se guardaba. El admin nunca
--   veía un pedido marcado. Estas columnas hacen que el mecanismo por fin persista.
--
-- QUÉ **NO** HACE (100% seguro):
--   • NO cambia pedidos existentes (arrancan en false / null).
--   • NO toca ninguna otra tabla ni el flujo de creación de pedidos.
--   • Idempotente: ADD COLUMN IF NOT EXISTS.
--
-- CÓMO USARLO:
--   Supabase → SQL Editor → pegá → Run. Una sola vez.
-- ============================================================

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS requiere_revision BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomaly_reasons   JSONB;

COMMENT ON COLUMN b2b_orders.requiere_revision IS
  'true = el pedido tiene una anomalía (monto atípico o precio que no cuadra con el catálogo) y conviene revisarlo antes de confirmar. Lo setea api/_create-order.js.';
COMMENT ON COLUMN b2b_orders.anomaly_reasons IS
  'Array JSON con las razones por las que el pedido quedó marcado para revisión.';

-- Verificación (solo lectura):
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'b2b_orders'
--     AND column_name IN ('requiere_revision', 'anomaly_reasons');
