// api/maint.js — TEMPORARY maintenance endpoint. Scans all clients in the org
// for non-UUID ids (which break the UUID-typed order RPC → 502). Reports the
// affected rows. Also confirms the org notify email. Gated by MAINT_SECRET.
// REMOVE after.
import crypto from 'crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const ORG = 'aryes-ltda-6223';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const clients = await (await fetch(`${SB_URL}/rest/v1/clients?org_id=eq.${ORG}&select=id,name,phone,lista_id&order=created_at.asc`, { headers: H })).json();
  const bad = (clients || []).filter(c => !UUID_RE.test(c.id || ''));

  const org = (await (await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${ORG}&select=order_notify_email`, { headers: H })).json())?.[0];

  return res.status(200).json({
    total_clients: clients?.length ?? 0,
    non_uuid_count: bad.length,
    non_uuid_clients: bad,
    order_notify_email: org?.order_notify_email || null,
  });
}
