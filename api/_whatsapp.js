// api/_whatsapp.js — Envío de plantillas de WhatsApp aprobadas (Meta Cloud API)
// para los agentes de recordatorio por-org (carrito abandonado, reactivación, …).
// ----------------------------------------------------------------------------
// Por qué existe: el comprador mayorista vive en WhatsApp, no en el mail. Estos
// agentes nacieron mandando email (sin fricción de plantilla de Meta). Este helper
// agrega el canal WhatsApp reusando la MISMA infra que broadcast.js/_alert.js
// (Cloud API + plantilla pre-aprobada), con el formato de componentes que Meta
// exige para cuerpo con variables + botón URL dinámico.
//
// CANDADO: apagado por defecto. El canal WhatsApp de los recordatorios SOLO se
// activa si REMINDERS_WHATSAPP_ENABLED === 'true'. Sin esa env, el comportamiento
// es idéntico al de antes (email y nada más) → un deploy nunca empieza a mandar
// WhatsApp solo. Prenderlo es una decisión consciente en Vercel.
// ----------------------------------------------------------------------------
const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;

// Interruptor global del canal WhatsApp para recordatorios (default OFF).
export const WA_REMINDERS_ON = process.env.REMINDERS_WHATSAPP_ENABLED === 'true';
// WhatsApp disponible = hay sender Pazque configurado.
export const WA_READY = !!(WA_TOKEN && WA_PHONE_ID);

// Normaliza a solo dígitos (formato internacional que pide Meta: 59894…).
export function digits(p) { return String(p || '').replace(/\D/g, ''); }

// Manda una plantilla con parámetros de cuerpo y, opcional, un botón URL dinámico.
//   bodyParams:     array de strings → {{1}}, {{2}}, … del CUERPO (en orden)
//   urlButtonParam: string que reemplaza el {{1}} del botón URL (el sufijo dinámico,
//                   p.ej. el org_id que completa pazque.com/pedidos?org={{1}})
// Nunca atrapa el error: el llamador decide (allSettled / try-catch).
export async function sendWaTemplate({
  to, template, lang = 'es_AR', bodyParams = [], urlButtonParam,
  phoneId = WA_PHONE_ID, token = WA_TOKEN,
}) {
  const components = [];
  if (bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(t => ({ type: 'text', text: String(t) })),
    });
  }
  if (urlButtonParam != null) {
    components.push({
      type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: String(urlButtonParam) }],
    });
  }
  const r = await fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: digits(to),
      type: 'template',
      template: { name: template, language: { code: lang }, components },
    }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
