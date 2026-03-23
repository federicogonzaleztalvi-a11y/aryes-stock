-- ============================================================
-- ARYES STOCK — DATA MODEL HARDENING v1
-- Run in Supabase SQL Editor BEFORE deploying the app changes.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

-- ── 1. CLIENTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            TEXT        NOT NULL,
  tipo              TEXT        NOT NULL DEFAULT 'Otro',
  rut               TEXT        NOT NULL DEFAULT '',
  telefono          TEXT        NOT NULL DEFAULT '',
  email             TEXT        NOT NULL DEFAULT '',
  email_facturacion TEXT        NOT NULL DEFAULT '',
  contacto          TEXT        NOT NULL DEFAULT '',
  direccion         TEXT        NOT NULL DEFAULT '',
  ciudad            TEXT        NOT NULL DEFAULT '',
  cond_pago         TEXT        NOT NULL DEFAULT 'credito_30',
  limite_credito    NUMERIC(12,2),
  notas             TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_nombre_idx ON clients (nombre);

-- ── 2. INVOICES (CFEs) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT        NOT NULL UNIQUE,
  tipo            TEXT        NOT NULL DEFAULT 'e-Factura',
  moneda          TEXT        NOT NULL DEFAULT 'UYU',
  fecha           DATE        NOT NULL,
  fecha_venc      DATE,
  cliente_id      UUID        REFERENCES clients(id) ON DELETE SET NULL,
  cliente_nombre  TEXT        NOT NULL DEFAULT '',
  cliente_rut     TEXT        NOT NULL DEFAULT '',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_pendiente NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'borrador',
  items           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notas           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_cliente_id_idx  ON invoices (cliente_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_fecha_venc_idx  ON invoices (fecha_venc);

-- ── 3. COLLECTIONS (cobros) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID        REFERENCES clients(id) ON DELETE SET NULL,
  monto            NUMERIC(14,2) NOT NULL,
  metodo           TEXT        NOT NULL DEFAULT 'Transferencia',
  fecha            DATE        NOT NULL,
  fecha_cheque     DATE,
  facturas_aplicar JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notas            TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collections_cliente_id_idx ON collections (cliente_id);
CREATE INDEX IF NOT EXISTS collections_fecha_idx      ON collections (fecha);

-- ── 4. updated_at triggers ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS clients_updated_at  ON clients;
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────

ALTER TABLE clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select"  ON clients;
DROP POLICY IF EXISTS "clients_insert"  ON clients;
DROP POLICY IF EXISTS "clients_update"  ON clients;
DROP POLICY IF EXISTS "clients_delete"  ON clients;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;
DROP POLICY IF EXISTS "collections_select" ON collections;
DROP POLICY IF EXISTS "collections_insert" ON collections;
DROP POLICY IF EXISTS "collections_delete" ON collections;

CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','operador'));
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','operador'));
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (get_my_role() = 'admin');

CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','vendedor'));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','vendedor'));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated USING (get_my_role() = 'admin');

CREATE POLICY "collections_select" ON collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "collections_insert" ON collections FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','vendedor'));
CREATE POLICY "collections_delete" ON collections FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- ── 6. ONE-TIME MIGRATION: aryes_data blobs → proper tables ──
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- Run after creating the tables above.

INSERT INTO clients (
  id, nombre, tipo, rut, telefono, email, email_facturacion,
  contacto, direccion, ciudad, cond_pago, limite_credito,
  notas, created_at
)
SELECT
  (item->>'id')::uuid,
  item->>'nombre',
  COALESCE(item->>'tipo', 'Otro'),
  COALESCE(item->>'rut', ''),
  COALESCE(item->>'telefono', ''),
  COALESCE(item->>'email', ''),
  COALESCE(item->>'emailFacturacion', ''),
  COALESCE(item->>'contacto', ''),
  COALESCE(item->>'direccion', ''),
  COALESCE(item->>'ciudad', ''),
  COALESCE(item->>'condPago', 'credito_30'),
  CASE WHEN item->>'limiteCredito' IS NOT NULL AND item->>'limiteCredito' != ''
       THEN (item->>'limiteCredito')::numeric ELSE NULL END,
  COALESCE(item->>'notas', ''),
  COALESCE((item->>'creado')::timestamptz, now())
FROM (
  SELECT jsonb_array_elements(value::jsonb) AS item
  FROM aryes_data WHERE key = 'aryes-clients'
) sub
WHERE (item->>'id') IS NOT NULL AND (item->>'nombre') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (
  id, numero, tipo, moneda, fecha, fecha_venc,
  cliente_id, cliente_nombre, cliente_rut,
  subtotal, iva_total, descuento, total, saldo_pendiente,
  status, items, notas, created_at
)
SELECT
  (item->>'id')::uuid,
  item->>'numero',
  COALESCE(item->>'tipo', 'e-Factura'),
  COALESCE(item->>'moneda', 'UYU'),
  (item->>'fecha')::date,
  CASE WHEN item->>'fechaVenc' IS NOT NULL AND item->>'fechaVenc' != ''
       THEN (item->>'fechaVenc')::date ELSE NULL END,
  CASE WHEN item->>'clienteId' IS NOT NULL AND item->>'clienteId' != ''
       THEN (item->>'clienteId')::uuid ELSE NULL END,
  COALESCE(item->>'clienteNombre', ''),
  COALESCE(item->>'clienteRut', ''),
  COALESCE((item->>'subtotal')::numeric, 0),
  COALESCE((item->>'ivaTotal')::numeric, 0),
  COALESCE((item->>'descuento')::numeric, 0),
  COALESCE((item->>'total')::numeric, 0),
  COALESCE((item->>'saldoPendiente')::numeric, (item->>'total')::numeric, 0),
  COALESCE(item->>'status', 'emitida'),
  COALESCE(item->'items', '[]'::jsonb),
  COALESCE(item->>'notas', ''),
  COALESCE((item->>'createdAt')::timestamptz, now())
FROM (
  SELECT jsonb_array_elements(value::jsonb) AS item
  FROM aryes_data WHERE key = 'aryes-cfe'
) sub
WHERE (item->>'id') IS NOT NULL AND (item->>'numero') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO collections (
  id, cliente_id, monto, metodo, fecha, fecha_cheque,
  facturas_aplicar, notas, created_at
)
SELECT
  (item->>'id')::uuid,
  CASE WHEN item->>'clienteId' IS NOT NULL AND item->>'clienteId' != ''
       THEN (item->>'clienteId')::uuid ELSE NULL END,
  COALESCE((item->>'monto')::numeric, 0),
  COALESCE(item->>'metodo', 'Transferencia'),
  COALESCE((item->>'fecha')::date, now()::date),
  CASE WHEN item->>'fechaCheque' IS NOT NULL AND item->>'fechaCheque' != ''
       THEN (item->>'fechaCheque')::date ELSE NULL END,
  COALESCE(item->'facturasAplicar', '[]'::jsonb),
  COALESCE(item->>'notas', ''),
  COALESCE((item->>'createdAt')::timestamptz, now())
FROM (
  SELECT jsonb_array_elements(value::jsonb) AS item
  FROM aryes_data WHERE key = 'aryes-cobros'
) sub
WHERE (item->>'id') IS NOT NULL
ON CONFLICT (id) DO NOTHING;
