-- M-GAP1: Sale prices — add lista_id to clients
-- Safe to re-run
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lista_id TEXT;
