// api/analytics-live.js — "En vivo" (Live View estilo Shopify): quién está en el
// portal AHORA. Liviano a propósito: mira sólo los últimos minutos de web_events,
// agrupa por sesión y devuelve la última acción de cada una. Pensado para que el
// panel lo pollee cada ~10s sin pesar (no agrega 30 días como /api/analytics).
//
// Identidad: valida el JWT del admin y deriva el org DEL SERVIDOR (nunca del
// query). Sólo rol admin/contador. Scopeado al org del admin.
//
//   GET /api/analytics-live → { activos:[{accion,haceSeg,logueado}], total, ventanaMin }

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'contador'];
const VENTANA_MIN = 5;        // "ahora" = actividad en los últimos 5 minutos
const MAX_ROWS = 3000;        // tope defensivo

async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;
  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || !ALLOWED_ROLES.includes(u.role)) return null;
  return { org: u.org_id, role: u.role };
}

// Traduce el último evento de la sesión a una frase legible para el admin.
function accionDe(ev, props) {
  const p = props || {};
  switch (ev) {
    case 'pedido_confirmado': return 'Confirmó un pedido';
    case 'producto_agregado': return 'Agregó al carrito' + (p.producto ? ': ' + p.producto : '');
    case 'producto_visto':    return 'Mirando ' + (p.producto || 'un producto');
    case 'busqueda':          return 'Buscando' + (p.q ? ' “' + p.q + '”' : '');
    case 'catalogo_visto':    return 'En el catálogo';
    case 'page_view':         return 'En ' + (p.vista || 'el portal');
    default:                  return 'En el portal';
  }
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });

  const sinceISO = new Date(Date.now() - VENTANA_MIN * 60 * 1000).toISOString();
  const svcKey = SB_SVC || SB_ANON;
  const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

  let rows = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/web_events?org_id=eq.${encodeURIComponent(admin.org)}` +
      `&created_at=gte.${encodeURIComponent(sinceISO)}` +
      `&select=session_id,client_id,event,props,created_at` +
      `&order=created_at.desc&limit=${MAX_ROWS}`,
      { headers: svcH }
    );
    if (r.ok) rows = await r.json();
    else return res.status(200).json({ activos: [], total: 0, ventanaMin: VENTANA_MIN });
  } catch {
    return res.status(200).json({ activos: [], total: 0, ventanaMin: VENTANA_MIN });
  }
  if (!Array.isArray(rows)) rows = [];

  // Como viene ordenado desc, el primer evento que vemos de cada sesión es el
  // más reciente → esa es su "última acción".
  const vistos = new Set();
  const now = Date.now();
  const activos = [];
  for (const e of rows) {
    const sid = e.session_id;
    if (!sid || vistos.has(sid)) continue;
    vistos.add(sid);
    activos.push({
      accion: accionDe(e.event, e.props),
      haceSeg: Math.max(0, Math.round((now - new Date(e.created_at).getTime()) / 1000)),
      logueado: !!e.client_id,
    });
  }
  // Más recientes primero (ya lo están), tope visual de 30 filas.
  return res.status(200).json({ activos: activos.slice(0, 30), total: activos.length, ventanaMin: VENTANA_MIN });
}
