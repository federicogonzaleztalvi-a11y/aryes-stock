// api/stripe.js — Stripe endpoints (checkout + webhook) combined
// POST /api/stripe?action=checkout  → create Stripe Checkout session
// POST /api/stripe?action=webhook   → receive Stripe webhook events

import { log } from './_log.js';

const SB_URL         = process.env.SUPABASE_URL;
const SB_SVC         = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL        = process.env.APP_URL || 'https://aryes-stock.vercel.app';

const PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
};

// ── Shared helpers ────────────────────────────────────────────────

async function stripePost(path, body) {
  const params = new URLSearchParams();
  function flatten(obj, prefix) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? prefix+'['+k+']' : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key);
      else params.append(key, v);
    }
  }
  flatten(body, '');
  const r = await fetch('https://api.stripe.com/v1/'+path, {
    method:  'POST',
    headers: { Authorization: 'Bearer '+STRIPE_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Stripe error');
  return data;
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

async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts     = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).slice(2);
  const signature = parts.find(p => p.startsWith('v1=')).slice(3);
  const signed    = timestamp+'.'+payload;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (expected !== signature) throw new Error('Invalid Stripe signature');
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) throw new Error('Event too old');
}

// ── Checkout handler ──────────────────────────────────────────────

async function handleCheckout(req, res) {
  if (!STRIPE_SECRET || !SB_SVC) return res.status(500).json({ error: 'Misconfigured' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const userRes = await fetch(SB_URL+'/auth/v1/user', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer '+token }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });
  const user = await userRes.json();

  const { plan = 'pro', org_id } = req.body || {};
  if (!org_id) return res.status(400).json({ error: 'org_id requerido' });

  const priceId = PRICES[plan];
  if (!priceId) return res.status(400).json({ error: 'Plan invalido' });

  const orgRes = await fetch(SB_URL+'/rest/v1/organizations?id=eq.'+encodeURIComponent(org_id)+'&limit=1', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer '+SB_SVC }
  });
  const orgs = await orgRes.json();
  if (!orgs?.length) return res.status(404).json({ error: 'Org no encontrada' });
  const org = orgs[0];

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripePost('customers', {
      email: org.email, name: org.name,
      metadata: { org_id, user_email: user.email },
    });
    customerId = customer.id;
  }

  const session = await stripePost('checkout/sessions', {
    customer: customerId, mode: 'subscription',
    'line_items[0][price]': priceId, 'line_items[0][quantity]': 1,
    success_url: APP_URL+'/app?upgraded=1',
    cancel_url:  APP_URL+'/app',
    'metadata[org_id]': org_id, 'metadata[plan]': plan,
    'payment_method_types[0]': 'card',
  });

  log.info('stripe', 'checkout session created', { orgId: org_id, plan });
  return res.status(200).json({ url: session.url });
}

// ── Webhook handler ───────────────────────────────────────────────

async function handleWebhook(req, res) {
  if (!WEBHOOK_SECRET || !SB_SVC) return res.status(500).json({ error: 'Misconfigured' });

  try {
    await verifyStripeSignature(JSON.stringify(req.body), req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (e) {
    log.warn('stripe', 'signature failed', { error: e.message });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  log.info('stripe', 'event received', { type: event.type });

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
          trial_ends_at: null, active: true,
        });
        log.info('stripe', 'org activated', { orgId });
        break;
      }
      case 'invoice.paid': {
        await updateOrg({ stripe_customer_id: event.data.object.customer }, { subscription_status: 'active', active: true });
        break;
      }
      case 'invoice.payment_failed': {
        await updateOrg({ stripe_customer_id: event.data.object.customer }, { subscription_status: 'past_due' });
        break;
      }
      case 'customer.subscription.deleted': {
        await updateOrg({ stripe_customer_id: event.data.object.customer }, { subscription_status: 'canceled', active: false });
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    log.error('stripe', 'handler error', { error: e.message });
    return res.status(500).json({ error: 'Handler error' });
  }
}

// ── Router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const action = req.query?.action || req.body?.action;

  if (action === 'webhook' || req.headers['stripe-signature']) {
    return handleWebhook(req, res);
  }
  return handleCheckout(req, res);
}
