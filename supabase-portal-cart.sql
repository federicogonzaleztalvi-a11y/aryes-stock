-- ============================================================
-- Portal B2B — carrito persistente cross-device
-- Guarda el carrito del cliente en el servidor (no sólo en el
-- navegador) para que pueda arrancar un pedido en la compu y
-- seguirlo en el celular. Una fila por (org_id, client_id).
--
-- Sólo guardamos cantidades por producto (jsonb). Los precios
-- siempre se recalculan del catálogo fresco al abrir el carrito.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_carts (
  org_id      TEXT        NOT NULL,
  client_id   TEXT        NOT NULL,
  items       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, client_id)
);

-- RLS: igual que portal_sessions — sólo el service role (las funciones
-- serverless /api/cart) lee y escribe. El portal nunca toca esta tabla por
-- REST directo; pasa siempre por la API que valida la sesión. Así un cliente
-- no puede leer ni pisar el carrito de otro.
ALTER TABLE portal_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_carts_service_only" ON portal_carts
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
