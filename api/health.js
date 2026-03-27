/**
 * api/health.js — Health check endpoint.
 *
 * GET /api/health
 * Returns 200 if Supabase is reachable, 503 otherwise.
 * No auth required — safe to call from monitoring tools.
 *
 * Response shape:
 *   { ok: true, db: 'ok'|'error', latencyMs: number, ts: string }
 */
import { log } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const ts    = new Date().toISOString();
  const start = Date.now();

  // Check 1: env vars present
  if (!SB_URL || !SB_ANON) {
    log.fatal('health', 'missing env vars', { hasSbUrl: !!SB_URL, hasSbAnon: !!SB_ANON });
    return res.status(503).json({ ok: false, db: 'misconfigured', ts });
  }

  // Check 2: Supabase reachable (lightweight query — count 0 rows from b2b_orders)
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?limit=0`,
      {
        headers: {
          apikey:        SB_ANON,
          Authorization: `Bearer ${SB_ANON}`,
          Accept:        'application/json',
          Prefer:        'count=exact',
          Range:         '0-0',
        },
        signal: AbortSignal.timeout(4000), // 4s timeout
      }
    );

    const latencyMs = Date.now() - start;

    if (!r.ok && r.status !== 206) {
      log.error('health', 'db unreachable', { status: r.status, latencyMs });
      return res.status(503).json({ ok: false, db: 'error', latencyMs, ts });
    }

    log.info('health', 'ok', { latencyMs });
    return res.status(200).json({
      ok:        true,
      db:        'ok',
      latencyMs,
      ts,
      version:   process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'local',
    });

  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    log.error('health', isTimeout ? 'db timeout' : 'db error', {
      latencyMs, error: err.message
    });
    return res.status(503).json({
      ok:        false,
      db:        isTimeout ? 'timeout' : 'error',
      latencyMs,
      ts,
    });
  }
}
