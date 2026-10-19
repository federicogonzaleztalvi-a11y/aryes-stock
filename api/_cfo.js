// api/_cfo.js — EL CFO de Pazque (motor financiero).
//
// No es "el asiento de CFO del Directorio" (eso es una opinión de una línea).
// Esto es el CIERRE FINANCIERO MENSUAL: un CFO de verdad (mentalidad IB/PE, HBS)
// que arma el P&L, las unit economics, el runway y los escenarios con DATOS REALES
// del negocio, y entrega UN número que importa + UNA movida financiera.
//
// Principio nº1 (lo que separa a un CFO de un pitch deck): HONESTIDAD DE CAJA.
//   • Ingreso = plata que REALMENTE entró (orgs con cobro vía Stripe/MercadoPago).
//     Hoy = USD 0: Eric es design-partner gratis (free_forever) y aryes-ltda es demo.
//   • Nunca confundir "logos" ni "potencial" con ingreso facturado/cobrado.
//   • GMV que pasa por la plataforma se mide aparte (es la opción de take-rate a futuro),
//     y se marca si es histórico/demo vs corriente.
//   • Costos: fijos conocidos (infra que Federico paga) + estimaciones transparentes
//     (IA por nº de corridas). Todo supuesto va firmado en "metodología".
//
// Flujo (lo orquesta api/cron-cfo.js, mensual):
//   1. gatherFinancials() — lee ingresos, GMV, costos y drivers (SOLO LECTURA).
//   2. consultCFO() — una llamada a Claude con lente de CFO top → brief estructurado.
//   Sin ANTHROPIC_KEY devuelve brief null y el cron manda igual el P&L + KPIs crudos.
//
// REGLAS (igual que la Torre de Control): solo lectura + email a Federico. Cero
// efectos sobre clientes o datos (solo escribe su propia memoria mensual). Consultivo.
// Nada de inventar números. Español rioplatense, de igual a igual con un fundador.
// ----------------------------------------------------------------------------

const SB_URL        = process.env.SUPABASE_URL;
const SB_SVC        = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const H   = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const DAY = 24 * 60 * 60 * 1000;

// ── Parámetros económicos (defaults sensatos; override por env sin tocar código) ──
const PRICE_USD  = Number(process.env.PAZQUE_PRICE_USD ?? 199);        // precio de lista/mes por org
// Costos fijos de infra que Federico paga hoy (USD/mes). Editables en Vercel.
const COST = {
  vercel:   Number(process.env.PAZQUE_COST_VERCEL_USD   ?? 20),        // Vercel Pro
  supabase: Number(process.env.PAZQUE_COST_SUPABASE_USD ?? 25),        // Supabase Pro + compute Small
  dominio:  Number(process.env.PAZQUE_COST_DOMINIO_USD  ?? 1.5),       // pazque.com amortizado
  email:    Number(process.env.PAZQUE_COST_EMAIL_USD    ?? 0),         // Resend (free tier hoy)
  otros:    Number(process.env.PAZQUE_COST_OTROS_USD    ?? 0),         // buffer / misc
};
// IA (Anthropic) es variable: se estima por corridas de agentes, con un piso.
const AI_PER_RUN = Number(process.env.PAZQUE_AI_COST_PER_RUN  ?? 0.03);
const AI_FLOOR   = Number(process.env.PAZQUE_AI_COST_FLOOR_USD ?? 10);
// Caja disponible (opcional). Sin esto no se puede calcular runway honestamente.
const CASH_USD   = process.env.PAZQUE_CASH_USD != null && process.env.PAZQUE_CASH_USD !== ''
  ? Number(process.env.PAZQUE_CASH_USD) : null;
// Modo de financiamiento. Federico bootstrappea de bolsillo con tarjeta (sin caja
// asignada) → el "runway" tradicional NO aplica; el límite es el costo mensual de
// bolsillo sostenible, no meses de caja. Default: 'caja' si cargó caja, si no bootstrap.
const FUNDING    = (process.env.PAZQUE_FUNDING || (CASH_USD != null ? 'caja' : 'bootstrap_tarjeta')).toLowerCase();
const IS_BOOTSTRAP = FUNDING !== 'caja';
// Take-rate hipotético para dimensionar la opción de monetización por GMV (%).
const TAKE_RATE  = Number(process.env.PAZQUE_TAKE_RATE_PCT ?? 1.5);
// Orgs internas/demo a excluir del ingreso real (config, no hardcode en la lógica).
const INTERNAL   = (process.env.PAZQUE_INTERNAL_ORGS || 'aryes-ltda')
  .split(',').map(s => s.trim()).filter(Boolean);

const BIZ = `Pazque: SaaS B2B multi-tenant para distribuidoras mayoristas (HORECA, food, cosmética) en LATAM.
Modelo tipo Shopify (white-label por-org); precio de lista USD ${PRICE_USD}/mes por org. Lo construye Federico, fundador SOLO y NO-técnico (su tiempo es el recurso más escaso; no cobra sueldo → el P&L no tiene costo laboral, pero su tiempo SÍ es un costo real no-monetario).
Etapa: pre-ingreso. Cliente ancla: Eric, distribuidora en Uruguay (depósito grande, 400+ compradores), hoy GRATIS como design-partner (free_forever). aryes-ltda es la org demo interna de Federico, no cobra.
Monetización futura en 3 baldes: (1) suscripción (hoy), (2) take-rate sobre el GMV que pasa por la plataforma (riesgo cero, retener en la fuente), (3) financiamiento. El GMV de hoy dimensiona el balde 2.
FINANCIAMIENTO: Federico BOOTSTRAPPEA — paga la infra de su BOLSILLO con tarjeta de crédito, sin presupuesto asignado ni caja en banco para Pazque. Por eso NO hay "runway" tradicional (meses de caja) y NO le pidas que "cargue la caja": no existe. El número a cuidar es el COSTO MENSUAL DE BOLSILLO (que sea sostenible a nivel personal) y, sobre todo, VALIDAR INGRESO antes de que ese costo escale al sumar clientes. El riesgo real en esta etapa es tiempo del fundador + falta de validación de que alguien paga, NO quedarse sin caja.`;

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }

async function getJSON(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ── Lectura financiera del negocio (solo lectura) ───────────────────────────
export async function gatherFinancials(now = Date.now()) {
  const nowISO  = new Date(now).toISOString();
  const d30     = new Date(now - 30 * DAY).toISOString();
  const d90     = new Date(now - 90 * DAY).toISOString();

  const orgs = (await getJSON(
    'organizations?select=id,name,active,plan,plan_name,subscription_status,stripe_subscription_id,mp_payment_id,created_at,trial_ends_at&limit=1000'
  )) || [];
  const orders = (await getJSON(
    'b2b_orders?select=org_id,cliente_id,total,moneda,creado_en,estado&limit=5000'
  )) || [];
  const agentRuns = (await getJSON(
    `pazque_agent_log?ran_at=gte.${d30}&select=id,agente&limit=5000`
  )) || [];

  // ── Clasificación de cuentas (honesta y genérica) ──
  const isInternal = (o) => INTERNAL.includes(o.id);
  const isPaying   = (o) => !isInternal(o) && (!!o.stripe_subscription_id || !!o.mp_payment_id); // cobro real vía procesador
  const isFree     = (o) => !isInternal(o) && !isPaying(o) && (o.plan === 'free_forever' || o.plan_name === 'free_forever');
  const isTrial    = (o) => !isInternal(o) && !isPaying(o) && !isFree(o) &&
    ((o.subscription_status || '').toLowerCase() === 'trial' || (o.plan || '').toLowerCase() === 'trial');
  const isOtra     = (o) => !isInternal(o) && !isPaying(o) && !isFree(o) && !isTrial(o); // activa sin cobro ni plan claro

  const pagas   = orgs.filter(isPaying);
  const free    = orgs.filter(isFree);
  const trials  = orgs.filter(isTrial);
  const otras   = orgs.filter(isOtra);
  const internas = orgs.filter(isInternal);

  const mrr = round(pagas.length * PRICE_USD);  // ingreso recurrente REAL cobrado
  const arr = round(mrr * 12);

  // ── GMV (plata que pasa por la plataforma) — real (sin orgs internas) vs total ──
  const externalOrders = orders.filter(o => !INTERNAL.includes(o.org_id));
  const sumBy = (list, sinceISO) => {
    const by = {};
    for (const o of list) {
      if (sinceISO && !(o.creado_en && o.creado_en >= sinceISO)) continue;
      const ccy = (o.moneda || 'USD').toUpperCase();
      by[ccy] = round((by[ccy] || 0) + (Number(o.total) || 0));
    }
    return by;
  };
  const gmv = {
    total_por_moneda: sumBy(externalOrders),
    d90_por_moneda:   sumBy(externalOrders, d90),
    d30_por_moneda:   sumBy(externalOrders, d30),
    pedidos_total:    externalOrders.length,
    pedidos_30d:      externalOrders.filter(o => o.creado_en && o.creado_en >= d30).length,
    pedidos_90d:      externalOrders.filter(o => o.creado_en && o.creado_en >= d90).length,
    compradores_activos_30d: new Set(externalOrders.filter(o => o.creado_en && o.creado_en >= d30).map(o => o.cliente_id)).size,
    incluye_demo: orders.length !== externalOrders.length,
  };
  // GMV mensual (USD) estimado desde los últimos 90d → anualizado, para dimensionar take-rate.
  const gmvUSD90 = Number(gmv.d90_por_moneda.USD || 0);
  const gmvMensualUSD = round(gmvUSD90 / 3);
  const gmvAnualRunRate = round(gmvMensualUSD * 12);
  const takeRateAnualUSD = round(gmvAnualRunRate * (TAKE_RATE / 100));

  // ── Costos / burn ──
  const fixedTotal = round(COST.vercel + COST.supabase + COST.dominio + COST.email + COST.otros);
  const aiCost     = round(Math.max(AI_FLOOR, agentRuns.length * AI_PER_RUN));
  const burn       = round(fixedTotal + aiCost);

  // Asignación de costo de IA por agente (sabor CFO: cost allocation).
  const porAgente = {};
  for (const r of agentRuns) porAgente[r.agente || 'desconocido'] = (porAgente[r.agente || 'desconocido'] || 0) + 1;

  // ── KPIs derivados ──
  const grossMarginPct = mrr > 0 ? round(((mrr - costToServe(pagas.length, aiCost, fixedTotal)) / mrr) * 100) : null;
  const breakEvenOrgs  = PRICE_USD > 0 ? Math.ceil(burn / PRICE_USD) : null;
  const runwayMeses    = (CASH_USD != null && burn > 0) ? round(CASH_USD / burn) : null;
  const netBurnMensual = round(burn - mrr); // lo que se quema por mes después del ingreso

  return {
    fecha: nowISO.slice(0, 10),
    moneda_base: 'USD',
    ingreso: {
      mrr_usd: mrr, arr_usd: arr, precio_lista_usd: PRICE_USD,
      cobrado_este_mes_usd: mrr, // hoy = recurrente; no hay one-offs
    },
    cuentas: {
      pagas: pagas.length,
      design_partners_gratis: free.length,
      en_prueba: trials.length,
      activas_sin_cobro: otras.length,
      internas_demo: internas.length,
      total: orgs.length,
      detalle_pagas: pagas.map(o => o.name).filter(Boolean).slice(0, 10),
      detalle_gratis: free.map(o => o.name).filter(Boolean).slice(0, 10),
    },
    gmv,
    take_rate_opcion: {
      supuesto_pct: TAKE_RATE,
      gmv_mensual_usd_est: gmvMensualUSD,
      gmv_anual_run_rate_usd_est: gmvAnualRunRate,
      ingreso_anual_take_rate_usd_est: takeRateAnualUSD,
      nota: 'potencial, NO facturado. Basado en GMV de los últimos 90 días.',
    },
    costos: {
      fijos_usd: COST, fijos_total_usd: fixedTotal,
      ia_estimado_usd: aiCost, ia_corridas_30d: agentRuns.length, ia_por_agente: porAgente,
      ia_supuesto: `max(piso USD ${AI_FLOOR}, ${agentRuns.length} corridas × USD ${AI_PER_RUN})`,
      burn_mensual_usd: burn,
    },
    financiamiento: {
      modo: IS_BOOTSTRAP ? 'de bolsillo (tarjeta de crédito), sin presupuesto asignado' : 'caja asignada',
      costo_bolsillo_mensual_usd: netBurnMensual,   // lo que sale del bolsillo hoy (burn − ingreso)
      runway_aplica: !IS_BOOTSTRAP,
      nota: IS_BOOTSTRAP
        ? 'Bootstrap: no hay runway tradicional. El límite es que el costo mensual de bolsillo sea sostenible y validar ingreso antes de que escale.'
        : 'Runway = caja / burn.',
    },
    kpis: {
      net_burn_mensual_usd: netBurnMensual,
      break_even_orgs: breakEvenOrgs,
      gross_margin_pct: grossMarginPct,
      runway_meses: IS_BOOTSTRAP ? null : runwayMeses,
      caja_usd: CASH_USD,
      costo_por_cuenta_activa_usd: round(burn / Math.max(1, pagas.length + free.length)),
    },
    supuestos: {
      ingreso: 'Solo cuenta como ingreso la org con cobro vía Stripe/MercadoPago. Design-partners y demo = USD 0.',
      costos_fijos: 'Valores por defecto de infra; ajustables por env (PAZQUE_COST_*).',
      ia: 'Estimación por nº de corridas de agentes en pazque_agent_log; no es el gasto exacto de la API.',
      runway: IS_BOOTSTRAP
        ? 'NO APLICA: bootstrap de bolsillo con tarjeta, sin caja. El número a cuidar es el costo mensual de bolsillo.'
        : (CASH_USD == null ? 'SIN CALCULAR: falta ingresar la caja (env PAZQUE_CASH_USD).' : 'caja / burn.'),
    },
  };
}

// Costo de servir a las cuentas que generan carga (pagas) — proxy simple.
function costToServe(nPagas, aiCost, fixedTotal) {
  if (nPagas <= 0) return 0;
  // Atribuimos infra variable + IA proporcional; infra fija es mayormente hundida.
  return round((aiCost + fixedTotal * 0.5) * (nPagas / Math.max(1, nPagas)));
}

// ── Una llamada a Claude que devuelve JSON (tolerante) ──────────────────────
async function askJSON(system, userContent, maxTokens) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
    });
    if (!r.ok) { console.warn('[cfo] anthropic error:', r.status); return null; }
    const d = await r.json();
    let t = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const s = t.indexOf('{'); const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  } catch (err) { console.warn('[cfo] parse error:', err.message); return null; }
}

const CFO_SYSTEM = `Sos EL CFO de Pazque: el director financiero del fundador (Federico, solo y no-técnico). Perfil: formación de banca de inversión / private equity, mentalidad Harvard Business School. Pensás con primeros principios, unit economics, cohortes, sensibilidad y escenarios. Sos el adulto en la sala sobre la plata.

${BIZ}

TU TRABAJO este mes: tomar los NÚMEROS REALES que te paso (ingreso cobrado, GMV, costos, burn, KPIs) y entregar un cierre financiero de nivel. Reglas no negociables:
1. HONESTIDAD DE CAJA. Ingreso = plata que entró. Hoy es USD 0 y hay que decirlo sin anestesia. NUNCA presentes logos, design-partners ni potencial como ingreso. Separá SIEMPRE: cobrado | potencial (take-rate) | pipeline.
2. CERO INVENTOS. Si un dato no está (ej. caja → runway), decí "no medido, medilo" en vez de estimar al aire. Marcá qué es dato duro y qué es estimación.
3. FOCO. Un fundador solo no ejecuta 10 cosas. Entregá UNA movida financiera que mueva la aguja este mes.
4. Rigor pero claro para un no-financiero: si usás un término (burn, runway, gross margin, CAC/LTV, break-even), explicalo en media línea. Nada de humo ni jerga vacía.
5. Pensá la etapa: pre-ingreso, el riesgo nº1 NO es el costo (burn chico) — es la falta de validación de que alguien PAGA. El costo real es el TIEMPO del fundador. Decí la verdad incómoda si la ves.

Español rioplatense (voseo), directo, de igual a igual. Devolvé SOLO un JSON con esta forma exacta (sin texto afuera):
{
  "titular": "estado financiero en UNA línea honesta",
  "el_numero_que_importa": { "label": "qué número", "valor": "el valor", "lectura": "por qué ESE número manda este mes" },
  "accountability": "sobre la prioridad financiera del mes pasado: ¿se movió según los números? '' si no hay previa",
  "pyl": [ { "linea": "ej. Ingreso recurrente (MRR)", "monto_usd": "0", "nota": "media línea honesta" } ],
  "unit_economics": { "lectura": "2-4 frases: margen, costo de servir, break-even. Qué falta medir (CAC/LTV/churn) y por qué todavía no aplica o sí", "break_even": "qué hace falta para cubrir el burn en una línea" },
  "runway": { "estado": "sano | ajustado | sin_medir | no_aplica_bootstrap", "meses": "nº, 'sin medir', o 'no aplica' si es bootstrap de bolsillo", "lectura": "si es bootstrap: NO pidas cargar caja; hablá del costo mensual de bolsillo y su sostenibilidad. Si hay caja: qué significa y qué hacer" },
  "escenarios": [ { "nombre": "Base | Optimista | Pesimista", "supuestos": "...", "mrr_usd": "...", "runway": "...", "lectura": "..." } ],
  "la_movida_financiera": { "que": "la ÚNICA movida financiera de este mes", "por_que": "por qué ESTA", "impacto": "qué cambia en los números si se hace" },
  "banderas_rojas": [ "riesgo financiero concreto con el dato que lo dispara" ],
  "a_medir": [ "la métrica que deberíamos empezar a trackear para decidir mejor" ],
  "metodologia": "1-2 frases firmando los supuestos clave (qué es dato duro vs estimación) para que nadie se confunda",
  "cierre": "una frase de foco financiero para el mes"
}`;

// ── API pública: convocar al CFO ────────────────────────────────────────────
export async function consultCFO(fin, prev) {
  if (!ANTHROPIC_KEY) return null;
  const userContent =
    'NÚMEROS FINANCIEROS REALES (este mes):\n' + JSON.stringify(fin, null, 2) +
    (prev?.la_movida
      ? `\n\nLA MOVIDA FINANCIERA QUE SE FIJÓ EL MES PASADO (${prev.fecha || '?'}): "${prev.la_movida}". MRR de ese mes: USD ${prev.mrr ?? '?'}.`
      : '\n\n(No hay cierre del mes pasado registrado — es el primer cierre.)');
  return askJSON(CFO_SYSTEM, userContent, 2000);
}
