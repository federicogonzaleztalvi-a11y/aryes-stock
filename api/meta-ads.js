// api/meta-ads.js — Conexión self-service de Meta Ads + dashboard de métricas + insights de Claude.
// ----------------------------------------------------------------------------
// Cada distribuidor conecta SU PROPIA cuenta publicitaria de Meta (Facebook/Instagram)
// con un botón (Facebook Login for Business → devuelve un `code`). Acá:
//   1. canjeamos el code por un access_token (Graph API + App Secret — MISMA app que WhatsApp)
//   2. leemos las cuentas publicitarias que el usuario autorizó
//   3. guardamos { token, account_id, currency, ... } en organizations.meta_ads
//
// Una vez conectado, el dashboard (CampaniasTab) pide:
//   - action=metrics → lee la Marketing API de ESA cuenta (gasto, ROAS, CPA, CTR,
//     alcance, tendencia diaria, mejores/peores anuncios) y devuelve todo calculado.
//   - action=advice  → manda esas métricas a Claude (experto en Meta Ads) y devuelve
//     un panel de sugerencias accionables (NO un chat).
//
// FASE 1 = solo lectura (permiso ads_read). No se toca ninguna campaña.
// FASE 2 (futuro) = pausar/crear con confirmación humana (permiso ads_management).
//
// El token vive SERVER-SIDE (organizations.meta_ads.token), NUNCA vuelve al browser.
// Todo scoped por org del usuario. Genérico multi-tenant (nada hardcodeado a Eric).
// Mismo modelo que api/whatsapp-connect.js / api/simpliroute.js.
//
// GET  ?action=status                       → { connected, account_name, currency }
// POST ?action=connect  { code }            → canjea, lee cuentas, guarda, auto-selecciona
// POST ?action=select   { account_id }      → cambia la cuenta activa (si hay varias)
// POST ?action=disconnect                   → borra credenciales
// GET  ?action=metrics  [&range=last_30d]   → métricas calculadas de la cuenta activa
// GET  ?action=advice   [&range=last_30d]   → sugerencias de Claude sobre esas métricas

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// MISMA app Meta que WhatsApp (cuenta "Recomiendo"). Reusamos App ID + App Secret.
const APP_ID     = process.env.WA_APP_ID || '1031176906086563';
const APP_SECRET = process.env.WA_APP_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const GRAPH = 'https://graph.facebook.com/v21.0';

function svcHeaders() {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json' };
}

// Valida el JWT y resuelve { org, role }. Lectura (metrics/advice) la puede hacer
// cualquier usuario de la org; conectar/desconectar (acción sensible) solo admin.
async function resolveUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const k = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: k, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u) return null;
  return { org: u.org_id, role: u.role };
}

async function getConfig(org) {
  const r = await fetch(
    `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=meta_ads&limit=1`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return null;
  return (await r.json())?.[0]?.meta_ads || null;
}

async function saveConfig(org, cfg) {
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ meta_ads: cfg }),
  });
}

// Canjea el `code` de Facebook Login for Business por un access_token.
// Mismo endpoint/mecánica que whatsapp-connect (misma app → mismo App Secret).
async function exchangeCode(code) {
  const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(APP_ID)}`
    + `&client_secret=${encodeURIComponent(APP_SECRET)}&code=${encodeURIComponent(code)}`;
  const r = await fetch(url);
  if (!r.ok) return { error: (await r.text()).slice(0, 300) };
  const d = await r.json();
  if (!d?.access_token) return { error: 'Meta no devolvió token' };
  return { token: d.access_token };
}

// Lee las cuentas publicitarias que el usuario autorizó al conectar.
async function fetchAdAccounts(token) {
  const url = `${GRAPH}/me/adaccounts?fields=account_id,name,currency,account_status&limit=100&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  if (!r.ok) return { error: (await r.text()).slice(0, 300) };
  const d = await r.json();
  const accounts = (d?.data || []).map(a => ({
    id: 'act_' + a.account_id,
    account_id: a.account_id,
    name: a.name || ('Cuenta ' + a.account_id),
    currency: a.currency || 'USD',
    active: a.account_status === 1,   // 1 = ACTIVE
  }));
  return { accounts };
}

// ── Extracción de resultados/ROAS de una fila de insights ──────────────────
// Meta devuelve `actions` (array de {action_type, value}) y `purchase_roas`.
// Los tipos de acción varían por cuenta; sumamos de forma robusta.
function sumActions(actions, matcher) {
  if (!Array.isArray(actions)) return 0;
  let t = 0;
  for (const a of actions) if (matcher.test(a.action_type || '')) t += Number(a.value) || 0;
  return t;
}
function extractRow(row) {
  const spend = Number(row.spend) || 0;
  const impressions = Number(row.impressions) || 0;
  const clicks = Number(row.clicks) || 0;
  const reach = Number(row.reach) || 0;
  const ctr = Number(row.ctr) || (impressions ? (clicks / impressions) * 100 : 0);
  const cpc = Number(row.cpc) || (clicks ? spend / clicks : 0);
  const cpm = Number(row.cpm) || (impressions ? (spend / impressions) * 1000 : 0);

  const purchases = sumActions(row.actions, /(^|\.)(omni_)?purchase$/);
  const leads     = sumActions(row.actions, /lead/);
  const linkClk   = sumActions(row.actions, /link_click/);
  const messaging = sumActions(row.actions, /(onsite_conversion\.total_messaging_connection|messaging_conversation_started)/);

  // "Resultado" = la conversión más relevante disponible, en orden de valor comercial.
  let results = purchases, resultLabel = 'Compras';
  if (!results && messaging) { results = messaging; resultLabel = 'Conversaciones'; }
  if (!results && leads)     { results = leads;     resultLabel = 'Leads'; }
  if (!results && linkClk)   { results = linkClk;   resultLabel = 'Clics al enlace'; }

  const roasArr = row.purchase_roas;
  let roas = null;
  if (Array.isArray(roasArr) && roasArr.length) roas = Number(roasArr[0].value) || null;
  const convValue = sumActions(row.action_values, /(^|\.)(omni_)?purchase$/);
  if (roas == null && convValue && spend) roas = convValue / spend;

  const cpa = results ? spend / results : null;   // costo por resultado

  return { spend, impressions, clicks, reach, ctr, cpc, cpm, results, resultLabel, roas, cpa, convValue };
}

const INSIGHT_FIELDS = 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values,purchase_roas';

async function fetchInsights(actId, token, { level = 'account', range = 'last_30d', timeIncrement, limit, extraFields } = {}) {
  const p = new URLSearchParams();
  p.set('access_token', token);
  p.set('fields', (extraFields ? extraFields + ',' : '') + INSIGHT_FIELDS);
  p.set('date_preset', range);
  p.set('level', level);
  if (timeIncrement) p.set('time_increment', String(timeIncrement));
  if (limit) p.set('limit', String(limit));
  const r = await fetch(`${GRAPH}/${actId}/insights?${p.toString()}`);
  if (!r.ok) return { error: (await r.text()).slice(0, 400) };
  const d = await r.json();
  return { rows: d?.data || [] };
}

// Arma el paquete completo de métricas de la cuenta activa.
async function buildMetrics(cfg, range) {
  const actId = cfg.id || ('act_' + cfg.account_id);
  const token = cfg.token;

  // 1) Total de la cuenta (una fila agregada).
  const totalRes = await fetchInsights(actId, token, { level: 'account', range });
  if (totalRes.error) return { error: totalRes.error };
  const total = totalRes.rows[0] ? extractRow(totalRes.rows[0]) : extractRow({});

  // 2) Serie diaria para la tendencia (gasto + resultados por día).
  const trendRes = await fetchInsights(actId, token, { level: 'account', range, timeIncrement: 1 });
  const trend = (trendRes.rows || []).map(r => {
    const e = extractRow(r);
    return { date: r.date_start, spend: e.spend, results: e.results, roas: e.roas };
  });

  // 3) Por anuncio, para mejores/peores.
  const adsRes = await fetchInsights(actId, token, {
    level: 'ad', range, limit: 100, extraFields: 'ad_id,ad_name',
  });
  const ads = (adsRes.rows || []).map(r => {
    const e = extractRow(r);
    return { id: r.ad_id, name: r.ad_name || 'Anuncio', ...e };
  }).filter(a => a.spend > 0);

  // Mejores = mejor ROAS (o menor CPA si no hay ROAS); peores = lo contrario. Con gasto real.
  const hasRoas = ads.some(a => a.roas != null);
  const score = (a) => hasRoas ? (a.roas ?? -1) : (a.cpa != null ? -a.cpa : -Infinity);
  const sorted = [...ads].sort((x, y) => score(y) - score(x));
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse().filter(a => !best.includes(a));

  return {
    currency: cfg.currency || 'USD',
    account_name: cfg.account_name || null,
    range,
    total,
    trend,
    ads_count: ads.length,
    best,
    worst,
    sortedBy: hasRoas ? 'roas' : 'cpa',
  };
}

// ── Insights de Claude sobre las métricas (panel de sugerencias, NO chat) ──
async function getAdvice(metrics, currency) {
  if (!ANTHROPIC_KEY) return { error: 'Análisis no disponible (falta configurar Claude).' };
  const t = metrics.total || {};
  const fmt = (n) => (n == null ? '—' : Math.round(n * 100) / 100);
  const compact = {
    moneda: currency,
    periodo: metrics.range,
    total: {
      gasto: fmt(t.spend), resultados: fmt(t.results), tipo_resultado: t.resultLabel,
      costo_por_resultado: fmt(t.cpa), roas: fmt(t.roas), ctr_pct: fmt(t.ctr),
      cpc: fmt(t.cpc), cpm: fmt(t.cpm), alcance: fmt(t.reach), clics: fmt(t.clicks),
    },
    mejores_anuncios: (metrics.best || []).map(a => ({ nombre: a.name, gasto: fmt(a.spend), roas: fmt(a.roas), cpa: fmt(a.cpa), ctr: fmt(a.ctr) })),
    peores_anuncios: (metrics.worst || []).map(a => ({ nombre: a.name, gasto: fmt(a.spend), roas: fmt(a.roas), cpa: fmt(a.cpa), ctr: fmt(a.ctr) })),
    tendencia_gasto_diario: (metrics.trend || []).map(d => fmt(d.spend)),
  };

  const system = `Sos un experto senior en Meta Ads (Facebook/Instagram) y performance marketing, asesorando a un distribuidor mayorista en LATAM. Te paso las métricas reales de su cuenta publicitaria. Devolvé un análisis accionable y directo, en español rioplatense, SIN rodeos ni relleno.

Reglas:
- Respondé ÚNICAMENTE con un array JSON válido, sin texto antes ni después.
- Cada elemento: { "severidad": "alta"|"media"|"info", "titulo": "string corta", "detalle": "1-2 frases con el dato concreto y el porqué", "accion": "qué hacer, concreto" }.
- Máximo 5 sugerencias, ordenadas por impacto. Si algo está bien, marcalo como "info".
- Usá los números reales que te paso (no inventes). Si falta un dato (—), no lo asumas.
- No sugieras ejecutar cambios automáticos: el distribuidor decide y aprueba. Vos aconsejás.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: 'Métricas:\n' + JSON.stringify(compact, null, 2) }],
      }),
    });
    if (!r.ok) return { error: 'No se pudo generar el análisis.' };
    const d = await r.json();
    let text = d?.content?.[0]?.text || '';
    text = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('['); const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    const suggestions = JSON.parse(text);
    return { suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] };
  } catch {
    return { error: 'No se pudo generar el análisis.' };
  }
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'No autorizado' });
  const org = user.org;
  const action = req.query?.action || 'status';
  const range = String(req.query?.range || 'last_30d');

  // ── GET status (nunca devuelve el token) ──
  if (action === 'status' && req.method === 'GET') {
    const cfg = await getConfig(org);
    return res.status(200).json({
      connected: !!cfg?.token,
      account_name: cfg?.account_name || null,
      account_id: cfg?.account_id || null,
      currency: cfg?.currency || null,
      accounts: (cfg?.accounts || []).map(a => ({ account_id: a.account_id, name: a.name, currency: a.currency })),
    });
  }

  // ── POST connect (solo admin): canjea code, lee cuentas, guarda, auto-selecciona ──
  if (action === 'connect' && req.method === 'POST') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede conectar Meta Ads.' });
    if (!APP_SECRET) return res.status(503).json({ error: 'Falta configurar el conector de Meta en el servidor.' });

    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Faltan datos de la conexión. Probá de nuevo.' });

    const ex = await exchangeCode(code);
    if (ex.error) return res.status(400).json({ error: 'No se pudo conectar con Meta: ' + ex.error });
    const token = ex.token;

    const acc = await fetchAdAccounts(token);
    if (acc.error) return res.status(400).json({ error: 'No se pudieron leer tus cuentas publicitarias: ' + acc.error });
    if (!acc.accounts.length) return res.status(400).json({ error: 'No encontramos ninguna cuenta publicitaria en tu Meta. Verificá que tengas una y volvé a intentar.' });

    // Auto-seleccionamos la primera cuenta activa (o la primera, si ninguna figura activa).
    const chosen = acc.accounts.find(a => a.active) || acc.accounts[0];
    const cfg = {
      token,
      id: chosen.id, account_id: chosen.account_id,
      account_name: chosen.name, currency: chosen.currency,
      accounts: acc.accounts,
      connected_at: new Date().toISOString(),
    };
    await saveConfig(org, cfg);
    return res.status(200).json({
      ok: true, connected: true,
      account_name: chosen.name, account_id: chosen.account_id, currency: chosen.currency,
      accounts: acc.accounts.map(a => ({ account_id: a.account_id, name: a.name, currency: a.currency })),
    });
  }

  // ── POST select (solo admin): cambiar cuenta activa entre las autorizadas ──
  if (action === 'select' && req.method === 'POST') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede cambiar la cuenta.' });
    const cfg = await getConfig(org);
    if (!cfg?.token) return res.status(400).json({ error: 'Primero conectá Meta Ads.' });
    const wanted = String(req.body?.account_id || '');
    const found = (cfg.accounts || []).find(a => a.account_id === wanted);
    if (!found) return res.status(400).json({ error: 'Cuenta no encontrada.' });
    cfg.id = found.id; cfg.account_id = found.account_id;
    cfg.account_name = found.name; cfg.currency = found.currency;
    await saveConfig(org, cfg);
    return res.status(200).json({ ok: true, account_name: found.name, account_id: found.account_id, currency: found.currency });
  }

  // ── POST disconnect (solo admin) ──
  if (action === 'disconnect' && req.method === 'POST') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede desconectar.' });
    await saveConfig(org, null);
    return res.status(200).json({ ok: true, connected: false });
  }

  // ── GET metrics: métricas calculadas de la cuenta activa ──
  if (action === 'metrics' && req.method === 'GET') {
    const cfg = await getConfig(org);
    if (!cfg?.token) return res.status(400).json({ error: 'Meta Ads no está conectado.' });
    const m = await buildMetrics(cfg, range);
    if (m.error) return res.status(502).json({ error: 'Meta devolvió un error al leer las métricas: ' + m.error });
    return res.status(200).json(m);
  }

  // ── GET advice: sugerencias de Claude sobre esas métricas ──
  if (action === 'advice' && req.method === 'GET') {
    const cfg = await getConfig(org);
    if (!cfg?.token) return res.status(400).json({ error: 'Meta Ads no está conectado.' });
    const m = await buildMetrics(cfg, range);
    if (m.error) return res.status(502).json({ error: 'No se pudieron leer las métricas para analizar.' });
    const a = await getAdvice(m, cfg.currency || 'USD');
    if (a.error) return res.status(200).json({ suggestions: [], warning: a.error });
    return res.status(200).json({ suggestions: a.suggestions });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}
