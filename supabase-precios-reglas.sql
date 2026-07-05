-- ============================================================================
-- supabase-precios-reglas.sql
-- Modelo de precios v2 — reglas de descuento por producto DENTRO de la lista.
-- Genérico multi-tenant: NO está atado a ninguna org.
--
-- Qué resuelve:
--   Hoy el precio/descuento de un producto se carga en 9 lugares que se pisan
--   (producto: precio_venta, descuento_posible, volume_tiers, descuento_caja;
--    lista: descuento global, descuentos_categoria; lista×producto: precio,
--    descuento; cliente: overrides). Eso genera el bug "sin precio" y descuentos
--   que se apilan sin querer.
--
--   El modelo v2 unifica: el PRECIO BASE vive solo en el producto (precio_venta),
--   y TODOS los descuentos de un producto para una lista viven en UN solo lugar:
--   price_list_items.reglas (+ price_list_items.precio como precio especial fijo
--   opcional). El motor toma la MEJOR regla que aplica por unidad — NUNCA suma.
--
-- Formato de `reglas` (array JSONB, orden libre):
--   [
--     {"condicion":"siempre",  "dto":10},                    -- aplica siempre
--     {"condicion":"caja",     "dto":20},                    -- solo a unidades que completan caja cerrada
--     {"condicion":"cantidad", "dto":15, "min_unidades":24}  -- si la cantidad pedida alcanza el mínimo
--   ]
--   - condicion: 'siempre' | 'caja' | 'cantidad'
--   - dto: % de descuento (0 < dto <= 100)
--   - min_unidades: entero > 1, SOLO para condicion='cantidad'
--   - 'caja' usa products.unidades_por_caja para saber cuántas unidades forman caja
--
-- Precio especial: price_list_items.precio (> 0) sigue siendo el precio fijo del
--   producto para esa lista. Si está seteado, ES el precio final — no se le aplica
--   ningún descuento encima.
--
-- SEGURIDAD (expand/contract):
--   - Este script SOLO AGREGA una columna. No borra ni modifica nada existente.
--   - El motor (api/_catalog.js) usa la lógica v2 SOLO para productos con `reglas`
--     no vacías. Todo lo que hoy NO tiene reglas sigue con la lógica vieja, byte
--     por byte. Por eso correr esto NO cambia ningún precio del portal.
--   - Las columnas viejas (products.descuento_caja, volume_tiers, descuento_posible,
--     price_lists.descuento, etc.) quedan intactas para poder volver atrás.
--
-- Idempotente. Pegar en Supabase → SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE price_list_items
  ADD COLUMN IF NOT EXISTS reglas JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN price_list_items.reglas IS
  'Reglas de descuento del producto en esta lista (modelo v2): [{"condicion":"siempre|caja|cantidad","dto":10,"min_unidades":24}]. El motor toma la mejor regla que aplica por unidad, sin acumular. Si price_list_items.precio > 0, ese precio fijo gana y no se aplican reglas.';

-- ============================================================================
-- Verificación:
--   SELECT lista_id, product_uuid, precio, reglas
--   FROM price_list_items WHERE reglas <> '[]'::jsonb;
-- ============================================================================
