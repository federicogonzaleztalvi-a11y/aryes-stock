// api/_cabinet.js — EL JEFE DE GABINETE de Pazque (motor).
//
// Qué es: el chief of staff de Federico (fundador solo, no-técnico). NO es un
// agente más que te manda otro mail. Es la CAPA que se sienta ARRIBA de todos los
// agentes y de la foto cruda del negocio, y la colapsa en UNA sola señal diaria:
// "hoy lo único que mueve la aguja es esto, hacé esto".
//
// FOCO (lo que mira): el ÉXITO COMERCIAL de Pazque COMO PLATAFORMA — salir a
// venderla, sumar distribuidoras, convertir prueba en pago, facturar. NO opera el
// negocio de ningún cliente: trabajarle el embudo o los pedidos a Eric es el
// negocio de ERIC, no el de Federico. La única excepción es la SALUD de una cuenta
// (un cliente que no usa la plataforma) y entra como AGREGADO secundario, enmarcada
// como riesgo para Pazque (perder ingreso/referencia), nunca como "andá a operarle".
//
// Tres cosas que lo hacen distinto a un digest:
//   1. LOOPS ABIERTOS CON MEMORIA. No te manda una foto nueva y se olvida.
//      Detecta temas abiertos (ej. prospectos propios sin contactar, demos
//      calientes sin cerrar, ingreso en $0), los guarda en cabinet_loops y los
//      PERSIGUE día a día: cada loop envejece ("abierto hace 5 días") hasta que se
//      cierra solo cuando la señal deja de reproducirse. Accountability real, no ruido.
//   2. ANCLA A LA ESTRATEGIA. Lee la última prioridad del Directorio y del CFO y
//      alinea las acciones operativas del día a esa prioridad semanal/mensual.
//   3. CAPA DE RAZONAMIENTO. Claude sintetiza métricas + loops + estrategia en un
//      brief priorizado (la única cosa + 3 acciones), con el norte clavado en el
//      único número que importa hoy: el PRIMER cliente que pague.
//
// REGLAS (mismas que el resto de la Torre de Control):
//   • SOLO LECTURA del negocio + email a Federico. Nunca escribe a clientes, nunca
//     toca sus datos. Lo único que escribe es su propia memoria (cabinet_loops).
//   • Genérico multi-tenant: recorre las orgs reales (brandcfg), saltea la demo.
//     Cero cliente hardcodeado — escala solo cuando sumes distribuidoras.
//   • Honestidad de caja: MRR = plata REAL cobrada (app_config pazque_billing),
//     nunca estimada. Si no hay dato, lo dice; no inventa señales.
//   • Sin ANTHROPIC_KEY: devuelve brief null y el cron manda igual los loops crudos.
// ----------------------------------------------------------------------------

import { gatherMetrics } from './_board.js';

const SB_URL        = process.env.SUPABASE_URL;
const SB_SVC        = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const PRICE_USD     = Number(process.env.PAZQUE_PRICE_USD || 199);
const DEMO_ORG      = process.env.DEMO_ORG || 'aryes-ltda';
// Días sin un solo pedido para considerar que una org se está enfriando.
const QUIET_DAYS    = Math.max(3, Number(process.env.CABINET_QUIET_DAYS || 14));

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };
const DAY   = 24 * 60 * 60 * 1000;

const BIZ = `Pazque: SaaS B2B multi-tenant para distribuidoras mayoristas (HORECA, food, cosmética) en LATAM.
Modelo tipo Shopify (white-label por-org); UX benchmark Amazon. Lo construye Federico, fundador SOLO y NO-técnico, bootstrapeando de su bolsillo (sin caja ni runway: lo que importa es costo sostenible + validar el primer ingreso).
NORTE ABSOLUTO DE HOY: VENDER PAZQUE — conseguir el PRIMER cliente que pague y sumar distribuidoras. Ingreso real = 0 (nadie paga todavía).
QUÉ MIRÁS: el negocio de Pazque COMO PLATAFORMA/EMPRESA — su embudo PROPIO de adquisición (pazque_leads: prospectos sin contactar, demos calientes sin cerrar, seguimientos vencidos), trials por vencer / sin activar, altas de distribuidoras, conversión a pago, MRR real.
QUÉ NO MIRÁS: la operación interna de un cliente. Trabajarle sus prospectos (portal_leads) o sus pedidos a Eric es el negocio de ERIC, no de Federico; Eric tiene sus propias herramientas para eso. NO le armes la agenda operativa a un cliente.
Cliente ancla: Eric, una distribuidora en Uruguay (depósito grande, 400+ compradores), hoy GRATIS como design-partner. Importa SOLO como (a) caso de referencia para vender, y (b) riesgo de churn si no usa la plataforma — nunca como un negocio para operarle. NO se le spamea a él ni a sus compradores. aryes-ltda es la org demo interna, no cuenta.
Ya corren solos ~12 agentes (ventas, activación, reactivación, carrito, cobranzas, Torre de Control, El Directorio, El CFO). Tu trabajo NO es duplicarlos: es mirar lo que ellos dejan abierto DEL LADO COMERCIAL DE PAZQUE y decirle a Federico qué hacer HOY para vender.`;

function enc(v) { return encodeURIComponent(v); }

async function getJSON(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function patch(path, body) {
  try {
    await fetch(`${SB_URL}/rest/v1/${path}`, {
      method: 'PATCH', headers: { ...HJSON, Prefer: 'return=minimal' }, body: JSON.stringify(body),
    });
  } catch (e) { console.warn('[cabinet] patch falló:', e.message); }
}
async function insert(body) {
  try {
    await fetch(`${SB_URL}/rest/v1/cabinet_loops`, {
      method: 'POST', headers: { ...HJSON, Prefer: 'return=minimal' }, body: JSON.stringify(body),
    });
  } catch (e) { console.warn('[cabinet] insert falló:', e.message); }
}

// Orgs reales = las que tienen brandcfg, menos la demo. Mapa org_id → nombre.
async function listRealOrgs() {
  const rows = (await getJSON('app_config?key=eq.brandcfg&select=org_id,value')) || [];
  const map = new Map();
  for (const row of rows) {
    if (row.org_id === DEMO_ORG) continue;
    map.set(row.org_id, (row.value && row.value.name) || row.org_id);
  }
  return map;
}

// ── 1) Detectar señales (solo lectura, datos reales) ────────────────────────
// Cada señal es un loop POTENCIAL con una `clave` estable para deduplicar.
// FOCO: vender Pazque (embudo propio + trials + altas + ingreso). La salud de un
// cliente que no usa la plataforma entra al final como AGREGADO secundario.
export async function gatherSignals(metrics, now = Date.now()) {
  const signals = [];

  // El norte: ingreso en $0. Loop de pie hasta el primer cliente que pague.
  if ((metrics.mrr_usd || 0) === 0) {
    signals.push({
      clave: 'ingreso_cero', categoria: 'ingreso', severidad: 3, org_id: null,
      titulo: 'Ingreso real en $0 — ningún cliente paga todavía',
      detalle: `El único número que mueve la aguja hoy es el primer cliente que pague. ${metrics.orgs.pagas} orgs pagas.`,
      evidencia: { mrr_usd: metrics.mrr_usd, pagas: metrics.orgs.pagas },
    });
  }

  // ── EMBUDO PROPIO DE PAZQUE (adquisición de distribuidoras = el core) ──────
  const leads = (await getJSON(
    'pazque_leads?select=id,estado,respondio,ultimo_contacto_at,seguir_desde,created_at&limit=2000'
  )) || [];

  // Prospectos propios nuevos que nadie contactó → es de donde sale la próxima venta.
  const sinContactar = leads.filter(l => (l.estado || 'nuevo') === 'nuevo' && !l.ultimo_contacto_at);
  if (sinContactar.length > 0) {
    const oldest = sinContactar.reduce((min, l) => Math.min(min, new Date(l.created_at).getTime()), Infinity);
    const dias = Number.isFinite(oldest) ? Math.floor((now - oldest) / DAY) : 0;
    signals.push({
      clave: 'leads_propios_sin_contactar', categoria: 'adquisicion',
      severidad: (sinContactar.length >= 5 || dias >= 7) ? 3 : 2, org_id: null,
      titulo: `${sinContactar.length} prospecto(s) de Pazque sin contactar`,
      detalle: `Distribuidoras que entraron al embudo PROPIO y nadie tocó. El más viejo espera hace ${dias} día(s). Es de dónde sale la próxima que pague.`,
      evidencia: { sin_contactar: sinContactar.length, dias_mas_viejo: dias },
    });
  }

  // Prospectos calientes: contestaron pero no están cerrados. Lo más cerca de pagar.
  const calientes = leads.filter(l => l.respondio === true && l.estado !== 'convertido' && l.estado !== 'descartado');
  if (calientes.length > 0) {
    signals.push({
      clave: 'demos_calientes_sin_cerrar', categoria: 'ventas', severidad: 3, org_id: null,
      titulo: `${calientes.length} prospecto(s) caliente(s) sin cerrar`,
      detalle: `Contestaron y mostraron interés pero no están convertidos ni descartados. Es la plata más cerca de entrar — avanzá a demo o cierre antes de que se enfríe.`,
      evidencia: { calientes: calientes.length },
    });
  }

  // Seguimientos vencidos: contactados, sin respuesta, con fecha de re-toque pasada.
  const seguimientos = leads.filter(l =>
    l.ultimo_contacto_at && l.respondio === false && l.seguir_desde &&
    new Date(l.seguir_desde).getTime() <= now);
  if (seguimientos.length > 0) {
    signals.push({
      clave: 'seguimientos_vencidos', categoria: 'ventas', severidad: 2, org_id: null,
      titulo: `${seguimientos.length} seguimiento(s) de prospectos vencido(s)`,
      detalle: `Los contactaste, no respondieron y la fecha de volver a tocar ya pasó. Follow-up hoy o descartá para despejar el pipeline.`,
      evidencia: { vencidos: seguimientos.length },
    });
  }

  // Pipeline seco: ningún prospecto nuevo esta semana → sin leads no hay próxima venta.
  if ((metrics.embudo?.nuevos_ultimos_7d || 0) === 0) {
    signals.push({
      clave: 'pipeline_sin_leads_nuevos', categoria: 'adquisicion', severidad: 2, org_id: null,
      titulo: 'Ningún prospecto nuevo en 7 días',
      detalle: `El embudo propio no sumó leads esta semana. Sin leads nuevos no hay próxima distribuidora: prendé un canal (outbound del agente de ventas, demo en la landing, marca personal en IG).`,
      evidencia: { nuevos_7d: 0 },
    });
  }

  // Sin altas de distribuidoras en 7 días → crecimiento plano del lado de adquisición.
  if ((metrics.orgs?.nuevas_ultimos_7d || 0) === 0) {
    signals.push({
      clave: 'sin_altas_distribuidoras_7d', categoria: 'adquisicion', severidad: 2, org_id: null,
      titulo: 'Ninguna distribuidora nueva se dio de alta en 7 días',
      detalle: `No entró ninguna org nueva esta semana. El crecimiento está plano: la próxima distribuidora no se va a dar de alta sola.`,
      evidencia: { altas_7d: 0 },
    });
  }

  // Trials que vencen en ≤3 días (momento de cerrar o extender).
  for (const name of (metrics.detalle?.vencen_3d || [])) {
    signals.push({
      clave: `trial_vence:${name}`, categoria: 'ventas', severidad: 3, org_id: null,
      titulo: `Prueba por vencer: ${name}`,
      detalle: `El trial vence en ≤3 días. Ventana para cerrar la venta o extender antes de perderlo.`,
      evidencia: { org: name },
    });
  }
  // Trials que entraron pero no cargaron catálogo (cuenta vacía = nunca paga).
  for (const name of (metrics.detalle?.sin_activar || [])) {
    signals.push({
      clave: `trial_sin_activar:${name}`, categoria: 'activacion', severidad: 2, org_id: null,
      titulo: `Prueba sin activar: ${name}`,
      detalle: `Se dio de alta pero no cargó catálogo. Sin catálogo no hay portal que mostrar → no activa → no paga.`,
      evidencia: { org: name },
    });
  }

  // Embudo propio de Pazque estancado (leads contactados hace +7d sin respuesta).
  if ((metrics.embudo?.estancados_mas_7d || 0) > 0) {
    signals.push({
      clave: 'embudo_estancado', categoria: 'ventas', severidad: 2, org_id: null,
      titulo: `${metrics.embudo.estancados_mas_7d} lead(s) propios estancados +7d`,
      detalle: `Prospectos de Pazque contactados hace +7 días sin respuesta registrada. Follow-up o descartá para despejar el pipeline.`,
      evidencia: { estancados: metrics.embudo.estancados_mas_7d },
    });
  }

  // ── AGREGADO (secundario): salud de clientes de Pazque ─────────────────────
  // Un cliente que NO usa la plataforma es RIESGO para Pazque (perdés el caso de
  // referencia y el ingreso futuro de esa cuenta). NO es "operarle el negocio":
  // es vigilar que la plataforma le sirva. Por eso va con severidad baja (1-2) y
  // categoría salud_cliente — nunca compite con una señal de venta.
  const orgs = await listRealOrgs();
  for (const [orgId, nombre] of orgs) {
    const ult = (await getJSON(
      `b2b_orders?org_id=eq.${enc(orgId)}&estado=neq.cancelada&select=creado_en&order=creado_en.desc&limit=1`
    )) || [];
    if (ult[0]?.creado_en) {
      const dias = Math.floor((now - new Date(ult[0].creado_en).getTime()) / DAY);
      if (dias >= QUIET_DAYS) {
        signals.push({
          clave: `cliente_enfriandose:${orgId}`, categoria: 'salud_cliente',
          severidad: dias >= 45 ? 2 : 1, org_id: orgId,
          titulo: `${nombre}: ${dias} días sin usar la plataforma`,
          detalle: `(Agregado — salud de cuenta, no prioridad de venta.) Este cliente de Pazque no mueve un pedido hace ${dias} días. Riesgo para Pazque: si se enfría perdés el caso de referencia y el ingreso futuro de la cuenta. Vigilá que la plataforma le esté sirviendo; no es operarle el negocio.`,
          evidencia: { org: orgId, dias_sin_uso: dias },
        });
      }
    }
  }

  return signals;
}

// ── 2) Reconciliar señales contra la memoria (cabinet_loops) ────────────────
// Envejece los loops que siguen, abre los nuevos y cierra los que ya no aparecen.
export async function reconcileLoops(signals, now = Date.now()) {
  const all = (await getJSON('cabinet_loops?select=*&limit=1000')) || [];
  const byClave = new Map(all.map(l => [l.clave, l]));
  const detected = new Set(signals.map(s => s.clave));
  const nowISO = new Date(now).toISOString();

  const nuevos = [], continua = [], resueltos = [];

  for (const s of signals) {
    const ex = byClave.get(s.clave);
    if (ex) {
      // Ya existía (abierto o resuelto que reaparece): actualizar y mantener la
      // antigüedad original (detectado_en no se pisa → "hace N días" es real).
      await patch(`cabinet_loops?id=eq.${ex.id}`, {
        titulo: s.titulo, detalle: s.detalle, severidad: s.severidad, categoria: s.categoria,
        org_id: s.org_id ?? null, evidencia: s.evidencia || {}, estado: 'abierto',
        ultima_vez_visto: nowISO, resuelto_en: null, veces_visto: (ex.veces_visto || 1) + 1,
      });
      continua.push({ ...ex, ...s, detectado_en: ex.detectado_en });
    } else {
      await insert({
        clave: s.clave, titulo: s.titulo, detalle: s.detalle, severidad: s.severidad,
        categoria: s.categoria, org_id: s.org_id ?? null, evidencia: s.evidencia || {},
        estado: 'abierto', detectado_en: nowISO, ultima_vez_visto: nowISO, veces_visto: 1,
      });
      nuevos.push({ ...s, detectado_en: nowISO });
    }
  }

  // Loops que estaban abiertos y hoy NO se detectaron → se resolvieron (wins).
  for (const l of all) {
    if (l.estado === 'abierto' && !detected.has(l.clave)) {
      await patch(`cabinet_loops?id=eq.${l.id}`, { estado: 'resuelto', resuelto_en: nowISO });
      resueltos.push(l);
    }
  }

  const abiertos = [...nuevos, ...continua]
    // Silenciados (loop_silenciar): siguen abiertos pero no se muestran hasta la fecha.
    .filter(l => !l.silenciado_hasta || new Date(l.silenciado_hasta).getTime() <= now)
    .map(l => ({
      clave: l.clave, titulo: l.titulo, detalle: l.detalle, categoria: l.categoria,
      severidad: l.severidad, org_id: l.org_id ?? null,
      dias_abierto: Math.floor((now - new Date(l.detectado_en).getTime()) / DAY),
    }))
    .sort((a, b) => b.severidad - a.severidad || b.dias_abierto - a.dias_abierto);

  return { abiertos, nuevos, resueltos };
}

// ── 3) Síntesis con Claude (el razonamiento del chief of staff) ─────────────
const CHIEF_SYSTEM = `Sos EL JEFE DE GABINETE de Pazque: el chief of staff de Federico (fundador solo, no-técnico).

${BIZ}

Tu trabajo: mirar la foto del negocio + los LOOPS ABIERTOS (temas que vienen arrastrándose, con su antigüedad en días) + la prioridad estratégica vigente del Directorio y el CFO, y entregar UN parte operativo para HOY sobre cómo VENDER Pazque. Tu valor nº1 es el FOCO y el CIERRE: que Federico avance el embudo de Pazque y cierre loops comerciales, en vez de abrir features nuevas o perder el día operándole el negocio a un cliente.

ESTO ES CLAVE — el parte es sobre PAZQUE COMO EMPRESA, no sobre la operación de un cliente:
- SÍ van: el embudo PROPIO de Pazque (prospectos sin contactar, calientes sin cerrar, seguimientos vencidos, pipeline seco), trials por vencer/sin activar, altas de distribuidoras, conversión a pago, MRR real.
- NO van como acción para Federico: trabajarle los prospectos, los pedidos o el catálogo a un cliente (ej. Eric). Eso es el negocio de ESE cliente, tiene sus propias herramientas. Nunca le armes a Federico la agenda operativa de un cliente.
- Señales con categoría "salud_cliente" son un AGREGADO secundario: un cliente que no usa la plataforma = riesgo de churn/perder la referencia. Mencionalo como RIESGO para Pazque si es relevante, NUNCA como "andá a operarle el negocio". Jamás debe ser la "única cosa del día" salvo que sea el único cliente y esté por irse.

Principios:
- UNA sola cosa primero. La "única cosa de hoy" es la acción de mayor palanca para VENDER Pazque (acercar el primer cliente que pague / sumar una distribuidora) o el loop comercial más caro que se está enfriando. Nada de listas largas.
- Perseguí lo que se enfría. Un loop abierto hace muchos días pesa más que uno nuevo: nombralo y decí por qué ya no se puede ignorar.
- Acciones concretas y chicas. Cada acción = un paso que Federico puede dar hoy en <30 min, con el lugar donde hacerlo. Si una acción implicaría escribirle a clientes/prospectos, NO la auto-ejecutes: proponéla para que él la apruebe.
- Honestidad brutal: cero humo, no inventes números ni señales que no estén en los datos. Si algo no se puede saber con lo que hay, decilo.
- Español rioplatense (voseo), de igual a igual, directo.

Devolvé SOLO un JSON con esta forma exacta (sin texto afuera):
{
  "titular": "estado operativo de hoy en UNA línea honesta",
  "accountability": "sobre lo que dijiste AYER (si hay): ¿se movió, según los loops que se cerraron o siguen? '' si no hay previa",
  "la_unica_cosa": { "que": "la ÚNICA prioridad de hoy", "por_que": "por qué esta y no otra; atála al norte o al loop que se enfría", "como": "el primer paso concreto, hoy, en <30 min", "donde": "dónde se hace (ej. /app → Prospectos, /owner, responder un WhatsApp)" },
  "acciones": [ { "que": "acción concreta", "por_que": "qué loop cierra o qué aguja mueve", "donde": "dónde", "esfuerzo": "5 min | 15 min | 30 min" } ],
  "se_enfria": [ "loop abierto hace N días que no podés seguir pateando (con el número que lo dispara)" ],
  "wins": [ "lo que se cerró/mejoró desde la última corrida" ],
  "cierre": "una frase de foco para el día"
}
"acciones": máximo 3, ordenadas por impacto. No repitas "la_unica_cosa" dentro de "acciones".`;

async function askJSON(system, userContent, maxTokens) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
    });
    if (!r.ok) { console.warn('[cabinet] anthropic error:', r.status); return null; }
    const d = await r.json();
    let t = (d?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const s = t.indexOf('{'); const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  } catch (err) { console.warn('[cabinet] parse error:', err.message); return null; }
}

// metrics: de gatherMetrics(). loops: de reconcileLoops(). estrategia: {director, cfo}.
// prev: el brief de la corrida anterior (para accountability).
export async function consultCabinet(metrics, loops, estrategia, prev) {
  if (!ANTHROPIC_KEY) return null;
  const userContent =
    'FOTO DEL NEGOCIO (hoy):\n' + JSON.stringify(metrics, null, 2) +
    '\n\nLOOPS ABIERTOS (ordenados por severidad y antigüedad):\n' +
    (loops.abiertos.length ? JSON.stringify(loops.abiertos, null, 2) : '(ninguno — todo despejado)') +
    '\n\nSE CERRARON DESDE LA ÚLTIMA CORRIDA:\n' +
    (loops.resueltos.length ? loops.resueltos.map(r => '• ' + r.titulo).join('\n') : '(nada)') +
    '\n\nPRIORIDAD ESTRATÉGICA VIGENTE:\n' +
    (estrategia?.director ? `• Directorio (${estrategia.director.fecha || '?'}): "${estrategia.director.la_una_cosa}"` : '• Directorio: (sin registro)') +
    '\n' +
    (estrategia?.cfo ? `• CFO (${estrategia.cfo.fecha || '?'}): "${estrategia.cfo.la_movida}" (MRR ${estrategia.cfo.mrr ?? '?'})` : '• CFO: (sin registro)') +
    '\n\nLO QUE DIJISTE AYER:\n' +
    (prev?.la_unica_cosa?.que ? `"${prev.la_unica_cosa.que}" (${prev.fecha || '?'})` : '(no hay parte previo)');
  return askJSON(CHIEF_SYSTEM, userContent, 1600);
}

export const CABINET_META = { PRICE_USD, QUIET_DAYS, DEMO_ORG };
