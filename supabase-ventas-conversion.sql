-- ============================================================================
-- supabase-ventas-conversion.sql
-- ATRIBUCIÓN DE REGISTRO → PRUEBA del agente de ventas.
--
-- El objetivo del agente NO es "conseguir respuestas": es que la distribuidora
-- entre SOLA a Pazque, se registre e inicie la prueba de 14 días (modelo
-- Shopify / product-led growth). Para que el agente no trabaje a ciegas,
-- necesitamos CONECTAR el registro que entra por /alta con el prospecto que el
-- agente venía trabajando en pazque_leads.
--
-- Cómo funciona la cadena:
--   1. El agente comparte un link de auto-registro con un marcador del lead:
--        pazque.com/alta?ref=<id del lead>   (el id es un UUID, no es dato
--        personal ni es adivinable → seguro de poner en la URL)
--   2. /alta lee ese ?ref= y lo manda al endpoint de registro.
--   3. api/register.js, al crear la org en prueba, estampa acá quién convirtió.
--
-- Estas columnas NO tocan la máquina de estados (estado sigue: nuevo →
-- contactado → demo → convertido → descartado). "Inició prueba" es una señal
-- aparte: inicio_prueba_at IS NOT NULL. Así el Foco y las métricas de /owner
-- pueden medir PRUEBAS INICIADAS (el verdadero norte), no solo respuestas.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS inicio_prueba_at TIMESTAMPTZ, -- cuándo se registró e inició la prueba
  ADD COLUMN IF NOT EXISTS org_convertida   TEXT;        -- org_id que se creó desde este prospecto

COMMENT ON COLUMN pazque_leads.inicio_prueba_at IS
  'Momento en que este prospecto se registró e inició la prueba de 14 días (atribución del agente). NULL = todavía no convirtió.';
COMMENT ON COLUMN pazque_leads.org_convertida IS
  'org_id de la organización creada cuando este prospecto se registró desde /alta?ref=<id>.';

-- Índice chico para el Foco/métricas de /owner (pruebas iniciadas recientes).
CREATE INDEX IF NOT EXISTS idx_pazque_leads_inicio_prueba
  ON pazque_leads (inicio_prueba_at)
  WHERE inicio_prueba_at IS NOT NULL;
