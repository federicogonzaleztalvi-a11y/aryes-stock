// api/_push.js — Envío de Web Push a un COMPRADOR puntual del portal (modelo
// Amazon: "tu pedido fue confirmado", "tu pedido fue entregado").
// ----------------------------------------------------------------------------
// Por qué existe: el comprador que instala el portal como app (PWA) puede recibir
// avisos del estado de SU pedido en el celular, sin depender del número de
// WhatsApp (que es Marketing y arriesga la calidad del número de login OTP).
// Es un canal PROPIO, transaccional: solo le avisamos de su propio pedido, así
// que no necesita opt-out (igual que Rappi/PedidosYa con "tu pedido salió").
//
// Es best-effort total: si no hay VAPID configurado o el comprador no se suscribió,
// no pasa nada (no rompe el flujo del pedido ni del reparto que lo llama).
// La suscripción la crea el portal vía /api/push?action=subscribe-client.
// ----------------------------------------------------------------------------
import webpush from 'web-push';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hola@pazque.com';

// Manda un push a TODAS las suscripciones de un comprador (puede tener varias:
// cel + compu). Nunca lanza: devuelve { sent, failed } y traga cualquier error.
export async function pushToClient({ orgId, clientId, title, body, url, tag, urgent = false }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SB_URL || !SB_SVC) return { sent: 0, failed: 0 };
  if (!orgId || !clientId || !body) return { sent: 0, failed: 0 };

  const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

  let subs = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/push_subscriptions?org_id=eq.${encodeURIComponent(orgId)}` +
      `&client_id=eq.${encodeURIComponent(clientId)}&limit=20`,
      { headers: H }
    );
    if (r.ok) subs = await r.json();
  } catch { return { sent: 0, failed: 0 }; }
  if (!Array.isArray(subs) || !subs.length) return { sent: 0, failed: 0 };

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify({ title: title || 'Pazque', body, url, tag, urgent });

  let sent = 0, failed = 0;
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      // 404/410 = suscripción muerta (desinstaló / revocó) → la borramos.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await fetch(
          `${SB_URL}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
          { method: 'DELETE', headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }
        ).catch(() => {});
      }
    }
  }));

  return { sent, failed };
}
