// api/maint.js — TEMPORARY debug endpoint. Reproduces realistic portal carts
// against the DEPLOYED RPC to capture the FULL rawBody behind the 502 at line
// 342 of api/pedido.js. Tests: multi-item cart, and the double-submit (same
// idempotency key twice) path. Cleans up. Gated by MAINT_SECRET. REMOVE after.
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

  const cli = (await (await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&select=id&limit=1`, { headers: H })).json())?.[0];
  const prs = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name,precio_venta,stock&limit=5`, { headers: H })).json();
  if (!cli || !prs?.length) return res.status(200).json({ err: 'no client/products', cli, prs });

  // Build a realistic portal-shaped cart (multiple items, integer qty)
  const portalItems = prs.map((p, i) => ({
    productId: p.uuid, nombre: p.name, unidad: 'un',
    cantidad: i + 1, precioUnit: Number(p.precio_venta) || 0,
    subtotal: (Number(p.precio_venta) || 0) * (i + 1),
  }));
  const total = portalItems.reduce((s, it) => s + it.subtotal, 0);

  async function callRpc(items, idemKey) {
    const orderId = rnd();
    const body = JSON.stringify({
      p_order_id: orderId, p_org_id: ORG, p_cliente_id: cli.id,
      p_cliente_nombre: 'DBG_DELETE', p_cliente_tel: '0',
      p_items: items, p_total: total, p_notas: 'dbg', p_idempotency_key: idemKey, p_ttl_hours: 6,
    });
    const r = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, { method: 'POST', headers: Hj, body });
    const status = r.status;
    const fullBody = await r.text();
    return { orderId, status, body: fullBody };
  }

  async function cleanup(orderId) {
    await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}`, { method: 'DELETE', headers: H });
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, { method: 'DELETE', headers: H });
  }

  const out = { products: prs.length, total };

  // A) realistic multi-item cart
  const a = await callRpc(portalItems, 'dbg-multi-' + rnd());
  out.A_multi = { status: a.status, body: a.body };
  await cleanup(a.orderId);

  // B) double-submit with the SAME idempotency key (portal's stable key on retry)
  const sharedKey = 'dbg-idem-' + rnd();
  const b1 = await callRpc(portalItems, sharedKey);
  const b2 = await callRpc(portalItems, sharedKey); // second hit — should return idempotent, not raise
  out.B_idem_first  = { status: b1.status, body: b1.body };
  out.B_idem_second = { status: b2.status, body: b2.body };
  await cleanup(b1.orderId);
  await cleanup(b2.orderId);

  return res.status(200).json(out);
}
