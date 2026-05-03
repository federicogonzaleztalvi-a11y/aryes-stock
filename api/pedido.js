// api/pedido.js — B2B portal order endpoint
// SECURITY: validates portal session token
// ATP: calls create_b2b_order_with_reservations RPC (atomic)
//   - validates available_stock for all items
//   - creates all reservations
//   - inserts b2b_order
//   - all in one Postgres transaction (all-or-nothing)
// INTERNAL OPS: unaffected — VentasTab / create_venta unchanged

import { checkRateLimit } from './_rate-limit.js';
import webpush from 'web-push';
import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';


const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://pazque.com',
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
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await checkRateLimit('pedido:' + _ip, 60, 10))) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  // ── GET /api/pedido?action=pendientes — lista pedidos B2B pendientes (operador) ──
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action !== 'pendientes')
      return res.status(401).json({ error: 'No autorizado' });
    // Require auth — derive org from authenticated user
    const authH = req.headers['authorization'] || '';
    const userToken = authH.startsWith('Bearer ') ? authH.slice(7) : null;
    if (!userToken) return res.status(401).json({ error: 'No autenticado' });
    const userRes = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + userToken } });
    if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });
    const userData = await userRes.json();
    const userMeta = userData?.user_metadata || userData?.raw_user_meta_data || {};
    const org = userMeta.org_id;
    if (!org) return res.status(403).json({ error: 'Usuario sin organización' });
    const key = SB_SVC || SB_ANON;
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?org_id=eq.${encodeURIComponent(org)}&estado=eq.pendiente&order=creado_en.desc&limit=50`,
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
    // POST confirmar — require auth, derive org from user
    const authHC = req.headers['authorization'] || '';
    const userTokenC = authHC.startsWith('Bearer ') ? authHC.slice(7) : null;
    if (!userTokenC) return res.status(401).json({ error: 'No autenticado' });
    const userResC = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + userTokenC } });
    if (!userResC.ok) return res.status(401).json({ error: 'Sesion invalida' });
    const userDataC = await userResC.json();
    const userMetaC = userDataC?.user_metadata || userDataC?.raw_user_meta_data || {};
    const org = userMetaC.org_id;
    if (!org) return res.status(403).json({ error: 'Usuario sin organización' });
    const { orderId, operador = 'admin' } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const key = SB_SVC || SB_ANON;
    const orderRes = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
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
    apikey:          SB_SVC || SB_ANON,
    Authorization:  `Bearer ${SB_SVC || SB_ANON}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // ── 2b. Anomaly detection — flag unusual orders for admin review ─────────
  let requiere_revision = false;
  let anomaly_reasons = [];
  try {
    // Get client's last 10 orders to compare
    const histRes = await fetch(
      SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + clienteId + '&org_id=eq.' + org + '&order=creado_en.desc&limit=10&select=items,total',
      { headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), Accept: 'application/json' } }
    );
    if (histRes.ok) {
      const history = await histRes.json();
      if (history && history.length >= 2) {
        // Average order total
        var avgTotal = history.reduce(function(s, o) { return s + Number(o.total || 0); }, 0) / history.length;
        // Check if current total is 3x the average
        if (Number(total) > avgTotal * 3 && avgTotal > 0) {
          requiere_revision = true;
          anomaly_reasons.push('Total $' + Number(total).toFixed(0) + ' es ' + Math.round(Number(total)/avgTotal) + 'x el promedio ($' + Math.round(avgTotal) + ')');
        }
        // Check individual item quantities vs historical average
        var histQty = {};
        history.forEach(function(o) { (o.items || []).forEach(function(it) {
          var k = it.productId || it.productoId || '';
          if (!histQty[k]) histQty[k] = [];
          histQty[k].push(Number(it.qty || it.cantidad || 0));
        }); });
        items.forEach(function(it) {
          var k = it.productId || '';
          var qty = Number(it.qty || it.cantidad || 0);
          if (histQty[k] && histQty[k].length >= 2) {
            var avgQty = histQty[k].reduce(function(s,v){return s+v;},0) / histQty[k].length;
            if (qty > avgQty * 3 && avgQty > 0) {
              requiere_revision = true;
              anomaly_reasons.push((it.nombre || k) + ': ' + qty + ' unidades (promedio: ' + Math.round(avgQty) + ')');
            }
          }
        });
      } else if (history.length === 0 && Number(total) > 500) {
        // First order and high value
        requiere_revision = true;
        anomaly_reasons.push('Primer pedido del cliente con total alto: $' + Number(total).toFixed(0));
      }
    }
  } catch (anomalyErr) {
    // Non-fatal — continue without anomaly check
    log.warn('pedido', 'anomaly check failed (non-fatal)', { error: anomalyErr.message });
  }

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

    log.error('pedido', 'RPC error', { status: rpcRes.status, errMsg, errBody });
    return res.status(502).json({ 
      error: 'Error al procesar el pedido. Intentá de nuevo.',
      _diag: { status: rpcRes.status, errMsg, errBody }
    });
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

  

    // Patch anomaly flags if detected
    if (requiere_revision) {
      await fetch(SB_URL + '/rest/v1/b2b_orders?id=eq.' + (result.orderId || orderId), {
        method: 'PATCH',
        headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ requiere_revision: true, anomaly_reasons: anomaly_reasons }),
      }).catch(function() {});
      log.info('pedido', 'anomaly detected', { orderId: result.orderId || orderId, reasons: anomaly_reasons });
    }

    // ── Push notification to org admin ───────────────────────────────────
    try {
      const pushSubs = await fetch(
        SB_URL + '/rest/v1/push_subscriptions?org_id=eq.' + encodeURIComponent(org) + '&limit=20',
        { headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), Accept: 'application/json' } }
      );
      if (pushSubs.ok) {
        const subs = await pushSubs.json();
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:hola@pazque.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
          );
          const payload = JSON.stringify({
            title: 'Nuevo pedido B2B',
            body: (clienteNombre || 'Un cliente') + ' hizo un pedido por $' + Number(total).toFixed(0),
            icon: '/pazque-logo.png',
            tag: 'b2b-order-' + (result.orderId || orderId),
            url: '/app/pedidos',
          });
          await Promise.allSettled(
            subs.map(sub => {
              try {
                const subscription = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
                return webpush.sendNotification(subscription, payload);
              } catch { return Promise.resolve(); }
            })
          );
          log.info('pedido', 'push sent', { org, subs: subs.length });
        }
      }
    } catch (pushErr) {
      log.warn('pedido', 'push notification failed (non-fatal)', { error: pushErr.message });
    }

    return res.status(200).json({ ok: true, orderId: result.orderId || orderId });
}

export default withObservability('pedido', handler);
