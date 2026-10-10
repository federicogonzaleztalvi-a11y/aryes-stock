-- ============================================================================
-- supabase-portal-ventas-learning.sql
-- CEREBRO DE VENTAS para el embudo del CLIENTE (portal_leads).
--
-- El agente de ventas de Pazque (pazque_leads) ya aprende de lo que funciona.
-- Estas columnas le dan el MISMO cerebro al agente que cada cliente (ej: Eric)
-- usa para conseguir SUS compradores desde ProspectosTab. Todo por-org: ningún
-- cliente ve ni aprende de los datos de otro.
--
-- Guarda, por prospecto de cada org:
--   • respondio      → ¿el comercio contestó el WhatsApp? (señal de oro)
--   • respondio_at   → cuándo se marcó la respuesta
--   • variante       → qué molde de mensaje usó el agente (A/B, para medir cuál
--                      convierte mejor — nunca "a ojo")
--   • prompt_version → versión del prompt base (para comparar peras con peras
--                      cuando mejoremos el redactor)
--
-- El motor (api/lead.js → enrichPortalLead) lee los mensajes que SÍ consiguieron
-- respuesta EN ESA MISMA ORG y los usa de guía al redactar uno nuevo. Datos
-- reales por cliente, cero humo, cero cruce entre clientes.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE portal_leads
  ADD COLUMN IF NOT EXISTS respondio      BOOLEAN,      -- ¿contestó el comercio?
  ADD COLUMN IF NOT EXISTS respondio_at   TIMESTAMPTZ,  -- cuándo se marcó
  ADD COLUMN IF NOT EXISTS variante       TEXT,         -- molde del mensaje (A/B)
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;         -- versión del prompt base

-- Índice para que el loop de aprendizaje traiga rápido, POR ORG, los mensajes
-- que tuvieron respuesta (los mejores ejemplos de esa distribuidora).
CREATE INDEX IF NOT EXISTS idx_portal_leads_ganadores
  ON portal_leads (org_id, enriquecido_at DESC)
  WHERE respondio IS TRUE AND enriquecimiento IS NOT NULL;

COMMENT ON COLUMN portal_leads.respondio IS
  'Señal de resultado: true si el comercio contestó, false si no, null si sin marcar.';
COMMENT ON COLUMN portal_leads.variante IS
  'Molde de mensaje que usó el agente (A/B). Sirve para medir qué variante convierte mejor.';
COMMENT ON COLUMN portal_leads.prompt_version IS
  'Versión del prompt base del redactor. Permite comparar resultados entre versiones.';
