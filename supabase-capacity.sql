-- Vehicle capacity fields on rutas table
ALTER TABLE rutas
  ADD COLUMN IF NOT EXISTS capacidad_kg     NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidad_bultos INTEGER      DEFAULT 0;
