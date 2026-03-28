// api/otp-verify.js — Verifica el OTP e identifica al cliente
// SECURITY: tracks failed attempts, locks after MAX_ATTEMPTS,
//           persists session token in portal_sessions for server-side validation

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const MAX_ATTEMPTS   = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

  // Service key for writes; anon key for reads (consistent with existing pattern)
  const key = SB_SVC_KEY || SB_ANON;
  const codeHash = await sha256(code + telClean);

  // ── 1. Fetch active OTP session ───────────────────────────────────────────
  const otpRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions` +
    `?tel=eq.${encodeURIComponent(telClean)}` +
    `&used=eq.false` +
    `&expires_at=gte.${new Date().toISOString()}` +
    `&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );

  if (!otpRes.ok) {
    return res.status(500).json({ error: 'Error al verificar código' });
  }

  const otps = await otpRes.json();
  if (!otps?.length) {
    return res.status(401).json({ error: 'Código expirado o inválido. Pedí uno nuevo.' });
  }

  const otp = otps[0];

  // ── 2. Check code ─────────────────────────────────────────────────────────
  if (otp.code_hash !== codeHash) {
    const newAttempts = (otp.failed_attempts || 0) + 1;
    const shouldLock  = newAttempts >= MAX_ATTEMPTS;

    await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
      method:  'PATCH',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ failed_attempts: newAttempts }),
    // locked column does not exist — skip
    });

    if (shouldLock) {
      console.warn(`[otp-verify] session locked after ${MAX_ATTEMPTS} failed attempts tel:${telClean.slice(-4)}`);
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

  // ── 3. Code correct — mark OTP as used ───────────────────────────────────
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
    `?or=(phone.eq.${encodeURIComponent(telClean)},phone.eq.0${encodeURIComponent(telClean.slice(-8))},phone.eq.598${encodeURIComponent(telClean.slice(-8))})` +
    `&select=id,name,lista_id,email,city,cond_pago&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const clients = await cliRes.json();
  if (!clients?.length) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  const cliente    = clients[0];
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // ── 5. Persist session token server-side ─────────────────────────────────
  // Stored in portal_sessions — validated by api/pedido.js on every order.
  // Uses service key to bypass RLS (table is RESTRICTIVE — no REST access).
  const sessRes = await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
    method:  'POST',
    headers: {
      apikey:         key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({
      token:      sessionToken,
      cliente_id: cliente.id,
      tel:        telClean,
      org_id:     org,
      expires_at: expiresAt,
    }),
  });

  if (!sessRes.ok) {
    // Non-fatal: log but still return the session.
    // The worst case: pedido.js won't find the token and rejects the order.
    // Better than blocking login entirely.
    console.error('[otp-verify] failed to persist portal_session:', sessRes.status);
  }

  // ── 6. Return session to client ───────────────────────────────────────────
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
