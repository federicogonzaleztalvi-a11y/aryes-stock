-- ============================================================================
-- supabase-descuento-posible.sql
-- Descuento posible (suelto) por producto. Genérico: cualquier org puede usarlo.
-- NO está atado a ningún org en particular.
--
-- Qué resuelve:
--   Un % de descuento "de referencia" por producto, INDEPENDIENTE de la cantidad
--   (a diferencia de volume_tiers, que depende del bulto). Es solo informativo:
--   se carga al editar el producto y se muestra en la pestaña "Descuentos".
--   NO modifica precios en el portal ni en ventas — es una referencia.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS descuento_posible NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.descuento_posible IS
  'Descuento posible de referencia (%), suelto, independiente de la cantidad. Solo informativo — se muestra en la pestaña Descuentos. No aplica a precios.';

-- ============================================================================
-- Verificación:
--   SELECT name, descuento_posible FROM products WHERE descuento_posible > 0;
-- ============================================================================
