// api/demo-request.js — Captación de prospectos PROPIOS de Pazque (embudo de
// Federico). Una distribuidora interesada en CONTRATAR Pazque deja sus datos
// desde la landing (pazque.com) pidiendo una demo → se guarda en pazque_leads y
// le avisa a Federico por email.
//
// OJO — no confundir con api/lead.js: ese capta los COMPRADORES de un
// distribuidor ya cliente (feature del producto, por-org). Éste capta a las
// distribuidoras que quieren comprar Pazque (mi propio embudo, sin org).
//
// Público (sin auth):
//   POST { nombre, empresa, email, tel, rubro, mensaje, utm_*, fbclid, gclid,
//          referrer, landing_url }  → guarda el lead + avisa a Federico. { ok:true }
//
// Guarda todo el contexto de atribución (de qué anuncio vino) para poder medir
// campañas y hacer seguimiento después (peldaños outbound).

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { sendEmail, templates } from './_email.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// A dónde llega el aviso de un prospecto nuevo. Default: la casilla de Federico.
const LEADS_EMAIL = process.env.PAZQUE_LEADS_EMAIL || 'federico@pazque.com';

function svcHeaders() {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json' };
}

// Recorta y limpia un string libre. Tope de longitud para evitar payloads gigantes.
function clean(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Fail-closed: si el limiter no responde, no dejamos spamear la tabla.
  if (!(await checkRateLimit('demo:' + ip, 600, 5, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  const nombre  = clean(req.body?.nombre, 120);
  const empresa = clean(req.body?.empresa, 160);
  const email   = clean(req.body?.email, 160).toLowerCase();
  const tel     = clean(req.body?.tel, 40);
  const telDigits = tel.replace(/\D/g, '');
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  if (!nombre) return res.status(400).json({ error: 'Ingresá tu nombre' });
  // Al menos un canal de contacto: email válido o WhatsApp con 8+ dígitos.
  if (!emailOk && telDigits.length < 8)
    return res.status(400).json({ error: 'Dejanos un email o un WhatsApp para contactarte' });

  const lead = {
    nombre,
    empresa:      empresa || null,
    email:        emailOk ? email : null,
    tel:          telDigits || null,
    rubro:        clean(req.body?.rubro, 120) || null,
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

  const ins = await fetch(`${SB_URL}/rest/v1/pazque_leads`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(lead),
  });
  if (!ins.ok) {
    console.error('[demo-request] insert error:', await ins.text());
    return res.status(500).json({ error: 'No pudimos guardar tus datos. Probá de nuevo.' });
  }

  // Avisar a Federico (best-effort, no bloquea la respuesta al prospecto).
  try {
    const tpl = templates.nuevoLeadPazque(lead);
    await sendEmail({ to: LEADS_EMAIL, subject: tpl.subject, html: tpl.html });
  } catch (e) {
    console.warn('[demo-request] notify email failed (non-fatal):', e.message);
  }

  return res.status(200).json({ ok: true });
}
