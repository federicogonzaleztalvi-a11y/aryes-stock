-- ============================================================================
-- supabase-portal-learning.sql
-- LOOP DE APRENDIZAJE DEL CLIENTE — paridad con el tablero del dueño (owner.js).
--
-- El agente de prospección por-org ya aprende de la señal de oro (¿el comercio
-- respondió?). Faltaba la señal 1: aprender del mensaje que el vendedor REALMENTE
-- mandó, no del borrador crudo del agente. Estas dos columnas guardan el texto
-- final (editado o no) y si lo corrigió respecto del borrador — igual que
-- pazque_leads.mensaje_final / fue_editado en el lado del dueño.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS mensaje_final TEXT;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS fue_editado   BOOLEAN;

COMMENT ON COLUMN portal_leads.mensaje_final IS
  'Mensaje de WhatsApp final que el vendedor guardó para mandar (editado o igual al borrador). El motor aprende de éste, no del borrador del agente.';
COMMENT ON COLUMN portal_leads.fue_editado IS
  'true si el vendedor corrigió el borrador del agente antes de mandar; señal de aprendizaje del estilo propio de la distribuidora.';
