-- ============================================================================
-- supabase-simpliroute.sql
-- Integración self-service con SimpliRoute (ruteo de entregas).
-- Genérico multi-tenant: cualquier org conecta su propia cuenta. NO atado a Eric.
--
-- Qué guarda:
--   organizations.simpliroute (JSONB) — la config de SimpliRoute de cada org:
--     {
--       "token":          "<API token del distribuidor>",   -- secreto, solo server-side
--       "enabled":        true,                              -- auto-envío de pedidos a ruta
--       "account_name":   "Distribuidora X",                 -- para mostrar en la UI
--       "webhook_secret": "<random>",                        -- valida el webhook entrante
--       "webhook_id":     123                                -- id del webhook en SimpliRoute
--     }
--
-- El token vive SOLO del lado del servidor (api/simpliroute.js lo lee con service role
-- y nunca lo devuelve al browser). Por eso NO hace falta política RLS de SELECT para
-- clientes: la columna se maneja exclusivamente vía service role.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor.
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS simpliroute JSONB;

COMMENT ON COLUMN organizations.simpliroute IS
  'Config self-service de SimpliRoute (token, enabled, account_name, webhook_secret, webhook_id). Manejada por api/simpliroute.js con service role; el token nunca se expone al browser.';
