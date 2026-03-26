-- M-1: Devoluciones con impacto contable
-- Add tiene_devolucion to ventas table
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tiene_devolucion BOOLEAN NOT NULL DEFAULT false;
