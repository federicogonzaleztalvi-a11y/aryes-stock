// api/_maint.js — TEMPORARY one-shot maintenance endpoint.
// Sets default high stock for Eric (aryes-ltda-6223) so the order RPC stops
// gating on stock=0. No parameters — performs exactly one fixed update.
// Gated by MAINT_SECRET (timing-safe). REMOVE this file after running.
import crypto from 'crypto';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  if (!SB_URL || !SB_SVC) return res.status(500).json({ error: 'misconfigured' });

  const url = `${SB_URL}/rest/v1/products?org_id=eq.aryes-ltda-6223&stock=eq.0`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SB_SVC,
      Authorization: `Bearer ${SB_SVC}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ stock: 99999 }),
  });
  const text = await r.text();
  let count = null;
  try { count = JSON.parse(text).length; } catch { /* */ }
  return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, updated: count, body: text.slice(0, 300) });
}
