-- ============================================================================
-- supabase-reposicion.sql
-- AGENTE DE REPOSICIÓN (el "vendedor digital" de la distribuidora hacia SUS
-- compradores que YA tiene). A diferencia del agente de ventas (clientes nuevos)
-- o del de carrito abandonado (un pedido a medio hacer), este detecta el RITMO
-- real de cada comprador y, cuando se atrasa respecto de su propio patrón, le
-- recuerda reponer lo de siempre.
--
--   • Genérico por-org: solo actúa sobre orgs con el toggle
--     brandcfg.reorderReminders === true (Configuración → Portal B2B).
--   • Apagado por defecto en el código (REORDER_AGENT_ENABLED). Nada corre hasta
--     que Federico prenda el flag en Vercel.
--   • NO usa calendario fijo (eso sería spam). Usa el ritmo observado: mediana de
--     días entre pedidos de ESE comprador. Necesita un mínimo de pedidos para
--     inferir un patrón real (MIN_ORDERS en el código).
--
-- Esta tabla es el anti-spam: registra cuándo se le avisó por última vez a cada
-- comprador para respetar un período de enfriamiento entre recordatorios.
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reorder_reminders (
  org_id           TEXT        NOT NULL,
  cliente_id       UUID        NOT NULL,
  last_reminded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nudge_count      INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, cliente_id)
);

COMMENT ON TABLE reorder_reminders IS
  'Anti-spam del agente de reposición: último recordatorio enviado por comprador (org_id + cliente_id).';

-- Barrido típico del cron: "¿a quién le avisé hace más de X?" → por org + fecha.
CREATE INDEX IF NOT EXISTS idx_reorder_reminders_org_fecha
  ON reorder_reminders (org_id, last_reminded_at);

-- NOTA (sin DDL): el toggle por-org vive en app_config.value (jsonb) bajo la
-- clave brandcfg, campo booleano reorderReminders. No requiere columna nueva;
-- se setea desde Configuración → Portal B2B (igual que abandonedCartEmails).
