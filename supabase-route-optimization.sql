-- GAP3: Route optimization — add geocoords to clients
-- Safe to re-run
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS lat         NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS lng         NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
