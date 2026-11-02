// api/_cabinet-learn.js — FASE A del loop de aprendizaje del Jefe de Gabinete.
//
// Cierra el círculo de la aprobación-con-un-clic: mide si las acciones que Federico
// YA aprobó efectivamente FUNCIONARON, cruzando cada una contra el dato de hoy.
//
// Todavía NO cambia comportamiento (eso es la Fase B): solo RINDE CUENTAS —
// "de lo que aprobaste, X de Y prospectos respondieron". Es la materia prima para
// que mañana el Jefe re-priorice con evidencia real en vez de adivinar.
//
// Qué mide hoy (las 2 palancas de venta más ricas y con dato limpio):
//   • lead_marcar_contactado → ¿ese prospecto pasó a respondió=true / convertido?
//   • trial_extender         → ¿esa distribuidora volvió a usar la plataforma
//                              (hizo un pedido) después de darle aire?
//
// Honestidad de dato: el "win" de un trial se mide por USO real (un pedido después
// de la extensión), no por un estado de suscripción que podría no reflejar la
// realidad. Si no se puede saber todavía (acción muy reciente), cuenta como
// "pendiente", no como fracaso.
//
// Read-only: lee cabinet_actions ejecutadas + el estado actual de leads/orgs. Lo
// único que escribe es el resumen agregado en app_config (cabinet_learning), igual
// que director_brief/cfo_brief. Best-effort: si algo falla, el parte sale igual.
// ----------------------------------------------------------------------------

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const DAY = 24 * 60 * 60 * 1000;

// Cuántos días miramos hacia atrás (qué acciones aprobadas entran a medición).
const LOOKBACK_DAYS = Math.max(7, Number(process.env.LEARN_LOOKBACK_DAYS || 60));
// Ventana de maduración: una acción aprobada hace menos que esto todavía no se
// juzga (le damos tiempo al prospecto/distribuidora a reaccionar) → cuenta pendiente.
const WINDOW_DAYS = Math.max(1, Number(process.env.LEARN_WINDOW_DAYS || 7));

function enc(v) { return encodeURIComponent(v); }
async function getJSON(path) {
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; }
  catch { return null; }
}

// ── Scorecard: cruzar acciones ejecutadas contra el desenlace en el dato ──────
// Devuelve { por_tipo: { <tipo>: {total, win, miss, pending} }, total, fecha } o
// null si no hay nada que medir todavía.
export async function gatherScorecard(now = Date.now()) {
  const sinceISO = new Date(now - LOOKBACK_DAYS * DAY).toISOString();
  const acts = (await getJSON(
    `cabinet_actions?estado=eq.ejecutada&ejecutada_en=gte.${enc(sinceISO)}` +
    '&select=tipo,payload,ejecutada_en&order=ejecutada_en.asc&limit=1000'
  )) || [];
  if (!acts.length) return null;

  const por_tipo = {};

  // ── lead_marcar_contactado → ¿respondió / convirtió? ──────────────────────
  const contact = acts.filter(a => a.tipo === 'lead_marcar_contactado' && a.payload?.lead_id);
  if (contact.length) {
    const ids = [...new Set(contact.map(a => a.payload.lead_id))];
    const leads = (await getJSON(
      `pazque_leads?id=in.(${ids.join(',')})&select=id,estado,respondio`
    )) || [];
    const byId = new Map(leads.map(l => [l.id, l]));
    let win = 0, miss = 0, pending = 0;
    for (const a of contact) {
      const l = byId.get(a.payload.lead_id);
      if (!l) continue;                                       // lead borrado → no lo contamos
      const respondio = l.respondio === true || l.estado === 'convertido';
      const madura = (now - new Date(a.ejecutada_en).getTime()) >= WINDOW_DAYS * DAY;
      if (respondio) win++;
      else if (madura) miss++;
      else pending++;
    }
    por_tipo.lead_marcar_contactado = { total: win + miss + pending, win, miss, pending };
  }

  // ── trial_extender → ¿volvió a usar la plataforma (pedido post-extensión)? ─
  const trials = acts.filter(a => a.tipo === 'trial_extender' && a.payload?.org_id);
  if (trials.length) {
    const ids = [...new Set(trials.map(a => a.payload.org_id))];
    const earliest = trials.reduce((m, a) => Math.min(m, new Date(a.ejecutada_en).getTime()), Infinity);
    const orders = (await getJSON(
      `b2b_orders?org_id=in.(${ids.map(enc).join(',')})&estado=neq.cancelada` +
      `&creado_en=gte.${enc(new Date(earliest).toISOString())}&select=org_id,creado_en`
    )) || [];
    let win = 0, miss = 0, pending = 0;
    for (const a of trials) {
      const execMs = new Date(a.ejecutada_en).getTime();
      const madura = (now - execMs) >= WINDOW_DAYS * DAY;
      const usoPost = orders.some(o => o.org_id === a.payload.org_id && new Date(o.creado_en).getTime() >= execMs);
      if (usoPost) win++;
      else if (madura) miss++;
      else pending++;
    }
    por_tipo.trial_extender = { total: win + miss + pending, win, miss, pending };
  }

  const total = Object.values(por_tipo).reduce((s, x) => s + x.total, 0);
  if (!total) return null;
  return { por_tipo, total, window_dias: WINDOW_DAYS, lookback_dias: LOOKBACK_DAYS };
}
