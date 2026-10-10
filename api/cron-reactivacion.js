// api/cron-reactivacion.js — AGENTE DE REACTIVACIÓN (recuperar al comprador que
// DEJÓ de comprar, antes de perderlo del todo).
//
// Distinto del agente de reposición: ése le recuerda reponer a un comprador ACTIVO
// que se atrasó respecto de su propio ritmo (atrasos de días). Éste va por el que
// lleva MUCHO sin pedir —churn en curso— y le manda un "¿todo bien? te extrañamos"
// para traerlo de vuelta.
//
// Para no pisarse con reposición, arranca justo donde ése termina: reposición
// cubre atrasos hasta ~120 días; reactivación toma de REACT_MIN_DAYS (120) en
// adelante. Nunca le llegan los dos mails a la misma persona.
//
// Corre una vez por día (ver vercel.json). Dos candados, igual que la familia:
//   • Apagado por defecto: solo corre si REACTIVATION_AGENT_ENABLED === 'true'.
//   • Genérico por-org: solo actúa sobre orgs con brandcfg.reactivationReminders
//     === true (Configuración → Portal B2B).
//
// REGLAS (anti-spam):
//   • Fue cliente de verdad: al menos MIN_ORDERS pedidos históricos (no un one-off).
//   • Ventana de churn recuperable: último pedido entre REACT_MIN_DAYS y
//     REACT_MAX_DAYS atrás. Más viejo que eso = frío, no vale la pena.
//   • Enfriamiento largo entre recordatorios (reactivation_reminders), porque es
//     un mensaje fuerte: no se repite seguido.
//   • Solo a compradores con email cargado en su ficha.
//   • Auth por CRON_SECRET, como el resto de los crons.
//
// Canal: email (reusa _email.js, sin bloqueo de plantilla de Meta).
// ----------------------------------------------------------------------------

import { sendEmail, templates } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.REACTIVATION_AGENT_ENABLED === 'true';

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };

const DAY = 24 * 60 * 60 * 1000;

// Parámetros. Conservadores a propósito. Ajustables sin tocar la lógica.
const MIN_ORDERS      = 2;    // pedidos mínimos para considerarlo un cliente real
const REACT_MIN_DAYS  = 120;  // empieza donde termina reposición (atrasos ≤ 120 días)
const REACT_MAX_DAYS  = 365;  // más viejo que esto = frío, no reactivable
const COOLDOWN_DAYS   = 30;   // enfriamiento largo: mensaje fuerte, no se repite seguido
const LOOKBACK_DAYS   = 400;  // ventana de historial que miramos
const MAX_SENDS       = 50;   // tope de envíos por corrida (control de costo/spam)

async function sbGet(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// Top-N productos por frecuencia (cuántos pedidos distintos lo incluyeron).
function topProductos(ordersItems, n = 4) {
  const freq = new Map();
  for (const items of ordersItems) {
    const vistos = new Set();
    for (const it of (Array.isArray(items) ? items : [])) {
      const nombre = (it?.nombre || '').trim();
      if (!nombre || vistos.has(nombre)) continue;
      vistos.add(nombre);
      freq.set(nombre, (freq.get(nombre) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([nombre]) => nombre);
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Apagado por defecto: nada corre hasta que Federico prenda el flag.
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'REACTIVATION_AGENT_ENABLED!=true' });
  }

  const now = Date.now();

  // 1) Orgs con la reactivación prendida (mismo patrón que el resto).
  const cfgRes = await fetch(
    SB_URL + '/rest/v1/app_config?key=eq.brandcfg&select=org_id,value',
    { headers: H }
  );
  if (!cfgRes.ok) return res.status(500).json({ error: 'config DB error' });
  const cfgRows = await cfgRes.json();

  const enabledOrgs = new Map();
  for (const row of cfgRows) {
    const v = row.value || {};
    if (v.reactivationReminders === true) {
      enabledOrgs.set(row.org_id, { name: v.name || '', logoUrl: v.logo || v.logoUrl || '' });
    }
  }
  if (enabledOrgs.size === 0) {
    return res.status(200).json({ ok: true, enabledOrgs: 0, sent: 0 });
  }

  const sinceIso = new Date(now - LOOKBACK_DAYS * DAY).toISOString();
  let sent = 0, candidates = 0, skipped = 0;
  const errores = [];

  // Procesamos org por org para acotar cada query y respetar el aislamiento.
  for (const [orgId, org] of enabledOrgs) {
    if (sent >= MAX_SENDS) break;

    // 2) Historial de pedidos de la org en la ventana (ordenado por comprador).
    const orders = await sbGet(
      `b2b_orders?org_id=eq.${encodeURIComponent(orgId)}` +
      `&creado_en=gte.${encodeURIComponent(sinceIso)}` +
      `&select=cliente_id,cliente_nombre,items,creado_en&order=cliente_id.asc,creado_en.asc&limit=3000`
    );
    if (!orders.length) continue;

    // 3) Agrupar por comprador.
    const porCliente = new Map();
    for (const o of orders) {
      if (!o.cliente_id) continue;
      if (!porCliente.has(o.cliente_id)) porCliente.set(o.cliente_id, []);
      porCliente.get(o.cliente_id).push(o);
    }

    // 4) Enfriamiento: a quién ya le avisamos hace poco en esta org.
    const cutoffCooldown = new Date(now - COOLDOWN_DAYS * DAY).toISOString();
    const recientes = await sbGet(
      `reactivation_reminders?org_id=eq.${encodeURIComponent(orgId)}` +
      `&last_reminded_at=gte.${encodeURIComponent(cutoffCooldown)}&select=cliente_id`
    );
    const enEnfriamiento = new Set(recientes.map(r => r.cliente_id));

    for (const [clienteId, pedidos] of porCliente) {
      if (sent >= MAX_SENDS) break;
      if (pedidos.length < MIN_ORDERS) { skipped++; continue; }    // one-off, no era cliente
      if (enEnfriamiento.has(clienteId)) { skipped++; continue; }  // ya avisado

      const fechas = pedidos.map(p => new Date(p.creado_en).getTime()).sort((a, b) => a - b);
      const diasDesdeUltimo = (now - fechas[fechas.length - 1]) / DAY;
      // ¿Está en la ventana de churn recuperable?
      if (diasDesdeUltimo < REACT_MIN_DAYS || diasDesdeUltimo > REACT_MAX_DAYS) { skipped++; continue; }

      candidates++;

      // Ficha del comprador: nombre + email. Sin email no podemos avisar.
      let nombre = pedidos[pedidos.length - 1]?.cliente_nombre || '';
      let email = '';
      try {
        const cli = await sbGet(`clients?id=eq.${encodeURIComponent(clienteId)}&select=nombre,email&limit=1`);
        nombre = cli[0]?.nombre || nombre;
        email = (cli[0]?.email || '').trim();
      } catch { /* sin ficha → sin email */ }
      if (!email) { skipped++; continue; }

      const productos = topProductos(pedidos.map(p => p.items), 4);
      const portalUrl = 'https://pazque.com/pedidos?org=' + encodeURIComponent(orgId);

      try {
        const tpl = templates.reactivacion({
          empresa: org.name,
          nombre,
          productos,
          dias: Math.round(diasDesdeUltimo),
          portalUrl,
          logoUrl: org.logoUrl,
        });
        await sendEmail({ to: email, ...tpl });

        // Registrar el envío (upsert) para respetar el enfriamiento.
        await fetch(`${SB_URL}/rest/v1/reactivation_reminders?on_conflict=org_id,cliente_id`, {
          method: 'POST',
          headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            org_id: orgId, cliente_id: clienteId,
            last_reminded_at: new Date().toISOString(),
            nudge_count: 1,
          }),
        });
        sent++;
      } catch (e) {
        errores.push(`envío ${orgId}/${clienteId}: ${e.message || 'error'}`);
      }
    }
  }

  return res.status(200).json({
    ok: true, enabledOrgs: enabledOrgs.size, candidates, sent, skipped,
    ...(errores.length ? { errores } : {}),
  });
}
