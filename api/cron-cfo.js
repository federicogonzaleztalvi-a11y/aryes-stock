// api/cron-cfo.js — EL CFO de Pazque · cierre financiero MENSUAL para el dueño.
//
// Una vez por mes arma el cierre: P&L, unit economics, runway, escenarios y UNA
// movida financiera. Motor en api/_cfo.js. Este archivo orquesta: junta los
// números reales, convoca al CFO (Claude), arma el memo financiero (email) y
// guarda la movida del mes para pedir cuentas el mes que viene.
//
// POR QUÉ MENSUAL (y no semanal como el Directorio): un CFO cierra libros por mes.
// El Directorio es la mirada cualitativa semanal; el CFO es el número frío mensual.
//
// REGLAS (igual que la Torre de Control):
//   • SOLO LECTURA + email a Federico. Cero efectos sobre clientes o datos.
//     Lo único que escribe es su propia memoria (la movida del mes previo).
//   • Auth por CRON_SECRET. Solo Pazque (el negocio del dueño), no la op de Eric.
//   • Consultivo: recomienda; Federico decide y ejecuta.
//   • PRENDIDO por defecto (solo te escribe a vos → riesgo cero). Kill-switch:
//     CFO_AGENT_ENABLED=false.
//   • Sin ANTHROPIC_KEY manda igual el P&L + KPIs crudos.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';
import { gatherFinancials, consultCFO } from './_cfo.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.CFO_AGENT_ENABLED !== 'false';   // ON salvo apagado a mano
const TO_EMAIL    = process.env.CFO_EMAIL || process.env.DIRECTOR_EMAIL || process.env.ALERT_EMAIL || 'federico@pazque.com';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');

const HJSON = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json', 'Content-Type': 'application/json' };
const MEM_KEY = 'cfo_brief';
const MEM_ORG = '_pazque_owner';

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function usd(n) {
  const x = Number(n);
  if (!isFinite(x)) return String(n);
  return 'USD ' + x.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function moneyMap(m) {
  const e = Object.entries(m || {});
  return e.length ? e.map(([k, v]) => `${k} ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`).join(' · ') : '—';
}

function kpi(label, value, sub, accent) {
  return `
    <td style="padding:12px 14px;background:${accent ? '#052e24' : '#f7f7f4'};border-radius:10px;vertical-align:top">
      <div style="font-size:11px;color:${accent ? '#6ee7b7' : '#9a9a98'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:21px;font-weight:700;color:${accent ? '#fff' : '#1a1a18'};line-height:1.1">${esc(value)}</div>
      ${sub ? `<div style="font-size:11px;color:${accent ? '#a7f3d0' : '#6a6a68'};margin-top:3px">${esc(sub)}</div>` : ''}
    </td>`;
}

function buildEmail(fin, brief) {
  const ing = fin.ingreso, c = fin.cuentas, k = fin.kpis, cost = fin.costos, tr = fin.take_rate_opcion, gmv = fin.gmv;

  const grid = `
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 8px">
      <tr>
        ${kpi('MRR cobrado', usd(ing.mrr_usd), ing.mrr_usd === 0 ? 'nadie paga aún' : `${c.pagas} pagas`, true)}
        ${kpi('Burn mensual', usd(cost.burn_mensual_usd), `de bolsillo ${usd(k.net_burn_mensual_usd)}`)}
        ${fin.financiamiento?.runway_aplica
          ? kpi('Runway', k.runway_meses != null ? k.runway_meses + ' meses' : 'sin medir', k.caja_usd != null ? 'caja ' + usd(k.caja_usd) : 'falta ingresar caja')
          : kpi('Financiamiento', 'de bolsillo', 'tarjeta · sin runway tradicional')}
      </tr>
      <tr>
        ${kpi('Break-even', (k.break_even_orgs ?? '—') + ' orgs', `a USD ${ing.precio_lista_usd}/mes`)}
        ${kpi('Design-partners', String(c.design_partners_gratis), 'gratis (Eric)')}
        ${kpi('En prueba', String(c.en_prueba), c.internas_demo + ' demo interna')}
      </tr>
    </table>`;

  // P&L (de los datos crudos; existe aunque Claude no responda).
  const pylRows = brief?.pyl?.length ? brief.pyl.map(r => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18">${esc(r.linea)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18;text-align:right;font-weight:600;white-space:nowrap">${esc(r.monto_usd ? usd(r.monto_usd) : '—')}</td>
    </tr>
    ${r.nota ? `<tr><td colspan="2" style="padding:0 10px 8px;font-size:11px;color:#9a9a98;border-bottom:1px solid #f0ede8">${esc(r.nota)}</td></tr>` : ''}`).join('') : `
    <tr><td style="padding:8px 10px;font-size:13px;color:#1a1a18">Ingreso recurrente (MRR)</td><td style="padding:8px 10px;text-align:right;font-weight:600">${usd(ing.mrr_usd)}</td></tr>
    <tr><td style="padding:8px 10px;font-size:13px;color:#1a1a18">Infra fija (Vercel+Supabase+dominio)</td><td style="padding:8px 10px;text-align:right;font-weight:600">-${usd(cost.fijos_total_usd)}</td></tr>
    <tr><td style="padding:8px 10px;font-size:13px;color:#1a1a18">IA (estimado, ${cost.ia_corridas_30d} corridas/30d)</td><td style="padding:8px 10px;text-align:right;font-weight:600">-${usd(cost.ia_estimado_usd)}</td></tr>
    <tr><td style="padding:8px 10px;font-size:13px;font-weight:700;color:#b91c1c">Resultado mensual (net burn)</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:#b91c1c">-${usd(k.net_burn_mensual_usd)}</td></tr>`;

  const pyl = `
    <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:24px 0 8px">P&amp;L del mes</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #efece7;border-radius:10px;overflow:hidden">${pylRows}</table>
    <p style="font-size:11px;color:#9a9a98;margin:6px 0 0">GMV por la plataforma (${gmv.pedidos_total} pedidos${gmv.incluye_demo ? ', excluye demo' : ''}): total ${moneyMap(gmv.total_por_moneda)} · 30d ${moneyMap(gmv.d30_por_moneda)}. Opción take-rate @${tr.supuesto_pct}% ≈ ${usd(tr.ingreso_anual_take_rate_usd_est)}/año (potencial, no facturado).</p>`;

  let analisis = '';
  if (brief) {
    const num = brief.el_numero_que_importa || {};
    const esc_list = (arr, color) => (arr || []).length
      ? `<ul style="margin:6px 0 0;padding-left:18px">${arr.map(x => `<li style="font-size:13px;color:${color};line-height:1.6">${esc(x)}</li>`).join('')}</ul>`
      : `<p style="font-size:13px;color:#6a6a68;margin:6px 0 0">—</p>`;
    const esce = brief.escenarios?.length ? `
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 8px">Escenarios</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #efece7">
        <tr style="background:#f7f7f4"><th style="padding:7px 9px;text-align:left;font-size:11px;color:#6a6a68">Escenario</th><th style="padding:7px 9px;text-align:left;font-size:11px;color:#6a6a68">MRR</th><th style="padding:7px 9px;text-align:left;font-size:11px;color:#6a6a68">Runway</th><th style="padding:7px 9px;text-align:left;font-size:11px;color:#6a6a68">Lectura</th></tr>
        ${brief.escenarios.map(s => `<tr>
          <td style="padding:7px 9px;border-top:1px solid #f0ede8;font-size:12px;font-weight:600;color:#1a1a18">${esc(s.nombre)}</td>
          <td style="padding:7px 9px;border-top:1px solid #f0ede8;font-size:12px;color:#1a1a18">${esc(s.mrr_usd)}</td>
          <td style="padding:7px 9px;border-top:1px solid #f0ede8;font-size:12px;color:#1a1a18">${esc(s.runway)}</td>
          <td style="padding:7px 9px;border-top:1px solid #f0ede8;font-size:12px;color:#4a4a48">${esc(s.lectura)}</td>
        </tr>`).join('')}
      </table>` : '';

    analisis = `
      ${brief.accountability ? `
      <div style="margin:0 0 18px;padding:12px 14px;background:#fffaf0;border:1px solid #f0e6d2;border-radius:10px">
        <div style="font-size:11px;color:#9a7b2e;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px">Rindiendo cuentas</div>
        <div style="font-size:13px;color:#4a4a48;line-height:1.55">${esc(brief.accountability)}</div>
      </div>` : ''}
      <div style="margin:0 0 20px;padding:16px;background:#052e24;border-radius:12px">
        <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">El número que importa · ${esc(num.label)}</div>
        <div style="font-size:24px;font-weight:700;color:#fff;line-height:1.1;margin-bottom:6px">${esc(num.valor)}</div>
        <div style="font-size:13px;color:#a7f3d0;line-height:1.55">${esc(num.lectura)}</div>
      </div>
      ${pyl}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Unit economics</h2>
      <p style="font-size:13px;color:#4a4a48;line-height:1.6;margin:0">${esc(brief.unit_economics?.lectura)}</p>
      ${brief.unit_economics?.break_even ? `<p style="font-size:12px;color:#6a6a68;margin:4px 0 0">Break-even: ${esc(brief.unit_economics.break_even)}</p>` : ''}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Runway</h2>
      <p style="font-size:13px;color:#4a4a48;line-height:1.6;margin:0"><b>${esc(brief.runway?.estado)}</b> — ${esc(brief.runway?.meses)} ${/^\d/.test(String(brief.runway?.meses)) ? 'meses' : ''}. ${esc(brief.runway?.lectura)}</p>
      ${esce}
      <div style="margin:22px 0 0;padding:16px;background:#f0f9f4;border:1px solid #c6ead6;border-radius:12px">
        <div style="font-size:11px;color:#059669;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">La movida financiera de este mes</div>
        <div style="font-size:16px;font-weight:700;color:#052e24;line-height:1.4;margin-bottom:6px">${esc(brief.la_movida_financiera?.que)}</div>
        <div style="font-size:13px;color:#2a5a48;line-height:1.55">${esc(brief.la_movida_financiera?.por_que)}</div>
        ${brief.la_movida_financiera?.impacto ? `<div style="font-size:12px;color:#2a5a48;line-height:1.55;margin-top:4px">Impacto: ${esc(brief.la_movida_financiera.impacto)}</div>` : ''}
      </div>
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Banderas rojas</h2>
      ${esc_list(brief.banderas_rojas, '#b91c1c')}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">A medir</h2>
      ${esc_list(brief.a_medir, '#4a4a48')}
      ${brief.metodologia ? `<p style="font-size:11px;color:#9a9a98;line-height:1.5;margin:18px 0 0;padding-top:12px;border-top:1px solid #f0ede8">Metodología: ${esc(brief.metodologia)}</p>` : ''}
      ${brief.cierre ? `<p style="font-size:14px;color:#1a1a18;font-style:italic;margin:16px 0 0">${esc(brief.cierre)}</p>` : ''}`;
  } else {
    analisis = `${pyl}
      <p style="font-size:13px;color:#6a6a68;line-height:1.6;margin-top:16px">
      (La síntesis del CFO no está disponible este mes — falta ANTHROPIC_KEY o la llamada falló.
      Te dejo los números crudos arriba para decidir igual.)</p>`;
  }

  const titular = brief?.titular || `Pazque: ${usd(ing.mrr_usd)} MRR · burn ${usd(cost.burn_mensual_usd)}/mes · ${c.pagas} pagas`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px 22px;color:#1a1a18">
      <div style="display:inline-block;background:#052e24;color:#6ee7b7;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.04em">
        EL CFO · CIERRE FINANCIERO MENSUAL
      </div>
      <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;line-height:1.35">${esc(titular)}</h1>
      <p style="font-size:12px;color:#9a9a98;margin:0 0 20px">${esc(fin.fecha)} · consultivo — vos decidís y ejecutás</p>
      ${grid}
      ${analisis}
      <p style="font-size:11px;color:#b5b5b2;margin-top:26px;line-height:1.5;padding-top:14px;border-top:1px solid #f0ede8">
        El CFO de Pazque · copiloto financiero. Solo lee el negocio y te aconseja; no ejecuta ni toca datos de clientes.
        Ingreso = plata cobrada (procesador de pago); el resto es potencial o pipeline.
        <a href="${SITE}/owner" style="color:#059669;text-decoration:none">Abrir consola</a>
      </p>
    </div>`;
  return { subject: `El CFO · ${esc(brief?.titular || (usd(ing.mrr_usd) + ' MRR · ' + fin.fecha))}`.slice(0, 120), html };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'CFO_AGENT_ENABLED=false' });
  }

  const now = Date.now();
  const fin = await gatherFinancials(now);

  // Memoria: la movida del mes pasado (para pedir cuentas).
  let prev = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_config?key=eq.${MEM_KEY}&org_id=eq.${MEM_ORG}&select=value&limit=1`, { headers: HJSON });
    if (r.ok) prev = (await r.json())?.[0]?.value || null;
  } catch { /* best-effort */ }

  const brief = await consultCFO(fin, prev);

  try {
    await sendEmail({ to: TO_EMAIL, ...buildEmail(fin, brief) });
  } catch (e) {
    console.error('[cron-cfo] email falló:', e.message);
  }

  // Guardar la movida de ESTE mes como memoria para la próxima corrida.
  if (brief?.la_movida_financiera?.que) {
    try {
      await fetch(`${SB_URL}/rest/v1/app_config?on_conflict=key,org_id`, {
        method: 'POST',
        headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: MEM_KEY, org_id: MEM_ORG, value: { la_movida: brief.la_movida_financiera.que, mrr: fin.ingreso.mrr_usd, fecha: fin.fecha } }),
      });
    } catch (e) { console.error('[cron-cfo] no se pudo guardar memoria:', e.message); }
  }

  return res.status(200).json({ ok: true, analizado: !!brief, fin });
}
