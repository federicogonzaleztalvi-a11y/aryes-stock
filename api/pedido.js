// api/pedido.js — Recibe pedidos del portal B2B y los guarda en b2b_orders
// SECURITY: validates portal session token before accepting any order
// Idempotency: duplicate idempotency_key returns the existing order

import { log, withObservability } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Validate portal session token ─────────────────────────────────────────
// Looks up the token in portal_sessions (written by otp-verify.js).
// Returns the session row if valid, null if invalid/expired.
async function validatePortalSession(token) {
  if (!token) return null;

  // Use service key — portal_sessions is RESTRICTIVE (no REST access)
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
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  // Token comes from Authorization: Bearer <token> header
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const portalSession = await validatePortalSession(token);
  if (!portalSession) {
    log.warn('pedido', 'unauthorized — invalid or missing session token');
    return res.status(401).json({ error: 'Sesión inválida. Iniciá sesión nuevamente.' });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const {
    items           = [],
    total           = 0,
    notas           = '',
    idempotencyKey  = null,
  } = req.body || {};

  if (!items.length) {
    return res.status(400).json({ error: 'El pedido no tiene productos' });
  }

  // Use values from the validated server-side session — never trust the body
  // for identity-related fields (clienteId, tel, org)
  const org           = portalSession.org_id;
  const clienteId     = portalSession.cliente_id;
  const clienteTel    = portalSession.tel;

  // clienteNombre still comes from body (cosmetic only — not used for auth)
  const clienteNombre = (req.body?.clienteNombre || '').substring(0, 100);

  const headers = {
    apikey:         SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // ── 3. Idempotency check ──────────────────────────────────────────────────
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

  // ── 4. Insert order ───────────────────────────────────────────────────────
  const order = {
    org_id:          org,
    cliente_id:      clienteId,
    cliente_nombre:  clienteNombre,
    cliente_tel:     clienteTel,
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
    if (r.status === 409 && idempotencyKey) {
      log.warn('pedido', 'idempotency conflict (race)', { idempotencyKey });
      return res.status(200).json({ ok: true, idempotent: true });
    }
    log.error('pedido', 'db error', { status: r.status, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al guardar el pedido' });
  }

  const saved = await r.json();
  log.info('pedido', 'created', { orderId: saved?.[0]?.id, org, clienteId, total });
  return res.status(200).json({ ok: true, orderId: saved?.[0]?.id });
}

export default withObservability('pedido', handler);
