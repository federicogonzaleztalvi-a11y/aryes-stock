-- ============================================================================
-- supabase-b2b-orders-pod.sql
-- Proof of Delivery (POD) para pedidos B2B.
--
-- Cuando el repartidor marca "entregado" en SimpliRoute, el webhook
-- (api/simpliroute.js, action=webhook) captura la prueba de entrega y la
-- guarda acá. El portal del cliente la muestra en "Seguir mi pedido".
--
-- Aditivo y nullable: si la org no conectó SimpliRoute (o el pedido no se
-- entregó), ambas columnas quedan NULL y el portal degrada al comportamiento
-- actual (solo el badge "Entregado", sin detalle). Genérico multi-tenant.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor.
-- ============================================================================

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pod JSONB;

COMMENT ON COLUMN b2b_orders.entregado_en IS
  'Timestamp real de entrega (de SimpliRoute checkout). NULL si no entregado/sin integración.';
COMMENT ON COLUMN b2b_orders.pod IS
  'Proof of Delivery: { hora, observacion, firma, fotos[], lat, lng }. Capturado por api/simpliroute.js desde el webhook visit_checkout_detailed.';
