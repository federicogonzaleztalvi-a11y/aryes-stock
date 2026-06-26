-- Dirección fiscal del cliente + teléfono por sucursal.
-- Correr una vez en Supabase → SQL Editor. Idempotente (se puede correr de nuevo sin romper).

-- 1) Dirección fiscal del cliente (separada de la dirección de entrega que usan las rutas)
ALTER TABLE clients          ADD COLUMN IF NOT EXISTS direccion_fiscal text;

-- 2) Teléfono propio de cada sucursal / dirección de entrega
ALTER TABLE client_addresses ADD COLUMN IF NOT EXISTS telefono         text;
