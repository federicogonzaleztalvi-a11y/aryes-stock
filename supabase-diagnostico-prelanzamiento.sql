-- ============================================================
-- PAZQUE — Diagnóstico de estado de datos PRE-LANZAMIENTO
-- ------------------------------------------------------------
-- TODO es SOLO LECTURA (SELECT). No cambia absolutamente nada.
-- Pegá cada bloque en Supabase → SQL Editor → Run y revisá el
-- resultado. Al lado de cada uno dice qué esperar (✅) y qué es
-- una señal de alerta (⚠️).
-- ============================================================


-- ── 1 · CONTROL DE INVENTARIO por-org ────────────────────────
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


-- ── 2 · ESTADO DE SUSCRIPCIÓN / TRIAL por-org ────────────────
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


-- ── 3 · CLIENTES con id NO-UUID (rompe pedidos con 502) ──────
-- El RPC tipa cliente_id como UUID. Un cliente con id de texto (legacy/test)
-- hace fallar TODO pedido suyo. createB2BOrder ya lo detecta y devuelve
-- 'invalid_client', pero conviene saber si existen para migrarlos.
-- ✅ Esperado: 0 filas.
SELECT id, name, org_id, phone
FROM clients
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 50;


-- ── 4 · CLIENTES sin lista de precios asignada ───────────────
-- Un cliente sin lista_id ve precios generales (fallback), no los negociados.
-- No es un error, pero conviene saber cuántos quedan sin lista.
SELECT org_id, COUNT(*) AS clientes_sin_lista
FROM clients
WHERE lista_id IS NULL
GROUP BY org_id
ORDER BY org_id;


-- ── 5 · PRECIOS SOSPECHOSOS en price_list_items ──────────────
-- Precios en 0 (no debería venderse gratis) o microscópicos (0,00x = típico
-- error de import por comas/decimales mal parseados).
-- ✅ Esperado: 0 filas. Si aparecen, revisar el import de esa lista.
SELECT lista_id, product_uuid, precio
FROM price_list_items
WHERE precio IS NULL OR precio <= 0 OR precio < 0.01
LIMIT 50;


-- ── 6 · RUTAS con driver_token NULL ──────────────────────────
-- El tracking público de reparto usa driver_token. Si es NULL, el link de
-- seguimiento puede quedar mutable/roto. (Solo relevante si ya usás ruteo.)
-- ✅ Esperado: 0 filas, o rutas viejas ya entregadas.
SELECT id, org_id, driver_token
FROM rutas
WHERE driver_token IS NULL
LIMIT 50;


-- ── 7 · RESERVAS de stock colgadas ───────────────────────────
-- Con enforcement de stock, las reservas vencidas deberían liberarse por el
-- cron horario (cron-reservations). Ver si hay activas ya vencidas (el cron
-- las va a limpiar en la próxima corrida).
-- ✅ Esperado: 0, o pocas que se limpian solas en < 1 hora.
SELECT COUNT(*) AS reservas_activas_vencidas
FROM stock_reservations
WHERE status = 'active' AND expires_at < NOW();


-- ── 8 · PEDIDOS B2B marcados para revisión ───────────────────
-- El Fix #4 (y la detección de anomalías previa) marca requiere_revision cuando
-- el total del cliente no coincide con el catálogo o el monto es atípico.
-- ⚠️ REQUIERE correr antes `supabase-b2b-orders-revision.sql` (crea la columna;
--    sin ella este SELECT falla y el flag no se persiste en ningún pedido).
-- ✅ Esperado: pocos o ninguno. Si hay muchos, revisar la lógica de precios.
SELECT org_id, COUNT(*) AS pedidos_a_revisar
FROM b2b_orders
WHERE requiere_revision = true
GROUP BY org_id
ORDER BY org_id;
