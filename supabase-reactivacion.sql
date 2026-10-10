-- ============================================================================
-- supabase-reactivacion.sql
-- AGENTE DE REACTIVACIÓN (recuperar al comprador que DEJÓ de comprar, antes de
-- perderlo del todo). Arranca donde termina reposición (atrasos ≤ 120 días):
-- toma al que lleva MUCHO sin pedir —churn en curso— y le manda un
-- "¿todo bien? te extrañamos" para traerlo de vuelta.
--
--   • Genérico por-org: solo actúa sobre orgs con el toggle
--     brandcfg.reactivationReminders === true (Configuración → Portal B2B).
--   • Apagado por defecto en el código (REACTIVATION_AGENT_ENABLED). Nada corre
--     hasta que Federico prenda el flag en Vercel.
--   • Mensaje fuerte: enfriamiento largo entre recordatorios al mismo comprador.
--
-- Esta tabla es el anti-spam: registra cuándo se le avisó por última vez a cada
-- comprador para respetar el enfriamiento entre reactivaciones.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reactivation_reminders (
  org_id           TEXT        NOT NULL,
  cliente_id       UUID        NOT NULL,
  last_reminded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nudge_count      INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, cliente_id)
);

COMMENT ON TABLE reactivation_reminders IS
  'Anti-spam del agente de reactivación: último "te extrañamos" enviado por comprador (org_id + cliente_id).';

-- Barrido típico del cron: "¿a quién le avisé hace más de X?" → por org + fecha.
CREATE INDEX IF NOT EXISTS idx_reactivation_reminders_org_fecha
  ON reactivation_reminders (org_id, last_reminded_at);

-- NOTA (sin DDL): el toggle por-org vive en app_config.value (jsonb) bajo la
-- clave brandcfg, campo booleano reactivationReminders. No requiere columna
-- nueva; se setea desde Configuración → Portal B2B (igual que reorderReminders).
