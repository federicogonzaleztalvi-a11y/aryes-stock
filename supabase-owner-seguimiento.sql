-- ============================================================================
-- supabase-owner-seguimiento.sql
-- SEGUIMIENTO INTELIGENTE — la 4ª pieza de un motor comercial pro.
--
-- El 80% de las ventas se cierran en el 2º-5º toque. Sin un sistema que te lo
-- recuerde, es donde todos aflojan. Estas dos columnas hacen que /owner sepa
-- a QUIÉN te toca seguir hoy:
--
--   ultimo_contacto_at → cuándo le escribiste por última vez.
--   seguir_desde       → a partir de cuándo vuelve a aparecer en "Para seguir".
--
-- Cuando Federico marca "Ya le escribí", se setea ultimo_contacto_at=now y
-- seguir_desde=now+3 días. Cuando pospone, se corre seguir_desde. Un prospecto
-- activo (contactado/demo) con seguir_desde ya vencido = "seguilo hoy".
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS ultimo_contacto_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seguir_desde       TIMESTAMPTZ;

-- Para ordenar rápido "quién sigue primero".
CREATE INDEX IF NOT EXISTS idx_pazque_leads_seguir ON pazque_leads (seguir_desde);
