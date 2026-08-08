-- ============================================================================
-- supabase-pazque-leads.sql
-- EMBUDO PROPIO DE PAZQUE (adquisición de Federico): distribuidoras interesadas
-- en CONTRATAR Pazque dejan sus datos desde la landing (pazque.com) pidiendo una
-- demo. NO confundir con `portal_leads` (api/lead.js), que capta los COMPRADORES
-- de un distribuidor ya cliente — eso es una feature del producto, otro embudo.
--
-- Esta es la "base compartida": tanto el inbound (formulario de la landing) como
-- el outbound futuro (agente que busca distribuidoras) escriben en esta misma
-- tabla. Desde acá se hace el seguimiento del prospecto.
--
-- Seguridad: se maneja SOLO vía service role (api/demo-request.js). RLS activo
-- sin políticas → anon/authenticated no leen ni escriben directo.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pazque_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  empresa      TEXT,            -- nombre de la distribuidora
  email        TEXT,
  tel          TEXT,
  rubro        TEXT,            -- qué distribuye (HORECA, alimentos, cosmética…)
  mensaje      TEXT,
  -- Atribución de campaña (de qué anuncio / fuente llegó el prospecto)
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  fbclid       TEXT,
  gclid        TEXT,
  referrer     TEXT,
  landing_url  TEXT,
  -- Ciclo de vida: nuevo → contactado → demo → convertido | descartado
  estado       TEXT NOT NULL DEFAULT 'nuevo',
  notas        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pazque_leads_created ON pazque_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pazque_leads_estado  ON pazque_leads (estado);

ALTER TABLE pazque_leads ENABLE ROW LEVEL SECURITY;
-- Sin políticas: RLS activo deniega todo acceso anon/authenticated directo.
-- El único camino es api/demo-request.js con service role (bypass RLS).

COMMENT ON TABLE pazque_leads IS
  'Prospectos propios de Pazque (distribuidoras interesadas en contratar). Manejada solo por api/demo-request.js con service role. Base compartida inbound + outbound.';
