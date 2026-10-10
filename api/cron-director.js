// api/cron-director.js — EL DIRECTORIO · copiloto de dirección del DUEÑO de Pazque.
//
// Un board de nivel mundial para Federico (fundador solo, no-técnico). Una vez
// por semana convoca una REUNIÓN DE DIRECTORIO: siete sillas (CFO, CMO, CRO,
// CPO, CTO, COO, Estrategia&Legal) analizan cada una su dominio, y el PRESIDENTE
// las sintetiza en UN solo brief con UNA sola prioridad. El motor vive en
// api/_board.js; este archivo orquesta: junta datos, convoca la mesa, arma el
// email (minutas) y guarda la prioridad para pedir cuentas la semana que viene.
//
// POR QUÉ UN BOARD Y NO 7 MAILS: muchos expertos, UNA decisión. El foco es el
// producto, no el ruido. Es lo que hacen bien Apple/Amazon/Shopify.
//
// REGLAS (mismo criterio que el resto de la Torre de Control):
//   • SOLO LECTURA + email a Federico. Cero efectos sobre clientes o datos.
//     Lo único que escribe es su propia memoria (la prioridad previa).
//   • Auth por CRON_SECRET. Solo Pazque (el negocio del dueño), no la op de Eric.
//   • Consultivo: recomienda; Federico decide y ejecuta. No ejecuta nada solo.
//   • PRENDIDO por defecto (solo te escribe a vos → riesgo cero). Kill-switch:
//     DIRECTOR_AGENT_ENABLED=false.
//   • Sin ANTHROPIC_KEY manda igual el brief con los números crudos.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';
import { gatherMetrics, consultBoard, SEATS } from './_board.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.DIRECTOR_AGENT_ENABLED !== 'false';   // ON salvo apagado a mano
const TO_EMAIL    = process.env.DIRECTOR_EMAIL || process.env.ALERT_EMAIL || 'federico@pazque.com';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');

const HJSON = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json', 'Content-Type': 'application/json' };
const MEM_KEY = 'director_brief';
const MEM_ORG = '_pazque_owner';

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(label, value, sub) {
  return `
    <td style="padding:12px 14px;background:#f7f7f4;border-radius:10px;vertical-align:top">
      <div style="font-size:11px;color:#9a9a98;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:22px;font-weight:700;color:#1a1a18;line-height:1">${esc(value)}</div>
      ${sub ? `<div style="font-size:11px;color:#6a6a68;margin-top:3px">${esc(sub)}</div>` : ''}
    </td>`;
}

function buildEmail(metrics, seats, brief) {
  const o = metrics.orgs, em = metrics.embudo;
  const grid = `
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 8px">
      <tr>${num('MRR', 'USD ' + metrics.mrr_usd, metrics.arr_usd ? 'ARR USD ' + metrics.arr_usd : '')}${num('Clientes pagos', o.pagas)}${num('En prueba', o.trial_activos, o.trials_sin_activar + ' sin activar')}</tr>
      <tr>${num('Vencen en 3 días', o.trial_vencen_3d)}${num('Leads nuevos (7d)', em.nuevos_ultimos_7d, em.leads_total + ' total')}${num('Leads estancados', em.estancados_mas_7d, '+7d sin respuesta')}</tr>
    </table>`;

  // La mesa: una línea por director (lectura + qué recomienda), directo de cada silla.
  const mesa = seats.length ? `
    <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:24px 0 10px">La mesa (${seats.length} directores)</h2>
    ${seats.map(s => `
      <div style="margin:0 0 10px;padding:11px 13px;border:1px solid #efece7;border-radius:10px">
        <div style="font-size:11px;color:#9a9a98;text-transform:uppercase;letter-spacing:.03em;font-weight:700;margin-bottom:3px">${esc(s.nombre)} · ${esc(s.rol)}</div>
        <div style="font-size:13px;color:#1a1a18;margin-bottom:3px">${esc(s.out.titular)}</div>
        <div style="font-size:12px;color:#4a4a48;line-height:1.5">→ ${esc(s.out.recomendacion)}</div>
        ${s.out.riesgo ? `<div style="font-size:12px;color:#b91c1c;line-height:1.5;margin-top:3px">⚠ ${esc(s.out.riesgo)}</div>` : ''}
        ${s.out.dato_que_falta ? `<div style="font-size:11px;color:#9a7b2e;line-height:1.5;margin-top:3px">◷ dato a medir: ${esc(s.out.dato_que_falta)}</div>` : ''}
      </div>`).join('')}` : '';

  let analisis;
  if (brief) {
    const deci = (brief.decisiones || []).map(d => `
      <div style="margin:0 0 12px;padding:12px 14px;border:1px solid #efece7;border-radius:10px">
        <div style="font-size:14px;font-weight:700;color:#1a1a18;margin-bottom:4px">${esc(d.tema)}</div>
        <div style="font-size:13px;color:#1a1a18;margin-bottom:4px">→ ${esc(d.recomendacion)}</div>
        <div style="font-size:12px;color:#6a6a68;line-height:1.5">${esc(d.por_que)}</div>
      </div>`).join('');
    const rojas = (brief.banderas_rojas || []).length
      ? `<ul style="margin:6px 0 0;padding-left:18px">${(brief.banderas_rojas || []).map(b => `<li style="font-size:13px;color:#b91c1c;line-height:1.6">${esc(b)}</li>`).join('')}</ul>`
      : `<p style="font-size:13px;color:#6a6a68;margin:6px 0 0">Ninguna esta semana.</p>`;
    analisis = `
      ${brief.accountability ? `
      <div style="margin:0 0 18px;padding:12px 14px;background:#fffaf0;border:1px solid #f0e6d2;border-radius:10px">
        <div style="font-size:11px;color:#9a7b2e;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px">Rindiendo cuentas</div>
        <div style="font-size:13px;color:#4a4a48;line-height:1.55">${esc(brief.accountability)}</div>
      </div>` : ''}
      <div style="margin:0 0 20px;padding:16px;background:#052e24;border-radius:12px">
        <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">La una cosa de esta semana${brief.la_una_cosa?.director ? ` · impulsa ${esc(brief.la_una_cosa.director)}` : ''}</div>
        <div style="font-size:16px;font-weight:700;color:#fff;line-height:1.4;margin-bottom:6px">${esc(brief.la_una_cosa?.que)}</div>
        <div style="font-size:13px;color:#a7f3d0;line-height:1.55">${esc(brief.la_una_cosa?.por_que)}</div>
      </div>
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 10px">Decisiones para vos</h2>
      ${deci || '<p style="font-size:13px;color:#6a6a68">Sin decisiones pendientes.</p>'}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Banderas rojas</h2>
      ${rojas}
      ${mesa}
      ${brief.cierre ? `<p style="font-size:14px;color:#1a1a18;font-style:italic;margin:22px 0 0;padding-top:16px;border-top:1px solid #efece7">${esc(brief.cierre)}</p>` : ''}`;
  } else {
    analisis = `${mesa}
      <p style="font-size:13px;color:#6a6a68;line-height:1.6;margin-top:16px">
      (La síntesis del directorio no está disponible esta semana — falta ANTHROPIC_KEY o la llamada falló.
      Te dejo los números crudos arriba para decidir igual.)</p>`;
  }

  const titular = brief?.titular || `Pazque: ${o.pagas} pagos · ${o.trial_activos} en prueba · USD ${metrics.mrr_usd} MRR`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px 22px;color:#1a1a18">
      <div style="display:inline-block;background:#052e24;color:#6ee7b7;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.04em">
        EL DIRECTORIO · MINUTAS SEMANALES
      </div>
      <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;line-height:1.35">${esc(titular)}</h1>
      <p style="font-size:12px;color:#9a9a98;margin:0 0 20px">${esc(metrics.fecha)} · consultivo — vos decidís y ejecutás</p>
      ${grid}
      ${analisis}
      <p style="font-size:11px;color:#b5b5b2;margin-top:26px;line-height:1.5;padding-top:14px;border-top:1px solid #f0ede8">
        El Directorio de Pazque · copiloto de dirección. Solo lee el negocio y te aconseja; no ejecuta ni toca datos de clientes.
        <a href="${SITE}/owner" style="color:#059669;text-decoration:none">Abrir consola</a>
      </p>
    </div>`;
  return { subject: `El Directorio · ${esc(brief?.titular || metrics.fecha)}`.slice(0, 120), html };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'DIRECTOR_AGENT_ENABLED=false' });
  }

  const now = Date.now();
  const metrics = await gatherMetrics(now);

  // Memoria: la prioridad de la semana pasada (para pedir cuentas).
  let prev = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_config?key=eq.${MEM_KEY}&org_id=eq.${MEM_ORG}&select=value&limit=1`, { headers: HJSON });
    if (r.ok) prev = (await r.json())?.[0]?.value || null;
  } catch { /* best-effort */ }

  const { seats, brief } = await consultBoard(metrics, prev);

  try {
    await sendEmail({ to: TO_EMAIL, ...buildEmail(metrics, seats, brief) });
  } catch (e) {
    console.error('[cron-director] email falló:', e.message);
  }

  // Guardar la prioridad de ESTA semana como memoria para la próxima corrida.
  if (brief?.la_una_cosa?.que) {
    try {
      await fetch(`${SB_URL}/rest/v1/app_config?on_conflict=key,org_id`, {
        method: 'POST',
        headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: MEM_KEY, org_id: MEM_ORG, value: { la_una_cosa: brief.la_una_cosa.que, fecha: metrics.fecha } }),
      });
    } catch (e) { console.error('[cron-director] no se pudo guardar memoria:', e.message); }
  }

  return res.status(200).json({ ok: true, directores: seats.length, de: SEATS.length, analizado: !!brief, metrics });
}
