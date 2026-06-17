-- ============================================================================
-- supabase-wa-bot.sql
-- Tablas para el bot de pedidos por WhatsApp (Fase 3).
--
--   wa_conversations  → máquina de estados de la conversación (carrito en curso).
--   wa_accounts       → ruteo multi-tenant: phone_number_id (WABA de cada
--                       distribuidora) → org_id. Vacía en el piloto de un número;
--                       se puebla vía Embedded Signup cuando se sume el modelo
--                       Tech Provider de Meta.
--
-- Ambas son de uso EXCLUSIVO del servidor (service role). RLS activo SIN policies
-- públicas: anon/authenticated no pueden leer ni escribir; el service role
-- bypassa RLS. Seguro de re-correr.
-- ============================================================================

-- ── Estado de conversación del bot ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text NOT NULL,
  cliente_id      uuid,
  phone_number_id text,                       -- número de Meta que recibió el mensaje
  from_number     text NOT NULL,              -- número del cliente
  estado          text NOT NULL DEFAULT 'idle', -- 'idle' | 'revision'
  carrito         jsonb NOT NULL DEFAULT '{}'::jsonb, -- { lineas, sinPrecio, sinMatch, total }
  last_message_id text,                        -- idempotencia: último msg entrante procesado
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz                  -- TTL del carrito (se ignora vencido)
);

-- Una conversación activa por canal (número Meta) + remitente (cliente).
CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_channel_uidx
  ON wa_conversations (phone_number_id, from_number);

CREATE INDEX IF NOT EXISTS wa_conversations_org_idx
  ON wa_conversations (org_id);

ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE wa_conversations IS
  'Estado del bot de pedidos por WhatsApp: carrito en revisión por (phone_number_id, from_number). Solo service role.';

-- ── Ruteo phone_number_id → org (modelo Tech Provider / Embedded Signup) ─────
CREATE TABLE IF NOT EXISTS wa_accounts (
  phone_number_id text PRIMARY KEY,           -- id del número en la WABA de la distribuidora
  org_id          text NOT NULL,
  waba_id         text,
  display_name    text,                        -- nombre comercial que ve el cliente
  token           text,                        -- token de envío de ESA WABA (si difiere del global)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_accounts_org_idx
  ON wa_accounts (org_id);

ALTER TABLE wa_accounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE wa_accounts IS
  'Mapeo phone_number_id → org para el bot multi-tenant. Se puebla con Embedded Signup. Solo service role.';
