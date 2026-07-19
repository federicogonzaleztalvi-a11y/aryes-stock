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

// Número Pazque (fallback) para la notificación de prospecto por WhatsApp.
const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_LANG     = process.env.WA_BROADCAST_LANG || 'es_AR';

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

// Lee la config de captación. { activa, notify_phone, notify_email }.
async function getCaptacion(org) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=captacion&limit=1`,
      { headers: svcHeaders() }
    );
    if (!r.ok) return { activa: false, notify_phone: null, notify_email: null };
    const c = (await r.json())?.[0]?.captacion || {};
    return { activa: !!c.activa, notify_phone: c.notify_phone || null, notify_email: c.notify_email || null };
  } catch { return { activa: false, notify_phone: null, notify_email: null }; }
}

// Merge parcial: lee la config actual y sobreescribe solo los campos del patch.
// Así togglear el flag no borra el teléfono/mail, ni viceversa.
async function setCaptacion(org, patch) {
  const cur = await getCaptacion(org);
  const next = {
    activa:       'activa'       in patch ? !!patch.activa                 : cur.activa,
    notify_phone: 'notify_phone' in patch ? (patch.notify_phone || null)   : cur.notify_phone,
    notify_email: 'notify_email' in patch ? (patch.notify_email || null)   : cur.notify_email,
  };
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ captacion: next }),
  });
  return next;
}

// Fuente de campaña del prospecto, en texto corto (para el WhatsApp/email).
function fuenteOf(lead) {
  if (lead.utm_source || lead.utm_campaign)
    return [lead.utm_source, lead.utm_campaign].filter(Boolean).join(' · ');
  if (lead.fbclid) return 'Meta Ads';
  if (lead.gclid)  return 'Google Ads';
  if (lead.referrer) { try { return new URL(lead.referrer).hostname.replace(/^www\./, ''); } catch { return lead.referrer; } }
  return 'Directo';
}

// Saneado para parámetros de plantilla de WhatsApp: Meta rechaza saltos de línea,
// tabs y más de 4 espacios seguidos dentro de un parámetro. Nunca vacío.
function waParam(v, fallback = '-') {
  const s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();
  return s || fallback;
}

// Notifica al distribuidor por WhatsApp que entró un prospecto (best-effort).
// Sender: su propia WABA si conectó WhatsApp y la plantilla pazque_prospecto está
// APROBADA en su cuenta; si no, el número de Pazque (fallback, nunca rompe).
async function notifyWhatsApp(org, lead, notifyPhone) {
  const to = String(notifyPhone || '').replace(/\D/g, '');
  if (!to) return;   // sin teléfono configurado → no hay a quién avisar

  let sender = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=whatsapp_sender&limit=1`,
      { headers: svcHeaders() }
    );
    if (r.ok) sender = (await r.json())?.[0]?.whatsapp_sender || null;
  } catch { /* usa fallback Pazque */ }

  const useOrg = !!(sender?.phone_id && sender?.token && sender?.prospecto_status === 'APPROVED');
  const phoneId = useOrg ? sender.phone_id : WA_PHONE_ID;
  const token   = useOrg ? sender.token   : WA_TOKEN;
  if (!phoneId || !token) return;   // mensajería no configurada

  const detalle = [lead.comercio, lead.ciudad, fuenteOf(lead)].filter(Boolean).join(' · ');
  const params = [waParam(lead.nombre), waParam(lead.tel), waParam(detalle)];

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'pazque_prospecto',
          language: { code: WA_LANG },
          components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
        },
      }),
    });
    if (!r.ok) console.warn('[lead] WhatsApp notify failed (non-fatal):', (await r.text()).slice(0, 200));
  } catch (e) {
    console.warn('[lead] WhatsApp notify threw (non-fatal):', e.message);
  }
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
        `${SB_URL}/rest/v1/portal_leads?org_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500`,
        { headers: svcHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: 'No se pudieron leer los prospectos' });
      return res.status(200).json({ leads: await r.json() });
    }

    if (req.method === 'GET' && action === 'config') {
      return res.status(200).json(await getCaptacion(org));
    }

    if (req.method === 'POST' && action === 'config') {
      const patch = {};
      if ('activa' in (req.body || {}))       patch.activa = !!req.body.activa;
      if ('notify_phone' in (req.body || {})) patch.notify_phone = clean(req.body.notify_phone, 40).replace(/\D/g, '') || null;
      if ('notify_email' in (req.body || {})) {
        const em = clean(req.body.notify_email, 160).toLowerCase();
        // Validación básica de email; vacío = usar el mail de pedidos (fallback).
        patch.notify_email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? em : null;
      }
      const next = await setCaptacion(org, patch);
      return res.status(200).json({ ok: true, ...next });
    }

    if (req.method === 'POST' && action === 'dismiss') {
      const id = clean(req.body?.id, 40);
      if (!id) return res.status(400).json({ error: 'Falta id' });
      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
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
        `${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
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

      await fetch(`${SB_URL}/rest/v1/portal_leads?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(org)}`, {
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

  const nombre   = clean(req.body?.nombre, 120);
  const tel      = clean(req.body?.tel, 40);
  const comercio = clean(req.body?.comercio, 160);
  const ciudad   = clean(req.body?.ciudad, 120);
  const telDigits = tel.replace(/\D/g, '');
  if (!nombre) return res.status(400).json({ error: 'Ingresá tu nombre' });
  if (telDigits.length < 8) return res.status(400).json({ error: 'Ingresá un WhatsApp válido' });
  if (!comercio) return res.status(400).json({ error: 'Ingresá el nombre de tu comercio' });
  if (!ciudad) return res.status(400).json({ error: 'Ingresá tu ciudad' });

  const lead = {
    org_id:       org,
    nombre,
    tel:          telDigits,
    comercio,
    ciudad,
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

  const ins = await fetch(`${SB_URL}/rest/v1/portal_leads`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(lead),
  });
  if (!ins.ok) {
    console.error('[lead] insert error:', await ins.text());
    return res.status(500).json({ error: 'No pudimos guardar tus datos. Probá de nuevo.' });
  }

  // Notificar al distribuidor por email (best-effort, no bloquea la respuesta).
  // Destino: el mail propio de prospectos si se configuró, si no el de pedidos.
  try {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=order_notify_email,name&limit=1`,
      { headers: svcHeaders() }
    );
    const orow = (orgRes.ok ? await orgRes.json() : [])?.[0];
    const dest = cap.notify_email || orow?.order_notify_email;
    if (dest) {
      const tpl = templates.nuevoProspecto(lead, orow?.name || 'Pazque');
      await sendEmail({ to: dest, subject: tpl.subject, html: tpl.html });
    }
  } catch (e) {
    console.warn('[lead] notify email failed (non-fatal):', e.message);
  }

  // Notificar por WhatsApp al teléfono configurado (best-effort, no bloquea).
  await notifyWhatsApp(org, lead, cap.notify_phone);

  return res.status(200).json({ ok: true });
}
