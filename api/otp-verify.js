// api/otp-verify.js — Verifica el OTP e identifica al cliente
// SECURITY: tracks failed attempts per session, locks after MAX_ATTEMPTS

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const MAX_ATTEMPTS = 5; // lock session after this many wrong codes

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!SB_URL || !SB_ANON) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { tel, code, org = 'aryes' } = req.body || {};
  if (!tel || !code) return res.status(400).json({ error: 'Teléfono y código requeridos' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key      = SB_SVC_KEY || SB_ANON;
  const codeHash = await sha256(code + telClean);

  // ── 1. Fetch active OTP session ───────────────────────────────────────────
  // Include locked=false filter — locked sessions are permanently rejected
  const otpRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions` +
    `?tel=eq.${encodeURIComponent(telClean)}` +
    `&used=eq.false` +
    `&locked=eq.false` +
    `&expires_at=gte.${new Date().toISOString()}` +
    `&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );

  if (!otpRes.ok) {
    return res.status(500).json({ error: 'Error al verificar código' });
  }

  const otps = await otpRes.json();

  if (!otps?.length) {
    // Could be expired, already used, or locked
    return res.status(401).json({ error: 'Código expirado o inválido. Pedí uno nuevo.' });
  }

  const otp = otps[0];

  // ── 2. Check code ─────────────────────────────────────────────────────────
  if (otp.code_hash !== codeHash) {
    const newAttempts = (otp.failed_attempts || 0) + 1;
    const shouldLock  = newAttempts >= MAX_ATTEMPTS;

    // Increment failed_attempts and optionally lock the session
    await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
      method:  'PATCH',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        failed_attempts: newAttempts,
        locked:          shouldLock,
      }),
    });

    if (shouldLock) {
      console.warn(`[otp-verify] session locked after ${MAX_ATTEMPTS} failed attempts for tel:${telClean.slice(-4)}`);
      return res.status(429).json({
        error: `Demasiados intentos incorrectos. El código fue bloqueado. Pedí uno nuevo.`,
        locked: true,
      });
    }

    const remaining = MAX_ATTEMPTS - newAttempts;
    return res.status(401).json({
      error: `Código incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`,
    });
  }

  // ── 3. Code is correct — mark as used ────────────────────────────────────
  await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
    method:  'PATCH',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ used: true }),
  });

  // ── 4. Look up the client ─────────────────────────────────────────────────
  const cliRes = await fetch(
    `${SB_URL}/rest/v1/clients` +
    `?or=(telefono.eq.${encodeURIComponent(telClean)},telefono.eq.0${encodeURIComponent(telClean.slice(-8))},telefono.eq.598${encodeURIComponent(telClean.slice(-8))})` +
    `&select=id,nombre,lista_id,email,ciudad,condPago:cond_pago&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const clients = await cliRes.json();

  if (!clients?.length) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  const cliente = clients[0];

  // ── 5. Return session ─────────────────────────────────────────────────────
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return res.status(200).json({
    ok: true,
    session: {
      token:     sessionToken,
      expiresAt,
      clienteId: cliente.id,
      nombre:    cliente.nombre,
      listaId:   cliente.lista_id || null,
      tel:       telClean,
      org,
    },
  });
}
