-- ============================================================
-- PAZQUE — Tabla: packings (registro de preparación/packing de pedidos)
-- Antes vivía SOLO en localStorage (sin org_id) → se perdía al recargar y
-- no era multi-tenant. Esta tabla lo hace durable y por-org, siguiendo el
-- mismo patrón que transfers / deposit_locations.
-- Safe to re-run: IF NOT EXISTS throughout.
-- ============================================================

CREATE TABLE IF NOT EXISTS packings (
  id               TEXT          PRIMARY KEY,
  org_id           TEXT          NOT NULL,
  venta_id         TEXT          NOT NULL,
  nro_venta        TEXT          NOT NULL DEFAULT '',
  cliente_nombre   TEXT          NOT NULL DEFAULT '',
  items            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  bultos           INTEGER       NOT NULL DEFAULT 1,
  notas            TEXT          NOT NULL DEFAULT '',
  estado           TEXT          NOT NULL DEFAULT 'listo',
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Multi-tenancy + historial: las queries filtran por org_id y ordenan por fecha.
CREATE INDEX IF NOT EXISTS packings_org_creado_idx ON packings (org_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS packings_venta_idx      ON packings (venta_id);

ALTER TABLE packings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packings_select" ON packings;
DROP POLICY IF EXISTS "packings_insert" ON packings;
DROP POLICY IF EXISTS "packings_delete" ON packings;

-- Todos los roles autenticados pueden leer el historial de packing.
CREATE POLICY "packings_select" ON packings
  FOR SELECT TO authenticated USING (true);

-- Admin y operador pueden registrar un packing.
CREATE POLICY "packings_insert" ON packings
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

-- Sólo admin puede borrar.
CREATE POLICY "packings_delete" ON packings
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
