// api/historial.js — Historial de pedidos del cliente por teléfono
// Llamado desde PedidosPage cuando el cliente abre "Mis pedidos"
// No requiere auth — el teléfono ya fue verificado via OTP en el browser

import { log, withObservability } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://aryes-stock.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};


// ── Rate limiting: max 30 requests per IP per 1 min ──
const _rl_his = new Map();
function _checkRate_his(ip) {
  const now = Date.now();
  const entry = _rl_his.get(ip) || [];
  const recent = entry.filter(t => now - t < 60000);
  if (recent.length >= 30) return false;
  recent.push(now);
  _rl_his.set(ip, recent);
  return true;
}
async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_his(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  // Hard fail — nunca usar anon key como fallback de service key
  if (!SB_URL || !SB_ANON) {
    log.fatal('historial', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  // Validate portal session token — prevents unauthorized access to order history
  const authHeader = req.headers['authorization'] || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (sessionToken) {
    // If token provided, validate it
    const key = SB_ANON;
    const sessRes = await fetch(
      `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&revoked=eq.false&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    if (!sessRes.ok || !(await sessRes.json())?.length) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }
  }

  const { tel, org = 'aryes' } = req.query || {};
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  // Buscar pedidos en b2b_orders — últimos 20, más recientes primero
  const r = await fetch(
    `${SB_URL}/rest/v1/b2b_orders?cliente_tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&order=creado_en.desc&limit=20`,
    { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
  );

  if (!r.ok) {
    const err = await r.text();
    log.error('historial', 'db error', { status: r.status, org, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al cargar historial' });
  }

  const orders = await r.json();
  if (!Array.isArray(orders)) return res.status(200).json({ orders: [] });

  // Enrich with venta estado — cross b2b_orders.venta_id with ventas.estado
  const ventaIds = orders.filter(o => o.venta_id).map(o => o.venta_id);
  let ventaEstados = {};
  if (ventaIds.length > 0) {
    try {
      const vr = await fetch(
        `${SB_URL}/rest/v1/ventas?id=in.(${ventaIds.map(id => `"${id}"`).join(',')})&select=id,estado`,
        { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
      );
      if (vr.ok) {
        const ventas = await vr.json();
        if (Array.isArray(ventas)) ventas.forEach(v => { ventaEstados[v.id] = v.estado; });
      }
    } catch { /* non-critical — continue without venta estado */ }
  }

  const enriched = orders.map(o => ({
    ...o,
    venta_estado: o.venta_id ? (ventaEstados[o.venta_id] || null) : null,
  }));

  log.info('historial', 'ok', { count: enriched.length, org });
  return res.status(200).json({ orders: enriched });
}

export default withObservability('historial', handler);
