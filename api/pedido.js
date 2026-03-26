// api/pedido.js — Recibe pedidos del portal B2B y los guarda en orders table
// El WMS admin los ve en VentasTab como ventas pendientes de importar

const SB_URL  = process.env.SUPABASE_URL     || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_ANON)                return res.status(500).json({ error: 'Server misconfigured' });

  const {
    org             = 'aryes',
    clienteId       = null,
    clienteNombre,
    clienteTelefono = null,
    items           = [],
    total           = 0,
    notas           = '',
  } = req.body || {};

  if (!clienteNombre || !items.length) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const order = {
    org_id:         org,
    cliente_id:     clienteId  || null,
    cliente_nombre: clienteNombre,
    cliente_tel:    clienteTelefono || '',
    items,
    total:          Number(total) || 0,
    moneda:         'USD',
    notas:          notas || '',
    estado:         'pendiente',
  };

  const r = await fetch(`${SB_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      apikey:          SB_ANON,
      Authorization:   `Bearer ${SB_ANON}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify(order),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('[pedido] Supabase error:', r.status, err);
    return res.status(502).json({ error: 'Error al guardar el pedido' });
  }

  const saved = await r.json();
  return res.status(200).json({ ok: true, orderId: saved?.[0]?.id });
}
