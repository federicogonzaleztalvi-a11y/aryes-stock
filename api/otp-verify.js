// api/otp-verify.js v3 — columnas: phone, name (NO telefono, NO nombre)

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const MAX_ATTEMPTS   = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  const { tel, code, org = 'aryes' } = req.body || {};
  if (!tel || !code) return res.status(400).json({ error: 'Teléfono y código requeridos' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key = SB_SVC_KEY || SB_ANON;
  const codeHash = await sha256(code + telClean);

  // 1. Buscar OTP activo
  const otpRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions` +
    `?tel=eq.${encodeURIComponent(telClean)}` +
    `&used=eq.false` +
    `&expires_at=gte.${new Date().toISOString()}` +
    `&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );

  if (!otpRes.ok) return res.status(500).json({ error: 'Error al verificar código' });

  const otps = await otpRes.json();
  if (!otps?.length) return res.status(401).json({ error: 'Código expirado o inválido. Pedí uno nuevo.' });

  const otp = otps[0];

  // 2. Verificar hash
  if (otp.code_hash !== codeHash) {
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

  // 3. Marcar OTP como usado
  await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  });

  // 4. Buscar cliente por columna PHONE (no telefono)
  const tel8 = telClean.slice(-8);
  const cliUrl = `${SB_URL}/rest/v1/clients` +
    `?or=(phone.eq.${encodeURIComponent(telClean)},phone.eq.0${encodeURIComponent(tel8)},phone.eq.598${encodeURIComponent(tel8)})` +
    `&select=id,name,lista_id,email,cond_pago&limit=1`;

  // DIAGNÓSTICO TEMPORAL
  return res.status(200).json({ 
    _diag: true,
    sb_url: SB_URL ? SB_URL.slice(0,30) : 'UNDEFINED',
    has_svc: !!SB_SVC_KEY,
    has_anon: !!SB_ANON,
    tel: telClean,
    tel8,
    cliUrl: cliUrl.slice(0,100)
  });
  // FIN DIAGNÓSTICO
  console.log('[otp-verify] buscando cliente, tel:', telClean, 'tel8:', tel8);
  console.log('[otp-verify] SB_URL:', SB_URL ? 'ok' : 'UNDEFINED', 'key:', key ? 'ok' : 'UNDEFINED');

  // Usar service key para bypass RLS en la búsqueda del cliente
  const clientKey = SB_SVC_KEY || SB_ANON;
  const cliRes = await fetch(cliUrl, {
    headers: { 
      apikey: clientKey, 
      Authorization: `Bearer ${clientKey}`, 
      Accept: 'application/json',
      Prefer: 'count=none'
    }
  });
  const cliText = await cliRes.text();
  console.log('[otp-verify] status:', cliRes.status, 'body:', cliText.slice(0, 300));
  
  let clients;
  try { clients = JSON.parse(cliText); } catch(e) { clients = []; }
  console.log('[otp-verify] clientes:', Array.isArray(clients) ? clients.length : typeof clients);

  if (!clients?.length) return res.status(404).json({ error: 'Cliente no encontrado' });

  const cliente = clients[0];
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // 5. Guardar sesión
  const sessRes = await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ token: sessionToken, cliente_id: cliente.id, tel: telClean, org_id: org, expires_at: expiresAt }),
  });

  if (!sessRes.ok) {
    console.error('[otp-verify] portal_sessions error:', sessRes.status, await sessRes.text());
  }

  // 6. Respuesta — campo nombre usa cliente.name (columna en inglés)
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
