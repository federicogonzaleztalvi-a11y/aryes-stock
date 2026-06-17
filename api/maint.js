// api/maint.js — TEMPORARY debug endpoint. Reproduces the FULL live /api/pedido
// HTTP path (auth → anomaly → RPC → push/email) by minting a real portal session
// for Eric and POSTing a realistic cart to https://pazque.com/api/pedido, to
// capture whatever produces the 502. Cleans up session + order. Gated by
// MAINT_SECRET. REMOVE after.
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

  const cli = (await (await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&select=id,name,lista_id&limit=1`, { headers: H })).json())?.[0];
  const prs = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name,precio_venta&limit=3`, { headers: H })).json();
  if (!cli || !prs?.length) return res.status(200).json({ err: 'no client/products', cli, prs });

  // Report whether a real email would fire (side-effect awareness)
  const orgRow = (await (await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${ORG}&select=order_notify_email,name`, { headers: H })).json())?.[0] || {};

  // Mint a short-lived portal session for Eric's client
  const token = 'dbg-' + rnd();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const mintRes = await fetch(`${SB_URL}/rest/v1/portal_sessions`, {
    method: 'POST', headers: { ...Hj, Prefer: 'return=representation' },
    body: JSON.stringify({ token, cliente_id: cli.id, org_id: ORG, tel: '0', expires_at: expires, revoked: false }),
  });
  const mintTxt = await mintRes.text();
  if (!mintRes.ok) return res.status(200).json({ step: 'mint_session', status: mintRes.status, body: mintTxt.slice(0, 500) });

  // Realistic portal-shaped cart
  const items = prs.map((p, i) => ({
    productId: p.uuid, nombre: p.name, unidad: 'un',
    cantidad: i + 1, precioUnit: Number(p.precio_venta) || 0,
    subtotal: (Number(p.precio_venta) || 0) * (i + 1),
  }));
  const total = items.reduce((s, it) => s + it.subtotal, 0);

  // POST to the LIVE endpoint — exercises the entire pedido.js handler
  let liveStatus = null, liveBody = '';
  try {
    const r = await fetch('https://pazque.com/api/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        org: ORG, clienteId: cli.id, clienteNombre: 'PRUEBA SISTEMA - IGNORAR',
        clienteTelefono: '0', items, total,
        notas: 'PRUEBA AUTOMATICA - IGNORAR', idempotencyKey: 'dbg-live-' + rnd(),
      }),
    });
    liveStatus = r.status;
    liveBody = (await r.text()).slice(0, 800);
  } catch (e) {
    liveBody = 'THROW: ' + e.message;
  }

  // Cleanup: delete any order created + the session
  let createdOrderId = null;
  try { createdOrderId = JSON.parse(liveBody)?.orderId || null; } catch { /* non-JSON body */ }
  if (createdOrderId) {
    await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${createdOrderId}`, { method: 'DELETE', headers: H });
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${createdOrderId}`, { method: 'DELETE', headers: H });
  }
  await fetch(`${SB_URL}/rest/v1/portal_sessions?token=eq.${token}`, { method: 'DELETE', headers: H });

  return res.status(200).json({
    notify_email: orgRow.order_notify_email || null,
    items: items.length, total,
    live: { status: liveStatus, body: liveBody },
    cleaned_order: createdOrderId,
  });
}
