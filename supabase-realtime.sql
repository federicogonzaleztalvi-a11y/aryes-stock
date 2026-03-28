-- ============================================================
-- ENABLE REALTIME — Multi-device sync
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable Realtime for key tables
-- This adds them to the supabase_realtime publication

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE rutas;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;

-- Verify:
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- ORDER BY tablename;
