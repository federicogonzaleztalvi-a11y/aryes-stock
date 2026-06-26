// api/analytics.js — Agregación de analítica web para el panel del admin.
// ----------------------------------------------------------------------------
// Lee public.web_events (RLS service-only) con la service key, SIEMPRE scopeado
// al org del admin logueado, y devuelve los números ya masticados para que la
// pestaña "Analítica" del admin cargue liviana (no baja eventos crudos al navegador).
//
// Identidad: se valida el access_token de Supabase del admin y se deriva el org
// DEL SERVIDOR (nunca del query). Sólo rol admin/contador.
//
// GET /api/analytics?days=30 → { resumen, porDia, topPaginas, topProductos,
//                                topAgregados, busquedas, embudo, tiempos }

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'contador'];
const MAX_ROWS = 20000;           // tope defensivo de filas a agregar por request
const IDLE_CAP_MS = 30 * 60 * 1000; // si entre 2 eventos pasan >30min, no se suma como "tiempo en pantalla"

// Valida el JWT del admin y resuelve { org, role } desde la tabla users.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  const email = userData?.email;
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

function dayKey(iso) { return String(iso).slice(0, 10); }

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });

  let days = parseInt(req.query.days, 10);
  if (!Number.isFinite(days) || days < 1 || days > 365) days = 30;
  const sinceISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const svcKey = SB_SVC || SB_ANON;
  const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

  let rows = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/web_events?org_id=eq.${encodeURIComponent(admin.org)}` +
      `&created_at=gte.${encodeURIComponent(sinceISO)}` +
      `&select=session_id,client_id,event,path,props,created_at` +
      `&order=created_at.asc&limit=${MAX_ROWS}`,
      { headers: svcH }
    );
    if (r.ok) rows = await r.json();
    else if (r.status === 404 || r.status === 400) {
      // Tabla aún no creada → devolvemos vacío con una pista para el panel.
      return res.status(200).json({ pendingSetup: true, resumen: {}, porDia: [], topPaginas: [], topProductos: [], topAgregados: [], busquedas: [], embudo: {}, tiempos: {} });
    }
  } catch {
    return res.status(502).json({ error: 'Error al leer analítica' });
  }
  if (!Array.isArray(rows)) rows = [];

  // ── Agregaciones ──
  const sessions = new Set();
  const clients = new Set();
  const evCount = {};            // por tipo de evento
  const byDay = {};              // dia -> { visitas:Set, pedidos, eventos }
  const pageCount = {};          // vista -> count de page_view
  const pageTime = {};           // vista -> ms acumulados
  const prodVistos = {};         // producto -> count
  const prodAgregados = {};      // producto -> count
  const searches = {};           // q -> count
  const sessionSpan = {};        // sid -> { min, max }
  const perSession = {};         // sid -> [ {event, path, t} ]

  for (const e of rows) {
    const sid = e.session_id || '∅';
    const t = new Date(e.created_at).getTime();
    if (e.session_id) sessions.add(e.session_id);
    if (e.client_id) clients.add(e.client_id);
    evCount[e.event] = (evCount[e.event] || 0) + 1;

    const d = dayKey(e.created_at);
    if (!byDay[d]) byDay[d] = { visitas: new Set(), pedidos: 0, eventos: 0 };
    byDay[d].eventos++;
    if (e.session_id) byDay[d].visitas.add(e.session_id);
    if (e.event === 'pedido_confirmado') byDay[d].pedidos++;

    if (e.event === 'page_view') {
      const v = (e.props && e.props.vista) || e.path || 'otra';
      pageCount[v] = (pageCount[v] || 0) + 1;
    }
    if (e.event === 'producto_visto') {
      const p = (e.props && e.props.producto) || '—';
      prodVistos[p] = (prodVistos[p] || 0) + 1;
    }
    if (e.event === 'producto_agregado') {
      const p = (e.props && e.props.producto) || '—';
      prodAgregados[p] = (prodAgregados[p] || 0) + 1;
    }
    if (e.event === 'busqueda') {
      const q = ((e.props && e.props.q) || '').toString().trim().toLowerCase();
      if (q) searches[q] = (searches[q] || 0) + 1;
    }

    const span = sessionSpan[sid] || { min: t, max: t };
    span.min = Math.min(span.min, t); span.max = Math.max(span.max, t);
    sessionSpan[sid] = span;
    (perSession[sid] = perSession[sid] || []).push({ path: (e.props && e.props.vista) || e.path || 'otra', t });
  }

  // Tiempo por pantalla: diferencia entre eventos consecutivos de la misma sesión
  // (cap a 30min para no inflar por inactividad), atribuida a la pantalla previa.
  for (const sid of Object.keys(perSession)) {
    const evs = perSession[sid].sort((a, b) => a.t - b.t);
    for (let i = 0; i < evs.length - 1; i++) {
      const dt = evs[i + 1].t - evs[i].t;
      if (dt > 0 && dt < IDLE_CAP_MS) pageTime[evs[i].path] = (pageTime[evs[i].path] || 0) + dt;
    }
  }

  // Duración promedio de sesión
  const spans = Object.values(sessionSpan).map(s => s.max - s.min).filter(x => x >= 0);
  const avgSession = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length / 1000) : 0; // seg

  const sortTop = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));

  const porDia = Object.keys(byDay).sort().map(d => ({
    dia: d, visitas: byDay[d].visitas.size, pedidos: byDay[d].pedidos, eventos: byDay[d].eventos,
  }));

  const topPaginas = Object.keys(pageCount).map(v => ({
    k: v, v: pageCount[v], seg: Math.round((pageTime[v] || 0) / 1000),
  })).sort((a, b) => b.v - a.v).slice(0, 10);

  const embudo = {
    catalogo: evCount['catalogo_visto'] || 0,
    productoVisto: evCount['producto_visto'] || 0,
    agregado: evCount['producto_agregado'] || 0,
    pedido: evCount['pedido_confirmado'] || 0,
  };

  return res.status(200).json({
    rango: { days, since: sinceISO, sampled: rows.length >= MAX_ROWS },
    resumen: {
      eventos: rows.length,
      visitas: sessions.size,
      clientesActivos: clients.size,
      pedidos: evCount['pedido_confirmado'] || 0,
      productosAgregados: evCount['producto_agregado'] || 0,
      productosVistos: evCount['producto_visto'] || 0,
      busquedas: evCount['busqueda'] || 0,
      duracionMediaSeg: avgSession,
    },
    porDia,
    topPaginas,
    topProductos: sortTop(prodVistos),
    topAgregados: sortTop(prodAgregados),
    busquedas: sortTop(searches),
    embudo,
  });
}
