-- ============================================================================
-- supabase-meta-ads.sql
-- Integración self-service con Meta Ads (Facebook / Instagram Ads).
-- Genérico multi-tenant: cualquier org conecta SU propia cuenta publicitaria.
-- NO atado a Eric ni a ninguna org puntual.
--
-- Qué guarda:
--   organizations.meta_ads (JSONB) — la conexión de Meta Ads de cada org:
--     {
--       "token":            "<user/business token de Meta>",  -- secreto, solo server-side
--       "account_id":       "123456789",                      -- cuenta publicitaria elegida (sin act_)
--       "account_name":     "Distribuidora X",                 -- para mostrar en la UI
--       "currency":         "UYU",                             -- moneda de la cuenta
--       "accounts":         [ { id, account_id, name, currency } ], -- todas las que autorizó
--       "connected_at":     "2026-07-19T...Z"
--     }
--
-- El token vive SOLO del lado del servidor (api/meta-ads.js lo lee con service role
-- y NUNCA lo devuelve al browser — las métricas se calculan server-side). Por eso no
-- hace falta política RLS de SELECT para clientes: la columna se maneja exclusivamente
-- vía service role. Mismo modelo que organizations.simpliroute / organizations.whatsapp_sender.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS meta_ads JSONB;

COMMENT ON COLUMN organizations.meta_ads IS
  'Conexión self-service de Meta Ads (token, account_id, account_name, currency, accounts). Manejada por api/meta-ads.js con service role; el token nunca se expone al browser.';
