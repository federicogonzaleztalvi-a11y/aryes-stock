-- ============================================================================
-- supabase-ventas-learning.sql
-- LOOP DE APRENDIZAJE del agente de ventas (peldaño 3 de autonomía).
--
-- Hasta hoy el agente redactaba el primer mensaje de WhatsApp pero NUNCA se
-- enteraba de qué pasaba con él: si Federico lo mandó tal cual, si lo corrigió,
-- o si el prospecto contestó. Sin ese feedback, el agente no mejora: redacta
-- igual de bien (o mal) el día 1 que el día 100.
--
-- Estas columnas cierran el loop. Guardan, por prospecto:
--   • mensaje_borrador → lo que el agente propuso (foto al momento de contactar)
--   • mensaje_final    → lo que Federico realmente mandó (puede haberlo editado)
--   • fue_editado      → ¿Federico lo cambió? (señal de "qué corrige")
--   • respondio        → ¿el prospecto contestó? (señal de oro: qué funciona)
--   • respondio_at     → cuándo marcó la respuesta
--
-- El motor (api/owner.js → enrichLead) lee estos ejemplos REALES al redactar un
-- mensaje nuevo: prioriza los que tuvieron respuesta y los que Federico mandó sin
-- tocar, y aprende de sus correcciones. Datos reales, cero humo.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS mensaje_borrador TEXT,        -- lo que propuso el agente
  ADD COLUMN IF NOT EXISTS mensaje_final    TEXT,        -- lo que Federico mandó
  ADD COLUMN IF NOT EXISTS fue_editado      BOOLEAN,     -- ¿lo editó? (final != borrador)
  ADD COLUMN IF NOT EXISTS respondio        BOOLEAN,     -- ¿contestó el prospecto?
  ADD COLUMN IF NOT EXISTS respondio_at     TIMESTAMPTZ; -- cuándo se marcó

-- Índice para que enrichLead traiga rápido los mejores ejemplos (los que tienen
-- mensaje final guardado, priorizando los que tuvieron respuesta).
CREATE INDEX IF NOT EXISTS idx_pazque_leads_ejemplos
  ON pazque_leads (respondio, enriquecido_at DESC)
  WHERE mensaje_final IS NOT NULL;

COMMENT ON COLUMN pazque_leads.mensaje_borrador IS
  'Primer mensaje de WhatsApp que propuso el agente (foto al momento de contactar).';
COMMENT ON COLUMN pazque_leads.mensaje_final IS
  'Mensaje que Federico realmente usó. Si difiere del borrador, fue_editado = true.';
COMMENT ON COLUMN pazque_leads.respondio IS
  'Señal de resultado: true si el prospecto contestó, false si no, null si sin marcar.';
