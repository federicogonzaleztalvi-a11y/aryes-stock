// api/cron-contactar.js — AGENTE "VENDEDOR PROACTIVO" (aviso al VENDEDOR).
// ----------------------------------------------------------------------------
// Una vez por semana le manda un Web Push al vendedor con cuántos de SUS clientes
// hace rato no le hacen un pedido, para que los contacte (WhatsApp / llamada /
// visita) antes de perderlos. Es el "la app le avisa" del portal del vendedor:
// la solapa "Contactar" ya los muestra; esto lo trae sin que tenga que abrir.
//
// A diferencia de los agentes que escriben al COMPRADOR, acá el push va al propio
// vendedor (staff interno) → sin riesgo de spam a clientes ni plantilla de Meta.
//
// Candados (igual que la familia de crons):
//   • Apagado por defecto: solo corre si CONTACTAR_PUSH_ENABLED === 'true'.
//   • Auth por CRON_SECRET.
//   • Solo le llega a vendedores que SE SUSCRIBIERON a avisos (push_subscriptions
//     con vendedor_id). Si no activó notificaciones, no recibe nada.
// ----------------------------------------------------------------------------

import webpush from 'web-push';
import { log, withObservability } from './_log.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.CONTACTAR_PUSH_ENABLED === 'true';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hola@pazque.com';

const H   = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const DAY = 24 * 60 * 60 * 1000;
const UMBRAL_DIAS = 21;   // sin pedir hace >= 21 días (o nunca) = para contactar

async function sbGet(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// Cuenta los clientes de un vendedor (en su org) que no piden hace >= UMBRAL días
// o nunca. Mismo criterio que api/vendedor?action=porvisitar.
async function contarParaContactar(orgId, vendedorId) {
  const clients = await sbGet(
    `clients?org_id=eq.${encodeURIComponent(orgId)}` +
    `&vendedor_id=eq.${encodeURIComponent(vendedorId)}&select=id`
  );
  if (!Array.isArray(clients) || !clients.length) return 0;

  const inList = 'in.(' + clients.map(c => c.id).join(',') + ')';
  const orders = await sbGet(
    `b2b_orders?org_id=eq.${encodeURIComponent(orgId)}` +
    `&cliente_id=${encodeURIComponent(inList)}&select=cliente_id,creado_en&order=creado_en.desc&limit=2000`
  );
  const ultimo = new Map();
  for (const o of (Array.isArray(orders) ? orders : [])) {
    if (!ultimo.has(o.cliente_id)) ultimo.set(o.cliente_id, o.creado_en);
  }
  const now = Date.now();
  let count = 0;
  for (const c of clients) {
    const ult = ultimo.get(c.id);
    if (!ult) { count++; continue; } // nunca pidió
    if (Math.floor((now - new Date(ult).getTime()) / DAY) >= UMBRAL_DIAS) count++;
  }
  return count;
}

async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) return res.status(200).json({ ok: true, skipped: 'disabled' });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SB_URL || !SB_SVC) {
    return res.status(200).json({ ok: true, skipped: 'not-configured' });
  }

  // Solo vendedores que activaron avisos (tienen suscripción con vendedor_id).
  const subs = await sbGet('push_subscriptions?vendedor_id=not.is.null&select=org_id,vendedor_id,endpoint,p256dh,auth&limit=1000');
  if (!Array.isArray(subs) || !subs.length) return res.status(200).json({ ok: true, sent: 0, vendedores: 0 });

  // Agrupar suscripciones por (org, vendedor).
  const porVendedor = new Map(); // key `${org}|${vendedorId}` → { orgId, vendedorId, subs: [] }
  for (const s of subs) {
    if (!s.org_id || !s.vendedor_id) continue;
    const key = s.org_id + '|' + s.vendedor_id;
    if (!porVendedor.has(key)) porVendedor.set(key, { orgId: s.org_id, vendedorId: s.vendedor_id, subs: [] });
    porVendedor.get(key).subs.push(s);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let sent = 0, vendedoresAvisados = 0;
  for (const { orgId, vendedorId, subs: vsubs } of porVendedor.values()) {
    const count = await contarParaContactar(orgId, vendedorId);
    if (count <= 0) continue; // nada para avisar → no molestamos

    const body = count === 1
      ? 'Tenés 1 cliente que hace rato no te pide. Tocá para contactarlo.'
      : 'Tenés ' + count + ' clientes que hace rato no te piden. Tocá para contactarlos.';
    const payload = JSON.stringify({
      title: 'Clientes para contactar',
      body,
      icon: '/pazque-logo.png',
      tag: 'vend-contactar',
      url: '/vendedor',
    });

    vendedoresAvisados++;
    await Promise.allSettled(vsubs.map(async sub => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            { method: 'DELETE', headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }).catch(() => {});
        }
      }
    }));
  }

  log.info('cron-contactar', 'done', { vendedores: vendedoresAvisados, sent });
  return res.status(200).json({ ok: true, vendedores: vendedoresAvisados, sent });
}

export default withObservability('cron-contactar', handler);
