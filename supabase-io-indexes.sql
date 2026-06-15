-- supabase-io-indexes.sql
-- Índices para reducir seq scans (Disk IO) en tablas calientes.
-- Idempotente: se puede correr múltiples veces.
-- NOTA: cada CREATE INDEX es DDL → dispara una recarga de esquema en PostgREST.
-- Correr cuando el Disk IO Budget esté recuperado (no encimar con throttle activo).

-- Poller de pedidos B2B (cada 3 min): b2b_orders?org_id=eq.X&estado=eq.pendiente&order=creado_en.desc
CREATE INDEX IF NOT EXISTS idx_b2b_orders_org_estado
  ON b2b_orders (org_id, estado, creado_en DESC);

-- Catálogo + sync: products?org_id=eq.X
CREATE INDEX IF NOT EXISTS idx_products_org
  ON products (org_id);

-- OTP login: clients?org_id=eq.X&phone=...
CREATE INDEX IF NOT EXISTS idx_clients_org_phone
  ON clients (org_id, phone);

-- ATP / reservas activas: stock_reservations?org_id=eq.X&status=eq.active&expires_at=gte.now
CREATE INDEX IF NOT EXISTS idx_stock_res_org_status
  ON stock_reservations (org_id, status, expires_at);

-- Recomendados / historial: ventas?org_id=eq.X&cliente_id=...
CREATE INDEX IF NOT EXISTS idx_ventas_org_cliente
  ON ventas (org_id, cliente_id);
