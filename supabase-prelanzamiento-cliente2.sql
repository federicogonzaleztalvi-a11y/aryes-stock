-- ============================================================================
-- PAZQUE — Preparación para el cliente #2 (todo en un solo archivo)
-- ----------------------------------------------------------------------------
-- Consolidado de 3 pasos. Corré TODO de arriba a abajo, una sola vez:
--   Supabase → SQL Editor → pegá este archivo → Run.
--
-- ORDEN (importante):
--   PARTE A · Migración: default seguro de control de inventario   (escribe)
--   PARTE B · Migración: columnas de "marcar pedido para revisión" (escribe)
--   PARTE C · Diagnóstico de estado de datos                       (SOLO lectura)
--
-- SEGURIDAD:
--   • Las Partes A y B NO tocan ninguna org, producto, precio ni pedido
--     existente. Eric y la demo quedan exactamente igual.
--   • Ambas son idempotentes: podés correrlas de nuevo sin romper nada.
--   • La Parte C es 100% SELECT: no cambia absolutamente nada.
--
-- QUÉ MIRAR:
--   Al terminar, revisá los resultados de la PARTE C. Cada bloque dice qué
--   esperar (✅) y qué es señal de alerta (⚠️). Pasame los ⚠️ que aparezcan.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE A · Default seguro para el control de inventario por-org
-- ----------------------------------------------------------------------------
-- Cambia el DEFAULT de organizations.no_controla_stock de false a TRUE, para
-- que una distribuidora NUEVA (el cliente #2) arranque en "NO controla
-- inventario": productos en stock alto y el portal nunca bloquea pedidos por
-- falta de stock. Empieza a validar recién cuando prende, a mano, el toggle
-- "Controlo inventario" en su panel (self-service, api/stock-control.js).
--
-- POR QUÉ: el default anterior (false = "sí controla") hacía que un cliente
-- nuevo validara stock con sus productos en 0 → pedidos bloqueados apenas entra.
-- Esa es la sorpresa que NO queremos. Invertir el default lo evita.
--
-- NO cambia ninguna org existente (solo las que se creen desde ahora).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE organizations
  ALTER COLUMN no_controla_stock SET DEFAULT true;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE B · Columnas de "marcar pedido para revisión" en b2b_orders
-- ----------------------------------------------------------------------------
-- Agrega b2b_orders.requiere_revision (BOOLEAN) y anomaly_reasons (JSONB).
--
-- POR QUÉ (bug encontrado 2026-07-29): api/_create-order.js viene haciendo
-- PATCH a estas columnas para marcar pedidos anómalos (monto atípico, o precio
-- del cliente que no cuadra con el catálogo — Fix #4). Pero las columnas NUNCA
-- existieron, así que el PATCH fallaba en silencio (.catch vacío) y el flag no
-- se guardaba. El admin nunca veía un pedido marcado. Estas columnas hacen que
-- el mecanismo por fin persista.
--
-- NO cambia pedidos existentes (arrancan en false / null). Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS requiere_revision BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomaly_reasons   JSONB;

COMMENT ON COLUMN b2b_orders.requiere_revision IS
  'true = el pedido tiene una anomalía (monto atípico o precio que no cuadra con el catálogo) y conviene revisarlo antes de confirmar. Lo setea api/_create-order.js.';
COMMENT ON COLUMN b2b_orders.anomaly_reasons IS
  'Array JSON con las razones por las que el pedido quedó marcado para revisión.';


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE C · Diagnóstico de estado de datos (SOLO LECTURA)
-- ----------------------------------------------------------------------------
-- TODO lo que sigue es SELECT: no cambia nada. Revisá cada resultado.
-- ════════════════════════════════════════════════════════════════════════════


-- ── C1 · CONTROL DE INVENTARIO por-org ───────────────────────
-- Ver qué orgs controlan stock y si su stock es real o ficticio (99999).
-- ✅ Esperado: Eric no_controla_stock=true, con stock ~99999 (ficticio, OK
--    mientras no cargue inventario real). Una org que controla debería tener
--    stock < 99999 en sus productos.
SELECT
  o.id, o.name, o.no_controla_stock,
  COUNT(p.uuid)                                          AS productos,
  COUNT(p.uuid) FILTER (WHERE p.stock = 99999)           AS en_99999_ficticio,
  COUNT(p.uuid) FILTER (WHERE p.stock IS NULL OR p.stock = 0) AS en_cero
FROM organizations o
LEFT JOIN products p ON p.org_id = o.id
GROUP BY o.id, o.name, o.no_controla_stock
ORDER BY o.id;


-- ── C2 · ESTADO DE SUSCRIPCIÓN / TRIAL por-org ───────────────
-- Ver quién está activo, en trial, y si algún trial ya venció.
-- Con el gate de acceso nuevo (_access.js) + 5 días de gracia, un trial
-- vencido hace >5 días pone el portal "en pausa".
-- ✅ Esperado: Eric subscription_status='active'. Nadie que deba estar vivo
--    con trial vencido hace >5 días.
SELECT
  id, name, subscription_status, plan_name, trial_ends_at,
  CASE
    WHEN subscription_status = 'active' THEN 'OK activo'
    WHEN trial_ends_at IS NULL THEN '⚠️ trial sin fecha'
    WHEN trial_ends_at > NOW() THEN 'trial vigente'
    WHEN trial_ends_at > NOW() - INTERVAL '5 days' THEN 'trial vencido — EN GRACIA'
    ELSE '⚠️ trial vencido — PORTAL EN PAUSA'
  END AS estado_acceso
FROM organizations
ORDER BY id;


-- ── C3 · CLIENTES con id NO-UUID (rompe pedidos con 502) ─────
-- El RPC tipa cliente_id como UUID. Un cliente con id de texto (legacy/test)
-- hace fallar TODO pedido suyo. createB2BOrder ya lo detecta y devuelve
-- 'invalid_client', pero conviene saber si existen para migrarlos.
-- ✅ Esperado: 0 filas.
SELECT id, name, org_id, phone
FROM clients
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 50;


-- ── C4 · CLIENTES sin lista de precios asignada ──────────────
-- Un cliente sin lista_id ve precios generales (fallback), no los negociados.
-- No es un error, pero conviene saber cuántos quedan sin lista.
SELECT org_id, COUNT(*) AS clientes_sin_lista
FROM clients
WHERE lista_id IS NULL
GROUP BY org_id
ORDER BY org_id;


-- ── C5 · PRECIOS SOSPECHOSOS en price_list_items ─────────────
-- Precios en 0 (no debería venderse gratis) o microscópicos (0,00x = típico
-- error de import por comas/decimales mal parseados).
-- ✅ Esperado: 0 filas. Si aparecen, revisar el import de esa lista.
SELECT lista_id, product_uuid, precio
FROM price_list_items
WHERE precio IS NULL OR precio <= 0 OR precio < 0.01
LIMIT 50;


-- ── C6 · RUTAS con driver_token NULL ─────────────────────────
-- El tracking público de reparto usa driver_token. Si es NULL, el link de
-- seguimiento puede quedar mutable/roto. (Solo relevante si ya usás ruteo.)
-- ✅ Esperado: 0 filas, o rutas viejas ya entregadas.
SELECT id, org_id, driver_token
FROM rutas
WHERE driver_token IS NULL
LIMIT 50;


-- ── C7 · RESERVAS de stock colgadas ──────────────────────────
-- Con enforcement de stock, las reservas vencidas deberían liberarse por el
-- cron horario (cron-reservations). Ver si hay activas ya vencidas (el cron
-- las va a limpiar en la próxima corrida).
-- ✅ Esperado: 0, o pocas que se limpian solas en < 1 hora.
SELECT COUNT(*) AS reservas_activas_vencidas
FROM stock_reservations
WHERE status = 'active' AND expires_at < NOW();


-- ── C8 · PEDIDOS B2B marcados para revisión ──────────────────
-- El Fix #4 (y la detección de anomalías previa) marca requiere_revision cuando
-- el total del cliente no coincide con el catálogo o el monto es atípico.
-- (La columna la crea la PARTE B de arriba, así que este SELECT ya funciona.)
-- ✅ Esperado: pocos o ninguno. Si hay muchos, revisar la lógica de precios.
SELECT org_id, COUNT(*) AS pedidos_a_revisar
FROM b2b_orders
WHERE requiere_revision = true
GROUP BY org_id
ORDER BY org_id;

-- ============================================================================
-- FIN. Pasame cualquier ⚠️ que haya salido en la PARTE C.
-- ============================================================================
