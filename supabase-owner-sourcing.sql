-- ============================================================================
-- supabase-owner-sourcing.sql
-- FASE B — SOURCING OUTBOUND (el agente arma la lista de distribuidoras solo).
--
-- El agente busca distribuidoras uruguayas reales en Google Places, las mete en
-- pazque_leads YA enriquecidas y con el mensaje de WhatsApp armado. NADA se manda
-- solo: Federico abre el chat con el texto precargado y le da enviar a mano.
--
-- Estas dos columnas hacen que:
--   place_id → no re-insertar dos veces la misma distribuidora (dedupe).
--   origen   → distinguir quién entró por la landing ('inbound') de quién trajo
--              el agente ('sourcing'), para métricas y para la escalera.
--
-- El mensaje de WhatsApp ya vive dentro de la columna enriquecimiento (JSONB),
-- no necesita columna propia.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS place_id TEXT,                       -- id de Google Places (dedupe)
  ADD COLUMN IF NOT EXISTS origen   TEXT NOT NULL DEFAULT 'inbound'; -- 'inbound' | 'sourcing'

-- Índice único parcial: no puede haber dos filas con el mismo place_id.
-- (Parcial: las filas inbound tienen place_id NULL y no chocan entre sí.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pazque_leads_place_id
  ON pazque_leads (place_id) WHERE place_id IS NOT NULL;
