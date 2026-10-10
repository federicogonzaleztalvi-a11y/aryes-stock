-- ============================================================================
-- supabase-cobranzas.sql
-- AGENTE DE COBRANZAS (el "vendedor digital" que persigue la plata ya vendida
-- pero no cobrada). Mira facturas VENCIDAS con saldo pendiente de cada comprador
-- y le manda un recordatorio de pago profesional.
--
--   • Genérico por-org: solo actúa sobre orgs con el toggle
--     brandcfg.collectionsReminders === true (Configuración → Portal B2B).
--   • Apagado por defecto en el código (COLLECTIONS_AGENT_ENABLED). Nada corre
--     hasta que Federico prenda el flag en Vercel.
--   • Respetuoso: no avisa el día 1 (margen de gracia) y respeta un período de
--     enfriamiento entre recordatorios al mismo comprador.
--
-- Esta tabla es el anti-spam: registra cuándo se le avisó por última vez a cada
-- comprador para respetar el enfriamiento entre recordatorios de pago.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS collections_reminders (
  org_id           TEXT        NOT NULL,
  cliente_id       UUID        NOT NULL,
  last_reminded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_count   INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, cliente_id)
);

COMMENT ON TABLE collections_reminders IS
  'Anti-spam del agente de cobranzas: último recordatorio de pago enviado por comprador (org_id + cliente_id).';

-- Barrido típico del cron: "¿a quién le avisé hace más de X?" → por org + fecha.
CREATE INDEX IF NOT EXISTS idx_collections_reminders_org_fecha
  ON collections_reminders (org_id, last_reminded_at);

-- NOTA (sin DDL): el toggle por-org vive en app_config.value (jsonb) bajo la
-- clave brandcfg, campo booleano collectionsReminders. No requiere columna nueva;
-- se setea desde Configuración → Portal B2B (igual que reorderReminders).
