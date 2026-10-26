// api/cron-jefe-gabinete.js — EL JEFE DE GABINETE · parte operativo diario.
//
// El chief of staff de Federico. Corre todas las mañanas y colapsa la foto del
// negocio + los loops abiertos (que persigue día a día) + la prioridad del
// Directorio/CFO en UN solo parte: "hoy, la única cosa que mueve la aguja es
// esto; después, estas 3; esto se está enfriando; esto se cerró". El motor vive
// en api/_cabinet.js; este archivo orquesta: junta datos, reconcilia loops,
// convoca la síntesis, arma el email y guarda el parte para pedir cuentas mañana.
//
// REGLAS (mismas que el resto de la Torre de Control):
//   • SOLO LECTURA del negocio + email a Federico. No escribe a clientes, no toca
//     sus datos. Lo único que escribe es su memoria (cabinet_loops + su parte).
//   • Auth por CRON_SECRET. Solo Pazque (el negocio del dueño), no la op de Eric.
//   • Consultivo: propone; Federico decide y ejecuta. No auto-ejecuta nada.
//   • PRENDIDO por defecto (solo te escribe a vos → riesgo cero). Kill-switch:
//     CABINET_ENABLED=false.
//   • Sin ANTHROPIC_KEY manda igual el parte con los loops crudos.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';
import { gatherMetrics } from './_board.js';
import { gatherSignals, reconcileLoops, consultCabinet } from './_cabinet.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.CABINET_ENABLED !== 'false';   // ON salvo apagado a mano
const TO_EMAIL    = process.env.CABINET_EMAIL || process.env.DIRECTOR_EMAIL || process.env.ALERT_EMAIL || 'federico@pazque.com';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');

const HJSON  = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json', 'Content-Type': 'application/json' };
const MEM_ORG = '_pazque_owner';
const MEM_KEY = 'cabinet_brief';

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Lee una memoria de app_config (value jsonb) del dueño.
async function readMem(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_config?key=eq.${key}&org_id=eq.${MEM_ORG}&select=value&limit=1`, { headers: HJSON });
    if (r.ok) return (await r.json())?.[0]?.value || null;
  } catch { /* best-effort */ }
  return null;
}

const SEV_COLOR = { 3: '#b91c1c', 2: '#9a7b2e', 1: '#6a6a68' };
const SEV_TXT   = { 3: 'alta', 2: 'media', 1: 'baja' };

function num(label, value, sub) {
  return `
    <td style="padding:12px 14px;background:#f7f7f4;border-radius:10px;vertical-align:top">
      <div style="font-size:11px;color:#9a9a98;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:22px;font-weight:700;color:#1a1a18;line-height:1">${esc(value)}</div>
      ${sub ? `<div style="font-size:11px;color:#6a6a68;margin-top:3px">${esc(sub)}</div>` : ''}
    </td>`;
}

function buildEmail(metrics, loops, brief) {
  const o = metrics.orgs, em = metrics.embudo;
  const grid = `
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 8px">
      <tr>${num('MRR real', 'USD ' + metrics.mrr_usd, metrics.mrr_usd ? '' : 'nadie paga aún')}${num('Clientes pagos', o.pagas)}${num('En prueba', o.trial_activos, o.trials_sin_activar + ' sin activar')}</tr>
      <tr>${num('Loops abiertos', loops.abiertos.length)}${num('Leads nuevos (7d)', em.nuevos_ultimos_7d, em.leads_total + ' total')}${num('Cerrados hoy', loops.resueltos.length)}</tr>
    </table>`;

  // Tabla de loops abiertos (lo que el Jefe persigue). Ordenados por severidad+edad.
  const loopsRows = loops.abiertos.slice(0, 12).map(l => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f4f4f0;font-size:13px;color:#1a1a18;vertical-align:top">
        ${esc(l.titulo)}
        <div style="font-size:11px;color:#9a9a98;margin-top:2px">${esc(l.categoria)}</div>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #f4f4f0;font-size:12px;color:#6a6a68;white-space:nowrap;text-align:right;vertical-align:top">
        hace ${l.dias_abierto}d
        <div style="font-size:11px;color:${SEV_COLOR[l.severidad] || '#6a6a68'};margin-top:2px">${SEV_TXT[l.severidad] || ''}</div>
      </td>
    </tr>`).join('');
  const loopsTable = loops.abiertos.length ? `
    <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:24px 0 8px">Loops abiertos (${loops.abiertos.length})</h2>
    <table style="width:100%;border-collapse:collapse">${loopsRows}</table>` : `
    <p style="font-size:13px;color:#059669;margin:20px 0 0">Sin loops abiertos — todo despejado. 🎉</p>`;

  let cuerpo;
  if (brief) {
    const acciones = (brief.acciones || []).map(a => `
      <div style="margin:0 0 10px;padding:11px 13px;border:1px solid #efece7;border-radius:10px">
        <div style="font-size:13px;font-weight:700;color:#1a1a18;margin-bottom:3px">${esc(a.que)}</div>
        <div style="font-size:12px;color:#4a4a48;line-height:1.5">${esc(a.por_que)}</div>
        <div style="font-size:11px;color:#9a9a98;margin-top:4px">${esc(a.donde || '')}${a.esfuerzo ? ` · ${esc(a.esfuerzo)}` : ''}</div>
      </div>`).join('');
    const enfria = (brief.se_enfria || []).length
      ? `<ul style="margin:6px 0 0;padding-left:18px">${(brief.se_enfria || []).map(x => `<li style="font-size:13px;color:#b91c1c;line-height:1.6">${esc(x)}</li>`).join('')}</ul>`
      : `<p style="font-size:13px;color:#6a6a68;margin:6px 0 0">Nada crítico enfriándose.</p>`;
    const wins = (brief.wins || []).length
      ? `<ul style="margin:6px 0 0;padding-left:18px">${(brief.wins || []).map(x => `<li style="font-size:13px;color:#059669;line-height:1.6">${esc(x)}</li>`).join('')}</ul>` : '';
    cuerpo = `
      ${brief.accountability ? `
      <div style="margin:0 0 18px;padding:12px 14px;background:#fffaf0;border:1px solid #f0e6d2;border-radius:10px">
        <div style="font-size:11px;color:#9a7b2e;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px">Lo de ayer</div>
        <div style="font-size:13px;color:#4a4a48;line-height:1.55">${esc(brief.accountability)}</div>
      </div>` : ''}
      <div style="margin:0 0 20px;padding:16px;background:#052e24;border-radius:12px">
        <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">La única cosa de hoy</div>
        <div style="font-size:16px;font-weight:700;color:#fff;line-height:1.4;margin-bottom:6px">${esc(brief.la_unica_cosa?.que)}</div>
        <div style="font-size:13px;color:#a7f3d0;line-height:1.55;margin-bottom:8px">${esc(brief.la_unica_cosa?.por_que)}</div>
        ${brief.la_unica_cosa?.como ? `<div style="font-size:13px;color:#fff;line-height:1.5">→ ${esc(brief.la_unica_cosa.como)}</div>` : ''}
        ${brief.la_unica_cosa?.donde ? `<div style="font-size:11px;color:#6ee7b7;margin-top:4px">${esc(brief.la_unica_cosa.donde)}</div>` : ''}
      </div>
      ${acciones ? `<h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 10px">Después, estas</h2>${acciones}` : ''}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Se está enfriando</h2>
      ${enfria}
      ${wins ? `<h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Se cerró</h2>${wins}` : ''}
      ${loopsTable}
      ${brief.cierre ? `<p style="font-size:14px;color:#1a1a18;font-style:italic;margin:22px 0 0;padding-top:16px;border-top:1px solid #efece7">${esc(brief.cierre)}</p>` : ''}`;
  } else {
    cuerpo = `
      <p style="font-size:13px;color:#6a6a68;line-height:1.6;margin:0 0 8px">
      (La síntesis del Jefe de Gabinete no está disponible — falta ANTHROPIC_KEY o la llamada falló.
      Te dejo igual los loops abiertos para que decidas.)</p>
      ${loopsTable}`;
  }

  const titular = brief?.titular || `Pazque: ${loops.abiertos.length} loops abiertos · USD ${metrics.mrr_usd} MRR`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px 22px;color:#1a1a18">
      <div style="display:inline-block;background:#052e24;color:#6ee7b7;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.04em">
        JEFE DE GABINETE · PARTE DEL DÍA
      </div>
      <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;line-height:1.35">${esc(titular)}</h1>
      <p style="font-size:12px;color:#9a9a98;margin:0 0 20px">${esc(metrics.fecha)} · consultivo — vos decidís y ejecutás</p>
      ${grid}
      ${cuerpo}
      <p style="font-size:11px;color:#b5b5b2;margin-top:26px;line-height:1.5;padding-top:14px;border-top:1px solid #f0ede8">
        El Jefe de Gabinete de Pazque · chief of staff. Persigue los loops abiertos hasta cerrarlos; solo lee el negocio y te aconseja, no ejecuta ni toca datos de clientes.
        <a href="${SITE}/owner" style="color:#059669;text-decoration:none">Abrir consola</a>
      </p>
    </div>`;
  return { subject: `Jefe de Gabinete · ${esc(brief?.titular || metrics.fecha)}`.slice(0, 120), html };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'CABINET_ENABLED=false' });
  }

  const now = Date.now();
  const metrics = await gatherMetrics(now);

  // Detectar señales → reconciliar contra la memoria (abre/envejece/cierra loops).
  const signals = await gatherSignals(metrics, now);
  const loops = await reconcileLoops(signals, now);

  // Anclar a la estrategia vigente + pedir cuentas sobre el parte de ayer.
  const [director, cfo, prev] = await Promise.all([
    readMem('director_brief'), readMem('cfo_brief'), readMem(MEM_KEY),
  ]);

  const brief = await consultCabinet(metrics, loops, { director, cfo }, prev);

  try {
    await sendEmail({ to: TO_EMAIL, ...buildEmail(metrics, loops, brief) });
  } catch (e) {
    console.error('[cron-jefe-gabinete] email falló:', e.message);
  }

  // Guardar el parte de HOY como memoria para la accountability de mañana.
  if (brief?.la_unica_cosa?.que) {
    try {
      await fetch(`${SB_URL}/rest/v1/app_config?on_conflict=key,org_id`, {
        method: 'POST',
        headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: MEM_KEY, org_id: MEM_ORG, value: { la_unica_cosa: brief.la_unica_cosa, fecha: metrics.fecha } }),
      });
    } catch (e) { console.error('[cron-jefe-gabinete] no se pudo guardar memoria:', e.message); }
  }

  return res.status(200).json({
    ok: true,
    loops: { abiertos: loops.abiertos.length, nuevos: loops.nuevos.length, resueltos: loops.resueltos.length },
    analizado: !!brief,
  });
}
