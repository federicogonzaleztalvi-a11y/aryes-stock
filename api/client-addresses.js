// api/client-addresses.js — Sucursales / direcciones de entrega del cliente del
// portal B2B.
//
// Auth: igual que cart.js — se valida el token de sesión contra portal_sessions
// y se deriva org_id + cliente_id DEL SERVIDOR (nunca del query). La tabla
// client_addresses tiene RLS, así que la lectura desde el browser con la anon
// key devolvía [] en silencio (el selector de sucursal nunca aparecía). Acá se
// lee con service role, scoped al cliente de la sesión: un cliente sólo puede
// ver sus propias direcciones.
//
// GET /api/client-addresses → { addresses: [...] }

import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// ── Rate limiting: max 60 requests por IP por minuto ──
const _rl_addr = new Map();
function _checkRate_addr(ip) {
  const now = Date.now();
  const entry = _rl_addr.get(ip) || [];
  const recent = entry.filter(t => now - t < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  _rl_addr.set(ip, recent);
  return true;
}

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_addr(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  if (!SB_URL || !SB_ANON) {
    log.fatal('client-addresses', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  // Sesión REQUERIDA — validar token y derivar org + cliente de la sesión
  const authHeader = req.headers['authorization'] || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!sessionToken) return res.status(401).json({ error: 'No autenticado' });

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;
  const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

  const sessRes = await fetch(
    `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(sessionToken)}&expires_at=gte.${new Date().toISOString()}&revoked=eq.false&select=org_id,cliente_id&limit=1`,
    { headers: svcH }
  );
  if (!sessRes.ok) return res.status(401).json({ error: 'Sesión inválida' });
  const sessions = await sessRes.json();
  if (!sessions?.length) return res.status(401).json({ error: 'Sesión expirada. Iniciá sesión nuevamente.' });

  const org = sessions[0].org_id;
  const clienteId = sessions[0].cliente_id;
  if (!clienteId) return res.status(400).json({ error: 'Cliente no identificado en la sesión' });

  const r = await fetch(
    `${SB_URL}/rest/v1/client_addresses?client_id=eq.${encodeURIComponent(clienteId)}&org_id=eq.${encodeURIComponent(org)}&active=eq.true&order=created_at.asc`,
    { headers: svcH }
  );
  if (!r.ok) {
    const err = await r.text();
    log.error('client-addresses', 'get db error', { status: r.status, org, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al cargar las direcciones' });
  }
  const rows = await r.json();
  return res.status(200).json({ addresses: Array.isArray(rows) ? rows : [] });
}

export default withObservability('client-addresses', handler);
