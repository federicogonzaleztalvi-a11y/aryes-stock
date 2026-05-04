// api/tracking-public.js — Public tracking endpoint for delivery clients & drivers
// Replaces direct Supabase access from TrackingPage.jsx and DriverView.jsx
// Uses SERVICE_ROLE_KEY to bypass RLS, validates each request with strict rules.
//
// GET  /api/tracking-public?ruta=UUID&org=ORGID                  → driver view (full ruta)
// GET  /api/tracking-public?ruta=UUID&org=ORGID&cliente=UUID     → tracking view (cliente only)
// PATCH /api/tracking-public?ruta=UUID&org=ORGID                 → driver updates (whitelisted fields)
//
// Security model:
//  - org_id MUST match what's stored in DB (anti cross-org spoofing)
//  - UUID validation prevents injection
//  - PATCH whitelists fields: entregas, salidaEn, enRuta, updated_at
//  - Rate limited 60 req/min per IP
//
import { setCorsHeaders } from './_cors.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORG_RE  = /^[a-z0-9_-]{1,64}$/i;

// Rate limiting: 60 req/min per IP
const _rl = new Map();
function _checkRate(ip) {
  const now = Date.now();
  const entry = _rl.get(ip) || [];
  const recent = entry.filter(t => now - t < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  _rl.set(ip, recent);
  return true;
}

async function setHeaders(req, res) {
  await setCorsHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  await setHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server misconfigured' });

  const ruta    = String(req.query.ruta    || '').trim();
  const org     = String(req.query.org     || '').trim();
  const cliente = String(req.query.cliente || '').trim();

  // Validate UUIDs and org id
  if (!UUID_RE.test(ruta)) return res.status(400).json({ error: 'ruta inválida' });
  if (!ORG_RE.test(org))   return res.status(400).json({ error: 'org inválido' });
  if (cliente && !UUID_RE.test(cliente)) return res.status(400).json({ error: 'cliente inválido' });

  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // ───────── GET: Tracking (cliente) o Driver (full ruta) ─────────
  if (req.method === 'GET') {
    const url = `${SB_URL}/rest/v1/rutas?id=eq.${ruta}&org_id=eq.${org}&select=*&limit=1`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      console.error('[tracking-public] DB error:', await r.text());
      return res.status(500).json({ error: 'Error del servidor' });
    }
    const rows = await r.json();
    const rutaRow = rows?.[0];
    if (!rutaRow) return res.status(404).json({ error: 'Ruta no encontrada' });

    // If cliente filter provided → return only that delivery
    if (cliente) {
      const entrega = (rutaRow.entregas || []).find(e => e.clienteId === cliente);
      if (!entrega) return res.status(404).json({ error: 'Entrega no encontrada en esta ruta' });

      const myIdx     = rutaRow.entregas.findIndex(e => e.clienteId === cliente);
      const aheadPend = rutaRow.entregas.slice(0, myIdx).filter(e => e.estado === 'pendiente').length;

      return res.status(200).json({
        id:         rutaRow.id,
        vehiculo:   rutaRow.vehiculo,
        zona:       rutaRow.zona,
        dia:        rutaRow.dia,
        entrega,
        aheadPend,
        myIdx,
      });
    }

    // No cliente filter → driver view (full ruta)
    return res.status(200).json(rutaRow);
  }

  // ───────── PATCH: Driver updates entregas/salidaEn/enRuta ─────────
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'object' ? req.body : (() => {
      try { return JSON.parse(req.body || '{}'); } catch { return {}; }
    })();

    // Whitelist allowed fields — driver cannot change vehiculo, org_id, repartidor, etc
    // salidaEn/enRuta are NOT columns in the table — they live inside the entregas JSONB or localStorage
    const update = {};
    if (Array.isArray(body.entregas)) update.entregas = body.entregas;
    if (typeof body.notas === 'string') update.notas = body.notas;
    update.updated_at = new Date().toISOString();

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Sin campos válidos para actualizar' });
    }

    // Verify ruta exists & belongs to org BEFORE patching (anti spoof)
    const verify = await fetch(
      `${SB_URL}/rest/v1/rutas?id=eq.${ruta}&org_id=eq.${org}&select=id&limit=1`,
      { headers }
    );
    const verifyRows = await verify.json();
    if (!verifyRows?.length) return res.status(404).json({ error: 'Ruta no encontrada' });

    // Patch
    const r = await fetch(`${SB_URL}/rest/v1/rutas?id=eq.${ruta}`, {
      method:  'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body:    JSON.stringify(update),
    });
    if (!r.ok) {
      console.error('[tracking-public] PATCH error:', await r.text());
      return res.status(500).json({ error: 'Error al actualizar' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
