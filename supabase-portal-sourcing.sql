-- ============================================================================
-- supabase-portal-sourcing.sql
-- Sourcing por-org: cada distribuidor cliente de Pazque busca SUS compradores
-- (los comercios de su rubro) con el mismo motor que /owner usa para Federico,
-- pero AISLADO a su propia org. Vive sobre el embudo del producto (portal_leads),
-- NO sobre pazque_leads ni /owner.
--
-- Qué agrega:
--   1. portal_leads: columnas para leads que llegan por sourcing (place_id para
--      no duplicar, origen, y el cache del enriquecimiento de Claude).
--   2. portal_leads.tel deja de ser NOT NULL — un comercio hallado en Google
--      puede no tener teléfono publicado.
--   3. organizations.sourcing (JSONB) — el ICP editable de cada org:
--        { "rubros": ["Cafeterías", ...], "ciudad": "Montevideo",
--          "tope": 20, "mes": "2026-08", "usadas": 3 }
--      rubros/ciudad los edita el admin; mes/usadas son el contador del tope.
--
-- Aislamiento: el índice único es (org_id, place_id) → dos orgs distintas pueden
-- tener el mismo comercio como prospecto sin pisarse. Cada org solo ve lo suyo.
--
-- Seguridad: portal_leads sigue con RLS activo sin políticas → solo service role
-- (api/lead.js). Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE portal_leads
  ADD COLUMN IF NOT EXISTS place_id        TEXT,
  ADD COLUMN IF NOT EXISTS origen          TEXT,          -- 'sourcing' | null (inbound)
  ADD COLUMN IF NOT EXISTS enriquecimiento JSONB,         -- cache del análisis de Claude
  ADD COLUMN IF NOT EXISTS enriquecido_at  TIMESTAMPTZ;

-- Un comercio hallado en Google puede no tener teléfono publicado.
ALTER TABLE portal_leads ALTER COLUMN tel DROP NOT NULL;

-- Dedupe POR ORG: la misma org no repite un comercio; orgs distintas sí pueden
-- tener el mismo (cada una lo trabaja por su lado).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_portal_leads_org_place
  ON portal_leads (org_id, place_id) WHERE place_id IS NOT NULL;

-- ICP editable + contador de tope, por org.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sourcing JSONB;

COMMENT ON COLUMN organizations.sourcing IS
  'Config de sourcing por-org: { rubros[], ciudad, tope, mes, usadas }. rubros/ciudad los edita el admin; mes/usadas son el contador mensual del tope. Manejada por api/lead.js.';

-- Pre-cargar a Eric (Aryes) con un ICP HORECA sensato para que arranque listo.
-- Es solo el punto de partida: desde el panel puede editar rubros y ciudad.
UPDATE organizations
  SET sourcing = jsonb_build_object(
        'rubros', jsonb_build_array('Cafeterías', 'Restaurantes', 'Hoteles', 'Heladerías', 'Panaderías'),
        'ciudad', 'Montevideo',
        'tope',   20
      )
  WHERE id = 'aryes-ltda-6223' AND sourcing IS NULL;
