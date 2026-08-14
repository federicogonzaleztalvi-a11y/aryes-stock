-- Contacto de Cobranza / Administración en la ficha de cliente
-- Separado del email de facturación (que es a dónde va el CFE).
-- Correr en Supabase → SQL Editor → Run. Idempotente (IF NOT EXISTS).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS telefono_cobranza TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_cobranza    TEXT NOT NULL DEFAULT '';
