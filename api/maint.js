// api/maint.js — TEMPORARY debug endpoint. Probes which quantity field the
// DEPLOYED RPC reads, and how it reacts to a non-uuid productId, to pinpoint
// the 502. Cleans up. Gated by MAINT_SECRET. REMOVE after.
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
  const pr  = (await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name&limit=1`, { headers: H })).json())?.[0];
  if (!cli || !pr) return res.status(200).json({ err: 'no client/product', cli, pr });

  async function runVariant(label, item) {
    const orderId = rnd();
    const body = JSON.stringify({
      p_order_id: orderId, p_org_id: ORG, p_cliente_id: cli.id,
      p_cliente_nombre: 'DBG_DELETE', p_cliente_tel: '0',
      p_items: [item], p_total: 1, p_notas: 'dbg', p_idempotency_key: 'dbg-' + rnd(), p_ttl_hours: 1,
    });
    const r = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, { method: 'POST', headers: Hj, body });
    const status = r.status; const txt = (await r.text()).slice(0, 300);
    let resvCount = null;
    const rv = await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}&select=quantity`, { headers: H });
    if (rv.ok) resvCount = (await rv.json()).length;
    // cleanup
    await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}`, { method: 'DELETE', headers: H });
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, { method: 'DELETE', headers: H });
    return { label, status, resvCount, body: txt };
  }

  const out = {};
  out.A_cantidad = await runVariant('cantidad', { productId: pr.uuid, cantidad: 2 });
  out.B_qty      = await runVariant('qty',      { productId: pr.uuid, qty: 2 });
  out.C_baduuid  = await runVariant('baduuid',  { productId: 'p1', qty: 2 });
  out.D_both     = await runVariant('both',     { productId: pr.uuid, cantidad: 2, qty: 2 });
  return res.status(200).json(out);
}
