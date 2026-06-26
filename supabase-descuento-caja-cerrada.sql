-- Descuento por caja cerrada (distribuidores).
-- Correr una vez en Supabase → SQL Editor. Idempotente (se puede correr de nuevo sin romper).
--
-- Cómo funciona:
--   - Por PRODUCTO: cuántas unidades trae la caja + qué % de descuento se gana por caja completa.
--   - Por LISTA de precios: un flag que habilita el descuento para los clientes de esa lista
--     (ej. una "Lista Distribuidores"). Los clientes de listas sin el flag no lo reciben.
--   - En el carrito: solo las unidades que completan cajas enteras llevan el descuento.

-- 1) Config por producto
ALTER TABLE products    ADD COLUMN IF NOT EXISTS unidades_por_caja integer DEFAULT 0;
ALTER TABLE products    ADD COLUMN IF NOT EXISTS descuento_caja    numeric DEFAULT 0;

-- 2) Flag por lista de precios (quién recibe el descuento por caja cerrada)
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS habilitar_caja_cerrada boolean DEFAULT false;
