// api/payments.js — Payment processing (MercadoPago + Stripe future)
//
// CURRENT: MercadoPago (operates natively in Uruguay and LATAM)
//   POST /api/payments?action=checkout  → create MP Checkout Pro preference
//   POST/GET /api/payments?action=webhook → receive MP webhook notifications
//
// FUTURE (when LLC in Delaware is ready):
//   Uncomment the Stripe section and update UpgradePage to call /api/payments?provider=stripe
//   Steps: 1) Open LLC via Stripe Atlas  2) Get live Stripe keys
//           3) Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Vercel
//           4) Update provider detection logic below

import { log } from './_log.js';

const SB_URL    = process.env.SUPABASE_URL;
const SB_SVC    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN  = process.env.MP_ACCESS_TOKEN;
const APP_URL   = process.env.APP_URL || 'https://aryes-stock.vercel.app';

// ── Stripe (future) ───────────────────────────────────────────────
// const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
// const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// const STRIPE_PRICES  = {
//   starter: process.env.STRIPE_PRICE_STARTER,
//   pro:     process.env.STRIPE_PRICE_PRO,
// };

const PLANS = {
  starter: { price: 79,  title: 'Aryes Stock Starter', currency: 'USD' },
  pro:     { price: 149, title: 'Aryes Stock Pro',     currency: 'USD' },
};

// ── Shared helpers ────────────────────────────────────────────────

async function updateOrg(filter, updates) {
  const query = Object.entries(filter)
    .map(([k,v]) => k + '=eq.' + encodeURIComponent(v)).join('&');
  const r = await fetch(SB_URL + '/rest/v1/organizations?' + query, {
    method: 'PATCH',
    headers: {
      apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error('Supabase update failed: ' + r.status);
}

async function getOrgAndUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('No autenticado');
  const userRes = await fetch(SB_URL + '/auth/v1/user', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer ' + token }
  });
  if (!userRes.ok) throw new Error('Sesion invalida');
  const user = await userRes.json();
  return user;
}

// ── MercadoPago: create checkout preference ───────────────────────

async function mpCheckout(req, res) {
  if (!MP_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
  const { plan = 'pro', org_id } = req.body || {};
  if (!org_id) return res.status(400).json({ error: 'org_id requerido' });
  const planData = PLANS[plan];
  if (!planData) return res.status(400).json({ error: 'Plan invalido' });

  try { await getOrgAndUser(req); } catch(e) { return res.status(401).json({ error: e.message }); }

  const orgRes = await fetch(SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(org_id) + '&limit=1', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC }
  });
  const orgs = await orgRes.json();
  if (!orgs?.length) return res.status(404).json({ error: 'Org no encontrada' });
  const org = orgs[0];

  const preference = {
    items: [{ title: planData.title, quantity: 1, unit_price: planData.price, currency_id: planData.currency }],
    payer: { email: org.email, name: org.name },
    back_urls: {
      success: APP_URL + '/app?upgraded=1',
      failure: APP_URL + '/app?payment=failed',
      pending: APP_URL + '/app?payment=pending',
    },
    auto_return: 'approved',
    notification_url: APP_URL + '/api/payments?action=webhook',
    external_reference: org_id + '|' + plan,
    statement_descriptor: 'ARYES STOCK',
    metadata: { org_id, plan },
  };

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + MP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(preference),
  });

  if (!mpRes.ok) {
    const err = await mpRes.json().catch(() => ({}));
    log.error('payments', 'MP preference failed', { status: mpRes.status });
    return res.status(500).json({ error: 'Error al crear el pago' });
  }

  const data = await mpRes.json();
  log.info('payments', 'MP preference created', { orgId: org_id, plan });
  return res.status(200).json({ url: data.init_point, testUrl: data.sandbox_init_point });
}

// ── MercadoPago: receive webhook ──────────────────────────────────

async function mpWebhook(req, res) {
  const topic = req.query?.topic || req.body?.type;
  const id    = req.query?.id    || req.body?.data?.id;
  log.info('payments', 'MP webhook', { topic, id });

  if (topic !== 'payment' && topic !== 'merchant_order') return res.status(200).json({ received: true });
  if (!id) return res.status(200).json({ received: true });

  try {
    const payRes = await fetch('https://api.mercadopago.com/v1/payments/' + id, {
      headers: { Authorization: 'Bearer ' + MP_TOKEN }
    });
    if (!payRes.ok) return res.status(200).json({ received: true });

    const payment = await payRes.json();
    const [orgId, plan] = (payment.external_reference || '').split('|');
    if (!orgId) return res.status(200).json({ received: true });

    if (payment.status === 'approved') {
      await updateOrg({ id: orgId }, {
        subscription_status: 'active', plan_name: plan || 'pro',
        trial_ends_at: null, active: true, mp_payment_id: String(id),
      });
      log.info('payments', 'org activated via MP', { orgId });
    } else if (payment.status === 'rejected') {
      await updateOrg({ id: orgId }, { subscription_status: 'past_due' });
    }
  } catch(e) {
    log.error('payments', 'webhook error', { error: e.message });
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
  if (req.method === 'GET' || action === 'webhook') return mpWebhook(req, res);
  return mpCheckout(req, res);
}
