-- supabase-push.sql
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          text PRIMARY KEY,
  org_id      text NOT NULL,
  role        text DEFAULT 'admin',
  endpoint    text NOT NULL,
  p256dh      text,
  auth        text,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo el service key puede escribir (desde api/push.js)
-- El anon key puede leer las propias suscripciones
CREATE POLICY "service_all" ON push_subscriptions
  FOR ALL USING (true);
