// api/cart.js — Carrito persistente del portal B2B (cross-device).
// Permite que un cliente arranque el pedido en la compu y lo siga en el cel.
// Guarda SÓLO cantidades por producto (jsonb); los precios se recalculan del
// catálogo fresco al abrir el carrito.
//
// Auth: igual que historial.js — se valida el token de sesión contra
// portal_sessions y se derivan org_id + cliente_id DEL SERVIDOR (nunca del
// query). La tabla portal_carts tiene RLS service-only, así que un cliente no
// puede leer ni pisar el carrito de otro: todo pasa por esta función.
//
// GET  /api/cart           → { items: {...} }   (carrito guardado del cliente)
// POST /api/cart  {items}  → { ok: true }       (upsert del carrito)

import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// ── Rate limiting: max 60 requests por IP por minuto ──
// (el guardado va con debounce en el cliente, así que 60/min sobra de margen)
const _rl_cart = new Map();
function _checkRate_cart(ip) {
  const now = Date.now();
  const entry = _rl_cart.get(ip) || [];
  const recent = entry.filter(t => now - t < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  _rl_cart.set(ip, recent);
  return true;
}

// Sanea el carrito: objeto plano { "clave": entero>0 }. Descarta basura y
// limita el tamaño para que nadie meta un payload gigante.
function sanitizeItems(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= 500) break;                       // tope defensivo de líneas
    const key = String(k).slice(0, 200);
    const qty = Math.floor(Number(v));
    if (key && Number.isFinite(qty) && qty > 0 && qty <= 100000) {
      out[key] = qty;
      n++;
    }
  }
  return out;
}

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_cart(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  if (!SB_URL || !SB_ANON) {
    log.fatal('cart', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  // Sesión REQUERIDA — validar token y derivar org + cliente de la sesión
  const authHeader = req.headers['authorization'] || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!sessionToken) return res.status(401).json({ error: 'No autenticado' });

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;
  const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

  const sessRes = await fetch(
    `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&select=org_id,cliente_id&limit=1`,
    { headers: svcH }
  );
  if (!sessRes.ok) return res.status(401).json({ error: 'Sesión inválida' });
  const sessions = await sessRes.json();
  if (!sessions?.length) return res.status(401).json({ error: 'Sesión expirada. Iniciá sesión nuevamente.' });

  const org = sessions[0].org_id;
  const clienteId = sessions[0].cliente_id;
  if (!clienteId) return res.status(400).json({ error: 'Cliente no identificado en la sesión' });

  // ── GET: devolver el carrito guardado del cliente ──
  if (req.method === 'GET') {
    const r = await fetch(
      `${SB_URL}/rest/v1/portal_carts?org_id=eq.${encodeURIComponent(org)}&client_id=eq.${encodeURIComponent(clienteId)}&select=items&limit=1`,
      { headers: svcH }
    );
    if (!r.ok) {
      const err = await r.text();
      log.error('cart', 'get db error', { status: r.status, org, body: err.substring(0, 200) });
      return res.status(502).json({ error: 'Error al cargar el carrito' });
    }
    const rows = await r.json();
    const items = Array.isArray(rows) && rows[0]?.items ? rows[0].items : {};
    return res.status(200).json({ items });
  }

  // ── POST: upsert del carrito ──
  const items = sanitizeItems(req.body?.items);
  const row = {
    org_id: org,
    client_id: clienteId,
    items,
    updated_at: new Date().toISOString(),
  };

  // Upsert por (org_id, client_id) — resolution=merge-duplicates pisa la fila.
  const up = await fetch(
    `${SB_URL}/rest/v1/portal_carts?on_conflict=org_id,client_id`,
    {
      method: 'POST',
      headers: {
        ...svcH,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    }
  );

  if (!up.ok) {
    const err = await up.text();
    log.error('cart', 'upsert db error', { status: up.status, org, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al guardar el carrito' });
  }

  return res.status(200).json({ ok: true });
}

export default withObservability('cart', handler);
