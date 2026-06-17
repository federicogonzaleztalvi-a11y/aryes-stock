// api/maint.js — TEMPORARY maintenance endpoint. Cleanup of test order.
// Gated by MAINT_SECRET (timing-safe). REMOVE this file after running.
import crypto from 'crypto';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_ORDER_ID = 'f48fd4a3-f298-43be-a67b-be7e8a96cf5d';

function safeEq(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function del(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, Prefer: 'return=representation' },
  });
  const t = await r.text();
  let n = null; try { n = JSON.parse(t).length; } catch { /* */ }
  return { status: r.status, deleted: n };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.MAINT_SECRET;
  const given  = req.headers['x-maint'] || '';
  if (!secret || !safeEq(given, secret)) return res.status(401).json({ error: 'unauthorized' });
  if (!SB_URL || !SB_SVC) return res.status(500).json({ error: 'misconfigured' });

  const resv  = await del(`stock_reservations?reference_id=eq.${TEST_ORDER_ID}`);
  const order = await del(`b2b_orders?cliente_nombre=eq.ZZZ_TEST_DELETE`);
  return res.status(200).json({ ok: true, reservations: resv, orders: order });
}
