-- ============================================================
-- ARYES STOCK — Add precio_venta to products table
-- Safe to re-run: uses IF NOT EXISTS pattern via ALTER TABLE
-- ============================================================

-- Add precio_venta column (default 0 preserves existing rows)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS precio_venta NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'precio_venta';
