-- ============================================================
-- VARIANTES DE PRODUCTO (genérico, multi-tenant)
-- Run in Supabase SQL Editor (one-time)
-- ============================================================
-- Permite que un producto "padre" (ej: Color Softgel 150g) ofrezca N opciones
-- (colores, sabores, talles, aromas) que el cliente elige en el portal — sin
-- crear N cards. Las variantes COMPARTEN precio/IVA/descuentos/stock del padre;
-- cada una es sólo una etiqueta + SKU opcional. Modelo igual a volume_tiers:
-- un JSONB en la misma fila products, así la sync Realtime (broadcast por fila)
-- lo propaga sin cambios.
--
-- Forma:
--   {
--     "label": "Color",
--     "options": [
--       { "id": "rojo", "label": "Rojo", "sku": "CSG-RED", "color_hex": "#e11d48" },
--       { "id": "azul", "label": "Azul", "sku": "CSG-BLUE", "color_hex": "#2563eb" }
--     ]
--   }
-- Producto sin variantes -> variants = '{}'::jsonb (o null). Retrocompatible.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Verificar.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'variants';
