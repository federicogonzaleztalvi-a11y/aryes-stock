// api/cron-ventas.js — AGENTE DE VENTAS PROACTIVO de Pazque (peldaño 2 de autonomía).
//
// La diferencia con /owner: /owner es REACTIVO (Federico aprieta los botones).
// Este agente es PROACTIVO — se despierta SOLO cada mañana (ver vercel.json) y,
// sin que nadie le pida nada:
//
//   1. TRABAJA  → explora el mercado (un rubro/zona distinto por día) y suma
//                 distribuidoras uruguayas nuevas a pazque_leads (Google Places).
//   2. PREPARA  → enriquece las que estén sin enriquecer (hasta un tope diario),
//                 dejando rubro, tamaño, prioridad, ángulo y el mensaje de
//                 WhatsApp YA redactado — reusando EXACTAMENTE el motor de /owner.
//   3. DECIDE   → mira a quién toca seguir hoy (activos con seguimiento vencido)
//                 y cuántos quedan listos para un primer contacto.
//   4. PROPONE  → le manda a Federico un email con el plan del día y el link a
//                 /owner. Deja registro de la corrida en pazque_agent_log.
//
// REGLA DE ORO (igual que el resto de la Torre de Control):
//   • NUNCA manda un WhatsApp solo. Deja todo listo; Federico aprueba y envía.
//   • Apagado por defecto: solo corre si VENTAS_AGENT_ENABLED === 'true'.
//   • Tope de gasto: enriquece como mucho MAX_ENRICH leads por corrida (cada
//     enrich consume Anthropic + lectura web; el tope controla el costo).
//   • Auth por CRON_SECRET, como cron-trial / cron-carrito-abandonado.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';
// Reusamos el MISMO motor que /owner (una sola fuente de verdad: el mensaje que
// arma el agente de la mañana es idéntico al del botón "Enriquecer").
import { sourceDistributors, enrichLead, draftFollowUp } from './owner.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'federico@pazque.com').trim().toLowerCase();
const ENABLED     = process.env.VENTAS_AGENT_ENABLED === 'true';
const MAX_ENRICH  = Math.max(1, Math.min(25, Number(process.env.VENTAS_AGENT_MAX_ENRICH || 8)));
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };

// Rotación de mercado: el agente explora un rubro/zona distinto cada día en vez
// de repetir la misma búsqueda. Determinístico por día (sin estado extra).
const QUERIES = [
  'distribuidoras de alimentos en Montevideo',
  'distribuidoras mayoristas de bebidas en Uruguay',
  'distribuidoras de productos de limpieza en Montevideo',
  'distribuidoras de cosmética y perfumería en Uruguay',
  'distribuidoras de panadería y repostería en Uruguay',
  'distribuidoras de productos para gastronomía en Montevideo',
  'distribuidoras mayoristas de almacén en Canelones',
  'importadoras y distribuidoras de alimentos en Uruguay',
];
function pickQuery() {
  const dayNum = Math.floor(Date.now() / 86_400_000);
  return QUERIES[dayNum % QUERIES.length];
}

async function sbGet(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Email del plan del día: limpio, sobrio, accionable. Solo lista nombres; el
// detalle y el mensaje redactado se ven (y se envían) en /owner.
function digestHtml({ query, sourced, enriched, seguimientos, listos, followUps }) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 0;color:#555">${esc(label)}</td>
         <td style="padding:6px 0;text-align:right;font-weight:700;color:#1a1a18">${esc(val)}</td></tr>`;
  const lista = (arr) => arr.length
    ? '<ul style="margin:8px 0 0;padding-left:18px;color:#333">' +
      arr.slice(0, 12).map(l => `<li style="margin:3px 0">${esc(l.empresa || l.nombre || 'Sin nombre')}</li>`).join('') +
      (arr.length > 12 ? `<li style="margin:3px 0;color:#888">y ${arr.length - 12} más…</li>` : '') +
      '</ul>'
    : '<p style="margin:6px 0 0;color:#888">—</p>';

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#20231f">
    <h2 style="font-size:20px;margin:0 0 4px">Tu plan de ventas de hoy</h2>
    <p style="margin:0 0 18px;color:#6f726a;font-size:14px">El agente trabajó mientras dormías. Esto es lo que te propone.</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #eee;border-bottom:1px solid #eee;margin-bottom:18px">
      ${row('Rubro explorado hoy', query)}
      ${row('Distribuidoras nuevas encontradas', `${sourced.added} nuevas · ${sourced.found} vistas`)}
      ${row('Prospectos enriquecidos (mensaje listo)', enriched)}
      ${row('Seguimientos redactados para hoy', seguimientos)}
    </table>

    <h3 style="font-size:15px;margin:0 0 2px">Listos para un primer contacto (${listos.length})</h3>
    ${lista(listos)}

    <h3 style="font-size:15px;margin:18px 0 2px">Para seguir hoy (${followUps.length})</h3>
    ${lista(followUps)}

    <div style="margin:24px 0 8px">
      <a href="${SITE}/owner" style="display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;
         padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px">Abrir /owner y aprobar envíos</a>
    </div>
    <p style="margin:12px 0 0;color:#9a9a92;font-size:12px">
      El agente nunca envía mensajes solo: deja todo redactado y vos aprobás a mano desde /owner.
    </p>
  </div>`;
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Apagado por defecto: nada corre hasta que Federico prenda el flag.
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'VENTAS_AGENT_ENABLED!=true' });
  }

  const started = Date.now();
  const query = pickQuery();
  let sourced = { added: 0, found: 0 };
  let enriched = 0;
  const errores = [];

  // 1) TRABAJA — explora el rubro del día y suma distribuidoras nuevas.
  try {
    sourced = await sourceDistributors(query);
    if (sourced?.error) { errores.push('sourcing: ' + sourced.error); sourced = { added: 0, found: 0 }; }
  } catch (e) { errores.push('sourcing: ' + (e.message || 'error')); }

  // 2) PREPARA — enriquece pendientes (hasta el tope), dejando el mensaje listo.
  const pend = await sbGet(
    `pazque_leads?enriquecimiento=is.null&estado=eq.nuevo&select=*&order=created_at.desc&limit=${MAX_ENRICH}`
  );
  for (const lead of pend) {
    try {
      const out = await enrichLead(lead);
      if (out?.error) { errores.push(`enrich ${lead.id}: ${out.error}`); continue; }
      const up = await fetch(`${SB_URL}/rest/v1/pazque_leads?id=eq.${lead.id}`, {
        method: 'PATCH', headers: { ...HJSON, Prefer: 'return=minimal' },
        body: JSON.stringify({ enriquecimiento: out.enriquecimiento, enriquecido_at: new Date().toISOString() }),
      });
      if (up.ok) enriched++;
      else errores.push(`guardar ${lead.id}: ${up.status}`);
    } catch (e) { errores.push(`enrich ${lead.id}: ${e.message || 'error'}`); }
  }

  // 3) DECIDE — a quién seguir hoy y cuántos quedan listos para contactar.
  const nowIso = new Date().toISOString();
  const followUps = await sbGet(
    `pazque_leads?estado=in.(contactado,demo)&seguir_desde=lte.${encodeURIComponent(nowIso)}` +
    `&select=id,nombre,empresa,estado,rubro,toques,enriquecimiento,mensaje_final,seguimiento_mensaje` +
    `&order=seguir_desde.asc&limit=50`
  );
  const listos = await sbGet(
    `pazque_leads?estado=eq.nuevo&enriquecimiento=not.is.null` +
    `&select=id,nombre,empresa&order=created_at.desc&limit=50`
  );

  // 3b) PREPARA EL SEGUIMIENTO — para los que tocan hoy y todavía no tienen el
  // próximo toque redactado, lo deja listo (hasta el mismo tope de gasto). Así
  // Federico abre /owner y el mensaje de seguimiento ya está, no solo el primero.
  let seguimientos = 0;
  const porRedactar = followUps.filter(l => !l.seguimiento_mensaje).slice(0, MAX_ENRICH);
  for (const lead of porRedactar) {
    try {
      const out = await draftFollowUp(lead);
      if (out?.error) { errores.push(`seguimiento ${lead.id}: ${out.error}`); continue; }
      const up = await fetch(`${SB_URL}/rest/v1/pazque_leads?id=eq.${lead.id}`, {
        method: 'PATCH', headers: { ...HJSON, Prefer: 'return=minimal' },
        body: JSON.stringify({ seguimiento_mensaje: out.mensaje, seguimiento_generado_at: new Date().toISOString() }),
      });
      if (up.ok) { seguimientos++; lead.seguimiento_mensaje = out.mensaje; }
      else errores.push(`guardar seguimiento ${lead.id}: ${up.status}`);
    } catch (e) { errores.push(`seguimiento ${lead.id}: ${e.message || 'error'}`); }
  }

  const plan = { query, sourced, enriched, seguimientos, listos: listos.length, followUps: followUps.length,
                 errores, ms: Date.now() - started };

  // 4) PROPONE — email del plan (solo si hay algo accionable o hubo errores) + bitácora.
  const hayAlgo = listos.length > 0 || followUps.length > 0 || sourced.added > 0 || errores.length > 0;
  if (hayAlgo) {
    try {
      await sendEmail({
        to: OWNER_EMAIL,
        subject: `Plan de ventas · ${listos.length} para contactar · ${followUps.length} para seguir`,
        html: digestHtml({ query, sourced, enriched, seguimientos, listos, followUps }),
      });
    } catch (e) { errores.push('email: ' + (e.message || 'error')); }
  }

  // Bitácora (auditable). Fire-and-forget: si falla no rompe la corrida.
  try {
    await fetch(`${SB_URL}/rest/v1/pazque_agent_log`, {
      method: 'POST', headers: { ...HJSON, Prefer: 'return=minimal' },
      body: JSON.stringify({ agente: 'ventas', resumen: plan }),
    });
  } catch { /* la bitácora es best-effort */ }

  return res.status(200).json({ ok: true, ...plan });
}
