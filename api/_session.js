// Shared portal-session validation for B2B portal endpoints.
// A valid session is a non-expired, non-revoked row in public.portal_sessions.
// Returns the session row { token, cliente_id, org_id, tel, ... } or null.
//
// SECURITY: callers MUST derive org_id and cliente_id from the returned session,
// never from the query string or request body. This prevents IDOR / cross-tenant
// access where an attacker passes ?cliente=<other-uuid> or org=<other-org>.

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getBearerToken(req) {
  const authH = req.headers['authorization'] || req.headers['Authorization'] || '';
  return authH.startsWith('Bearer ') ? authH.slice(7).trim() : null;
}

export async function validatePortalSession(token) {
  if (!token || typeof token !== 'string') return null;
  const key = SB_SVC || SB_ANON;
  if (!SB_URL || !key) return null;

  const r = await fetch(
    `${SB_URL}/rest/v1/portal_sessions` +
    `?token=eq.${encodeURIComponent(token)}` +
    `&expires_at=gte.${new Date().toISOString()}` +
    `&revoked=eq.false` +
    `&select=token,cliente_id,org_id,tel,expires_at` +
    `&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] || null;
}
