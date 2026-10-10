-- ============================================================================
-- supabase-ventas-ab.sql
-- A/B + VERSIONADO de prompts para el agente de ventas de Pazque (pazque_leads).
--
-- El agente ya aprende de lo que funciona (supabase-ventas-learning.sql). Ahora
-- además etiqueta CADA primer mensaje con el molde que usó (A/B) y la versión del
-- prompt base. Así el tablero del dueño muestra la tasa de respuesta de cada molde
-- y Federico elige la ganadora con DATOS, no a ojo.
--
--   • variante       → molde de mensaje que usó el agente (A/B)
--   • prompt_version → versión del prompt base (para comparar peras con peras
--                      cuando mejoremos el redactor)
--
-- (respondio / respondio_at ya existen desde supabase-ventas-learning.sql.)
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS variante       TEXT,   -- molde del mensaje (A/B)
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;   -- versión del prompt base

COMMENT ON COLUMN pazque_leads.variante IS
  'Molde de mensaje que usó el agente (A/B). Sirve para medir qué variante convierte mejor.';
COMMENT ON COLUMN pazque_leads.prompt_version IS
  'Versión del prompt base del redactor. Permite comparar resultados entre versiones.';
