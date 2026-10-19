// api/cron-data-guardian.js — Torre de Control · GUARDIÁN DE DATOS.
//
// Por qué existe: el Guardián de regresión (cron-guardian.js) caza bugs de CÓDIGO
// después de un deploy. Pero los datos se pudren SOLOS, sin que ningún deploy los
// toque: un cliente que se borra deja pedidos huérfanos, un producto que se va
// deja precios colgando, un id mal cargado rompe los pedidos de ese cliente con
// un 502 opaco. Eso no lo ve ningún test de flujo: el endpoint responde 200, pero
// el dato está roto por debajo. Este agente audita la INTEGRIDAD de los datos y,
// si algo se corrompió en silencio, te avisa por email con el detalle y cómo
// arreglarlo.
//
// REGLAS DE DISEÑO (mismo criterio que toda la Torre de Control):
//   • SÓLO LECTURA: toda la auditoría vive en la función pazque_data_health()
//     (SECURITY DEFINER, STABLE, no escribe nada). Acá sólo la llamamos y
//     formateamos. Cero efectos sobre los datos.
//   • Genérico / multi-tenant: la función barre TODAS las orgs por igual; nada
//     está hardcodeado a Eric. Cada hallazgo trae su org en la muestra.
//   • Auth por CRON_SECRET, como el resto de los crons.
//   • Kill-switch DATA_GUARDIAN_ENABLED=false (default ON, riesgo cero: sólo lee
//     y manda un mail a Federico).
//   • Sólo molesta si hay algo: si no hay hallazgos, no manda email (no es ruido).
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
// Default ON: su valor es cazar corrupción silenciosa; apagar con DATA_GUARDIAN_ENABLED=false.
const ENABLED     = process.env.DATA_GUARDIAN_ENABLED !== 'false';
const TO_EMAIL    = process.env.DATA_GUARDIAN_EMAIL || process.env.OWNER_EMAIL
                 || process.env.ALERT_EMAIL || 'federico@pazque.com';

// Metadatos de severidad: color del badge + orden. 'critico' primero.
const SEV = {
  critico: { label: 'CRÍTICO', bg: '#fef2f2', fg: '#b91c1c', rank: 1 },
  alto:    { label: 'ALTO',    bg: '#fff7ed', fg: '#c2410c', rank: 2 },
  medio:   { label: 'MEDIO',   bg: '#fefce8', fg: '#a16207', rank: 3 },
  bajo:    { label: 'BAJO',    bg: '#f4f4f5', fg: '#52525b', rank: 4 },
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Llama a la función de auditoría vía RPC de Supabase (service role). Devuelve el
// objeto { generado, hallazgos[] } o lanza si la DB no responde.
async function runHealthCheck() {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/pazque_data_health`, {
    method: 'POST',
    headers: {
      apikey: SB_SVC,
      Authorization: 'Bearer ' + SB_SVC,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
  });
  if (!r.ok) throw new Error('RPC pazque_data_health HTTP ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
  return r.json();
}

// Render de la muestra de un hallazgo: una tablita con hasta ~8 filas (los pares
// clave/valor del objeto). El total ("n") puede ser mayor que la muestra.
function sampleTable(muestra) {
  const rows = Array.isArray(muestra) ? muestra.slice(0, 8) : [];
  if (!rows.length) return '';
  const body = rows.map((o) => {
    const pairs = Object.entries(o || {})
      .map(([k, v]) => `<span style="color:#9a9a98">${esc(k)}:</span> ${esc(v)}`)
      .join(' &nbsp;·&nbsp; ');
    return `<tr><td style="padding:5px 10px;border-top:1px solid #f0ede8;font-size:12px;color:#1a1a18;font-family:ui-monospace,monospace">${pairs}</td></tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;background:#fafafa;border-radius:6px;overflow:hidden">${body}</table>`;
}

function card(h) {
  const sev = SEV[h.severidad] || SEV.bajo;
  return `
    <div style="border:1px solid #f0ede8;border-radius:10px;padding:16px 18px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="display:inline-block;background:${sev.bg};color:${sev.fg};font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px">${sev.label}</span>
        <span style="font-size:15px;font-weight:700;color:#1a1a18">${esc(h.titulo)}</span>
        <span style="margin-left:auto;font-size:13px;font-weight:700;color:${sev.fg}">${esc(h.n)}</span>
      </div>
      <p style="font-size:13px;color:#4a4a48;margin:0 0 4px;line-height:1.5">${esc(h.detalle)}</p>
      <p style="font-size:12px;color:#6a6a68;margin:0;line-height:1.5"><b>Cómo arreglarlo:</b> ${esc(h.como_arreglar)}</p>
      ${sampleTable(h.muestra)}
    </div>`;
}

function buildEmail(data) {
  const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
  const peor = hallazgos.reduce((acc, h) => {
    const r = (SEV[h.severidad] || SEV.bajo).rank;
    return r < acc ? r : acc;
  }, 9);
  const hayCritico = peor === 1;
  const total = hallazgos.reduce((s, h) => s + (Number(h.n) || 0), 0);
  const subject = `${hayCritico ? '🔴' : '🧬'} Guardián de datos: ${hallazgos.length} tipo${hallazgos.length === 1 ? '' : 's'} de problema (${total} registro${total === 1 ? '' : 's'})`.slice(0, 120);
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px 22px">
      <div style="display:inline-block;background:${hayCritico ? '#fef2f2' : '#fefce8'};color:${hayCritico ? '#b91c1c' : '#a16207'};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px">
        INTEGRIDAD DE DATOS
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#1a1a18;margin:0 0 6px">
        Encontré ${hallazgos.length} tipo${hallazgos.length === 1 ? '' : 's'} de dato roto
      </h1>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 20px">${esc(data.generado || '')} · Montevideo</p>
      ${hallazgos.map(card).join('')}
      <p style="font-size:12px;color:#9a9a98;margin-top:22px;line-height:1.5">
        Guardián de datos de Pazque · audita la integridad de la base (clientes, pedidos, precios, sesiones)
        sin tocar nada. Esto es corrupción que ningún test de flujo ve: el endpoint responde bien,
        pero el dato está roto por debajo. Cada tarjeta muestra el total y una muestra; arreglá primero lo crítico.
      </p>
    </div>`;
  return { subject, html };
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}.
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'DATA_GUARDIAN_ENABLED=false' });
  }

  let data;
  try {
    data = await runHealthCheck();
  } catch (e) {
    console.error('[cron-data-guardian] auditoría falló:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }

  const hallazgos = Array.isArray(data?.hallazgos) ? data.hallazgos : [];

  if (hallazgos.length) {
    try {
      await sendEmail({ to: TO_EMAIL, ...buildEmail(data) });
    } catch (e) {
      console.error('[cron-data-guardian] no se pudo enviar el aviso:', e.message);
    }
  }

  return res.status(200).json({
    ok: true,
    generado: data?.generado || null,
    hallazgos: hallazgos.length,
    registros: hallazgos.reduce((s, h) => s + (Number(h.n) || 0), 0),
    emailed: hallazgos.length > 0,
    resumen: hallazgos.map(h => ({ check: h.check, severidad: h.severidad, n: h.n })),
  });
}
