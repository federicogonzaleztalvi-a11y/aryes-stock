// api/maint.js — TEMPORARY debug endpoint. Replays the pedido RPC call exactly
// like api/pedido.js (service-role key) with the REAL org/client/product and the
// portal's exact item shape, to surface the real error behind the 502.
// Cleans up any order/reservation it creates. Gated by MAINT_SECRET. REMOVE after.
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
  const out = { keyUsed: SB_SVC ? 'svc' : 'anon' };

  // 1. Fetch a real client for the org and inspect its id format.
  const cliRes = await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&select=id,name&limit=1`, { headers: H });
  const clients = await cliRes.json().catch(() => []);
  const cli = clients?.[0];
  out.clientFetchStatus = cliRes.status;
  out.clientId = cli?.id ?? null;
  out.clientIdType = cli ? typeof cli.id : null;

  // 2. Fetch a real product uuid.
  const prRes = await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${ORG}&select=uuid,name&limit=1`, { headers: H });
  const prods = await prRes.json().catch(() => []);
  const pid = prods?.[0]?.uuid;
  out.productId = pid ?? null;

  if (!cli || !pid) return res.status(200).json(out);

  // 3. Replay the RPC exactly as the portal -> pedido.js does (item field: cantidad).
  const orderId = rnd();
  const idk = 'dbgreal-' + rnd();
  const body = JSON.stringify({
    p_order_id: orderId, p_org_id: ORG, p_cliente_id: cli.id,
    p_cliente_nombre: 'DBG_REAL_DELETE', p_cliente_tel: '0',
    p_items: [{ productId: pid, nombre: prods[0].name, unidad: 'un', cantidad: 1, precioUnit: 1, subtotal: 1 }],
    p_total: 1, p_notas: 'dbg', p_idempotency_key: idk, p_ttl_hours: 1,
  });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, { method: 'POST', headers: Hj, body });
  out.rpcStatus = r.status;
  out.rpcBody = (await r.text()).slice(0, 600);

  // 4. Cleanup anything created.
  await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}`, { method: 'DELETE', headers: H });
  await fetch(`${SB_URL}/rest/v1/b2b_orders?cliente_nombre=eq.DBG_REAL_DELETE`, { method: 'DELETE', headers: H });

  return res.status(200).json(out);
}
