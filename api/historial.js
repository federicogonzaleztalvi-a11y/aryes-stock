// api/historial.js — Historial de pedidos del cliente por teléfono
// Llamado desde PedidosPage cuando el cliente abre "Mis pedidos"
// No requiere auth — el teléfono ya fue verificado via OTP en el browser

import { log, withObservability } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  // Hard fail — nunca usar anon key como fallback de service key
  if (!SB_URL || !SB_ANON) {
    log.fatal('historial', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  const { tel, org = 'aryes' } = req.query || {};
  if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });

  const telClean = tel.replace(/\D/g, '');
  if (telClean.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

  // Buscar pedidos en b2b_orders — últimos 20, más recientes primero
  const r = await fetch(
    `${SB_URL}/rest/v1/b2b_orders?cliente_tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&order=creado_en.desc&limit=20`,
    { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
  );

  if (!r.ok) {
    const err = await r.text();
    log.error('historial', 'db error', { status: r.status, org, body: err.substring(0, 200) });
    return res.status(502).json({ error: 'Error al cargar historial' });
  }

  const orders = await r.json();
  log.info('historial', 'ok', { count: orders.length, org });
  return res.status(200).json({ orders: Array.isArray(orders) ? orders : [] });
}

export default withObservability('historial', handler);
