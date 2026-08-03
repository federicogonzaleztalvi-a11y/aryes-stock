// api/_alert.js — Torre de Control: alerta proactiva cuando algo se rompe en prod.
// ----------------------------------------------------------------------------
// OBJETIVO: que Federico se entere de un error ANTES que Eric. Enganchado en el
// logger central (_log.js), así CUALQUIER log.error/log.fatal de CUALQUIER
// endpoint dispara una alerta, sin tocar cada archivo.
//
// CANAL: email vía Resend (ya configurado). WhatsApp queda para más adelante:
// Meta NO permite mensajes proactivos libres fuera de la ventana de 24h, exige
// una plantilla pre-aprobada (ver broadcast.js). Cuando exista 'pazque_alerta'
// aprobada, se suma acá sin cambiar el resto.
//
// SEGURIDAD DE DISEÑO (por qué esto no puede empeorar las cosas):
//   • Fire-and-forget: nunca bloquea ni rompe el request que lo originó.
//   • Nunca usa `log.*` adentro → imposible loop de "alertar genera error que
//     genera otra alerta". Sólo console.* directo.
//   • A propósito NO toca la DB para throttlear: si lo que falla ES la DB,
//     alertar no debe volver a pegarle. Throttle 100% en memoria.
//   • Throttle + cap horario: un error en loop NO te inunda de mails.
// ----------------------------------------------------------------------------
import { sendEmail } from './_email.js';

// Destino de las alertas. Default al contacto de Pazque para que funcione HOY
// sin setup; se puede apuntar a una casilla dedicada con la env var ALERT_EMAIL.
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'contacto@pazque.com';
const IS_PROD = (process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production';

// Throttle en memoria (por instancia lambda). Imperfecto entre instancias, pero
// resuelve el caso común (un mismo error disparándose en loop) y el cap acota el
// peor caso. Endurecer cross-instancia se puede después; a propósito sin DB acá.
const COOLDOWN_MS = 10 * 60 * 1000;   // misma firma de error: máx 1 mail / 10 min
const HOURLY_CAP  = 20;               // tope duro de mails por instancia por hora
const _lastBySig = new Map();         // firma -> ts de la última alerta enviada
let _windowStart = Date.now();
let _windowCount = 0;

function _throttled(sig) {
  const now = Date.now();
  if (now - _windowStart > 3600000) { _windowStart = now; _windowCount = 0; }
  if (_windowCount >= HOURLY_CAP) return true;               // cap horario alcanzado
  const last = _lastBySig.get(sig) || 0;
  if (now - last < COOLDOWN_MS) return true;                 // misma firma, muy seguido
  _lastBySig.set(sig, now);
  _windowCount++;
  return false;
}

function _esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Punto de entrada llamado por _log.js. `entry` = { ts, level, service, msg, ...extra }.
export function maybeAlert(entry) {
  try {
    if (!IS_PROD || !ALERT_EMAIL) return;
    const sig = (entry.service || '?') + '|' + (entry.msg || '?');
    if (_throttled(sig)) return;
    _send(entry).catch(() => {});     // fire-and-forget, jamás propaga error
  } catch { /* alertar nunca rompe el request */ }
}

async function _send(entry) {
  const { ts, level, service, msg, ...extra } = entry;
  const detalle = Object.keys(extra).length
    ? _esc(JSON.stringify(extra, null, 2)).slice(0, 1500)
    : '(sin detalle adicional)';
  const subject = `⚠️ Pazque ${String(level || 'error').toUpperCase()}: ${service} — ${msg}`.slice(0, 120);
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 22px">
      <div style="display:inline-block;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px">
        ${_esc(String(level || 'error').toUpperCase())} EN PRODUCCIÓN
      </div>
      <h1 style="font-size:19px;font-weight:700;color:#1a1a18;margin:0 0 6px">${_esc(msg)}</h1>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 4px">Módulo: <strong>${_esc(service)}</strong></p>
      <p style="font-size:12px;color:#9a9a98;margin:0 0 18px">${_esc(ts)}</p>
      <pre style="background:#f7f7f4;border-radius:8px;padding:14px;font-size:12px;color:#1a1a18;white-space:pre-wrap;word-break:break-word;overflow-x:auto;margin:0">${detalle}</pre>
      <p style="font-size:12px;color:#9a9a98;margin-top:22px;line-height:1.5">
        Torre de Control de Pazque · alerta automática. Se agrupa por tipo de error (máx 1 cada 10 min) para no inundarte.
      </p>
    </div>`;
  await sendEmail({ to: ALERT_EMAIL, subject, html });
}
