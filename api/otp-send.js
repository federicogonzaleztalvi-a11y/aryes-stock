// api/otp-send.js — Genera y guarda un OTP para el teléfono del cliente
// El código se devuelve en la respuesta para desarrollo (modo sin SMS)
// Cuando se conecte Twilio, se comenta la línea `code` en la respuesta

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY; // service key para escribir otp_sessions
const SB_ANON     = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple SHA-256 hash via Web Crypto (available in Node 18+ / Vercel)
async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { tel, org = 'aryes' } = req.body || {};
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  // Limpiar número — solo dígitos
  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  // Verificar que el teléfono existe en la tabla clients
  const key = SB_SVC_KEY || SB_ANON;
  const cliRes = await fetch(
    `${SB_URL}/rest/v1/clients?or=(telefono.eq.${encodeURIComponent(telClean)},telefono.eq.0${encodeURIComponent(telClean.slice(-8))},telefono.eq.598${encodeURIComponent(telClean.slice(-8))})&select=id,nombre,lista_id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const clients = await cliRes.json();
  if (!clients?.length) {
    return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });
  }

  // Generar código 4 dígitos
  const code     = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await sha256(code + telClean); // salted hash
  const expires  = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Guardar OTP en Supabase (usa service key para bypassear RLS)
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

  // TODO: Cuando se conecte Twilio/WhatsApp, enviar el código acá
  // Por ahora: devolver el código en la respuesta (modo desarrollo)
  // En producción con SMS: eliminar `code` de la respuesta y enviar via Twilio
  const devMode = !process.env.TWILIO_ACCOUNT_SID;

  return res.status(200).json({
    ok: true,
    clienteNombre: clients[0].nombre,
    // SOLO EN DEV — remover cuando se active Twilio
    ...(devMode && { code, _devMode: true }),
  });
}
