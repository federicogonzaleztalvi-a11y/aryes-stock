// api/otp-verify.js — Verifica el OTP e identifica al cliente
// Devuelve los datos del cliente para iniciar sesión en el portal

const SB_URL     = process.env.SUPABASE_URL     || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

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
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { tel, code, org = 'aryes' } = req.body || {};
  if (!tel || !code) return res.status(400).json({ error: 'Teléfono y código requeridos' });

  const telClean = tel.replace(/\D/g, '');
  const key      = SB_SVC_KEY || SB_ANON;
  const codeHash = await sha256(code + telClean);

  // Buscar OTP válido — no usado, no expirado, mismo hash
  const otpRes = await fetch(
    `${SB_URL}/rest/v1/otp_sessions?tel=eq.${encodeURIComponent(telClean)}&used=eq.false&expires_at=gte.${new Date().toISOString()}&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const otps = await otpRes.json();

  if (!otps?.length) {
    return res.status(401).json({ error: 'Código expirado. Pedí uno nuevo.' });
  }

  const otp = otps[0];
  if (otp.code_hash !== codeHash) {
    return res.status(401).json({ error: 'Código incorrecto.' });
  }

  // Marcar OTP como usado
  await fetch(`${SB_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used: true }),
  });

  // Buscar el cliente por teléfono (intentar múltiples formatos)
  const cliRes = await fetch(
    `${SB_URL}/rest/v1/clients?or=(telefono.eq.${encodeURIComponent(telClean)},telefono.eq.0${encodeURIComponent(telClean.slice(-8))},telefono.eq.598${encodeURIComponent(telClean.slice(-8))})&select=id,nombre,lista_id,email,ciudad,condPago:cond_pago&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const clients = await cliRes.json();
  if (!clients?.length) return res.status(404).json({ error: 'Cliente no encontrado' });

  const cliente = clients[0];

  // Generar token de sesión simple (UUID + ttl 7 días)
  // No usamos Supabase Auth — guardamos en localStorage del browser
  const sessionToken = crypto.randomUUID();
  const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return res.status(200).json({
    ok: true,
    session: {
      token:      sessionToken,
      expiresAt,
      clienteId:  cliente.id,
      nombre:     cliente.nombre,
      listaId:    cliente.lista_id || null,
      tel:        telClean,
      org,
    },
  });
}
