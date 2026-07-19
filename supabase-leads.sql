-- ============================================================================
-- supabase-leads.sql
-- Captación de prospectos (Camino B): la landing del portal (?org=) permite que
-- alguien interesado que TODAVÍA no es cliente deje sus datos para pedir acceso.
-- Genérico multi-tenant: se activa por-org con un flag; nunca atado a Eric.
--
-- Qué agrega:
--   1. tabla `leads` — un prospecto por fila, con atribución de campaña (utm_*,
--      fbclid, referrer) para saber de qué anuncio de Meta/Google llegó. Así el
--      dashboard de Campañas puede, más adelante, atribuir leads → anuncio.
--   2. organizations.captacion (JSONB) — { "activa": true } prende el formulario
--      "Pedí acceso" en el portal de esa org. Off (null) por defecto → el portal
--      white-label de un cliente no muestra nada hasta que él lo active.
--
-- Seguridad: la tabla se maneja SOLO vía service role (api/lead.js). RLS activo
-- sin políticas públicas → anon/authenticated no leen ni escriben directo. El
-- endpoint valida org, rate-limita el POST público y sanea el input.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              TEXT NOT NULL,
  nombre              TEXT NOT NULL,
  tel                 TEXT NOT NULL,
  comercio            TEXT,
  ciudad              TEXT,
  mensaje             TEXT,
  -- Atribución de campaña (de dónde vino el prospecto)
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  fbclid              TEXT,
  gclid               TEXT,
  referrer            TEXT,
  landing_url         TEXT,
  -- Ciclo de vida: nuevo → contactado → convertido | descartado
  estado              TEXT NOT NULL DEFAULT 'nuevo',
  converted_client_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_estado  ON leads (org_id, estado);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- Sin políticas: RLS activo deniega todo acceso anon/authenticated directo.
-- El único camino es api/lead.js con service role (bypass RLS).

COMMENT ON TABLE leads IS
  'Prospectos del portal (captación Camino B). Manejada solo por api/lead.js con service role. utm_*/fbclid/gclid para atribución a campañas de ads.';

-- Flag por-org que prende la captación en el portal.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS captacion JSONB;

COMMENT ON COLUMN organizations.captacion IS
  'Config de captación de prospectos del portal: { "activa": bool }. null/false = formulario "Pedí acceso" oculto. Manejada por api/lead.js.';
