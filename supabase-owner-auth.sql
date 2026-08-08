-- ============================================================================
-- supabase-owner-auth.sql
-- LOGIN SIN CONTRASEÑA de la consola de DUEÑO (/owner, api/owner.js).
--
-- Federico entra a pazque.com/owner → pide un código a su mail → lo pega →
-- queda con sesión de 30 días en ese dispositivo. Mismo patrón que Shopify /
-- Amazon (cuenta con sesión persistente), NO una clave compartida.
--
-- Dos tablas:
--   owner_login_codes  → códigos de 6 dígitos de un solo uso (vencen en 10 min)
--   owner_sessions     → sesiones activas (token de 30 días por dispositivo)
--
-- Ambas guardan HASH (sha256), nunca el código/token en claro. Manejadas SOLO
-- por api/owner.js con service role. RLS activo sin políticas → nadie las lee
-- ni escribe directo (ni anon, ni authenticated, ni las orgs de los clientes).
-- Aislado por completo del sistema de roles por-org que protege a Eric.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

-- Códigos de acceso de un solo uso ------------------------------------------
CREATE TABLE IF NOT EXISTS owner_login_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,             -- a qué mail se envió (el del dueño)
  code_hash  TEXT NOT NULL,             -- sha256 del código de 6 dígitos
  expires_at TIMESTAMPTZ NOT NULL,      -- vence a los 10 min
  attempts   INT NOT NULL DEFAULT 0,    -- intentos fallidos → se bloquea a los 5
  consumed   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_codes_email   ON owner_login_codes (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_codes_expires ON owner_login_codes (expires_at);

ALTER TABLE owner_login_codes ENABLE ROW LEVEL SECURITY;

-- Sesiones activas (una por dispositivo/navegador) --------------------------
CREATE TABLE IF NOT EXISTS owner_sessions (
  token_hash   TEXT PRIMARY KEY,        -- sha256 del token de sesión (bearer)
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,    -- 30 días desde el login
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_expires ON owner_sessions (expires_at);

ALTER TABLE owner_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE owner_login_codes IS
  'Códigos de un solo uso para el login sin contraseña de /owner. Solo api/owner.js (service role).';
COMMENT ON TABLE owner_sessions IS
  'Sesiones activas de la consola de dueño (/owner), 30 días por dispositivo. Solo api/owner.js (service role).';
