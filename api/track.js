// api/track.js — Ingesta de analítica web del portal B2B.
// ----------------------------------------------------------------------------
// Recibe TANDAS de eventos de comportamiento (page_view, producto_visto,
// producto_agregado, pedido_confirmado, busqueda, ...) y los guarda en
// public.web_events. El panel del admin los lee agregados vía api/analytics.js.
//
// Auth (igual criterio que cart.js / _session.js):
//   - Si viene un token de portal válido → org_id + client_id se DERIVAN del
//     servidor (autoritativo, sin confiar en el body).
//   - Si NO hay token (visita anónima previa al login) → se acepta `org` del
//     body PERO se valida que sea una organización real (existe en
//     organizations.id). Así nadie puede inflar la tabla con orgs inventadas.
//
// La tabla tiene RLS service-only: ningún cliente puede leer ni pisar eventos
// de otro. Es write-only desde el portal; todo lo demás pasa por el servidor.
//
// POST /api/track  { org?, session_id, events:[{event,path,props,ts}] } → { ok, n }

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;

// ── Rate limit: 30 tandas por IP por minuto (el cliente manda con debounce/lotes) ──
const _rl = new Map();
function _checkRate(ip) {
  const now = Date.now();
  const recent = (_rl.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 30) return false;
  recent.push(now);
  _rl.set(ip, recent);
  return true;
}

// Cache de orgs válidas (para validar visitas anónimas sin pegarle a la DB
// en cada request). TTL 5 min.
const _orgCache = new Map();
async function orgExists(org, svcH) {
  const now = Date.now();
  const hit = _orgCache.get(org);
  if (hit && now - hit.t < 5 * 60 * 1000) return hit.ok;
  let ok = false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=id&limit=1`,
      { headers: svcH }
    );
    if (r.ok) { const rows = await r.json(); ok = Array.isArray(rows) && rows.length > 0; }
  } catch { /* red caída → no validamos, devolvemos false */ }
  _orgCache.set(org, { ok, t: now });
  return ok;
}

const EVENT_RE = /^[a-z0-9_]{1,40}$/; // nombres de evento controlados

// Sanea la tanda de eventos: máx 50 por request, nombres y tamaños acotados.
function sanitizeEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (out.length >= 50) break;
    if (!e || typeof e !== 'object') continue;
    const event = String(e.event || '').toLowerCase();
    if (!EVENT_RE.test(event)) continue;
    let props = {};
    if (e.props && typeof e.props === 'object' && !Array.isArray(e.props)) {
      // Acotar props: máx 20 claves, valores cortos.
      let n = 0;
      for (const [k, v] of Object.entries(e.props)) {
        if (n >= 20) break;
        const key = String(k).slice(0, 40);
        if (typeof v === 'number' && Number.isFinite(v)) props[key] = v;
        else if (typeof v === 'boolean') props[key] = v;
        else if (v != null) props[key] = String(v).slice(0, 200);
        n++;
      }
    }
    out.push({
      event,
      path: e.path != null ? String(e.path).slice(0, 200) : null,
      props,
    });
  }
  return out;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate(ip)) return res.status(429).json({ error: 'rate' });

  if (!SB_URL || !SB_SVC) return res.status(204).end(); // sin config → no rompemos el portal

  const svcH = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

  const body = req.body || {};
  const events = sanitizeEvents(body.events);
  if (!events.length) return res.status(200).json({ ok: true, n: 0 });

  const sessionId = body.session_id != null ? String(body.session_id).slice(0, 80) : null;

  // ── Resolver org_id + client_id ──
  let org = null;
  let clientId = null;

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token && token !== 'demo-token') {
    // Sesión válida → org + cliente DEL SERVIDOR (autoritativo)
    try {
      const sr = await fetch(
        `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(token)}&expires_at=gte.${new Date().toISOString()}&revoked=eq.false&select=org_id,cliente_id&limit=1`,
        { headers: svcH }
      );
      if (sr.ok) {
        const rows = await sr.json();
        if (rows?.[0]) { org = rows[0].org_id; clientId = rows[0].cliente_id || null; }
      }
    } catch { /* sigue como anónimo */ }
  }

  if (!org) {
    // Visita anónima (pre-login) → aceptar org del body sólo si es real
    const candidate = body.org != null ? String(body.org).slice(0, 80) : '';
    if (candidate && await orgExists(candidate, svcH)) org = candidate;
  }

  if (!org) return res.status(200).json({ ok: true, n: 0 }); // sin org válida → descartar en silencio

  const now = new Date().toISOString();
  const rows = events.map(e => ({
    org_id: org,
    session_id: sessionId,
    client_id: clientId,
    event: e.event,
    path: e.path,
    props: e.props,
    created_at: now,
  }));

  try {
    const ins = await fetch(`${SB_URL}/rest/v1/web_events`, {
      method: 'POST',
      headers: { ...svcH, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!ins.ok) return res.status(204).end(); // no romper el portal por analítica
  } catch {
    return res.status(204).end();
  }

  return res.status(200).json({ ok: true, n: rows.length });
}
