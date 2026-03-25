-- ============================================================
-- ARYES STOCK — Tabla: purchase_invoices (facturas de compra)
-- Safe to re-run: IF NOT EXISTS throughout
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id               TEXT          PRIMARY KEY,
  proveedor_id     TEXT          NOT NULL DEFAULT '',
  proveedor_nombre TEXT          NOT NULL DEFAULT '',
  numero           TEXT          NOT NULL DEFAULT '',
  fecha            DATE          NOT NULL,
  fecha_venc       DATE,
  moneda           TEXT          NOT NULL DEFAULT 'USD',
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_pendiente  NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT          NOT NULL DEFAULT 'pendiente',
  recepcion_id     TEXT,
  notas            TEXT          NOT NULL DEFAULT '',
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pi_proveedor_idx  ON purchase_invoices (proveedor_id);
CREATE INDEX IF NOT EXISTS pi_status_idx     ON purchase_invoices (status);
CREATE INDEX IF NOT EXISTS pi_fecha_venc_idx ON purchase_invoices (fecha_venc);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pi_select" ON purchase_invoices;
DROP POLICY IF EXISTS "pi_write"  ON purchase_invoices;

-- All roles can read (operador needs to see pending payments context)
CREATE POLICY "pi_select" ON purchase_invoices
  FOR SELECT TO authenticated USING (true);

-- Only admin can write (purchase invoices are financial records)
CREATE POLICY "pi_write" ON purchase_invoices
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin'))
  WITH CHECK (get_my_role() IN ('admin'));
