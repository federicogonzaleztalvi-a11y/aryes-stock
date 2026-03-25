-- ============================================================
-- ARYES STOCK — Tabla: transfers (internal warehouse transfers)
-- Safe to re-run: IF NOT EXISTS throughout
-- ============================================================

CREATE TABLE IF NOT EXISTS transfers (
  id               TEXT          PRIMARY KEY,
  producto_id      TEXT          NOT NULL,
  producto_nombre  TEXT          NOT NULL DEFAULT '',
  cantidad         NUMERIC(14,4) NOT NULL DEFAULT 0,
  origen           TEXT          NOT NULL DEFAULT '',
  destino          TEXT          NOT NULL DEFAULT '',
  notas            TEXT          NOT NULL DEFAULT '',
  fecha            TEXT          NOT NULL DEFAULT '',
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transfers_producto_idx   ON transfers (producto_id);
CREATE INDEX IF NOT EXISTS transfers_creado_en_idx  ON transfers (creado_en DESC);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_select" ON transfers;
DROP POLICY IF EXISTS "transfers_insert" ON transfers;
DROP POLICY IF EXISTS "transfers_delete" ON transfers;

-- All roles can read transfer history
CREATE POLICY "transfers_select" ON transfers
  FOR SELECT TO authenticated USING (true);

-- Admin and operador can create transfers
CREATE POLICY "transfers_insert" ON transfers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

-- Only admin can delete
CREATE POLICY "transfers_delete" ON transfers
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
