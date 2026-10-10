// api/cron-director.js — EL DIRECTOR · copiloto de dirección del DUEÑO de Pazque.
//
// Qué es: un chief of staff de nivel mundial para Federico. No vende, no manda
// nudges a clientes, no toca datos. Una vez por semana LEE todo el estado del
// negocio Pazque (orgs en prueba, pagas, el embudo de adquisición pazque_leads)
// y te manda por email un BRIEF EJECUTIVO que razona con criterio de director:
//   • el estado del negocio en una línea,
//   • LA UNA COSA que importa esta semana (foco — la decisión más difícil),
//   • decisiones que necesita de vos, cada una con recomendación + por qué,
//   • banderas rojas (un trial que se apaga, un lead estancado),
//   • te pide cuentas: se acuerda de la prioridad de la semana pasada y pregunta
//     si se movió (memoria perfecta = lo que a un CEO humano se le escapa).
//
// POR QUÉ PUEDE SER MEJOR QUE UN CEO HUMANO: data completa y en tiempo real,
// memoria perfecta, cero ego/política, y su trabajo nº1 es hacerte decir que NO
// y mantener el foco. No reemplaza tu criterio: es consultivo. Vos decidís y
// ejecutás. No ejecuta nada por su cuenta.
//
// REGLAS DE DISEÑO (mismo criterio que el resto de la Torre de Control):
//   • SOLO LECTURA + email a Federico. Cero efectos sobre clientes o datos del
//     negocio. Lo único que escribe es su propia memoria (la prioridad previa).
//   • Auth por CRON_SECRET, como el resto de los crons.
//   • Solo Pazque: razona sobre EL negocio Pazque, no sobre la operación de Eric.
//   • PRENDIDO por defecto (solo te escribe a vos → riesgo cero). Kill-switch:
//     poné DIRECTOR_AGENT_ENABLED=false para apagarlo.
//   • Si no hay ANTHROPIC_KEY, manda igual el brief con los números crudos
//     (sin el análisis) en vez de no mandar nada.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';

const SB_URL        = process.env.SUPABASE_URL;
const SB_SVC        = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET   = process.env.CRON_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
// Prendido salvo que lo apaguen a mano. Solo escribe a Federico → seguro ON.
const ENABLED       = process.env.DIRECTOR_AGENT_ENABLED !== 'false';
const TO_EMAIL      = process.env.DIRECTOR_EMAIL || process.env.ALERT_EMAIL || 'federico@pazque.com';
const SITE          = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');
const PRICE_USD     = Number(process.env.PAZQUE_PRICE_USD || 149);  // precio de lista por org/mes

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };

const DAY = 24 * 60 * 60 * 1000;
// Memoria del Director: dónde guarda la prioridad de la semana pasada para pedir cuentas.
const MEM_KEY = 'director_brief';
const MEM_ORG = '_pazque_owner';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function getJSON(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ── Señales del negocio Pazque (solo lectura) ───────────────────────────────
async function gatherMetrics(now) {
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const in3d    = new Date(now + 3 * DAY).toISOString();
  const nowISO  = new Date(now).toISOString();

  const orgs  = (await getJSON(
    'organizations?select=id,name,created_at,subscription_status,active,trial_ends_at,activation&limit=1000'
  )) || [];
  const leads = (await getJSON(
    'pazque_leads?select=id,estado,respondio,toques,created_at&limit=2000'
  )) || [];

  // Orgs: buckets de ciclo de vida.
  const isTrial  = (o) => (o.subscription_status || '').toLowerCase() === 'trial';
  const isPaying = (o) => o.active === true && !isTrial(o);
  const trialVivo = (o) => isTrial(o) && o.active !== false &&
    (!o.trial_ends_at || o.trial_ends_at > nowISO);

  const pagas          = orgs.filter(isPaying);
  const trialActivos   = orgs.filter(trialVivo);
  const trialVencen3d  = orgs.filter(o => isTrial(o) && o.trial_ends_at &&
    o.trial_ends_at > nowISO && o.trial_ends_at <= in3d);
  const trialVencidos  = orgs.filter(o => isTrial(o) && o.trial_ends_at && o.trial_ends_at <= nowISO);
  const nuevas7d       = orgs.filter(o => o.created_at && o.created_at >= weekAgo);
  const trialsActivadas = trialActivos.filter(o => o.activation?.activated_at);
  const trialsSinActivar = trialActivos.filter(o => !o.activation?.activated_at);

  // Embudo de adquisición (pazque_leads = prospección + demos inbound del dueño).
  const ESTADOS = ['nuevo', 'contactado', 'demo', 'convertido', 'descartado'];
  const porEstado = {};
  for (const e of ESTADOS) porEstado[e] = leads.filter(l => (l.estado || 'nuevo') === e).length;
  const respondieron = leads.filter(l => l.respondio === true).length;
  const nuevosLeads7d = leads.filter(l => l.created_at && l.created_at >= weekAgo).length;
  // Estancados: contactados hace +7d, sin respuesta, no cerrados.
  const estancados = leads.filter(l =>
    (l.estado === 'contactado' || l.estado === 'demo') &&
    l.respondio !== true && l.created_at && l.created_at < weekAgo
  ).length;

  return {
    fecha: nowISO.slice(0, 10),
    orgs: {
      total: orgs.length,
      pagas: pagas.length,
      trial_activos: trialActivos.length,
      trial_vencen_3d: trialVencen3d.length,
      trial_vencidos_sin_pagar: trialVencidos.length,
      nuevas_ultimos_7d: nuevas7d.length,
      trials_activadas: trialsActivadas.length,     // cargaron catálogo
      trials_sin_activar: trialsSinActivar.length,  // cuenta vacía = no van a pagar
    },
    mrr_usd: pagas.length * PRICE_USD,
    arr_usd: pagas.length * PRICE_USD * 12,
    embudo: {
      leads_total: leads.length,
      nuevos_ultimos_7d: nuevosLeads7d,
      por_estado: porEstado,
      respondieron,
      estancados_mas_7d: estancados,
    },
    // nombres de las que vencen pronto / sin activar, para accionar directo
    detalle: {
      vencen_3d: trialVencen3d.map(o => o.name).filter(Boolean).slice(0, 10),
      sin_activar: trialsSinActivar.map(o => o.name).filter(Boolean).slice(0, 10),
    },
  };
}

// ── El razonamiento del Director (Claude) ───────────────────────────────────
const SYSTEM = `Sos EL DIRECTOR: el copiloto de dirección de Federico, el fundador de Pazque
(SaaS B2B para distribuidoras mayoristas en LATAM; benchmark Shopify como modelo,
Amazon como UX). Federico es fundador solo y no-técnico.

Tu rol es el de un chief of staff / director de nivel mundial: pensás con primeros
principios y frameworks reales (unit economics, cohortes/retención, foco en ICP,
secuenciación), NO con opiniones vagas. Tu trabajo número uno es PROTEGER EL FOCO:
hacer que Federico diga que NO a lo que dispersa y SÍ a la única palanca que mueve
la aguja esta semana. Un fundador solo se pierde construyendo cosas que nadie pidió;
vos lo traés de vuelta al negocio.

Reglas duras:
- Sos CONSULTIVO. Recomendás, Federico decide y ejecuta. Nunca asumas que algo ya se hizo.
- Cero humo. No inventes números ni señales que no estén en los datos. Si un dato
  falta o es ambiguo, decilo.
- Priorizá brutalmente. "La una cosa" es UNA sola. Si listás 5 prioridades, fallaste.
- Español rioplatense (voseo), directo, de igual a igual con un fundador. Sin florituras.
- Si hay una prioridad de la semana pasada, empezá pidiendo cuentas sobre ella.

Devolvé SOLO un JSON con esta forma exacta (sin texto afuera):
{
  "titular": "estado del negocio en una línea honesta",
  "accountability": "sobre la prioridad de la semana pasada: ¿parece haberse movido según los números? qué preguntar. '' si no hay previa",
  "la_una_cosa": { "que": "la única prioridad de esta semana", "por_que": "por qué esta y no otra, con el razonamiento" },
  "decisiones": [ { "tema": "...", "recomendacion": "...", "por_que": "..." } ],
  "banderas_rojas": [ "riesgo concreto con el dato que lo dispara" ],
  "cierre": "una frase de foco para la semana"
}`;

async function askDirector(metrics, prev) {
  if (!ANTHROPIC_KEY) return null;
  const userContent =
    'NÚMEROS DEL NEGOCIO PAZQUE (esta semana):\n' + JSON.stringify(metrics, null, 2) +
    (prev?.la_una_cosa
      ? `\n\nLA PRIORIDAD QUE FIJASTE LA SEMANA PASADA (${prev.fecha || '?'}): "${prev.la_una_cosa}"`
      : '\n\n(No hay prioridad de la semana pasada registrada.)');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1500, system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!r.ok) { console.warn('[cron-director] anthropic error:', r.status); return null; }
    const d = await r.json();
    let text = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
    return JSON.parse(text);
  } catch (err) { console.warn('[cron-director] parse error:', err.message); return null; }
}

// ── Email ───────────────────────────────────────────────────────────────────
function num(label, value, sub) {
  return `
    <td style="padding:12px 14px;background:#f7f7f4;border-radius:10px;vertical-align:top">
      <div style="font-size:11px;color:#9a9a98;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:22px;font-weight:700;color:#1a1a18;line-height:1">${esc(value)}</div>
      ${sub ? `<div style="font-size:11px;color:#6a6a68;margin-top:3px">${esc(sub)}</div>` : ''}
    </td>`;
}

function buildEmail(metrics, brief) {
  const o = metrics.orgs, em = metrics.embudo;
  const grid = `
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 8px">
      <tr>${num('MRR', 'USD ' + metrics.mrr_usd, metrics.arr_usd ? 'ARR USD ' + metrics.arr_usd : '')}${num('Clientes pagos', o.pagas)}${num('En prueba', o.trial_activos, o.trials_sin_activar + ' sin activar')}</tr>
      <tr>${num('Vencen en 3 días', o.trial_vencen_3d)}${num('Leads nuevos (7d)', em.nuevos_ultimos_7d, em.leads_total + ' total')}${num('Leads estancados', em.estancados_mas_7d, '+7d sin respuesta')}</tr>
    </table>`;

  let analisis;
  if (brief) {
    const deci = (brief.decisiones || []).map(d => `
      <div style="margin:0 0 14px;padding:12px 14px;border:1px solid #efece7;border-radius:10px">
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
      <div style="margin:0 0 18px;padding:16px;background:#052e24;border-radius:12px">
        <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">La una cosa de esta semana</div>
        <div style="font-size:16px;font-weight:700;color:#fff;line-height:1.4;margin-bottom:6px">${esc(brief.la_una_cosa?.que)}</div>
        <div style="font-size:13px;color:#a7f3d0;line-height:1.55">${esc(brief.la_una_cosa?.por_que)}</div>
      </div>
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 10px">Decisiones para vos</h2>
      ${deci || '<p style="font-size:13px;color:#6a6a68">Sin decisiones pendientes.</p>'}
      <h2 style="font-size:14px;font-weight:700;color:#1a1a18;margin:22px 0 6px">Banderas rojas</h2>
      ${rojas}
      ${brief.cierre ? `<p style="font-size:14px;color:#1a1a18;font-style:italic;margin:22px 0 0;padding-top:16px;border-top:1px solid #efece7">${esc(brief.cierre)}</p>` : ''}`;
  } else {
    analisis = `<p style="font-size:13px;color:#6a6a68;line-height:1.6">
      (El análisis del Director no está disponible esta semana — falta ANTHROPIC_KEY o la llamada falló.
      Te dejo los números crudos arriba para que decidas igual.)</p>`;
  }

  const titular = brief?.titular || `Pazque: ${o.pagas} pagos · ${o.trial_activos} en prueba · USD ${metrics.mrr_usd} MRR`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px 22px;color:#1a1a18">
      <div style="display:inline-block;background:#052e24;color:#6ee7b7;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.04em">
        EL DIRECTOR · BRIEF SEMANAL
      </div>
      <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;line-height:1.35">${esc(titular)}</h1>
      <p style="font-size:12px;color:#9a9a98;margin:0 0 20px">${esc(metrics.fecha)} · consultivo — vos decidís y ejecutás</p>
      ${grid}
      ${analisis}
      <p style="font-size:11px;color:#b5b5b2;margin-top:26px;line-height:1.5;padding-top:14px;border-top:1px solid #f0ede8">
        El Director de Pazque · copiloto de dirección. Solo lee el negocio y te aconseja; no ejecuta ni toca datos de clientes.
        <a href="${SITE}/owner" style="color:#059669;text-decoration:none">Abrir consola</a>
      </p>
    </div>`;
  return { subject: `El Director · ${esc(brief?.titular || metrics.fecha)}`.slice(0, 120), html };
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
  const prevRows = await getJSON(
    `app_config?key=eq.${MEM_KEY}&org_id=eq.${MEM_ORG}&select=value&limit=1`
  );
  const prev = prevRows?.[0]?.value || null;

  const brief = await askDirector(metrics, prev);

  try {
    await sendEmail({ to: TO_EMAIL, ...buildEmail(metrics, brief) });
  } catch (e) {
    console.error('[cron-director] email falló:', e.message);
  }

  // Guardar la prioridad de ESTA semana como memoria para la próxima corrida.
  if (brief?.la_una_cosa?.que) {
    try {
      await fetch(`${SB_URL}/rest/v1/app_config?on_conflict=key,org_id`, {
        method: 'POST',
        headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          key: MEM_KEY, org_id: MEM_ORG,
          value: { la_una_cosa: brief.la_una_cosa.que, fecha: metrics.fecha },
        }),
      });
    } catch (e) { console.error('[cron-director] no se pudo guardar memoria:', e.message); }
  }

  return res.status(200).json({ ok: true, metrics, analizado: !!brief });
}
