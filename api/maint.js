// api/maint.js — TEMPORARY maintenance endpoint. (1) Migrates the test client
// "federico-test" (non-UUID clients.id, which breaks the UUID-typed order RPC)
// to a real UUID, re-pointing its portal sessions. (2) Updates the org's order
// notification email. Reports every step. Gated by MAINT_SECRET. REMOVE after.
import crypto from 'crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const ORG = 'aryes-ltda-6223';
const OLD_CID = 'federico-test';
const NEW_NOTIFY_EMAIL = 'federicogonzalez@aryes.com.uy';

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
  const steps = {};

  async function patch(path, body, prefer = 'return=representation') {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      method: 'PATCH', headers: { ...Hj, Prefer: prefer }, body: JSON.stringify(body),
    });
    return { status: r.status, body: (await r.text()).slice(0, 400) };
  }

  // ── Part 1: change the org notification email ──────────────────────────────
  steps.email = await patch(`organizations?id=eq.${ORG}`, { order_notify_email: NEW_NOTIFY_EMAIL });

  // ── Part 2: migrate federico-test → UUID ───────────────────────────────────
  const existing = (await (await fetch(`${SB_URL}/rest/v1/clients?id=eq.${OLD_CID}&select=*`, { headers: H })).json())?.[0];
  if (!existing) {
    steps.migrate = { skipped: 'no federico-test client row found' };
  } else {
    const newUuid = rnd();
    // Try the simplest path first: directly update the PK in place.
    steps.clients_pk = await patch(`clients?id=eq.${OLD_CID}`, { id: newUuid });
    if (steps.clients_pk.status >= 200 && steps.clients_pk.status < 300) {
      steps.sessions   = await patch(`portal_sessions?cliente_id=eq.${OLD_CID}`, { cliente_id: newUuid }, 'return=minimal');
      steps.new_uuid   = newUuid;
      // Verify the order RPC now accepts the migrated client
      const orderId = rnd();
      const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`, {
        method: 'POST', headers: Hj,
        body: JSON.stringify({
          p_order_id: orderId, p_org_id: ORG, p_cliente_id: newUuid,
          p_cliente_nombre: 'DBG_DELETE', p_cliente_tel: '0',
          p_items: [{ productId: null }], p_total: 0, p_notas: 'dbg',
          p_idempotency_key: 'dbg-' + rnd(), p_ttl_hours: 1,
        }),
      });
      steps.rpc_verify = { status: rpcRes.status, body: (await rpcRes.text()).slice(0, 300) };
      await fetch(`${SB_URL}/rest/v1/stock_reservations?reference_id=eq.${orderId}`, { method: 'DELETE', headers: H });
      await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, { method: 'DELETE', headers: H });
    } else {
      steps.migrate = { note: 'direct PK update failed — see clients_pk status/body, will need insert+repoint+delete' };
    }
  }

  return res.status(200).json(steps);
}
