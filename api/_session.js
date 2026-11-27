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
  // Vía RPC SECURITY DEFINER (anon no puede UPDATE portal_sessions). Devuelve la
  // nueva fecha para que el caller la pase al cliente (desliza su copia local).
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/portal_renew_session`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) return null;
    const out = await r.json().catch(() => null);  // la RPC devuelve el timestamptz
    return out || null;
  } catch { return null; /* best-effort; la sesión actual sigue válida igual */ }
}

export async function validatePortalSession(token) {
  if (!token || typeof token !== 'string') return null;
  // Usamos la ANON key (pública, siempre válida) para las RPCs del portal, NO la
  // service-role: estas funciones son SECURITY DEFINER (corren con permisos del
  // dueño y validan el token adentro), así que no necesitan service-role. Además,
  // si el valor de SUPABASE_SERVICE_ROLE_KEY está roto/rechazado por el gateway,
  // `SB_SVC || SB_ANON` tomaba el valor roto y TODA llamada fallaba → el portal
  // depende sólo de la anon key, que es pública y estable.
  const key = SB_ANON;
  if (!SB_URL || !key) return null;

  // Validamos vía RPC SECURITY DEFINER `portal_validate_session` en vez de leer
  // portal_sessions directo. Motivo: la lectura directa corre con el rol de la
  // clave y, si el service-role no surte efecto, cae a `anon` → RLS bloquea la
  // lectura de portal_sessions → la validación fallaba para TODOS (login no
  // persistía, "Mis pedidos" daba 401). La RPC corre con permisos del dueño y
  // valida el token adentro → el portal NO depende de la service-role key.
  const r = await fetch(
    `${SB_URL}/rest/v1/rpc/portal_validate_session`,
    {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_token: token }),
    }
  );
  if (!r.ok) {
    let body = ''; try { body = (await r.text()).slice(0, 200); } catch { body = '(sin cuerpo)'; }
    console.error('[session-diag] rpc !ok status=' + r.status + ' tok=' + (token ? token.slice(0, 8) : 'none') + ' body=' + body);
    return null;
  }
  const rows = await r.json();
  const session = Array.isArray(rows) ? (rows[0] || null) : (rows || null);
  if (!session) {
    console.warn('[session-diag] rpc ok pero SIN sesión · tok=' + (token ? token.slice(0, 8) : 'none') + ' rows=' + JSON.stringify(rows).slice(0, 120));
  }

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
