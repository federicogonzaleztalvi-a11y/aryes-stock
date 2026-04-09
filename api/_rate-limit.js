// api/_rate-limit.js — Persistent rate limiter via Supabase
// Works across all serverless instances (no in-memory Map)
const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * Check rate limit using Supabase RPC (atomic, persistent)
 * @param {string} key - Unique key (e.g., 'register:192.168.1.1')
 * @param {number} windowSeconds - Time window in seconds (default: 60)
 * @param {number} maxRequests - Max requests per window (default: 10)
 * @returns {Promise<boolean>} true if allowed, false if rate limited
 */
export async function checkRateLimit(key, windowSeconds = 60, maxRequests = 10) {
  if (!SB_URL || !SB_SVC) return true; // fail open if no DB
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
    if (!r.ok) return true; // fail open on DB error
    const allowed = await r.json();
    return allowed === true;
  } catch {
    return true; // fail open on network error
  }
}
