// api/maint.js — TEMPORARY debug endpoint. Replays the pedido RPC call exactly
// like api/pedido.js (service-role key) and returns the RAW upstream response,
// so we can see the real error behind the production 502.
// Side-effect-free: uses a fake org -> product_not_found -> full rollback.
// Gated by MAINT_SECRET (timing-safe). REMOVE this file after running.
import crypto from 'crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

function safeEq(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.MAINT_SECRET;
  const given  = req.headers['x-maint'] || '';
  if (!secret || !safeEq(given, secret)) return res.status(401).json({ error: 'unauthorized' });

  const keyUsed = SB_SVC ? 'svc' : 'anon';
  const key = SB_SVC || SB_ANON;
  const rpcHeaders = {
    apikey: key, Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json', Accept: 'application/json',
  };
  const rnd = () => crypto.randomUUID();

  // Replay with a FAKE org so the product lock fails -> product_not_found -> rollback.
  const body = JSON.stringify({
    p_order_id: rnd(), p_org_id: '__dbg_fake_org__', p_cliente_id: rnd(),
    p_cliente_nombre: 'DBG', p_cliente_tel: '0',
    p_items: [{ productId: rnd(), cantidad: 1, qty: 1 }],
    p_total: 0, p_notas: '', p_idempotency_key: null, p_ttl_hours: 1,
  });

  let out = { keyUsed, svcLen: (SB_SVC || '').length, anonLen: (SB_ANON || '').length };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, {
      method: 'POST', headers: rpcHeaders, body,
    });
    out.status = r.status;
    out.rawBody = (await r.text()).slice(0, 600);
  } catch (e) {
    out.threw = e.message;
  }
  return res.status(200).json(out);
}
