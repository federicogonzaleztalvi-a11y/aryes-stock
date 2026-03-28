// api/reservations-cleanup.js
// Cron job: expire stale stock reservations
// Called by Vercel Cron every hour
// Also callable manually: GET /api/reservations-cleanup (admin only)

import { log } from './_log.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // Allow GET (Vercel Cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SB_URL || !SB_SVC) {
    return res.status(500).json({ error: 'Misconfigured' });
  }

  // Verify Cron secret or admin token
  const authHeader = req.headers.authorization || '';
  const cronSecret = req.headers['x-vercel-cron'] || '';

  // Allow if: Vercel Cron header present, or Bearer matches CRON_SECRET, or service key
  const isAuthorized =
    cronSecret === process.env.CRON_SECRET ||
    authHeader === 'Bearer ' + process.env.CRON_SECRET ||
    authHeader === 'Bearer ' + SB_SVC;

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Call the Postgres RPC that expires stale reservations
    const r = await fetch(`${SB_URL}/rest/v1/rpc/expire_stale_reservations`, {
      method:  'POST',
      headers: {
        apikey:          SB_SVC,
        Authorization:  `Bearer ${SB_SVC}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!r.ok) {
      const err = await r.text();
      log.error('reservations-cleanup', 'RPC failed', { status: r.status, err });
      return res.status(500).json({ error: 'RPC failed', detail: err });
    }

    const result = await r.json();
    log.info('reservations-cleanup', 'expired reservations', result);

    return res.status(200).json({
      ok:      true,
      expired: result.expired || 0,
      ts:      new Date().toISOString(),
    });

  } catch (e) {
    log.error('reservations-cleanup', 'unexpected error', { error: e.message });
    return res.status(500).json({ error: e.message });
  }
}
