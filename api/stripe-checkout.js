// api/stripe-checkout.js — Creates a Stripe Checkout session
// Called when a trial user clicks "Upgrade" or "Subscribe"

import { log } from './_log.js';

const SB_URL        = process.env.SUPABASE_URL;
const SB_SVC        = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL       = process.env.APP_URL || 'https://aryes-stock.vercel.app';

// Stripe price IDs — set these after creating products in Stripe dashboard
const PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,  // $79/mo
  pro:     process.env.STRIPE_PRICE_PRO,       // $149/mo
};

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!STRIPE_SECRET || !SB_SVC) return res.status(500).json({ error: 'Misconfigured' });

  // Verify user session
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

  // Get org info
  const orgRes = await fetch(SB_URL+'/rest/v1/organizations?id=eq.'+encodeURIComponent(org_id)+'&limit=1', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer '+SB_SVC }
  });
  const orgs = await orgRes.json();
  if (!orgs?.length) return res.status(404).json({ error: 'Org no encontrada' });
  const org = orgs[0];

  // Create or reuse Stripe customer
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripePost('customers', {
      email: org.email,
      name:  org.name,
      metadata: { org_id, user_email: user.email },
    });
    customerId = customer.id;
  }

  // Create checkout session
  const session = await stripePost('checkout/sessions', {
    customer:             customerId,
    mode:                 'subscription',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': 1,
    success_url:          APP_URL+'/app?upgraded=1',
    cancel_url:           APP_URL+'/app',
    'subscription_data[trial_from_plan]': false,
    'metadata[org_id]':   org_id,
    'metadata[plan]':     plan,
    'payment_method_types[0]': 'card',
  });

  log.info('stripe-checkout', 'session created', { orgId: org_id, plan });
  return res.status(200).json({ url: session.url });
}
