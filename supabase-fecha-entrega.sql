-- supabase-fecha-entrega.sql
-- Agrega la fecha de entrega estimada/elegida al pedido B2B del portal.
-- El portal la calcula segun la config de reparto de la org (brandCfg.reparto):
--   modo 'zona'    -> fecha estimada por la zona/ruta del cliente (read-only)
--   modo 'cliente' -> fecha que el cliente eligio en el checkout
-- Se guarda con un PATCH best-effort desde api/_create-order.js despues del RPC,
-- y se muestra en el comprobante PDF (api/_pedido-pdf.js).
--
-- Columna simple, nullable: los pedidos existentes y las orgs sin reparto
-- configurado quedan en NULL (sin fecha), cero cambios de comportamiento.
-- No requiere tocar RLS (solo agrega una columna).

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS fecha_entrega_estimada date;

COMMENT ON COLUMN b2b_orders.fecha_entrega_estimada IS
  'Fecha de entrega estimada (modo zona) o elegida por el cliente (modo cliente) en el checkout del portal. NULL si la org no usa reparto.';
