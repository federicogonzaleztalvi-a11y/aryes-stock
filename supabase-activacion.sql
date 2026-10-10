-- ============================================================================
-- supabase-activacion.sql
-- AGENTE DE ACTIVACIÓN (product-led growth) — segundo agente de Pazque.
--
-- El agente de VENTAS (cron-ventas) trae distribuidoras nuevas y las empuja a
-- registrarse e iniciar la prueba de 14 días. Pero registrarse no sirve de nada
-- si la distribuidora NO carga su catálogo: una cuenta vacía nunca se convierte
-- en cliente que paga. El punto de activación real de Pazque es:
--
--     la org tiene al menos UN producto con precio de venta cargado.
--
-- Este agente acompaña a las orgs en prueba que todavía no activaron, con una
-- secuencia corta de 3 avisos (no spam de calendario), y PARA apenas activan.
--
-- La columna `activation` (jsonb) guarda el estado de ese acompañamiento por org:
--   { stage: 0|1|2|3, last_nudge_at: ISO, activated_at: ISO|null }
--     stage 0 → todavía no mandamos ningún aviso
--     stage 1 → ya mandamos el 1er aviso (~24h sin activar): "cargá tu 1er producto"
--     stage 2 → ya mandamos el 2do aviso (~3 días): "importá tu lista de Excel"
--     stage 3 → ya mandamos el 3er y último aviso (~7 días): cierre + ayuda humana
--   activated_at IS NOT NULL → la org cargó catálogo; el agente ya no la toca.
--
-- NO toca el estado de suscripción ni el trial. Es sólo un acompañamiento de
-- onboarding. Apagado por defecto en el código (ACTIVATION_AGENT_ENABLED).
--
-- Script AUTO-CONTENIDO e idempotente. Seguro de re-correr. Pegar en Supabase
-- SQL Editor (o se aplica solo como migración).
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS activation jsonb;

COMMENT ON COLUMN organizations.activation IS
  'Estado del agente de activación (onboarding PLG): { stage, last_nudge_at, activated_at }. NULL = todavía sin tocar.';
