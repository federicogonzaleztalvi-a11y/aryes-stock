// api/historial.js — Historial de pedidos del cliente por teléfono
// Llamado desde PedidosPage cuando el cliente abre "Mis pedidos"
// No requiere auth — el teléfono ya fue verificado via OTP en el browser

import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';


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
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_his(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  // Hard fail — nunca usar anon key como fallback de service key
  if (!SB_URL || !SB_ANON) {
    log.fatal('historial', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  // Session REQUIRED — validate portal session and derive org from it
  const authHeader = req.headers['authorization'] || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!sessionToken) return res.status(401).json({ error: 'No autenticado' });

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;
  const sessRes = await fetch(
    `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&select=org_id,cliente_id,tel&limit=1`,
    { headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, Accept: 'application/json' } }
  );
  if (!sessRes.ok) return res.status(401).json({ error: 'Sesión inválida' });
  const sessions = await sessRes.json();
  if (!sessions?.length) return res.status(401).json({ error: 'Sesión expirada. Iniciá sesión nuevamente.' });
  const portalSession = sessions[0];

  // Derive org and identity from validated session — NEVER from query string
  const org = portalSession.org_id;
  const sessionClienteId = portalSession.cliente_id;
  const sessionTel = portalSession.tel;
  const { action } = req.query || {};

  // ── Estado de cuenta: usa cliente_id de la sesión validada ──
  if (action === 'cuenta') {
    const cliente_id = sessionClienteId;
    if (!cliente_id) return res.status(400).json({ error: 'Cliente no identificado en la sesión' });
    const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

    const [cfesRes, cobrosRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/cfes?cliente_id=eq.' + encodeURIComponent(cliente_id) + '&org_id=eq.' + encodeURIComponent(org) + '&order=fecha.desc&limit=200', { headers: svcH }),
      fetch(SB_URL + '/rest/v1/cobros?cliente_id=eq.' + encodeURIComponent(cliente_id) + '&org_id=eq.' + encodeURIComponent(org) + '&order=fecha.desc&limit=200', { headers: svcH }),
    ]);

    const cfes = cfesRes.ok ? await cfesRes.json() : [];
    const cobros = cobrosRes.ok ? await cobrosRes.json() : [];

    const mappedCfes = (cfes || []).map(r => ({
      id: r.id, numero: r.numero || '', tipo: r.tipo || 'e-Factura',
      fecha: r.fecha || '', fechaVenc: r.fecha_venc || null,
      total: r.total || 0, saldoPendiente: r.saldo_pendiente || 0,
      status: r.status || 'emitida',
    }));

    const mappedCobros = (cobros || []).map(r => ({
      id: r.id, monto: r.monto || 0, metodo: r.metodo || '',
      fecha: r.fecha || '', nroCobro: r.nro_cobro || '',
    }));

    return res.status(200).json({ cfes: mappedCfes, cobros: mappedCobros });
  }

  const tel = sessionTel;
  if (!tel) return res.status(400).json({ error: 'Teléfono no encontrado en la sesión' });

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
