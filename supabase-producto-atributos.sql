-- Atributos flexibles por producto (multi-rubro): lista libre de clave/valor que el
-- distribuidor completa según su vertical. Ej. vino → "Graduación: 12%"; ferretería →
-- "Material: Acero inox". Se rinde en la FICHA TÉCNICA del portal.
-- Formato JSONB: [{ "k": "Graduación", "v": "12%" }, ...]
-- Correr en Supabase → SQL Editor → Run. Idempotente (IF NOT EXISTS).

ALTER TABLE products ADD COLUMN IF NOT EXISTS atributos JSONB NOT NULL DEFAULT '[]'::jsonb;
