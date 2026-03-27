// api/mercadopago.js — MercadoPago payment integration
// POST /api/mercadopago?action=checkout  → create MP Checkout Pro preference
// POST /api/mercadopago?action=webhook   → receive MP webhook notifications
//
// STRIPE (FUTURE): When ready to scale internationally with LLC in Delaware,
// use api/stripe.js which is already built and configured.
// Steps to switch: 1) Open LLC via Stripe Atlas 2) Get live Stripe keys
// 3) Update UpgradePage.jsx to call /api/stripe instead of /api/mercadopago

import { log } from './_log.js';

const SB_URL    = process.env.SUPABASE_URL;
const SB_SVC    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN  = process.env.MP_ACCESS_TOKEN;   // APP_USR-... production token
const APP_URL   = process.env.APP_URL || 'https://aryes-stock.vercel.app';

// Plan prices in USD
const PLANS = {
  starter: { price: 79,  title: 'Aryes Stock Starter', currency: 'USD' },
  pro:     { price: 149, title: 'Aryes Stock Pro',     currency: 'USD' },
};

// ── Shared: update org billing status in Supabase ─────────────────

async function updateOrg(filter, updates) {
  const query = Object.entries(filter)
    .map(([k,v]) => k + '=eq.' + encodeURIComponent(v))
    .join('&');
  const r = await fetch(SB_URL + '/rest/v1/organizations?' + query, {
    method:  'PATCH',
    headers: {
      apikey:          SB_SVC,
      Authorization:  'Bearer ' + SB_SVC,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error('Supabase update failed: ' + r.status);
}

// ── Checkout: create MercadoPago preference ───────────────────────

async function handleCheckout(req, res) {
  if (!MP_TOKEN || !SB_SVC) return res.status(500).json({ error: 'Misconfigured' });

  // Verify user session
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const userRes = await fetch(SB_URL + '/auth/v1/user', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer ' + token }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });

  const { plan = 'pro', org_id } = req.body || {};
  if (!org_id) return res.status(400).json({ error: 'org_id requerido' });

  const planData = PLANS[plan];
  if (!planData) return res.status(400).json({ error: 'Plan invalido' });

  // Get org info
  const orgRes = await fetch(
    SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(org_id) + '&limit=1',
    { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }
  );
  const orgs = await orgRes.json();
  if (!orgs?.length) return res.status(404).json({ error: 'Org no encontrada' });
  const org = orgs[0];

  // Create MercadoPago Checkout Pro preference
  const preference = {
    items: [{
      title:      planData.title,
      quantity:   1,
      unit_price: planData.price,
      currency_id: planData.currency,
    }],
    payer: {
      email: org.email,
      name:  org.name,
    },
    back_urls: {
      success: APP_URL + '/app?upgraded=1',
      failure: APP_URL + '/app?payment=failed',
      pending: APP_URL + '/app?payment=pending',
    },
    auto_return:         'approved',
    notification_url:    APP_URL + '/api/mercadopago?action=webhook',
    external_reference:  org_id + '|' + plan,
    statement_descriptor: 'ARYES STOCK',
    metadata: { org_id, plan },
  };

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method:  'POST',
    headers: {
      Authorization:  'Bearer ' + MP_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  if (!mpRes.ok) {
    const err = await mpRes.json().catch(() => ({}));
    log.error('mercadopago', 'preference creation failed', { status: mpRes.status, err });
    return res.status(500).json({ error: 'Error al crear el pago' });
  }

  const data = await mpRes.json();
  log.info('mercadopago', 'preference created', { orgId: org_id, plan, prefId: data.id });

  // Return the checkout URL
  return res.status(200).json({
    url:    data.init_point,      // production URL
    testUrl: data.sandbox_init_point, // test URL
    prefId: data.id,
  });
}

// ── Webhook: receive MP payment notifications ─────────────────────

async function handleWebhook(req, res) {
  // MP sends a GET or POST notification
  const topic = req.query?.topic || req.body?.type;
  const id    = req.query?.id    || req.body?.data?.id;

  log.info('mercadopago', 'webhook received', { topic, id });

  // Only process payment notifications
  if (topic !== 'payment' && topic !== 'merchant_order') {
    return res.status(200).json({ received: true });
  }

  if (!id) return res.status(200).json({ received: true });

  try {
    // Fetch payment details from MP
    const payRes = await fetch('https://api.mercadopago.com/v1/payments/' + id, {
      headers: { Authorization: 'Bearer ' + MP_TOKEN }
    });

    if (!payRes.ok) {
      log.warn('mercadopago', 'could not fetch payment', { id });
      return res.status(200).json({ received: true });
    }

    const payment = await payRes.json();
    const status  = payment.status;           // approved, pending, rejected
    const ref     = payment.external_reference; // "org_id|plan"

    if (!ref) return res.status(200).json({ received: true });

    const [orgId, plan] = ref.split('|');
    if (!orgId) return res.status(200).json({ received: true });

    log.info('mercadopago', 'payment status', { orgId, plan, status, paymentId: id });

    if (status === 'approved') {
      await updateOrg({ id: orgId }, {
        subscription_status: 'active',
        plan_name:           plan || 'pro',
        trial_ends_at:       null,
        active:              true,
        mp_payment_id:       String(id),
      });
      log.info('mercadopago', 'org activated', { orgId, plan });
    } else if (status === 'rejected') {
      await updateOrg({ id: orgId }, { subscription_status: 'past_due' });
      log.warn('mercadopago', 'payment rejected', { orgId });
    }

  } catch (e) {
    log.error('mercadopago', 'webhook error', { error: e.message });
  }

  return res.status(200).json({ received: true });
}

// ── Router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action;

  if (req.method === 'GET' || action === 'webhook') {
    return handleWebhook(req, res);
  }
  return handleCheckout(req, res);
}
