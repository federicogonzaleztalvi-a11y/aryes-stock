// api/maint.js — TEMPORARY debug endpoint. Pinpoints the deterministic 502 by
// running the RPC with Eric's REAL client (from his latest portal session) vs a
// generic client, and returns the FULL Postgres rawBody. Gated by MAINT_SECRET.
// REMOVE after.
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

  // Eric's REAL client: most recent portal session for this org
  const sess = (await (await fetch(`${SB_URL}/rest/v1/portal_sessions?org_id=eq.${ORG}&order=expires_at.desc&select=cliente_id,tel,expires_at&limit=1`, { headers: H })).json())?.[0];
  // Generic client (what my earlier repro used)
  const genCli = (await (await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&select=id&limit=1`, { headers: H })).json())?.[0];
  const prs = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name,precio_venta&limit=3`, { headers: H })).json();
  if (!prs?.length) return res.status(200).json({ err: 'no products' });

  const items = prs.map((p, i) => ({
    productId: p.uuid, nombre: p.name, unidad: 'un',
    cantidad: i + 1, precioUnit: Number(p.precio_venta) || 0,
    subtotal: (Number(p.precio_venta) || 0) * (i + 1),
  }));
  const total = items.reduce((s, it) => s + it.subtotal, 0);

  async function callRpc(clienteId, tel) {
    if (!clienteId) return { skipped: 'no client id' };
    const orderId = rnd();
    const body = JSON.stringify({
      p_order_id: orderId, p_org_id: ORG, p_cliente_id: clienteId,
      p_cliente_nombre: 'DBG_DELETE', p_cliente_tel: tel || '0',
      p_items: items, p_total: total, p_notas: 'dbg', p_idempotency_key: 'dbg-' + rnd(), p_ttl_hours: 6,
    });
    const r = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, { method: 'POST', headers: Hj, body });
    const status = r.status;
    const raw = await r.text();
    // cleanup
    await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}`, { method: 'DELETE', headers: H });
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, { method: 'DELETE', headers: H });
    return { clienteId, status, raw };
  }

  return res.status(200).json({
    real_session_cliente_id: sess?.cliente_id || null,
    real_session_tel: sess?.tel || null,
    generic_cliente_id: genCli?.id || null,
    same_client: sess?.cliente_id === genCli?.id,
    REAL:    await callRpc(sess?.cliente_id, sess?.tel),
    GENERIC: await callRpc(genCli?.id, '0'),
  });
}
