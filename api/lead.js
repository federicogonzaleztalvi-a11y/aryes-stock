// api/lead.js — Captación de prospectos del portal (Camino B).
//
// Público (sin auth):
//   GET  ?org=X                     → { captacion: bool }  (para mostrar/ocultar el CTA)
//   POST { org, nombre, tel, ... }  → crea un lead + notifica al distribuidor por email
//
// Admin (Bearer JWT, rol admin — mismo patrón que broadcast.js / whatsapp-connect.js):
//   GET    ?action=list             → lista los prospectos de SU org
//   GET    ?action=config           → { activa: bool }
//   POST   { action:'config', activa } → prende/apaga la captación de SU org
//   POST   { action:'approve', id, lista_id? } → convierte lead → cliente
//   POST   { action:'dismiss', id } → marca el lead como descartado
//
// Genérico multi-tenant: la org del prospecto sale del body (validada/saneada);
// la org del admin sale SIEMPRE del JWT, nunca del body.

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { sendEmail, templates } from './_email.js';
import crypto from 'node:crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

function svcHeaders() {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json' };
}

function sanitizeOrg(v) {
  return String(v || '').replace(/[^a-z0-9_-]/gi, '');
}

// Recorta y limpia un string libre. Longitud tope para evitar payloads gigantes.
function clean(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// Valida el JWT del admin y resuelve { org }. Solo rol admin.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const k = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: k, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

// Lee el flag de captación de una org. { activa: bool }.
async function getCaptacion(org) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=captacion&limit=1`,
      { headers: svcHeaders() }
    );
    if (!r.ok) return { activa: false };
    const row = (await r.json())?.[0];
    return { activa: !!(row?.captacion?.activa) };
  } catch { return { activa: false }; }
}

async function setCaptacion(org, activa) {
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ captacion: { activa: !!activa } }),
  });
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action || '';

  // ── Rutas de admin (requieren JWT) ───────────────────────────────────────
  const isAdminAction =
    action === 'list' || action === 'approve' || action === 'dismiss' || action === 'config';

  if (isAdminAction) {
    const admin = await resolveAdmin(req);
    if (!admin) return res.status(401).json({ error: 'No autorizado' });
    const org = admin.org;

    if (req.method === 'GET' && action === 'list') {
      const r = await fetch(
        `${SB_URL}/rest/v1/leads?org_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500`,
        { headers: svcHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: 'No se pudieron leer los prospectos' });
      return res.status(200).json({ leads: await r.json() });
    }

    if (req.method === 'GET' && action === 'config') {
      return res.status(200).json(await getCaptacion(org));
    }

    if (req.method === 'POST' && action === 'config') {
      await setCaptacion(org, !!req.body?.activa);
      return res.status(200).json({ ok: true, activa: !!req.body?.activa });
    }

    if (req.method === 'POST' && action === 'dismiss') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });
      await fetch(`${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'descartado', updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && action === 'approve') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });

      // Traer el lead, scoped a la org del admin (nunca de otra org).
      const lr = await fetch(
        `${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
        { headers: svcHeaders() }
      );
      const lead = (lr.ok ? await lr.json() : [])?.[0];
      if (!lead) return res.status(404).json({ error: 'Prospecto no encontrado' });
      if (lead.converted_client_id) {
        return res.status(200).json({ ok: true, already: true, client_id: lead.converted_client_id });
      }

      // Crear el cliente con el mismo esquema que usa el vendedor (api/vendedor.js).
      const phone = clean(lead.tel, 40).replace(/\D/g, '');
      const row = {
        id:         crypto.randomUUID(),
        name:       clean(lead.nombre, 120) || 'Sin nombre',
        type:       'Otro',
        phone,
        contact:    clean(lead.comercio, 120),
        contacto:   clean(lead.comercio, 120),
        ciudad:     clean(lead.ciudad, 120),
        cond_pago:  'credito_30',
        org_id:     org,                    // ← del JWT, nunca del body
        created_at: new Date().toISOString(),
      };
      const lista_id = clean(req.body?.lista_id, 60);
      if (lista_id) row.lista_id = lista_id;

      const ins = await fetch(`${SB_URL}/rest/v1/clients`, {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!ins.ok) {
        console.error('[lead] approve → client insert error:', await ins.text());
        return res.status(502).json({ error: 'No se pudo crear el cliente' });
      }
      const created = (await ins.json())?.[0] || row;

      await fetch(`${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'convertido', converted_client_id: created.id, updated_at: new Date().toISOString() }),
      });

      return res.status(200).json({ ok: true, client: { id: created.id, name: created.name, phone: created.phone } });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ── Ruta pública: estado del flag (para decidir si mostrar el CTA) ────────
  if (req.method === 'GET') {
    const org = sanitizeOrg(req.query?.org) || 'aryes';
    return res.status(200).json(await getCaptacion(org));
  }

  // ── Ruta pública: crear prospecto ────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Fail-closed: si el limiter no responde, no dejamos spamear la tabla.
  if (!(await checkRateLimit('lead:' + ip, 600, 5, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  const org = sanitizeOrg(req.body?.org) || 'aryes';

  // La captación tiene que estar activa para esa org (server-authoritative:
  // no alcanza con que el front muestre el form; se valida acá también).
  const cap = await getCaptacion(org);
  if (!cap.activa) return res.status(403).json({ error: 'Captación no disponible' });

  const nombre = clean(req.body?.nombre, 120);
  const tel    = clean(req.body?.tel, 40);
  const telDigits = tel.replace(/\D/g, '');
  if (!nombre) return res.status(400).json({ error: 'Ingresá tu nombre' });
  if (telDigits.length < 8) return res.status(400).json({ error: 'Ingresá un WhatsApp válido' });

  const lead = {
    org_id:       org,
    nombre,
    tel:          telDigits,
    comercio:     clean(req.body?.comercio, 160) || null,
    ciudad:       clean(req.body?.ciudad, 120) || null,
    mensaje:      clean(req.body?.mensaje, 500) || null,
    utm_source:   clean(req.body?.utm_source, 120) || null,
    utm_medium:   clean(req.body?.utm_medium, 120) || null,
    utm_campaign: clean(req.body?.utm_campaign, 160) || null,
    fbclid:       clean(req.body?.fbclid, 255) || null,
    gclid:        clean(req.body?.gclid, 255) || null,
    referrer:     clean(req.body?.referrer, 255) || null,
    landing_url:  clean(req.body?.landing_url, 255) || null,
    estado:       'nuevo',
  };

  const ins = await fetch(`${SB_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(lead),
  });
  if (!ins.ok) {
    console.error('[lead] insert error:', await ins.text());
    return res.status(500).json({ error: 'No pudimos guardar tus datos. Probá de nuevo.' });
  }

  // Notificar al distribuidor por email (best-effort, no bloquea la respuesta).
  try {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=order_notify_email,name&limit=1`,
      { headers: svcHeaders() }
    );
    const orow = (orgRes.ok ? await orgRes.json() : [])?.[0];
    const dest = orow?.order_notify_email;
    if (dest) {
      const tpl = templates.nuevoProspecto(lead, orow?.name || 'Pazque');
      await sendEmail({ to: dest, subject: tpl.subject, html: tpl.html });
    }
  } catch (e) {
    console.warn('[lead] notify email failed (non-fatal):', e.message);
  }

  return res.status(200).json({ ok: true });
}
