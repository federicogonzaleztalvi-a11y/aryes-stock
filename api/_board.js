// api/_board.js — EL DIRECTORIO de Pazque (motor).
//
// Un board de nivel mundial para un fundador solo. NO son 7 agentes mandándote
// 7 mails sueltos (eso sería ruido = lo contrario del foco). Es una REUNIÓN DE
// DIRECTORIO: cada silla analiza SU dominio con su lente experta, y el PRESIDENTE
// escucha a todos y entrega UNA sola conclusión con UNA prioridad.
//
// Flujo (lo orquesta api/cron-director.js, semanal):
//   1. gatherMetrics() — lee el estado del negocio Pazque (solo lectura).
//   2. Cada silla (CFO, CMO, CRO, CPO, CTO, COO, Estrategia&Legal) opina en
//      paralelo sobre su área: lectura, recomendación, riesgo, y qué dato falta
//      para que su consejo sea más filoso.
//   3. El Presidente sintetiza todas las voces en el brief final (la una cosa +
//      decisiones + banderas + accountability sobre la prioridad previa).
//
// REGLAS: solo lectura + nada de inventar datos. Consultivo: recomienda, Federico
// decide y ejecuta. Si no hay ANTHROPIC_KEY, consultBoard devuelve brief null y
// el cron manda igual los números crudos.
// ----------------------------------------------------------------------------

const SB_URL        = process.env.SUPABASE_URL;
const SB_SVC        = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const PRICE_USD     = Number(process.env.PAZQUE_PRICE_USD || 149);

const H   = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const DAY = 24 * 60 * 60 * 1000;

// Contexto del negocio que comparten todas las sillas (para que opinen situadas).
const BIZ = `Pazque: SaaS B2B multi-tenant para distribuidoras mayoristas (HORECA, food, cosmética) en LATAM.
Modelo tipo Shopify (white-label por-org); UX benchmark Amazon. Lo construye Federico, fundador solo y NO-técnico.
Precio de lista USD ${PRICE_USD}/mes por org. Primer y único cliente pago hoy: Eric, una distribuidora en Uruguay (depósito grande, 400+ compradores).
Etapa: pre-escala, el objetivo es conseguir las distribuidoras 2..N y que los trials activen (carguen catálogo) y paguen.
Agentes ya vivos: ventas (prospección), activación, cobranzas, reactivación, captación de leads inbound, Torre de Control (salud + auto-fix).`;

const OUTPUT = `Devolvé SOLO un JSON con esta forma exacta (sin texto afuera):
{
  "titular": "tu lectura del área en UNA línea honesta",
  "lo_que_veo": "2-4 frases de análisis basadas SOLO en los datos + el contexto. Si falta data, decilo, no inventes.",
  "recomendacion": "la UNA movida que sugerís esta semana desde tu silla",
  "riesgo": "el riesgo nº1 de tu área ahora, o '' si ninguno",
  "dato_que_falta": "qué métrica deberíamos empezar a medir para que tu consejo sea más filoso, o ''"
}
Español rioplatense (voseo), directo, de igual a igual con un fundador. Cero humo. Nada de inventar números ni señales que no estén en los datos.`;

// ── Las sillas del directorio ───────────────────────────────────────────────
export const SEATS = [
  { id: 'cfo', nombre: 'CFO', rol: 'Finanzas',
    foco: `Mirás la salud financiera: MRR/ARR, caja y runway, pricing (¿USD ${PRICE_USD}/mes es bajo/alto para el valor que entrega?), unit economics (LTV vs CAC), y cuándo conviene gastar/contratar vs aguantar. Un fundador solo quema tiempo, no solo plata: cuidá las dos cosas.` },
  { id: 'cmo', nombre: 'CMO', rol: 'Growth & Marketing',
    foco: `Mirás la adquisición: el embudo de leads (pazque_leads), qué canal apretar, el costo de traer una distribuidora, y la marca personal de Federico en Instagram (build in public, founder LATAM). Tu norte: ¿de dónde va a salir la próxima distribuidora?` },
  { id: 'cro', nombre: 'CRO', rol: 'Ventas',
    foco: `Mirás el pipeline y la conversión: leads por estado (nuevo/contactado/demo/convertido/descartado), velocidad de cierre, demos, trials que no arrancan, y follow-ups estancados. Tu norte: mover gente de "interesado" a "paga".` },
  { id: 'cpo', nombre: 'CPO', rol: 'Producto',
    foco: `Mirás el producto: qué construir y SOBRE TODO qué NO. Federico tiende a sobre-construir features que nadie pidió; tu trabajo nº1 es protegerlo de eso y mantener el roadmap pegado a lo que mueve retención/activación/ingresos. Escuchá el feedback real de Eric por encima de las ideas lindas.` },
  { id: 'cto', nombre: 'CTO', rol: 'Ingeniería',
    foco: `Mirás la salud técnica y el riesgo: estabilidad (Torre de Control), deuda técnica, seguridad, y el riesgo de escala. Marcá el bus factor: todo depende de una persona no-técnica + un asistente. ¿Qué te rompe el día que entren 10 clientes a la vez?` },
  { id: 'coo', nombre: 'COO', rol: 'Operaciones & Éxito del Cliente',
    foco: `Mirás que lo que entra, se quede: activación (trials que no cargaron catálogo = cuentas vacías que nunca pagan), onboarding, retención, soporte y salud de cuentas. Prioridad absoluta: que Eric (el único que paga) esté feliz y no se vaya. Perder al cliente ancla retrasa todo.` },
  { id: 'cso', nombre: 'Estrategia & Legal', rol: 'Estrategia y Compliance',
    foco: `Mirás el mediano plazo y el riesgo estructural: moat y posicionamiento (Pazque como el "Choco" comercial, integrar en vez de construir ruteo/WMS), competencia, y el compliance fiscal (facturación CFE/DGI en Uruguay — no hacer pasar un documento interno por factura legal). Tu norte: que las movidas de hoy no cierren puertas mañana.` },
];

async function getJSON(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ── Señales del negocio Pazque (solo lectura) ───────────────────────────────
export async function gatherMetrics(now = Date.now()) {
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const in3d    = new Date(now + 3 * DAY).toISOString();
  const nowISO  = new Date(now).toISOString();

  const orgs  = (await getJSON(
    'organizations?select=id,name,created_at,subscription_status,active,trial_ends_at,activation&limit=1000'
  )) || [];
  const leads = (await getJSON(
    'pazque_leads?select=id,estado,respondio,toques,created_at&limit=2000'
  )) || [];

  const isTrial  = (o) => (o.subscription_status || '').toLowerCase() === 'trial';
  const isPaying = (o) => o.active === true && !isTrial(o);
  const trialVivo = (o) => isTrial(o) && o.active !== false && (!o.trial_ends_at || o.trial_ends_at > nowISO);

  const pagas          = orgs.filter(isPaying);
  const trialActivos   = orgs.filter(trialVivo);
  const trialVencen3d  = orgs.filter(o => isTrial(o) && o.trial_ends_at && o.trial_ends_at > nowISO && o.trial_ends_at <= in3d);
  const trialVencidos  = orgs.filter(o => isTrial(o) && o.trial_ends_at && o.trial_ends_at <= nowISO);
  const nuevas7d       = orgs.filter(o => o.created_at && o.created_at >= weekAgo);
  const trialsActivadas  = trialActivos.filter(o => o.activation?.activated_at);
  const trialsSinActivar = trialActivos.filter(o => !o.activation?.activated_at);

  const ESTADOS = ['nuevo', 'contactado', 'demo', 'convertido', 'descartado'];
  const porEstado = {};
  for (const e of ESTADOS) porEstado[e] = leads.filter(l => (l.estado || 'nuevo') === e).length;
  const respondieron  = leads.filter(l => l.respondio === true).length;
  const nuevosLeads7d = leads.filter(l => l.created_at && l.created_at >= weekAgo).length;
  const estancados = leads.filter(l =>
    (l.estado === 'contactado' || l.estado === 'demo') && l.respondio !== true &&
    l.created_at && l.created_at < weekAgo).length;

  return {
    fecha: nowISO.slice(0, 10),
    orgs: {
      total: orgs.length, pagas: pagas.length, trial_activos: trialActivos.length,
      trial_vencen_3d: trialVencen3d.length, trial_vencidos_sin_pagar: trialVencidos.length,
      nuevas_ultimos_7d: nuevas7d.length,
      trials_activadas: trialsActivadas.length, trials_sin_activar: trialsSinActivar.length,
    },
    mrr_usd: pagas.length * PRICE_USD,
    arr_usd: pagas.length * PRICE_USD * 12,
    precio_lista_usd: PRICE_USD,
    embudo: {
      leads_total: leads.length, nuevos_ultimos_7d: nuevosLeads7d,
      por_estado: porEstado, respondieron, estancados_mas_7d: estancados,
    },
    detalle: {
      vencen_3d: trialVencen3d.map(o => o.name).filter(Boolean).slice(0, 10),
      sin_activar: trialsSinActivar.map(o => o.name).filter(Boolean).slice(0, 10),
    },
  };
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
    if (!r.ok) { console.warn('[board] anthropic error:', r.status); return null; }
    const d = await r.json();
    let t = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const s = t.indexOf('{'); const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  } catch (err) { console.warn('[board] parse error:', err.message); return null; }
}

// Una silla opina sobre su dominio.
async function askSeat(seat, metrics) {
  const system =
    `Sos el/la ${seat.nombre} (${seat.rol}) del directorio de Pazque.\n\n${BIZ}\n\n` +
    `TU LENTE: ${seat.foco}\n\n${OUTPUT}`;
  const out = await askJSON(system, 'NÚMEROS DEL NEGOCIO (esta semana):\n' + JSON.stringify(metrics, null, 2), 700);
  return out ? { ...seat, out } : null;
}

// El Presidente sintetiza a toda la mesa en UNA conclusión.
const CHAIR_SYSTEM = `Sos EL PRESIDENTE del directorio de Pazque: el copiloto de dirección de Federico (fundador solo, no-técnico).
Acabás de escuchar a toda la mesa (CFO, CMO, CRO, CPO, CTO, COO, Estrategia&Legal). Tu trabajo es SINTETIZAR, no repetir:
tomás las voces, resolvés las tensiones entre ellas (ej. el CPO quiere construir y el CFO quiere cuidar caja) y entregás
UNA sola conclusión con UNA sola prioridad. Tu valor nº1 es el FOCO: hacer que Federico diga que NO a todo menos a la
palanca que mueve la aguja esta semana. Pensás con primeros principios y frameworks reales (unit economics, cohortes,
foco en ICP, secuenciación). Cero humo, no inventes datos. Español rioplatense, directo.

${BIZ}

Devolvé SOLO un JSON con esta forma exacta:
{
  "titular": "estado del negocio en UNA línea honesta",
  "accountability": "sobre la prioridad de la semana pasada: ¿parece haberse movido según los números? qué preguntar. '' si no hay previa",
  "la_una_cosa": { "que": "la ÚNICA prioridad de esta semana", "por_que": "por qué esta y no otra; nombrá qué director/es la respaldan", "director": "silla que la impulsa (ej. CMO)" },
  "decisiones": [ { "tema": "...", "recomendacion": "...", "por_que": "..." } ],
  "banderas_rojas": [ "riesgo concreto con el dato que lo dispara" ],
  "cierre": "una frase de foco para la semana"
}`;

async function synthesize(metrics, seats, prev) {
  const mesa = seats.map(s =>
    `• ${s.nombre} (${s.rol}):\n  - Lectura: ${s.out.titular}\n  - Recomienda: ${s.out.recomendacion}` +
    (s.out.riesgo ? `\n  - Riesgo: ${s.out.riesgo}` : '')
  ).join('\n');
  const userContent =
    'NÚMEROS DEL NEGOCIO:\n' + JSON.stringify(metrics, null, 2) +
    '\n\nLO QUE DIJO LA MESA:\n' + (mesa || '(la mesa no pudo opinar esta semana)') +
    (prev?.la_una_cosa
      ? `\n\nLA PRIORIDAD QUE SE FIJÓ LA SEMANA PASADA (${prev.fecha || '?'}): "${prev.la_una_cosa}"`
      : '\n\n(No hay prioridad de la semana pasada registrada.)');
  return askJSON(CHAIR_SYSTEM, userContent, 1600);
}

// ── API pública: convocar al directorio entero ─────────────────────────────
// Corre las sillas en PARALELO (una ronda de latencia) y después el presidente.
export async function consultBoard(metrics, prev) {
  if (!ANTHROPIC_KEY) return { seats: [], brief: null };
  const results = await Promise.all(SEATS.map(s => askSeat(s, metrics)));
  const seats = results.filter(Boolean);
  const brief = await synthesize(metrics, seats, prev);
  return { seats, brief };
}
