-- ============================================================
-- PAZQUE — Backfill de fichas de listas de precio (price_lists)
-- ------------------------------------------------------------
-- QUÉ HACE:
--   Crea la "ficha" (fila en price_lists) para cada lista que hoy
--   usan los clientes (clients.lista_id) pero que NO tiene ficha.
--   Sin esas fichas, la pantalla admin "Listas de precios" muestra
--   "Sin listas" aunque los precios existan y funcionen en el portal.
--
-- QUÉ **NO** HACE (100% seguro):
--   • NO toca precios. No modifica price_list_items.
--   • NO cambia ningún cliente ni producto.
--   • Solo INSERTA fichas que faltan. Idempotente: correrlo de nuevo
--     no crea duplicados (usa NOT EXISTS + ON CONFLICT DO NOTHING).
--   • Genérico multi-tenant: sirve para TODAS las orgs a la vez.
--
-- CÓMO USARLO:
--   1) Abrí Supabase → SQL Editor.
--   2) Pegá TODO este archivo y dale "Run".
--   3) Mirá los resultados de PASO 1 (antes) y PASO 3 (después).
--   4) Entrá al panel → "Listas de precios": ya aparecen tus listas.
--      Podés renombrarlas desde ahí (el nombre acá es solo un default).
-- ============================================================


-- ── PASO 1 · DIAGNÓSTICO (solo lectura, no cambia nada) ──────
-- Muestra qué listas usan los clientes y si ya tienen ficha.
SELECT
  c.org_id,
  c.lista_id,
  COUNT(*)                                   AS clientes_usando,
  (pl.id IS NOT NULL)                        AS tiene_ficha
FROM clients c
LEFT JOIN price_lists pl ON pl.id = c.lista_id
WHERE c.lista_id IS NOT NULL
GROUP BY c.org_id, c.lista_id, pl.id
ORDER BY tiene_ficha, c.org_id;


-- ── PASO 2 · BACKFILL (crea SOLO las fichas faltantes) ───────
-- Para cada lista_id que un cliente usa y que no existe en
-- price_lists, crea la ficha con el org_id de ese cliente.
-- Columnas obligatorias (NOT NULL): nombre, descuento, color,
-- activa, moneda, creado_en, updated_at, org_id → todas provistas.
INSERT INTO price_lists (id, org_id, nombre, descuento, color, activa, moneda, creado_en, updated_at)
SELECT DISTINCT ON (sub.lista_id)
  sub.lista_id,
  sub.org_id,
  'Lista ' || UPPER(RIGHT(sub.lista_id, 4)) AS nombre,   -- ej. "Lista PA7X" — renombrable desde el panel
  0,                                                       -- descuento global 0: los precios ya viven por-producto
  '#3b82f6',                                               -- color default (azul), editable desde el panel
  true,
  'UYU',                                                   -- moneda default (igual que el resto de la app)
  NOW(),
  NOW()
FROM (
  SELECT c.lista_id, c.org_id
  FROM clients c
  WHERE c.lista_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = c.lista_id)
) sub
ORDER BY sub.lista_id, sub.org_id
ON CONFLICT (id) DO NOTHING;


-- ── PASO 3 · VERIFICACIÓN (solo lectura) ─────────────────────
-- Ahora TODAS las listas usadas por clientes deben tener ficha
-- (tiene_ficha = true en todas las filas).
SELECT
  c.org_id,
  c.lista_id,
  COUNT(DISTINCT c.id)                       AS clientes_usando,
  COUNT(DISTINCT pli.product_uuid)           AS productos_con_precio,
  (pl.id IS NOT NULL)                        AS tiene_ficha,
  pl.nombre                                  AS nombre_ficha
FROM clients c
LEFT JOIN price_lists pl       ON pl.id = c.lista_id
LEFT JOIN price_list_items pli ON pli.lista_id = c.lista_id
WHERE c.lista_id IS NOT NULL
GROUP BY c.org_id, c.lista_id, pl.id, pl.nombre
ORDER BY c.org_id;
