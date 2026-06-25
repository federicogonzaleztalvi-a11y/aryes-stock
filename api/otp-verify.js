// api/otp-verify.js v4

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { findClientByPhone } from './_client-lookup.js';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;
// 90 días: la web app instalada debe sentirse "siempre abierta" (como WhatsApp/
// Mercado Libre). Antes eran 7 días → el cliente tenía que re-verificar por OTP
// muy seguido, lo que rompía la sensación de app nativa.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://pazque.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit por IP además del MAX_ATTEMPTS por-OTP: frena fuerza bruta que rota
  // entre múltiples OTPs/teléfonos desde una misma IP.
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await checkRateLimit('otp-verify:' + _ip, 600, 30, { failClosed: true })))
    return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });

  const { tel, code } = req.body || {};
  // SECURITY: org se sanitiza y el cliente debe pertenecer a ese org (cross-tenant).
  const org = String(req.body?.org || 'aryes').replace(/[^a-z0-9_-]/gi, '') || 'aryes';
  if (!tel || !code) return res.status(400).json({ error: 'Teléfono y código requeridos' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key = SB_SVC_KEY || SB_ANON;
  // SECURITY: el org entra al hash y al filtro → un OTP sólo es válido para la
  // org que lo emitió (evita reuso cross-tenant del mismo teléfono).
  const codeHash = await sha256(code + telClean + org);

  // 1. Buscar OTP activo (scoped al org)
  const otpRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&used=eq.false&expires_at=gte.${new Date().toISOString()}&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  if (!otpRes.ok) return res.status(500).json({ error: 'Error al verificar código' });
  const otps = await otpRes.json();
  if (!otps?.length) return res.status(401).json({ error: 'Código expirado o inválido. Pedí uno nuevo.' });

  const otp = otps[0];

  // 2. Verificar hash
  if (!safeEqual(otp.code_hash, codeHash)) {
    const newAttempts = (otp.failed_attempts || 0) + 1;
    await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ failed_attempts: newAttempts }),
    });
    const remaining = MAX_ATTEMPTS - newAttempts;
    if (remaining <= 0) return res.status(429).json({ error: 'Demasiados intentos. Pedí un código nuevo.', locked: true });
    return res.status(401).json({ error: `Código incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.` });
  }

  // 3. Buscar cliente por teléfono, SCOPED al org y tolerante al formato del número
  // guardado (espacios/guiones/+). El cliente debe pertenecer al org solicitado, si
  // no la sesión sería cross-tenant. Ver api/_client-lookup.js.
  const cliente = await findClientByPhone({ SB_URL, key, org, telClean });

  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // 5. Guardar sesión
  await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ token: sessionToken, cliente_id: cliente.id, tel: telClean, org_id: org, expires_at: expiresAt }),
  });

  // 4. Marcar OTP como usado (solo si la sesión se guardó correctamente)
  await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  });

  return res.status(200).json({
    ok: true,
    session: {
      token:     sessionToken,
      expiresAt,
      clienteId: cliente.id,
      nombre:    cliente.name,
      listaId:   cliente.lista_id || null,
      tel:       telClean,
      org,
    },
  });
}
// deployed Sun May  3 15:36:54 -03 2026
