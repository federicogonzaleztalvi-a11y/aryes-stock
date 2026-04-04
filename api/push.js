// api/push.js — Web Push Notifications endpoint
const ALLOWED_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';
// POST /api/push?action=subscribe  → save subscription
// POST /api/push?action=send       → send push to org (admin only)
// GET  /api/push?action=vapid-key  → return public VAPID key

import webpush from 'web-push';
import { log } from './_log.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_KEY || SB_ANON;

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hola@aryes.com.uy';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function setCORS(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || 'vapid-key';

  // GET public VAPID key — needed by client to subscribe
  if (action === 'vapid-key') {
    if (!VAPID_PUBLIC) return res.status(503).json({ error: 'Push not configured' });
    return res.status(200).json({ publicKey: VAPID_PUBLIC });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    log.warn('push', 'VAPID keys not configured');
    return res.status(503).json({ error: 'Push not configured' });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // POST /api/push?action=subscribe — save push subscription from browser
  if (action === 'subscribe' && req.method === 'POST') {
    const { subscription, orgId, role } = req.body || {};
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    // Save to Supabase push_subscriptions table
    const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions`, {
      method:  'POST',
      headers: {
        apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id:           subscription.endpoint.slice(-40), // stable ID from endpoint
        org_id:       orgId,
        role:         role || 'admin',
        endpoint:     subscription.endpoint,
        p256dh:       subscription.keys?.p256dh,
        auth:         subscription.keys?.auth,
        updated_at:   new Date().toISOString(),
      }),
    });

    if (!r.ok && r.status !== 409) {
      log.error('push', 'subscribe failed', { status: r.status });
      return res.status(502).json({ error: 'Failed to save subscription' });
    }

    log.info('push', 'subscribed', { orgId, role });
    return res.status(200).json({ ok: true });
  }

  // POST /api/push?action=send — send push notification to all org subscribers
  if (action === 'send' && req.method === 'POST') {
    const { orgId, title, body, url, tag, urgent } = req.body || {};
    if (!orgId || !body) return res.status(400).json({ error: 'orgId and body required' });

    // Get all subscriptions for this org
    const r = await fetch(
      `${SB_URL}/rest/v1/push_subscriptions?org_id=eq.${encodeURIComponent(orgId)}&limit=50`,
      { headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(502).json({ error: 'Failed to fetch subscriptions' });

    const subs = await r.json();
    if (!Array.isArray(subs) || !subs.length) {
      return res.status(200).json({ ok: true, sent: 0, msg: 'No subscribers' });
    }

    const payload = JSON.stringify({ title: title || 'Aryes Stock', body, url, tag, urgent });
    let sent = 0, failed = 0;

    await Promise.allSettled(subs.map(async sub => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload);
        sent++;
      } catch (err) {
        failed++;
        // If 410 Gone — subscription expired, delete it
        if (err.statusCode === 410) {
          await fetch(
            `${SB_URL}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
            { method: 'DELETE', headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}` } }
          ).catch(() => {});
        }
        log.warn('push', 'send failed', { endpoint: sub.endpoint?.slice(-20), status: err.statusCode });
      }
    }));

    log.info('push', 'sent', { orgId, sent, failed });
    return res.status(200).json({ ok: true, sent, failed });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
