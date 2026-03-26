-- M-2: Time windows — reception hours per client
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS horario_desde TEXT,
  ADD COLUMN IF NOT EXISTS horario_hasta TEXT;
