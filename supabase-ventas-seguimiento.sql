-- ============================================================================
-- supabase-ventas-seguimiento.sql
-- SEGUIMIENTO REDACTADO + CADENCIA del agente de ventas.
--
-- Hasta hoy el agente redactaba SOLO el primer mensaje. Pero en ventas la
-- mayoría de las respuestas llegan del toque 2 al 5, no del primero. Un vendedor
-- que manda un mensaje y abandona deja casi toda la plata sobre la mesa.
--
-- Estas columnas le dan memoria de cadencia al agente:
--   • toques                 → cuántas veces ya le escribió a este prospecto
--   • seguimiento_mensaje     → el PRÓXIMO toque ya redactado (listo para mandar)
--   • seguimiento_generado_at → cuándo lo preparó (para saber si está fresco)
--
-- El motor (api/owner.js → draftFollowUp) usa el número de toque y el mensaje
-- anterior para variar el ángulo y acortar cada vez, sin reclamar la falta de
-- respuesta. En el último toque hace un cierre cortés (breakup) que suele
-- destrabar respuestas. Humano SIEMPRE antes de enviar.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS toques                 INTEGER DEFAULT 0, -- veces contactado
  ADD COLUMN IF NOT EXISTS seguimiento_mensaje     TEXT,              -- próximo toque redactado
  ADD COLUMN IF NOT EXISTS seguimiento_generado_at TIMESTAMPTZ;       -- cuándo se preparó

COMMENT ON COLUMN pazque_leads.toques IS
  'Cuántas veces Federico ya le escribió a este prospecto (se incrementa en cada "Ya le escribí/seguí").';
COMMENT ON COLUMN pazque_leads.seguimiento_mensaje IS
  'Próximo mensaje de seguimiento ya redactado por el agente, listo para revisar y mandar.';
COMMENT ON COLUMN pazque_leads.seguimiento_generado_at IS
  'Momento en que el agente preparó el seguimiento pendiente.';
