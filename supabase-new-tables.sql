-- ============================================================
-- ARYES STOCK — New Tables: lotes, devoluciones, conteos
-- Run this entire script in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
-- ============================================================

-- ── 1. CREATE TABLES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lotes (
  id              TEXT        PRIMARY KEY,
  producto_id     TEXT        NOT NULL,
  producto_nombre TEXT        NOT NULL DEFAULT '',
  lote            TEXT        NOT NULL DEFAULT '',
  fecha_venc      DATE,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 0,
  proveedor       TEXT        NOT NULL DEFAULT '',
  notas           TEXT        NOT NULL DEFAULT '',
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devoluciones (
  id              TEXT        PRIMARY KEY,
  nro_devolucion  TEXT        NOT NULL,
  venta_id        TEXT,
  cliente_nombre  TEXT        NOT NULL DEFAULT '',
  motivo          TEXT        NOT NULL DEFAULT '',
  notas           TEXT        NOT NULL DEFAULT '',
  items           JSONB       NOT NULL DEFAULT '[]',
  estado          TEXT        NOT NULL DEFAULT 'procesada',
  fecha           TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conteos (
  id            TEXT        PRIMARY KEY,
  fecha         DATE        NOT NULL,
  items         JSONB       NOT NULL DEFAULT '[]',
  completado    BOOLEAN     NOT NULL DEFAULT false,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizado_en TIMESTAMPTZ
);

-- ── 2. INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS lotes_producto_id_idx  ON lotes (producto_id);
CREATE INDEX IF NOT EXISTS lotes_fecha_venc_idx   ON lotes (fecha_venc);
CREATE INDEX IF NOT EXISTS devoluciones_venta_idx ON devoluciones (venta_id);
CREATE INDEX IF NOT EXISTS conteos_fecha_idx      ON conteos (fecha);

-- ── 3. ENABLE RLS ────────────────────────────────────────────

ALTER TABLE lotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos      ENABLE ROW LEVEL SECURITY;

-- ── 4. DROP EXISTING POLICIES (idempotent re-run) ────────────

DROP POLICY IF EXISTS "lotes_select"          ON lotes;
DROP POLICY IF EXISTS "lotes_insert"          ON lotes;
DROP POLICY IF EXISTS "lotes_update"          ON lotes;
DROP POLICY IF EXISTS "lotes_delete"          ON lotes;

DROP POLICY IF EXISTS "devoluciones_select"   ON devoluciones;
DROP POLICY IF EXISTS "devoluciones_insert"   ON devoluciones;
DROP POLICY IF EXISTS "devoluciones_update"   ON devoluciones;
DROP POLICY IF EXISTS "devoluciones_delete"   ON devoluciones;

DROP POLICY IF EXISTS "conteos_select"        ON conteos;
DROP POLICY IF EXISTS "conteos_insert"        ON conteos;
DROP POLICY IF EXISTS "conteos_update"        ON conteos;
DROP POLICY IF EXISTS "conteos_delete"        ON conteos;

-- ── 5. LOTES POLICIES ────────────────────────────────────────
-- SELECT: todos los roles ven lotes (operador necesita ver vencimientos, vendedor FEFO)
-- INSERT: admin y operador (recepción crea lotes, registro manual)
-- UPDATE: admin y operador (corrección de cantidad o fecha de vencimiento)
-- DELETE: solo admin (irreversible, afecta auditoría de trazabilidad)

CREATE POLICY "lotes_select" ON lotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lotes_insert" ON lotes
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "lotes_update" ON lotes
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "lotes_delete" ON lotes
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── 6. DEVOLUCIONES POLICIES ─────────────────────────────────
-- SELECT: todos los roles (vendedor necesita ver historial del cliente)
-- INSERT: admin y vendedor (el vendedor procesa devoluciones de clientes)
-- UPDATE: solo admin (devoluciones son casi inmutables una vez procesadas)
-- DELETE: solo admin

CREATE POLICY "devoluciones_select" ON devoluciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "devoluciones_insert" ON devoluciones
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "devoluciones_update" ON devoluciones
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "devoluciones_delete" ON devoluciones
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── 7. CONTEOS POLICIES ──────────────────────────────────────
-- SELECT: todos los roles (trazabilidad y auditoría)
-- INSERT: admin y operador (conteo físico es operación de depósito)
-- UPDATE: solo admin (los conteos son inmutables por diseño de auditoría)
-- DELETE: solo admin

CREATE POLICY "conteos_select" ON conteos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "conteos_insert" ON conteos
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'operador'));

CREATE POLICY "conteos_update" ON conteos
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "conteos_delete" ON conteos
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── 8. VERIFY ────────────────────────────────────────────────
-- Run after applying to confirm policies are active:
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('lotes', 'devoluciones', 'conteos')
-- ORDER BY tablename, cmd;
