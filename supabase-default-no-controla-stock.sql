-- ============================================================
-- PAZQUE — Default seguro para el control de inventario por-org
-- ------------------------------------------------------------
-- QUÉ HACE:
--   Cambia el DEFAULT de organizations.no_controla_stock de false a TRUE.
--   Así, una distribuidora NUEVA arranca en "NO controla inventario":
--   sus productos entran en stock alto (99999) y el portal NUNCA bloquea
--   pedidos por falta de stock. El distribuidor recién empieza a validar
--   stock cuando prende, a mano, el toggle "Controlo inventario" en su
--   panel de Configuración (self-service, api/stock-control.js).
--
-- POR QUÉ:
--   El default anterior (false = "sí controla") hacía que un cliente nuevo
--   validara stock con sus productos en 0 → pedidos bloqueados apenas entra.
--   Esa es la sorpresa que NO queremos. Invertir el default lo evita.
--
-- QUÉ **NO** HACE (100% seguro):
--   • NO cambia ninguna org existente (solo afecta a las que se creen desde
--     ahora). Eric y la demo quedan exactamente como están.
--   • NO toca productos, precios, pedidos ni el toggle self-service.
--
-- CÓMO USARLO:
--   Supabase → SQL Editor → pegá este archivo → Run. Una sola vez.
-- ============================================================

ALTER TABLE organizations
  ALTER COLUMN no_controla_stock SET DEFAULT true;

-- Verificación (solo lectura): el default ahora debe ser true.
--   SELECT column_default
--   FROM information_schema.columns
--   WHERE table_name = 'organizations' AND column_name = 'no_controla_stock';
