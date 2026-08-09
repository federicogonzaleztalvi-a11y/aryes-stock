-- ============================================================================
-- supabase-owner-enrich.sql
-- PELDAÑO 1b — ENRIQUECIMIENTO de prospectos (agente que lee y sugiere).
--
-- Agrega a pazque_leads dos columnas donde queda cacheado el análisis de Claude
-- por prospecto (rubro inferido, tamaño estimado, ángulo de venta, prioridad).
-- El agente SOLO lee lo que el prospecto ya dejó y sugiere; no manda nada.
-- Se dispara con el botón "Enriquecer" de cada tarjeta en /owner (api/owner.js).
--
-- Además siembra 3 prospectos de PRUEBA para poder validar el flujo hoy mismo
-- (hasta que caigan los reales). Se reconocen por empresa que arranca con
-- "[prueba]" y se borran con el bloque DELETE del final.
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

ALTER TABLE pazque_leads
  ADD COLUMN IF NOT EXISTS enriquecimiento JSONB,       -- { rubro, tamano, prioridad, angulo, senales[] }
  ADD COLUMN IF NOT EXISTS enriquecido_at  TIMESTAMPTZ; -- cuándo se corrió (para no re-consultar)

-- ── Prospectos de prueba (borrables) ────────────────────────────────────────
-- Solo inserta si todavía no existen (idempotente por email).
INSERT INTO pazque_leads (nombre, empresa, email, tel, rubro, mensaje, utm_source, utm_campaign, estado)
SELECT * FROM (VALUES
  ('Marcela Fernández', '[prueba] Distribuidora La Espiga',
   'marcela@laespiga.test', '59899111222', 'Panadería y repostería',
   'Le vendo a unas 60 panaderías de Montevideo, me piden todo por WhatsApp y se me mezclan los pedidos. Quiero verlo.',
   'facebook', 'demo-lanzamiento', 'nuevo'),
  ('Diego Suárez', '[prueba] Suárez Bebidas',
   'diego@suarezbebidas.test', '59899333444', 'Bebidas y almacén',
   'Reparto bebidas a kioscos y almacenes en Canelones. Somos 4 vendedores en la calle.',
   'google', 'search-mayorista', 'nuevo'),
  ('Paula Rodríguez', '[prueba] Cosmética Andrea',
   'paula@cosmeticaandrea.test', '59899555666', 'Cosmética y perfumería',
   'Tengo un catálogo grande y las revendedoras me piden fotos y precios todo el día.',
   'instagram', 'reel-catalogo', 'nuevo')
) AS v(nombre, empresa, email, tel, rubro, mensaje, utm_source, utm_campaign, estado)
WHERE NOT EXISTS (
  SELECT 1 FROM pazque_leads p WHERE p.email = v.email
);

-- ── Para borrar los de prueba cuando ya no los necesites ─────────────────────
-- DELETE FROM pazque_leads WHERE empresa LIKE '[prueba]%';
