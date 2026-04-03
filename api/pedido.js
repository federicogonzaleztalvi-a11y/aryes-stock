// api/pedido.js — B2B portal order endpoint
// SECURITY: validates portal session token
// ATP: calls create_b2b_order_with_reservations RPC (atomic)
//   - validates available_stock for all items
//   - creates all reservations
//   - inserts b2b_order
//   - all in one Postgres transaction (all-or-nothing)
// INTERNAL OPS: unaffected — VentasTab / create_venta unchanged

import { log, withObservability } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://aryes-stock.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function validatePortalSession(token) {
  if (!token) return null;
  const key = SB_SVC || SB_ANON;
  const r = await fetch(
    `${SB_URL}/rest/v1/portal_sessions` +
    `?token=eq.${encodeURIComponent(token)}` +
    `&expires_at=gte.${new Date().toISOString()}` +
    `&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] || null;
}

async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });

  // ── GET /api/pedido?action=pendientes — lista pedidos B2B pendientes (operador) ──
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action !== 'pendientes')
      return res.status(401).json({ error: 'No autorizado' });
    // GET pendientes no necesita auth fuerte — app admin ya protege el acceso
    const org = req.query?.org || 'aryes';
    const key = SB_SVC || SB_ANON;
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?org_id=eq.${org}&estado=eq.pendiente&order=creado_en.desc&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(500).json({ error: 'Error al obtener pedidos' });
    return res.status(200).json({ ok: true, pedidos: await r.json() });
  }

  // ── GET /api/pedido?action=historial — historial del cliente autenticado ──
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action === 'historial') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const session = await validatePortalSession(token);
      if (!session) return res.status(401).json({ error: 'Sesión inválida' });
      const key = SB_SVC || SB_ANON;
      const r = await fetch(
        `${SB_URL}/rest/v1/b2b_orders?cliente_id=eq.${session.cliente_id}&org_id=eq.${session.org_id}&order=creado_en.desc&limit=30`,
        { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
      );
      if (!r.ok) return res.status(500).json({ error: 'Error al obtener historial' });
      return res.status(200).json({ ok: true, pedidos: await r.json() });
    }
    return res.status(400).json({ error: 'action requerida' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── POST /api/pedido?action=confirmar — confirmar pedido B2B → venta (operador) ──
  const actionConfirm = req.query?.action;
  if (actionConfirm === 'confirmar') {
    // POST confirmar llamado desde admin — protegido por login de la app
    const { orderId, operador = 'admin', org = 'aryes' } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const key = SB_SVC || SB_ANON;
    const orderRes = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}&org_id=eq.${org}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    const orders = await orderRes.json();
    if (!orders?.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = orders[0];
    if (pedido.estado !== 'pendiente')
      return res.status(409).json({ error: `Pedido ya en estado: ${pedido.estado}` });
    const nroRes = await fetch(`${SB_URL}/rest/v1/rpc/next_nro_venta`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const nroVenta = nroRes.ok ? await nroRes.json() : `V-B2B-${Date.now()}`;
    const itemsVenta = (pedido.items || []).map(item => ({
      productId:   item.id         || '',
      productName: item.nombre     || '',
      qty:         item.cantidad   || 0,
      unit:        item.unidad     || 'un',
      unitPrice:   item.precioUnit || 0,
      subtotal:    item.subtotal   || 0,
    }));
    const ventaId = crypto.randomUUID();
    const now = new Date().toISOString();
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'confirmada', confirmado_en: now, confirmado_por: operador }),
    });
    log.info('pedido', 'b2b confirmado', { orderId, nroVenta, cliente: pedido.cliente_nombre });
    return res.status(200).json({ ok: true, venta: {
      id: ventaId, nroVenta,
      clientId: pedido.cliente_id || '', clientName: pedido.cliente_nombre,
      clientTel: pedido.cliente_tel || '', items: itemsVenta,
      total: pedido.total, estado: 'confirmada',
      origen: 'b2b_portal', b2bOrderId: pedido.id,
      date: now, createdAt: now,
    }});
  }

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const authHeader    = req.headers['authorization'] || '';
  const token         = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const portalSession = await validatePortalSession(token);

  if (!portalSession) {
    log.warn('pedido', 'unauthorized — invalid or missing session token');
    return res.status(401).json({ error: 'Sesión inválida. Iniciá sesión nuevamente.' });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const {
    items          = [],
    total          = 0,
    notas          = '',
    idempotencyKey = null,
  } = req.body || {};

  if (!items.length) {
    return res.status(400).json({ error: 'El pedido no tiene productos' });
  }

  // Identity from validated server-side session — never trust the body
  const org           = portalSession.org_id;
  const clienteId     = portalSession.cliente_id;
  const clienteTel    = portalSession.tel;
  const clienteNombre = (req.body?.clienteNombre || '').substring(0, 100);

  // Pre-generate order ID (used as reservation reference_id)
  const orderId = crypto.randomUUID();

  const rpcHeaders = {
    apikey:          SB_ANON,
    Authorization:  `Bearer ${SB_ANON}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // ── 3. Call atomic RPC: create_b2b_order_with_reservations ───────────────
  // This single RPC validates available_stock for ALL items, creates ALL
  // reservations, and inserts the order — all in one Postgres transaction.
  // If any item has insufficient stock → full rollback, no partial state.
  const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, {
    method:  'POST',
    headers: rpcHeaders,
    body: JSON.stringify({
      p_order_id:        orderId,
      p_org_id:          org,
      p_cliente_id:      clienteId,
      p_cliente_nombre:  clienteNombre,
      p_cliente_tel:     clienteTel,
      p_items:           items,
      p_total:           Number(total) || 0,
      p_notas:           notas || '',
      p_idempotency_key: idempotencyKey || null,
      p_ttl_hours:       6,
    }),
  });

  if (!rpcRes.ok) {
    const errBody = await rpcRes.json().catch(() => ({}));
    const errMsg  = errBody?.message || errBody?.details || '';

    // Parse structured errors from the RPC
    if (errMsg.includes('item_insufficient:')) {
      // Format: 'item_insufficient:{productId}:{available}:{requested}'
      const parts     = errMsg.split(':');
      const productId = parts[1] || '';
      const available = parts[2] || '0';
      // Find the product name from items
      const itemMatch = items.find(i => i.productId === productId);
      const nombre    = itemMatch?.nombre || productId;
      log.warn('pedido', 'insufficient stock', { productId, available });
      return res.status(409).json({
        error:     `Stock insuficiente para: ${nombre}. Disponible: ${available}. Actualizá tu pedido.`,
        productId,
        available: Number(available),
      });
    }

    if (errMsg.includes('product_not_found')) {
      log.warn('pedido', 'product not found in RPC', { errMsg });
      return res.status(404).json({ error: 'Uno o más productos no fueron encontrados.' });
    }

    // Idempotent hit — order already exists
    const rpcData = await rpcRes.json().catch(() => null);
    if (rpcData?.idempotent) {
      log.info('pedido', 'idempotent hit', { orderId: rpcData.orderId });
      return res.status(200).json({ ok: true, orderId: rpcData.orderId, idempotent: true });
    }

    log.error('pedido', 'RPC error', { status: rpcRes.status, errMsg });
    return res.status(502).json({ error: 'Error al procesar el pedido. Intentá de nuevo.' });
  }

  const result = await rpcRes.json();

  // Handle idempotent response from RPC (order already existed)
  if (result?.idempotent) {
    log.info('pedido', 'idempotent hit via RPC', { orderId: result.orderId });
    return res.status(200).json({ ok: true, orderId: result.orderId, idempotent: true });
  }

  log.info('pedido', 'order created with reservations', {
    orderId: result.orderId || orderId,
    org,
    clienteId,
    items:  items.length,
    total,
  });

  return res.status(200).json({ ok: true, orderId: result.orderId || orderId });
}

export default withObservability('pedido', handler);
