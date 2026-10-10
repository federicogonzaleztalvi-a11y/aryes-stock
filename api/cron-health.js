// api/cron-health.js — Torre de Control · MONITOR DE SALUD (health-checks).
//
// Por qué existe: la detección que ya teníamos (api/_log.js → _alert.js) es
// REACTIVA — sólo se entera cuando el código tira un error "vigilado"
// (log.error/log.fatal). Si una dependencia crítica se cae de otra forma
// (Supabase no responde, un deploy rompió el sitio, un timeout), puede que nada
// la dispare y Eric lo note antes que vos. Este cron cierra ese agujero:
//
//   Cada pocos minutos le pega a las dependencias críticas COMO SI FUERA UN
//   CLIENTE y, si algo responde mal, te manda un email ANTES de que alguien lo
//   sufra. No espera a que el código "sepa" que falló: lo prueba en vivo.
//
// REGLAS DE DISEÑO (mismo criterio que el resto de la Torre de Control):
//   • Sólo LECTURA, cero efectos: nunca crea pedidos, nunca manda OTP, nunca
//     toca datos. Por eso NO prueba endpoints con efectos (pedido, otp-send).
//   • Apagado por defecto: sólo corre si HEALTH_MONITOR_ENABLED === 'true'.
//   • Auth por CRON_SECRET, como el resto de los crons.
//   • Alerta DIRECTO por email (no vía log.error) a propósito: una caída de
//     infra NO es un bug de código, así que NO debe abrir Issues/PR de auto-fix
//     (eso es para errores del código). Separación limpia:
//        _autofix  → "el código tiró un error" → PR para revisar.
//        este cron → "¿está arriba y respondiendo?" → aviso de incidente.
//   • Timeout por chequeo: un endpoint colgado no cuelga el monitor.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.HEALTH_MONITOR_ENABLED === 'true';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'contacto@pazque.com';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');
const TIMEOUT_MS  = 8000;   // un chequeo que tarda más que esto se cuenta como caído

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// fetch con timeout (AbortController): si el endpoint se cuelga, no colgamos el cron.
async function timedFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return { ok: r.ok, status: r.status, ms: Date.now() - started };
  } catch (e) {
    return {
      ok: false, status: 0, ms: Date.now() - started,
      error: e.name === 'AbortError' ? `timeout >${TIMEOUT_MS}ms` : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Chequeos read-only de cada dependencia crítica. Agregar uno nuevo = sumar un
// objeto a esta lista (name + detail + run que devuelve {ok,status,ms,error?}).
const CHECKS = [
  {
    name: 'Base de datos (Supabase)',
    detail: 'Lectura trivial de organizations',
    run: () => timedFetch(`${SB_URL}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' },
    }),
  },
  {
    name: 'Sitio público (pazque.com)',
    detail: 'La app carga con HTTP 200',
    run: () => timedFetch(`${SITE}/`, { method: 'GET' }),
  },
];

function buildAlert(failed, all) {
  const plural = failed.length === 1 ? '' : 's';
  const subject = `🔴 Pazque caído: ${failed.map(f => f.name).join(', ')}`.slice(0, 120);
  const row = (r) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18">
        ${r.ok ? '🟢' : '🔴'} ${esc(r.name)}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;color:#6a6a68">
        ${r.ok ? 'OK' : esc(r.error || ('HTTP ' + r.status))} · ${r.ms}ms
      </td>
    </tr>`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 22px">
      <div style="display:inline-block;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px">
        INCIDENTE EN PRODUCCIÓN
      </div>
      <h1 style="font-size:19px;font-weight:700;color:#1a1a18;margin:0 0 6px">
        ${failed.length} chequeo${plural} de salud falló${plural ? 'ron' : ''}
      </h1>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 18px">${esc(new Date().toISOString())}</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0ede8;border-radius:8px;overflow:hidden">
        ${all.map(row).join('')}
      </table>
      <p style="font-size:12px;color:#9a9a98;margin-top:22px;line-height:1.5">
        Monitor de salud de Pazque · chequeo automático cada 10 min. Sólo lee, no toca datos.
        Si esto es un pico transitorio, el próximo chequeo lo confirmará recuperado.
      </p>
    </div>`;
  return { subject, html };
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Apagado por defecto hasta que Federico prenda el flag.
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'HEALTH_MONITOR_ENABLED!=true' });
  }

  const results = [];
  for (const c of CHECKS) {
    const r = await c.run();
    results.push({ name: c.name, detail: c.detail, ...r });
  }
  const failed = results.filter(r => !r.ok);

  if (failed.length) {
    try {
      await sendEmail({ to: ALERT_EMAIL, ...buildAlert(failed, results) });
    } catch (e) {
      console.error('[cron-health] no se pudo enviar la alerta:', e.message);
    }
  }

  return res.status(200).json({
    ok: failed.length === 0,
    checked: results.length,
    failed: failed.length,
    results,
  });
}
