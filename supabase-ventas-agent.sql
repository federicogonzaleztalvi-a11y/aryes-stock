-- ============================================================================
-- supabase-ventas-agent.sql
-- AGENTE DE VENTAS PROACTIVO de Pazque (peldaño 2 de autonomía).
--
-- Hasta hoy /owner era REACTIVO: Federico apretaba "Buscar" y "Enriquecer". Este
-- agente (api/cron-ventas.js) lo vuelve PROACTIVO: cada mañana se despierta solo,
-- explora el mercado (un rubro/zona distinto por día), suma distribuidoras nuevas
-- YA enriquecidas con el mensaje de WhatsApp listo, mira a quién toca seguir, y le
-- manda a Federico un email con el plan del día. NADA se envía solo: Federico
-- aprueba y manda a mano desde /owner.
--
-- Este script es AUTO-CONTENIDO e idempotente: asegura todas las columnas que el
-- agente necesita (aunque no hayas corrido los supabase-owner-*.sql) y crea la
-- bitácora de auditoría. Seguro de re-correr. Pegar en Supabase SQL Editor.
-- ============================================================================

-- 1) Columnas que el agente usa en pazque_leads (todas IF NOT EXISTS).
ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS place_id           TEXT,                        -- dedupe Google Places
  ADD COLUMN IF NOT EXISTS origen             TEXT NOT NULL DEFAULT 'inbound', -- 'inbound' | 'sourcing'
  ADD COLUMN IF NOT EXISTS enriquecimiento    JSONB,                       -- { rubro, tamano, prioridad, angulo, senales[], mensaje_wa }
  ADD COLUMN IF NOT EXISTS enriquecido_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_contacto_at TIMESTAMPTZ,                 -- cuándo le escribiste
  ADD COLUMN IF NOT EXISTS seguir_desde       TIMESTAMPTZ;                 -- cuándo vuelve a "seguir hoy"

CREATE UNIQUE INDEX IF NOT EXISTS uq_pazque_leads_place_id
  ON pazque_leads (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pazque_leads_seguir  ON pazque_leads (seguir_desde);
CREATE INDEX IF NOT EXISTS idx_pazque_leads_estado2 ON pazque_leads (estado);

-- 2) Bitácora del agente: cada corrida deja registro de qué hizo. Es lo que
--    hace al agente AUDITABLE y medible (base para mejorarlo después).
CREATE TABLE IF NOT EXISTS pazque_agent_log (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente   TEXT NOT NULL DEFAULT 'ventas',
  ran_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumen  JSONB            -- { query, sourced, enriched, listos, followUps, errores, ms }
);
CREATE INDEX IF NOT EXISTS idx_pazque_agent_log_ran ON pazque_agent_log (ran_at DESC);

ALTER TABLE pazque_agent_log ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role (el cron) escribe/lee. anon/authenticated nada.

COMMENT ON TABLE pazque_agent_log IS
  'Bitácora de corridas de los agentes autónomos de Pazque (ventas, etc.). Solo service role.';
