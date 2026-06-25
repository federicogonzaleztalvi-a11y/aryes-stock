// api/otp-send.js — Genera y envía un OTP por WhatsApp via Meta Cloud API
// Si WA_ACCESS_TOKEN no está configurado, devuelve el código en la respuesta (modo dev)

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { findClientByPhone } from './_client-lookup.js';
import { randomInt } from 'node:crypto';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://pazque.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function toE164(tel) {
  const digits = tel.replace(/\D/g, '');
  // Already has country code (10+ digits starting with valid prefix)
  if (digits.length >= 10) return digits;
  // Short number without country code — return as-is, WhatsApp API handles it
  return digits;
}

async function sendViaWhatsApp(to, code) {
  const msg = 'Tu codigo de acceso a Pazque es: *' + code + '*\n\nValido por 10 minutos. No lo compartas.';
  const res = await fetch('https://graph.facebook.com/v21.0/' + WA_PHONE_ID + '/messages', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + WA_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: 'pazque_otp',
        language: { code: 'es_AR' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: code }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[otp-send] WhatsApp error:', err);
    throw new Error('WhatsApp no enviado: ' + err);
  }
  const data = await res.json();
  console.log('[otp-send] WhatsApp enviado via Meta:', data?.messages?.[0]?.id || 'ok');
  return data;
}


export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Rate limit persistente (Supabase RPC) — efectivo en serverless multi-instancia.
  // El Map en memoria anterior no servía: cada lambda tenía su propio Map.
  if (!(await checkRateLimit('otp-send:' + _ip, 600, 5, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  const { tel } = req.body || {};
  // SECURITY: org determina a qué tenant pertenece la sesión. Se sanitiza y el
  // cliente DEBE pertenecer a ese org — si no, 404. Esto evita que un cliente de
  // un distribuidor pida OTP/sesión para el portal de otro (cross-tenant).
  const org = String(req.body?.org || 'aryes').replace(/[^a-z0-9_-]/gi, '') || 'aryes';
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key = SB_SVC_KEY || SB_ANON;

  // Buscar el cliente por teléfono, SCOPED al org y tolerante al formato del número
  // guardado (espacios/guiones/+ → ej. "+598 96 425 798"). Ver api/_client-lookup.js.
  const cliente = await findClientByPhone({ SB_URL, key, org, telClean });

  if (!cliente) {
    return res.status(404).json({ error: 'Número no registrado. Contactá a Pazque para activar tu acceso.' });
  }

  // Multi-tenant: get org-specific WhatsApp sender if configured
  let org_sender = null;
  try {
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=whatsapp_sender&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    const orgs = await orgRes.json();
    if (orgs?.[0]?.whatsapp_sender) org_sender = orgs[0].whatsapp_sender;
  } catch(e) { console.warn('[otp-send] Could not fetch org sender:', e.message); }

  // Rate limit: bloquear si ya existe un OTP activo en los últimos 60 segundos
  const since = new Date(Date.now() - 60000).toISOString();
  // SECURITY: scope por org_id. Un mismo teléfono puede ser cliente de varias
  // orgs (un comercio que compra a dos distribuidoras en Pazque). Sin el scope,
  // un OTP de la org A serviría para autenticar en la org B (cross-tenant).
  const recentRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&used=eq.false&expires_at=gte.${new Date().toISOString()}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const recent = await recentRes.json();
  if (recent?.length) {
    return res.status(429).json({ error: 'Ya enviamos un código. Esperá 1 minuto antes de pedir otro.' });
  }

  // Invalidar OTPs anteriores del mismo tel+org antes de generar uno nuevo
  await fetch(`${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&used=eq.false`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  });

  // Código de 6 dígitos con CSPRNG (randomInt sin sesgo de módulo). Antes eran 4
  // dígitos con Math.random() → 10.000 combinaciones predecibles, brute-forceable.
  // El org entra al hash → el código sólo es válido para la org que lo emitió.
  const code     = String(randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = await sha256(code + telClean + org);
  const expires  = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const otpRes = await fetch(`${SB_URL}/rest/v1/otp_sessions`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ tel: telClean, org_id: org, code_hash: codeHash, expires_at: expires, used: false }),
  });

  if (!otpRes.ok) {
    console.error('[otp-send] DB error:', await otpRes.text());
    return res.status(500).json({ error: 'Error al generar código' });
  }

  // SECURITY: nunca devolver el código OTP en la respuesta en producción.
  // Solo en desarrollo local se expone para poder probar sin enviar mensajes.
  const IS_PROD = (process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production';

  if (WA_TOKEN && WA_PHONE_ID) {
    try {
      const telE164 = toE164(telClean);
      await sendViaWhatsApp(telE164, code);
      return res.status(200).json({ ok: true, clienteNombre: cliente.name });
    } catch (err) {
      console.error('[otp-send] WhatsApp failed:', err.message);
      // En prod NO se filtra el código — el usuario reintenta.
      if (IS_PROD) {
        return res.status(502).json({ error: 'No pudimos enviar el código. Probá de nuevo en unos segundos.' });
      }
      // Dev local: devolver el código para poder seguir probando.
      return res.status(200).json({ ok: true, clienteNombre: cliente.name, code, _devMode: true, _waError: err.message });
    }
  }

  // WhatsApp no configurado.
  if (IS_PROD) {
    console.error('[otp-send] WA_ACCESS_TOKEN no configurado en producción');
    return res.status(503).json({ error: 'Servicio de mensajería no disponible. Contactá al proveedor.' });
  }
  console.warn('[otp-send] DEV MODE — código devuelto en respuesta (sin envío)');
  return res.status(200).json({ ok: true, clienteNombre: cliente.name, code, _devMode: true });
}
