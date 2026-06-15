// api/_rate-limit.js — Persistent rate limiter via Supabase
// Works across all serverless instances (no in-memory Map)
const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * Check rate limit using Supabase RPC (atomic, persistent)
 * @param {string} key - Unique key (e.g., 'register:192.168.1.1')
 * @param {number} windowSeconds - Time window in seconds (default: 60)
 * @param {number} maxRequests - Max requests per window (default: 10)
 * @param {{failClosed?: boolean}} [opts] - SECURITY (A2): endpoints sensibles
 *   (OTP, registro, pagos) deben pasar failClosed:true. Si el limiter no puede
 *   funcionar (DB caída / mal configurada), fail-open dejaría pasar fuerza bruta
 *   sin límite. failClosed:true deniega ante el fallo (el usuario reintenta).
 * @returns {Promise<boolean>} true if allowed, false if rate limited
 */
export async function checkRateLimit(key, windowSeconds = 60, maxRequests = 10, opts = {}) {
  const onFail = opts.failClosed ? false : true; // fail-closed deniega; fail-open permite
  if (!SB_URL || !SB_SVC) return onFail; // sin DB
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/check_rate_limit', {
      method: 'POST',
      headers: {
        apikey: SB_SVC,
        Authorization: 'Bearer ' + SB_SVC,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: key,
        p_window_seconds: windowSeconds,
        p_max_requests: maxRequests,
      }),
    });
    if (!r.ok) return onFail; // error de DB
    const allowed = await r.json();
    return allowed === true;
  } catch {
    return onFail; // error de red
  }
}
