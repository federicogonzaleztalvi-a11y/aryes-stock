// api/historial.js â Historial de pedidos del cliente por telÃ©fono
// Llamado desde PedidosPage cuando el cliente abre "Mis pedidos"
// No requiere auth â el telÃ©fono ya fue verificado via OTP en el browser

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  // Hard fail â nunca usar anon key como fallback de service key
  if (!SB_URL || !SB_ANON) {
    console.error('[historial] FATAL: env vars SUPABASE_URL o SUPABASE_ANON_KEY no configuradas');
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  const { tel, org = 'aryes' } = req.query || {};
  if (!tel) return res.status(400).json({ error: 'TelÃ©fono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'TelÃ©fono invÃ¡lido' });

  // Buscar pedidos en b2b_orders â Ãºltimos 20, mÃ¡s recientes primero
  const r = await fetch(
    `${SB_URL}/rest/v1/b2b_orders?cliente_tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&order=creado_en.desc&limit=20`,
    { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
  );

  if (!r.ok) {
    const err = await r.text();
    console.error('[historial] DB error:', r.status, err);
    return res.status(502).json({ error: 'Error al cargar historial' });
  }

  const orders = await r.json();
  return res.status(200).json({ orders: Array.isArray(orders) ? orders : [] });
}
