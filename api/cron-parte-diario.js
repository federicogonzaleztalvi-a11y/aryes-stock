// api/cron-parte-diario.js — Torre de Control · PARTE DIARIO (digest matutino).
//
// Por qué existe: la Torre de Control hoy es REACTIVA (te avisa cuando algo se
// rompe) pero no te da la foto de "¿cómo viene el negocio?" sin que vos entres a
// mirar. Este cron te manda, cada mañana a las 7:00 (hora Uruguay), UN solo mail
// con el pulso del día anterior: si el sitio está arriba, cuánto se vendió en
// cada org real, qué orgs están calladas (riesgo de churn) y cuántas demos
// nuevas de Pazque entraron. Abrís el mail con el café y ya sabés dónde mirar.
//
// REGLAS DE DISEÑO (mismo criterio que el resto de la Torre de Control):
//   • Sólo LECTURA, cero efectos: no crea pedidos, no manda nada a clientes,
//     no toca datos. El único destinatario sos vos (Federico).
//   • Genérico por-org: recorre TODAS las orgs reales (las que tienen brandcfg),
//     saltea la org demo. No hay ningún cliente hardcodeado — escala solo cuando
//     sumes clientes.
//   • Auth por CRON_SECRET, como el resto de los crons.
//   • Kill-switch: prendido salvo PARTE_DIARIO_ENABLED === 'false'. Riesgo cero
//     (sólo te manda un mail a vos), por eso viene de fábrica.
//   • Zona horaria: Vercel corre en UTC. "Ayer" = el día completo de Uruguay
//     (UTC-3). El cron dispara 10:00 UTC = 07:00 UY (ver vercel.json).
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.PARTE_DIARIO_ENABLED !== 'false';   // default ON
const TO_EMAIL    = process.env.PARTE_DIARIO_EMAIL || process.env.OWNER_EMAIL || 'federico@pazque.com';
const DEMO_ORG    = process.env.DEMO_ORG || 'aryes-ltda';           // org demo/admin, no es cliente real
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');
const TIMEOUT_MS  = 12000;

const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

const DAY_MS = 24 * 60 * 60 * 1000;
const UY_OFFSET_MS = 3 * 60 * 60 * 1000;  // Uruguay = UTC-3 (sin horario de verano)

// Precios de la landing (un solo plan): USD 199/mes los primeros 3 meses de cada
// cliente (precio de lanzamiento), luego USD 399/mes. El MRR estimado aplica 199
// a las orgs con <90 días de vida y 399 a las más antiguas — es una estimación
// honesta a partir de created_at, no un dato de facturación real.
const PRECIO_LANZAMIENTO = 199;
const PRECIO_PLENO       = 399;
const LANZAMIENTO_DIAS   = 90;

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('es-UY', { maximumFractionDigits: 0 });
}

// Rango [inicio, fin) del día de AYER en hora Uruguay, expresado en UTC real.
function rangoAyerUruguay() {
  // Corremos "ahora" al reloj de pared uruguayo para extraer y/m/d sin líos de TZ.
  const nowUy = new Date(Date.now() - UY_OFFSET_MS);
  const y = nowUy.getUTCFullYear(), m = nowUy.getUTCMonth(), d = nowUy.getUTCDate();
  // Medianoche de HOY en Uruguay, en UTC real.
  const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0) + UY_OFFSET_MS);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  return { from: yesterdayStart, to: todayStart };
}

// fetch con timeout: un endpoint colgado no cuelga el parte.
async function timedFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function chequearSalud() {
  const [db, site] = await Promise.all([
    timedFetch(`${SB_URL}/rest/v1/organizations?select=id&limit=1`, { headers: H }),
    timedFetch(`${SITE}/`, { method: 'GET' }),
  ]);
  return {
    db:   db.ok,
    site: site.ok,
    ok:   db.ok && site.ok,
    detalle: [
      { name: 'Base de datos', ok: db.ok, info: db.ok ? 'OK' : (db.error || 'HTTP ' + db.status) },
      { name: 'Sitio pazque.com', ok: site.ok, info: site.ok ? 'OK' : (site.error || 'HTTP ' + site.status) },
    ],
  };
}

// Lista de orgs reales = las que tienen brandcfg, menos la demo. Devuelve
// mapa org_id → nombre comercial (de brandcfg.value.name).
async function listarOrgsReales() {
  const r = await fetch(SB_URL + '/rest/v1/app_config?key=eq.brandcfg&select=org_id,value', { headers: H });
  const orgs = new Map();
  if (r.ok) {
    for (const row of await r.json()) {
      if (row.org_id === DEMO_ORG) continue;
      orgs.set(row.org_id, (row.value && row.value.name) || row.org_id);
    }
  }
  return orgs;
}

// Foto de Pazque COMO EMPRESA (no de los clientes): cuántos clientes tengo,
// cuántos pagan, MRR estimado, pipeline del embudo y pendientes de prospección.
// Todo de lectura, de las tablas organizations + pazque_leads.
async function fotoPazque(fromISO, toISO) {
  // --- Clientes (organizations) ---
  const orgRes = await fetch(
    SB_URL + '/rest/v1/organizations?select=id,active,plan,subscription_status,plan_name,trial_ends_at,created_at',
    { headers: H }
  );
  const orgs = orgRes.ok ? await orgRes.json() : [];
  const reales = orgs.filter(o => o.id !== DEMO_ORG);

  const now = Date.now();
  let activos = 0, pagos = 0, enPrueba = 0, nuevosAyer = 0, mrr = 0;
  const pruebasPorVencer = [];  // {id, dias}
  for (const o of reales) {
    if (o.active === false) continue;
    activos++;
    const creada = o.created_at ? new Date(o.created_at).getTime() : null;
    if (creada && creada >= new Date(fromISO).getTime() && creada < new Date(toISO).getTime()) nuevosAyer++;

    const estado = (o.subscription_status || '').toLowerCase();
    const pagando = estado === 'active' || (o.plan_name && o.plan_name !== 'trial' && estado !== 'trial');
    if (pagando) {
      pagos++;
      const diasVida = creada ? Math.floor((now - creada) / DAY_MS) : 999;
      mrr += diasVida < LANZAMIENTO_DIAS ? PRECIO_LANZAMIENTO : PRECIO_PLENO;
    } else if (estado === 'trial') {
      enPrueba++;
      if (o.trial_ends_at) {
        const dias = Math.ceil((new Date(o.trial_ends_at).getTime() - now) / DAY_MS);
        if (dias >= 0 && dias <= 7) pruebasPorVencer.push({ id: o.id, dias });
      }
    }
  }
  pruebasPorVencer.sort((a, b) => a.dias - b.dias);

  // --- Pipeline del embudo (pazque_leads) ---
  const leadRes = await fetch(
    SB_URL + '/rest/v1/pazque_leads?select=estado,respondio,ultimo_contacto_at,seguir_desde,created_at',
    { headers: H }
  );
  const leads = leadRes.ok ? await leadRes.json() : [];
  const pipeline = { nuevo: 0, contactado: 0, demo: 0, convertido: 0, descartado: 0 };
  let contactosNuevosAyer = 0;
  let faltaMarcar = 0;   // ya contactados, sin registrar si respondieron (loop abierto)
  let contestaron = 0;   // respondió que SÍ → hay que seguir la charla
  let paraSeguirHoy = 0; // activos con seguir_desde vencido
  for (const l of leads) {
    const e = (l.estado || 'nuevo').toLowerCase();
    if (pipeline[e] != null) pipeline[e]++;
    if (l.created_at && new Date(l.created_at).getTime() >= new Date(fromISO).getTime()
        && new Date(l.created_at).getTime() < new Date(toISO).getTime()) contactosNuevosAyer++;
    // Loop de seguimiento (lo que vos marcás en /owner).
    const yaContactado = !!l.ultimo_contacto_at;
    if (yaContactado && (l.respondio === null || l.respondio === undefined)) faltaMarcar++;
    if (l.respondio === true && e !== 'convertido' && e !== 'descartado') contestaron++;
    if (yaContactado && l.respondio === false && l.seguir_desde
        && new Date(l.seguir_desde).getTime() <= now) paraSeguirHoy++;
  }

  return {
    activos, pagos, enPrueba, nuevosAyer, mrr, pruebasPorVencer,
    pipeline, contactosNuevosAyer, faltaMarcar, contestaron, paraSeguirHoy,
  };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'PARTE_DIARIO_ENABLED=false' });
  }

  const { from, to } = rangoAyerUruguay();
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  // 0) Foto de Pazque como empresa (clientes, MRR, pipeline, pendientes).
  const pz = await fotoPazque(fromISO, toISO);

  // 1) Salud del sitio (lo primero que querés saber a la mañana).
  const salud = await chequearSalud();

  // 2) Orgs reales.
  const orgs = await listarOrgsReales();

  // 3) Ventas de AYER por org + última venta (señal de inactividad/churn).
  const porOrg = [];
  let totalPedidos = 0, totalMonto = 0;
  for (const [orgId, nombre] of orgs) {
    // Pedidos de ayer (excluye canceladas).
    const url =
      SB_URL + '/rest/v1/b2b_orders?org_id=eq.' + encodeURIComponent(orgId) +
      '&creado_en=gte.' + encodeURIComponent(fromISO) +
      '&creado_en=lt.' + encodeURIComponent(toISO) +
      '&estado=neq.cancelada&select=total,cliente_nombre,estado,creado_en';
    const r = await fetch(url, { headers: H });
    const rows = r.ok ? await r.json() : [];
    const pedidos = rows.length;
    const monto = rows.reduce((s, o) => s + (Number(o.total) || 0), 0);
    totalPedidos += pedidos;
    totalMonto += monto;

    // Última venta de la org (para calcular "callado hace N días").
    let diasSinVender = null;
    const ultRes = await fetch(
      SB_URL + '/rest/v1/b2b_orders?org_id=eq.' + encodeURIComponent(orgId) +
        '&estado=neq.cancelada&select=creado_en&order=creado_en.desc&limit=1',
      { headers: H }
    );
    if (ultRes.ok) {
      const ult = await ultRes.json();
      if (ult[0]?.creado_en) {
        diasSinVender = Math.floor((Date.now() - new Date(ult[0].creado_en).getTime()) / DAY_MS);
      }
    }

    porOrg.push({ orgId, nombre, pedidos, monto, diasSinVender });
  }
  // Orden: primero las que más vendieron ayer.
  porOrg.sort((a, b) => b.monto - a.monto);

  // 4) Demos nuevas de Pazque (embudo propio) que entraron ayer.
  let demos = [];
  const demoRes = await fetch(
    SB_URL + '/rest/v1/pazque_leads?created_at=gte.' + encodeURIComponent(fromISO) +
      '&created_at=lt.' + encodeURIComponent(toISO) +
      '&select=nombre,empresa,rubro,estado,created_at&order=created_at.desc',
    { headers: H }
  );
  if (demoRes.ok) demos = await demoRes.json();

  // --- Armar el email ---
  const fechaAyer = from.toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Montevideo',
  });

  // --- Bloque "Pazque, la empresa" (tu foto como dueño) ---
  const nuevosTxt = pz.nuevosAyer > 0
    ? ` <span style="color:#059669;font-weight:700">+${pz.nuevosAyer} ayer</span>` : '';
  const vencenTxt = pz.pruebasPorVencer.length
    ? pz.pruebasPorVencer.map(p => `${esc(p.id)} (vence en ${p.dias}d)`).join(', ')
    : null;

  const pipeTxt = [
    pz.pipeline.nuevo ? `${pz.pipeline.nuevo} nuevos` : null,
    pz.pipeline.contactado ? `${pz.pipeline.contactado} contactados` : null,
    pz.pipeline.demo ? `${pz.pipeline.demo} en demo` : null,
    pz.pipeline.convertido ? `${pz.pipeline.convertido} convertidos` : null,
  ].filter(Boolean).join(' · ') || 'sin leads todavía';

  const pendientes = [
    pz.contestaron ? `💬 <b>${pz.contestaron}</b> te contestaron → seguí la charla` : null,
    pz.paraSeguirHoy ? `🔁 <b>${pz.paraSeguirHoy}</b> para seguir hoy` : null,
    pz.faltaMarcar ? `⏳ <b>${pz.faltaMarcar}</b> esperan que marques si contestaron` : null,
  ].filter(Boolean);

  const pazqueBloque = `
    <div style="background:#faf9f7;border:1px solid #f0ede8;border-radius:12px;padding:16px 18px;margin-bottom:24px">
      <p style="font-size:11px;color:#9a9a98;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;font-weight:700">Pazque · la plataforma</p>
      <div style="font-size:13px;color:#1a1a18;line-height:1.9">
        👥 <b>${pz.activos}</b> cliente${pz.activos === 1 ? '' : 's'} activo${pz.activos === 1 ? '' : 's'}${nuevosTxt}
        <span style="color:#6a6a68"> · ${pz.pagos} pago${pz.pagos === 1 ? '' : 's'} · ${pz.enPrueba} en prueba</span><br/>
        💵 <b style="color:#059669">${money(pz.mrr)}</b> <span style="color:#6a6a68">MRR estimado (USD/mes)</span><br/>
        ${vencenTxt ? `⏰ <span style="color:#b45309">Pruebas por vencer: ${esc(vencenTxt)}</span><br/>` : ''}
        🎯 <span style="color:#6a6a68">Pipeline:</span> ${pipeTxt}${pz.contactosNuevosAyer ? ` <span style="color:#059669">(+${pz.contactosNuevosAyer} ayer)</span>` : ''}
      </div>
      ${pendientes.length ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f0ede8;font-size:12px;color:#1a1a18;line-height:1.9">
          <span style="color:#9a9a98;text-transform:uppercase;font-size:10px;letter-spacing:.5px;font-weight:700">Pendientes tuyos (prospección)</span><br/>
          ${pendientes.join('<br/>')}
          <div style="margin-top:8px"><a href="${SITE}/owner" style="color:#059669;font-weight:600;text-decoration:none">Abrir /owner →</a></div>
        </div>` : ''}
    </div>`;

  const saludBadge = salud.ok
    ? `<span style="background:#ecfdf5;color:#059669;font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px">🟢 TODO OPERATIVO</span>`
    : `<span style="background:#fef2f2;color:#b91c1c;font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px">🔴 HAY UN PROBLEMA</span>`;

  const saludRows = salud.detalle.map(d => `
    <span style="display:inline-block;margin-right:14px;font-size:12px;color:#6a6a68">
      ${d.ok ? '🟢' : '🔴'} ${esc(d.name)}${d.ok ? '' : ' — ' + esc(d.info)}
    </span>`).join('');

  const DIAS_ALERTA = 4;  // una org callada 4+ días merece una miradita
  const ventasRows = porOrg.length ? porOrg.map(o => {
    const callado = o.diasSinVender != null && o.diasSinVender >= DIAS_ALERTA;
    const señal = o.diasSinVender == null
      ? '<span style="color:#9a9a98">sin ventas aún</span>'
      : o.diasSinVender === 0
        ? '<span style="color:#059669">vendió hoy/ayer</span>'
        : `<span style="color:${callado ? '#b45309' : '#6a6a68'}">${callado ? '⚠️ ' : ''}callado hace ${o.diasSinVender}d</span>`;
    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18;font-weight:600">${esc(o.nombre)}</td>
        <td style="padding:10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18;text-align:center">${o.pedidos}</td>
        <td style="padding:10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18;text-align:right;font-weight:700">${money(o.monto)}</td>
        <td style="padding:10px;border-bottom:1px solid #f0ede8;font-size:12px;text-align:right">${señal}</td>
      </tr>`;
  }).join('') : `<tr><td colspan="4" style="padding:14px;text-align:center;color:#9a9a98;font-size:13px">No hay orgs reales todavía.</td></tr>`;

  const demosRows = demos.length ? demos.map(d => `
    <li style="margin-bottom:6px;font-size:13px;color:#1a1a18">
      <b>${esc(d.empresa || d.nombre || 'Sin nombre')}</b>
      ${d.rubro ? `<span style="color:#6a6a68"> · ${esc(d.rubro)}</span>` : ''}
      <span style="color:#9a9a98"> · ${esc(d.estado || 'nuevo')}</span>
    </li>`).join('') : '';

  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 22px;color:#1a1a18">
      <p style="font-size:12px;color:#9a9a98;margin:0 0 4px;text-transform:uppercase;letter-spacing:.5px">Parte diario de Pazque</p>
      <h1 style="font-size:20px;font-weight:800;margin:0 0 2px">Buen día, Federico ☕</h1>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 18px;text-transform:capitalize">${esc(fechaAyer)}</p>

      ${pazqueBloque}

      <div style="margin-bottom:22px">
        ${saludBadge}
        <div style="margin-top:10px">${saludRows}</div>
      </div>

      <h2 style="font-size:14px;font-weight:700;margin:0 0 10px">📦 Ventas de ayer</h2>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 10px">
        <b style="color:#1a1a18">${totalPedidos}</b> pedido${totalPedidos === 1 ? '' : 's'} ·
        <b style="color:#059669">${money(totalMonto)}</b> en total
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0ede8;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#faf9f7">
            <td style="padding:8px 10px;font-size:11px;color:#9a9a98;text-transform:uppercase">Distribuidora</td>
            <td style="padding:8px 10px;font-size:11px;color:#9a9a98;text-transform:uppercase;text-align:center">Pedidos</td>
            <td style="padding:8px 10px;font-size:11px;color:#9a9a98;text-transform:uppercase;text-align:right">Monto</td>
            <td style="padding:8px 10px;font-size:11px;color:#9a9a98;text-transform:uppercase;text-align:right">Actividad</td>
          </tr>
        </thead>
        <tbody>${ventasRows}</tbody>
      </table>

      <h2 style="font-size:14px;font-weight:700;margin:0 0 10px">🎯 Demos nuevas (embudo Pazque)</h2>
      ${demos.length
        ? `<ul style="margin:0 0 20px;padding-left:18px">${demosRows}</ul>`
        : `<p style="font-size:13px;color:#9a9a98;margin:0 0 20px">Ninguna demo nueva ayer.</p>`}

      <p style="font-size:11px;color:#9a9a98;margin-top:26px;line-height:1.5;border-top:1px solid #f0ede8;padding-top:14px">
        Parte automático · se arma cada mañana a las 7:00 (hora Uruguay). Sólo lee datos,
        no toca nada ni manda nada a clientes. Para apagarlo: PARTE_DIARIO_ENABLED=false en Vercel.
      </p>
    </div>`;

  const subject = !salud.ok
    ? `🔴 Parte diario · algo está caído`
    : `☀️ Parte diario · ${pz.activos} cliente${pz.activos === 1 ? '' : 's'} · ${money(pz.mrr)} MRR · ${totalPedidos} pedido${totalPedidos === 1 ? '' : 's'}`;

  try {
    await sendEmail({ to: TO_EMAIL, subject, html });
  } catch (e) {
    console.error('[cron-parte-diario] no se pudo enviar el parte:', e.message);
    return res.status(200).json({ ok: false, error: 'email failed: ' + e.message });
  }

  return res.status(200).json({
    ok: true,
    salud: salud.ok,
    orgs: orgs.size,
    pazque: { activos: pz.activos, pagos: pz.pagos, enPrueba: pz.enPrueba, mrr: pz.mrr },
    totalPedidos,
    totalMonto,
    demos: demos.length,
  });
}
