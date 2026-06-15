-- ============================================================
-- PAZQUE — Depósito: mapa de ubicaciones (bins) + config de grilla
--
-- Reemplaza el almacenamiento localStorage de DepositoTab por Supabase,
-- así el layout del depósito y las asignaciones producto→bin sobreviven
-- a cambios de dispositivo y se comparten entre el equipo del distribuidor.
--
-- Modelo (espeja lo que hoy guarda DepositoTab):
--   deposit_locations = array `ubicaciones` [{id:bin, productoId, asignado}]
--   deposit_config    = objeto `config` {pasillos, estantes, niveles, posiciones, zonas}
--
-- IMPORTANTE: esto NO toca stock. El stock total sigue siendo products.stock.
-- Un bin sólo dice DÓNDE está físicamente un producto, no cuánto hay.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS en todo.
-- ============================================================

-- ── 1. Tabla: deposit_locations (asignación producto → bin) ──────────────
CREATE TABLE IF NOT EXISTS deposit_locations (
  org_id       TEXT        NOT NULL DEFAULT 'aryes',
  bin_id       TEXT        NOT NULL,                  -- ej. 'A-01-A-1-01'
  producto_id  TEXT        NOT NULL,
  asignado     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, bin_id)                        -- un producto por bin, por org
);

CREATE INDEX IF NOT EXISTS deposit_locations_org_idx       ON deposit_locations (org_id);
CREATE INDEX IF NOT EXISTS deposit_locations_producto_idx  ON deposit_locations (org_id, producto_id);

-- ── 2. Tabla: deposit_config (grilla del depósito, 1 fila por org) ────────
CREATE TABLE IF NOT EXISTS deposit_config (
  org_id      TEXT        PRIMARY KEY DEFAULT 'aryes',
  pasillos    INT         NOT NULL DEFAULT 8,
  estantes    INT         NOT NULL DEFAULT 4,
  niveles     INT         NOT NULL DEFAULT 3,
  posiciones  INT         NOT NULL DEFAULT 6,
  zonas       JSONB       NOT NULL DEFAULT '["A","F"]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. RLS: aislamiento por org ──────────────────────────────────────────
ALTER TABLE deposit_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_config    ENABLE ROW LEVEL SECURITY;

-- deposit_locations
DROP POLICY IF EXISTS "deposit_locations_select" ON deposit_locations;
DROP POLICY IF EXISTS "deposit_locations_write"  ON deposit_locations;

-- Cualquier usuario autenticado ve las ubicaciones de SU org
CREATE POLICY "deposit_locations_select" ON deposit_locations
  FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());

-- Admin y operador pueden crear/mover/liberar bins de SU org
CREATE POLICY "deposit_locations_write" ON deposit_locations
  FOR ALL TO authenticated
  USING (org_id = get_my_org_id() AND get_my_role() IN ('admin','operador'))
  WITH CHECK (org_id = get_my_org_id() AND get_my_role() IN ('admin','operador'));

-- deposit_config
DROP POLICY IF EXISTS "deposit_config_select" ON deposit_config;
DROP POLICY IF EXISTS "deposit_config_write"  ON deposit_config;

CREATE POLICY "deposit_config_select" ON deposit_config
  FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());

CREATE POLICY "deposit_config_write" ON deposit_config
  FOR ALL TO authenticated
  USING (org_id = get_my_org_id() AND get_my_role() IN ('admin','operador'))
  WITH CHECK (org_id = get_my_org_id() AND get_my_role() IN ('admin','operador'));

-- ── 4. Semilla de config para orgs existentes (no pisa si ya existe) ──────
INSERT INTO deposit_config (org_id) VALUES ('aryes')          ON CONFLICT (org_id) DO NOTHING;
INSERT INTO deposit_config (org_id) VALUES ('aryes-ltda-6223') ON CONFLICT (org_id) DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────────────────────
-- SELECT * FROM deposit_config;
-- SELECT count(*) FROM deposit_locations;
-- Esperado: filas de config para cada org; 0 ubicaciones hasta que se asignen.
