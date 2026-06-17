// api/maint.js — TEMPORARY maintenance endpoint. Final end-to-end proof: mints a
// portal session for Federico's (now-UUID) client and POSTs a real cart to the
// live /api/pedido, exercising the full flow (auth → RPC → notify email). Cleans
// up the order + session. Gated by MAINT_SECRET. REMOVE after.
import crypto from 'crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const ORG = 'aryes-ltda-6223';

function safeEq(a, b) {
  const ab = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.MAINT_SECRET;
  if (!secret || !safeEq(req.headers['x-maint'] || '', secret)) return res.status(401).json({ error: 'unauthorized' });

  const key = SB_SVC || SB_ANON;
  const H = { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' };
  const Hj = { ...H, 'Content-Type': 'application/json' };
  const rnd = () => crypto.randomUUID();

  // Federico's migrated client (by phone)
  const cli = (await (await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&phone=eq.94244655&select=id,name&limit=1`, { headers: H })).json())?.[0];
  const prs = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name,precio_venta&limit=2`, { headers: H })).json();
  if (!cli || !prs?.length) return res.status(200).json({ err: 'no client/products', cli, prs });

  const token = 'dbg-' + rnd();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
    method: 'POST', headers: Hj,
    body: JSON.stringify({ token, cliente_id: cli.id, org_id: ORG, tel: '94244655', expires_at: expires, revoked: false }),
  });

  const items = prs.map((p, i) => ({
    productId: p.uuid, nombre: p.name, unidad: 'un',
    cantidad: i + 1, precioUnit: Number(p.precio_venta) || 0,
    subtotal: (Number(p.precio_venta) || 0) * (i + 1),
  }));
  const total = items.reduce((s, it) => s + it.subtotal, 0);

  let liveStatus = null, liveBody = '';
  try {
    const r = await fetch('https://pazque.com/api/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        org: ORG, clienteId: cli.id, clienteNombre: cli.name || 'Federico',
        clienteTelefono: '94244655', items, total,
        notas: 'PRUEBA FINAL - IGNORAR', idempotencyKey: 'dbg-final-' + rnd(),
      }),
    });
    liveStatus = r.status;
    liveBody = (await r.text()).slice(0, 400);
  } catch (e) { liveBody = 'THROW: ' + e.message; }

  let createdOrderId = null;
  try { createdOrderId = JSON.parse(liveBody)?.orderId || null; } catch { /* non-JSON */ }
  if (createdOrderId) {
    await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${createdOrderId}`, { method: 'DELETE', headers: H });
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${createdOrderId}`, { method: 'DELETE', headers: H });
  }
  await fetch(`${SB_URL}/rest/v1/portal_sessions?token=eq.${token}`, { method: 'DELETE', headers: H });

  return res.status(200).json({
    client: cli, items: items.length, total,
    live: { status: liveStatus, body: liveBody },
    cleaned_order: createdOrderId,
  });
}
