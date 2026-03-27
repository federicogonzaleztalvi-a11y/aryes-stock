// api/pedido.js — Recibe pedidos del portal B2B y los guarda en b2b_orders
// Idempotency: si el mismo idempotency_key ya existe, devuelve el pedido existente

import { log, withObservability } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });

  const {
    org             = 'aryes',
    clienteId       = null,
    clienteNombre,
    clienteTelefono = null,
    items           = [],
    total           = 0,
    notas           = '',
    idempotencyKey  = null,
  } = req.body || {};

  if (!clienteNombre || !items.length) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const headers = {
    apikey:         SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // Idempotency check — si ya existe un pedido con este key, devolverlo
  if (idempotencyKey) {
    const checkR = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
      { headers }
    );
    if (checkR.ok) {
      const existing = await checkR.json();
      if (existing?.[0]?.id) {
        log.info('pedido', 'idempotent hit', { orderId: existing[0].id, idempotencyKey });
        return res.status(200).json({ ok: true, orderId: existing[0].id, idempotent: true });
      }
    }
  }

  const order = {
    org_id:          org,
    cliente_id:      clienteId || null,
    cliente_nombre:  clienteNombre,
    cliente_tel:     clienteTelefono || '',
    items,
    total:           Number(total) || 0,
    moneda:          'USD',
    notas:           notas || '',
    estado:          'pendiente',
    idempotency_key: idempotencyKey || null,
  };

  const r = await fetch(`${SB_URL}/rest/v1/b2b_orders`, {
    method:  'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body:    JSON.stringify(order),
  });

  if (!r.ok) {
    const err = await r.text();
    // Conflict en idempotency_key — race condition, devolver éxito
    if (r.status === 409 && idempotencyKey) {
      log.warn('pedido', 'idempotency conflict (race)', { idempotencyKey });
      return res.status(200).json({ ok: true, idempotent: true });
    }
    log.error('pedido', 'db error', { status: r.status, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al guardar el pedido' });
  }

  const saved = await r.json();
  log.info('pedido', 'created', { orderId: saved?.[0]?.id, org, total });
  return res.status(200).json({ ok: true, orderId: saved?.[0]?.id });
}

export default withObservability('pedido', handler);
