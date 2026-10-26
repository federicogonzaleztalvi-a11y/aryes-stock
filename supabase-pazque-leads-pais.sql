-- ============================================================================
-- supabase-pazque-leads-pais.sql
-- Agrega el PAÍS y la CIUDAD del prospecto a pazque_leads, para poder distinguir
-- mercados y zonas en /owner (ej: probar Argentina sin mezclar los leads con los
-- de Uruguay, o separar Buenos Aires de Córdoba dentro de Argentina).
--
-- País y ciudad los setea api/owner.js al sumar un lead por sourcing: los toma de
-- los componentes ESTRUCTURADOS de Google (country + locality/admin_2), los mismos
-- que ya usa la guardia geográfica (resuelve trampas como "Concepción del Uruguay"
-- = Argentina). Los leads inbound (formulario de la landing) no traen dirección →
-- quedan sin país ni ciudad.
--
-- Este script también backfillea los leads viejos de sourcing como 'Uruguay'
-- (ver nota del backfill). La ciudad de los leads viejos queda NULL a propósito
-- (ver nota al final).
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE pazque_leads ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE pazque_leads ADD COLUMN IF NOT EXISTS ciudad TEXT;

CREATE INDEX IF NOT EXISTS idx_pazque_leads_pais ON pazque_leads (pais);
CREATE INDEX IF NOT EXISTS idx_pazque_leads_ciudad ON pazque_leads (ciudad);

-- Backfill de los leads viejos de sourcing → 'Uruguay'.
-- OJO: NO se puede leer el país del texto de la dirección (`mensaje`), porque
-- Google OMITE el país en formattedAddress cuando el sesgo de región ya es ese
-- país (las direcciones UY terminan en "Departamento de Montevideo", nunca dicen
-- "Uruguay"). El código nuevo (api/owner.js) toma el país del componente
-- ESTRUCTURADO de Google, que sí lo incluye siempre — pero eso aplica a los leads
-- NUEVOS, no a los ya guardados.
-- Para los existentes la certeza viene de otro lado: TODO el sourcing histórico
-- se hizo con SOURCING_COUNTRY='Uruguay' (nunca se cambió), y la guardia
-- geográfica confirmó país=Uruguay en cada inserción. Así que todos los leads de
-- sourcing sin país son uruguayos — no es una adivinanza. Los inbound (landing,
-- sin dirección) quedan NULL, como debe ser.
-- Re-correr es seguro: a futuro los leads ya traen país del código, así que un
-- lead de sourcing con país NULL solo puede ser uno legado (pre-columna) = UY.
UPDATE pazque_leads SET pais = 'Uruguay'
WHERE pais IS NULL AND utm_source = 'sourcing-google';

-- La CIUDAD de los leads viejos queda NULL a propósito: el texto de la dirección
-- (`mensaje`) sí la contiene, pero parsearla es frágil (formatos mixtos, abreviaturas)
-- y no vale el riesgo de meter datos sucios. A partir de ahora los leads nuevos traen
-- ciudad del componente estructurado de Google. Los viejos se pueden ver igual por la
-- dirección en la tarjeta del lead; el filtro por ciudad opera sobre los nuevos.

COMMENT ON COLUMN pazque_leads.pais IS
  'País del prospecto (del sourcing de Google Places). Permite distinguir mercados en /owner. Inbound (landing) queda NULL.';

COMMENT ON COLUMN pazque_leads.ciudad IS
  'Ciudad/zona del prospecto (locality o admin_area_2 de Google Places). Permite filtrar por zona dentro de un país en /owner. Inbound y leads legados quedan NULL.';
