// api/otp-send.js — Genera y envía un OTP por SMS via Infobip
// Si INFOBIP_API_KEY no está configurado, devuelve el código en la respuesta (modo dev)

const SB_URL     = process.env.SUPABASE_URL;
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const IB_API_KEY  = process.env.INFOBIP_API_KEY;
const IB_BASE_URL = process.env.INFOBIP_BASE_URL;
const IB_SENDER   = process.env.INFOBIP_SENDER;

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

function toE164Uruguay(tel) {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('598')) return digits;
  if (digits.startsWith('0'))   return '598' + digits.slice(1);
  if (digits.length === 8)      return '598' + digits;
  return digits;
}

async function sendSmsInfobip(to, code) {
  const url = `${IB_BASE_URL}/sms/2/text/advanced`;
  const body = {
    messages: [{
      destinations: [{ to }],
      from: IB_SENDER || 'Aryes',
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
    console.error('[otp-send] Infobip error:', err);
    throw new Error('SMS no enviado: ' + err);
  }

  const data = await res.json();
  console.log('[otp-send] SMS enviado via Infobip:', data?.messages?.[0]?.status?.name);
  return data;
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { tel, org = 'aryes' } = req.body || {};
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  const key = SB_SVC_KEY || SB_ANON;
  const cliRes = await fetch(
    `${SB_URL}/rest/v1/clients?or=(telefono.eq.${encodeURIComponent(telClean)},telefono.eq.0${encodeURIComponent(telClean.slice(-8))},telefono.eq.598${encodeURIComponent(telClean.slice(-8))})&select=id,nombre,lista_id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  const clients = await cliRes.json();
  if (!clients?.length) {
    return res.status(404).json({ error: 'Número no registrado. Contactá a Aryes para activar tu acceso.' });
  }

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
      await sendSmsInfobip(telE164, code);
      return res.status(200).json({ ok: true, clienteNombre: clients[0].nombre });
    } catch (err) {
      console.error('[otp-send] Error enviando SMS:', err.message);
      return res.status(500).json({ error: 'Error al enviar el código. Intentá de nuevo.' });
    }
  }

  // Dev mode
  console.warn('[otp-send] DEV MODE — código devuelto en respuesta (sin SMS)');
  return res.status(200).json({ ok: true, clienteNombre: clients[0].nombre, code, _devMode: true });
}
