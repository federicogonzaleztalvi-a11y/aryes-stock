// api/stripe-webhook.js — Stripe webhook handler
// Receives events from Stripe and updates organization billing status

import { log } from './_log.js';

const SB_URL         = process.env.SUPABASE_URL;
const SB_SVC         = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts     = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).slice(2);
  const signature = parts.find(p => p.startsWith('v1=')).slice(3);
  const signed    = timestamp + '.' + payload;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (expected !== signature) throw new Error('Invalid Stripe signature');
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) throw new Error('Event too old');
}

async function updateOrg(filter, updates) {
  const query = Object.entries(filter).map(([k,v]) => k+'=eq.'+encodeURIComponent(v)).join('&');
  const r = await fetch(SB_URL+'/rest/v1/organizations?'+query, {
    method: 'PATCH',
    headers: { apikey: SB_SVC, Authorization: 'Bearer '+SB_SVC, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error('Supabase update failed: '+r.status);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!WEBHOOK_SECRET || !SB_SVC) return res.status(500).json({ error: 'Misconfigured' });

  try {
    await verifyStripeSignature(JSON.stringify(req.body), req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (e) {
    log.warn('stripe-webhook', 'signature failed', { error: e.message });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  log.info('stripe-webhook', 'event received', { type: event.type });

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const s = event.data.object;
        const orgId = s.metadata?.org_id;
        if (!orgId) break;
        await updateOrg({ id: orgId }, {
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
          subscription_status: 'active',
          plan_name: s.metadata?.plan || 'pro',
          trial_ends_at: null,
          active: true,
        });
        log.info('stripe-webhook', 'org activated', { orgId });
        break;
      }

      case 'invoice.paid': {
        const inv = event.data.object;
        await updateOrg({ stripe_customer_id: inv.customer }, { subscription_status: 'active', active: true });
        log.info('stripe-webhook', 'invoice paid', { customer: inv.customer });
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        await updateOrg({ stripe_customer_id: inv.customer }, { subscription_status: 'past_due' });
        log.warn('stripe-webhook', 'payment failed', { customer: inv.customer });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateOrg({ stripe_customer_id: sub.customer }, { subscription_status: 'canceled', active: false });
        log.info('stripe-webhook', 'subscription canceled', { customer: sub.customer });
        break;
      }

      default:
        log.info('stripe-webhook', 'unhandled event', { type: event.type });
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    log.error('stripe-webhook', 'handler error', { error: e.message });
    return res.status(500).json({ error: 'Handler error' });
  }
}
