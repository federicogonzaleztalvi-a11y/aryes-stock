// api/otp-send.js — Genera y envía un OTP por WhatsApp o SMS via Infobip
// Si INFOBIP_API_KEY no está configurado, devuelve el código en la respuesta (modo dev)

import { setCorsHeaders } from './_cors.js';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const IB_API_KEY  = process.env.INFOBIP_API_KEY;
const IB_BASE_URL = process.env.INFOBIP_BASE_URL;
const IB_SENDER   = process.env.INFOBIP_SENDER;
const IB_CHANNEL  = process.env.INFOBIP_CHANNEL;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://aryes-stock.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function toE164Uruguay(tel) {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('598')) return digits;
  if (digits.startsWith('0'))   return '598' + digits.slice(1);
  if (digits.length === 8)      return '598' + digits;
  return digits;
}

async function sendViaInfobip(to, code) {
  const mensaje = `Tu código de acceso a Aryes es: *${code}*\n\nVálido por 10 minutos. No lo compartas.`;

  if (IB_CHANNEL === 'whatsapp') {
    // WhatsApp via Infobip — mucho más barato que SMS (~10x)
    const url = `${IB_BASE_URL}/whatsapp/1/message/text`;
    const body = {
      from: org_sender || IB_SENDER,
      to,
      content: { text: mensaje },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `App ${IB_API_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[otp-send] Infobip WhatsApp error:', err);
      throw new Error('WhatsApp no enviado: ' + err);
    }
    const data = await res.json();
    console.log('[otp-send] WhatsApp enviado via Infobip:', data?.messages?.[0]?.status?.name || 'ok');
    return data;
  } else {
    // SMS via Infobip (fallback)
    const url = `${IB_BASE_URL}/sms/2/text/advanced`;
    const body = {
      messages: [{
        destinations: [{ to }],
        from: org_sender || IB_SENDER || 'Aryes',
        text: `Tu código de acceso a Aryes es: ${code}\n\nVálido por 10 minutos. No lo compartas.`,
      }],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `App ${IB_API_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[otp-send] Infobip SMS error:', err);
      throw new Error('SMS no enviado: ' + err);
    }
    const data = await res.json();
    console.log('[otp-send] SMS enviado via Infobip:', data?.messages?.[0]?.status?.name);
    return data;
  }
}


// ── Rate limiting: max 5 requests per IP per 10 min ──
const _rl_otp = new Map();
function _checkRate_otp(ip) {
  const now = Date.now();
  const entry = _rl_otp.get(ip) || [];
  const recent = entry.filter(t => now - t < 600000);
  if (recent.length >= 5) return false;
  recent.push(now);
  _rl_otp.set(ip, recent);
  return true;
}
export default async async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_otp(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  const { tel, org = 'aryes' } = req.body || {};
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key = SB_SVC_KEY || SB_ANON;

  // Buscar en tabla principal de clientes
  const cliRes = await fetch(
    `${SB_URL}/rest/v1/clients?or=(phone.eq.${encodeURIComponent(telClean)},phone.eq.0${encodeURIComponent(telClean.slice(-8))},phone.eq.598${encodeURIComponent(telClean.slice(-8))})&select=id,name,lista_id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  let clients = await cliRes.json();

  // Si no está en el teléfono principal, buscar en teléfonos adicionales (client_phones)
  if (!clients?.length) {
    const altRes = await fetch(
      `${SB_URL}/rest/v1/client_phones?phone=eq.${encodeURIComponent(telClean)}&active=eq.true&select=client_id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    const altPhones = await altRes.json();
    if (altPhones?.length) {
      const clientId = altPhones[0].client_id;
      const cliRes2 = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=id,name,lista_id&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
      );
      clients = await cliRes2.json();
    }
  }

  if (!clients?.length) {
    return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });
  }

  // Multi-tenant: get org-specific WhatsApp sender if configured
  let org_sender = IB_SENDER;
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
  const recentRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&used=eq.false&expires_at=gte.${new Date().toISOString()}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const recent = await recentRes.json();
  if (recent?.length) {
    return res.status(429).json({ error: 'Ya enviamos un código. Esperá 1 minuto antes de pedir otro.' });
  }

  // Invalidar OTPs anteriores del mismo tel antes de generar uno nuevo
  await fetch(`${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&used=eq.false`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  });

  const code     = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await sha256(code + telClean);
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

  if (IB_API_KEY && IB_BASE_URL) {
    try {
      const telE164 = toE164Uruguay(telClean);
      await sendViaInfobip(telE164, code);
      return res.status(200).json({ ok: true, clienteNombre: clients[0].name });
    } catch (err) {
      console.error('[otp-send] Error enviando mensaje:', err.message);
      return res.status(500).json({ error: 'Error al enviar el código. Intentá de nuevo.' });
    }
  }

  // Dev mode
  console.warn('[otp-send] DEV MODE — código devuelto en respuesta (sin SMS)');
  return res.status(200).json({ ok: true, clienteNombre: clients[0].name, code, _devMode: true });
}
