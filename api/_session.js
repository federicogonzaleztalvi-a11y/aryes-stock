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

// Sesión deslizante (patrón Amazon/Mercado Libre): la sesión dura 90 días, pero
// cada vez que el cliente usa el portal con sesión válida se la RENUEVA a 90 días
// desde hoy. Así un cliente activo NUNCA tiene que re-loguearse por OTP; el OTP
// sólo reaparece tras ~3 meses sin abrir la app, o en un dispositivo nuevo.
// Para no escribir en cada request, sólo renovamos cuando quedan menos de
// RENEW_WHEN_LEFT_MS de vida (≈ un write por cliente por mes, no por pedido).
const SESSION_TTL_MS     = 90 * 24 * 60 * 60 * 1000;   // 90 días (igual que otp-verify)
const RENEW_WHEN_LEFT_MS = 60 * 24 * 60 * 60 * 1000;   // renovar si quedan < 60 días

export function getBearerToken(req) {
  const authH = req.headers['authorization'] || req.headers['Authorization'] || '';
  return authH.startsWith('Bearer ') ? authH.slice(7).trim() : null;
}

// Extiende expires_at a +90 días. Best-effort: si falla, la sesión sigue siendo
// válida igual (sólo pierde la renovación de esta pasada), nunca rompe el login.
async function renewSession(token, key) {
  const nuevoExpira = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  try {
    await fetch(
      `${SB_URL}/rest/v1/portal_sessions?token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ expires_at: nuevoExpira }),
      }
    );
    return nuevoExpira;  // el caller lo devuelve al cliente para que deslice su copia local
  } catch { return null; /* best-effort; la sesión actual sigue válida igual */ }
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
    `&select=token,cliente_id,org_id,tel,expires_at,via_vendedor,vendedor_nombre` +
    `&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  const session = rows?.[0] || null;

  // Sesión deslizante: si a esta sesión le quedan pocos días, renovarla a +90d y
  // reflejar la fecha nueva en el objeto que devolvemos (así el endpoint puede
  // mandársela al cliente y éste desliza también su copia local → nunca se purga
  // una sesión que el server mantiene viva).
  if (session?.expires_at) {
    const msLeft = new Date(session.expires_at).getTime() - Date.now();
    if (msLeft < RENEW_WHEN_LEFT_MS) {
      const renewed = await renewSession(token, key);
      if (renewed) session.expires_at = renewed;
    }
  }

  return session;
}
