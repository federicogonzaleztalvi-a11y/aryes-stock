// api/payments.js — Payment processing (MercadoPago Subscriptions + Stripe future)
//
// CURRENT: MercadoPago Suscripciones (pagos recurrentes mensuales)
//   POST /api/payments              → crear suscripción mensual
//   POST/GET /api/payments?action=webhook → recibir notificaciones de MP
//
// FUTURE (cuando tengas LLC en Delaware):
//   Descomentar sección Stripe y cambiar UpgradePage a provider=stripe

import { log } from './_log.js';

const SB_URL   = process.env.SUPABASE_URL;
const SB_SVC   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
const APP_URL  = process.env.APP_URL || 'https://pazque.com';


// ── MercadoPago webhook signature verification ────────────────────
import crypto from 'crypto';
import { setCorsHeaders } from './_cors.js';


function verifyMPSignature(req) {
  if (!MP_WEBHOOK_SECRET) {
    // If no secret configured, log warning but allow (for development)
    console.warn('[payments] MP_WEBHOOK_SECRET not configured — skipping signature validation');
    return true;
  }
  const xSignature = req.headers['x-signature'] || '';
  const xRequestId = req.headers['x-request-id'] || '';
  const dataId = req.query?.['data.id'] || req.body?.data?.id || '';
  
  // Extract ts and v1 from x-signature header
  const parts = {};
  xSignature.split(',').forEach(part => {
    const [key, ...val] = part.split('=');
    parts[key.trim()] = val.join('=');
  });
  
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  
  // Build template: id:[data.id];request-id:[x-request-id];ts:[ts];
  let template = '';
  if (dataId) template += 'id:' + dataId + ';';
  if (xRequestId) template += 'request-id:' + xRequestId + ';';
  template += 'ts:' + ts + ';';
  
  // Calculate HMAC SHA256
  const computed = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(template).digest('hex');
  return computed === v1;
}

const PLANS = {
  pro:       { amount: 299, title: 'Pazque', currency: 'USD' },
  pro_intro: { amount: 149, title: 'Pazque — Precio lanzamiento', currency: 'USD' },
};

const INTRO_MONTHS = 3;

function getPlanForOrg(org) {
  if (!org.subscription_started_at) return PLANS.pro_intro;
  const months = (Date.now() - new Date(org.subscription_started_at).getTime()) / (30.44 * 24 * 60 * 60 * 1000);
  return months < INTRO_MONTHS ? PLANS.pro_intro : PLANS.pro;
}

// ── Stripe (futuro — descomentar cuando haya LLC en Delaware) ─────
// const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
// const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// const STRIPE_PRICES  = { starter: process.env.STRIPE_PRICE_STARTER, pro: process.env.STRIPE_PRICE_PRO };

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

// ── MercadoPago: crear suscripción mensual ────────────────────────

async function mpSubscription(req, res) {
  if (!MP_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });

  // Verificar sesión del usuario
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const userRes = await fetch(SB_URL + '/auth/v1/user', {
    headers: { apikey: SB_SVC, Authorization: 'Bearer ' + token }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });

  const { plan = 'pro', org_id } = req.body || {};
  if (!org_id) return res.status(400).json({ error: 'org_id requerido' });

  // Obtener datos de la org
  const orgRes = await fetch(
    SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(org_id) + '&limit=1',
    { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }
  );
  const orgs = await orgRes.json();
  if (!orgs?.length) return res.status(404).json({ error: 'Org no encontrada' });
  const org = orgs[0];

  // Determinar precio según antigüedad (intro 3 meses a 149, después 299)
  const planData = getPlanForOrg(org);

  // Crear plan de suscripción en MercadoPago
  // Primero crear el plan (preapproval_plan), luego la suscripción (preapproval)
  const planRes = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + MP_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason:           planData.title,
      auto_recurring: {
        frequency:        1,
        frequency_type:   'months',
        transaction_amount: planData.amount,
        currency_id:      planData.currency,
      },
      back_url: APP_URL + '/app?upgraded=1',
      status:   'active',
    }),
  });

  if (!planRes.ok) {
    const err = await planRes.json().catch(() => ({}));
    log.error('payments', 'MP plan creation failed', { status: planRes.status, err });
    return res.status(500).json({ error: 'Error al crear el plan de suscripcion' });
  }

  const mpPlan = await planRes.json();

  // Crear la suscripción vinculada al plan
  const subRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + MP_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      preapproval_plan_id: mpPlan.id,
      reason:              planData.title,
      payer_email:         org.email,
      external_reference:  org_id + '|' + plan,
      back_url:            APP_URL + '/app?upgraded=1',
      auto_recurring: {
        frequency:          1,
        frequency_type:     'months',
        transaction_amount: planData.amount,
        currency_id:        planData.currency,
      },
      status: 'pending',
    }),
  });

  if (!subRes.ok) {
    const err = await subRes.json().catch(() => ({}));
    log.error('payments', 'MP subscription creation failed', { status: subRes.status, err });
    return res.status(500).json({ error: 'Error al crear la suscripcion' });
  }

  const sub = await subRes.json();
  log.info('payments', 'MP subscription created', { orgId: org_id, plan, subId: sub.id });

  // Retornar URL de pago donde el cliente ingresa su tarjeta
  return res.status(200).json({
    url:   sub.init_point,
    subId: sub.id,
  });
}

// ── MercadoPago: recibir webhook de suscripción ───────────────────

async function mpWebhook(req, res) {
  // Verify webhook signature
  if (!verifyMPSignature(req)) {
    log.warn('payments', 'webhook signature verification FAILED — possible spoofing');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const topic = req.query?.topic || req.body?.type;
  const id    = req.query?.id    || req.body?.data?.id;

  log.info('payments', 'MP webhook', { topic, id });

  // Manejar notificaciones de suscripción (preapproval) y pagos
  if (!id) return res.status(200).json({ received: true });

  try {
    let orgId, plan, status;

    if (topic === 'subscription_preapproval' || topic === 'preapproval') {
      // Notificación de suscripción
      const subRes = await fetch('https://api.mercadopago.com/preapproval/' + id, {
        headers: { Authorization: 'Bearer ' + MP_TOKEN }
      });
      if (!subRes.ok) return res.status(200).json({ received: true });

      const sub = await subRes.json();
      const ref = sub.external_reference || '';
      [orgId, plan] = ref.split('|');
      status = sub.status; // authorized, paused, cancelled

      if (status === 'authorized' && orgId) {
        await updateOrg({ id: orgId }, {
          subscription_status:  'active',
          plan_name:            plan || 'pro',
          trial_ends_at:        null,
          subscription_started_at: new Date().toISOString(),
          active:               true,
          mp_payment_id:        String(id),
        });
        log.info('payments', 'subscription authorized — org activated', { orgId });
      } else if (status === 'cancelled' && orgId) {
        await updateOrg({ id: orgId }, { subscription_status: 'canceled', active: false });
        log.info('payments', 'subscription cancelled', { orgId });
      }

    } else if (topic === 'payment') {
      // Notificación de pago individual dentro de la suscripción
      const payRes = await fetch('https://api.mercadopago.com/v1/payments/' + id, {
        headers: { Authorization: 'Bearer ' + MP_TOKEN }
      });
      if (!payRes.ok) return res.status(200).json({ received: true });

      const payment = await payRes.json();
      const ref = payment.external_reference || '';
      [orgId, plan] = ref.split('|');

      if (payment.status === 'approved' && orgId) {
        await updateOrg({ id: orgId }, {
          subscription_status: 'active',
          active: true,
          mp_payment_id: String(id),
        });
        log.info('payments', 'payment approved', { orgId });
      } else if (payment.status === 'rejected' && orgId) {
        await updateOrg({ id: orgId }, { subscription_status: 'past_due' });
        log.warn('payments', 'payment rejected', { orgId });
      }
    }

  } catch(e) {
    log.error('payments', 'webhook error', { error: e.message });
  }

  return res.status(200).json({ received: true });
}

// ── Router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action;
  if (req.method === 'GET' || action === 'webhook') return mpWebhook(req, res);
  return mpSubscription(req, res);
}
