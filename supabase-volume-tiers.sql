-- ============================================================================
-- supabase-volume-tiers.sql
-- Escalas de descuento por volumen por producto. Genérico: cualquier org puede
-- cargarlas. NO está atado a ningún org en particular.
--
-- Qué resuelve:
--   Permite premiar la compra por bulto en el portal B2B ("10+ unidades: -5%").
--   El portal (catalogo.js) devuelve volume_tiers por producto; el carrito aplica
--   la mejor escala según la cantidad pedida y envía el precio ya descontado.
--
-- Formato del JSONB (array ordenado por cantidad mínima):
--   [{"min": 10, "dto": 5}, {"min": 24, "dto": 10}]
--   - min: cantidad mínima (entero > 1) para que aplique el descuento
--   - dto: porcentaje de descuento (0 < dto <= 100)
--   catalogo.js sanea la forma cruda, así que datos inválidos se ignoran sin romper.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS volume_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.volume_tiers IS
  'Escalas de descuento por volumen: [{"min":10,"dto":5}]. min=cantidad mínima, dto=% descuento. El portal aplica la mejor escala que alcanza la cantidad pedida.';

-- ============================================================================
-- Ejemplo de carga para un producto:
--   UPDATE products
--     SET volume_tiers = '[{"min":10,"dto":5},{"min":24,"dto":10}]'::jsonb
--     WHERE uuid = '<PRODUCT_UUID>';
--
-- Verificación:
--   SELECT name, volume_tiers FROM products WHERE volume_tiers <> '[]'::jsonb;
-- ============================================================================
