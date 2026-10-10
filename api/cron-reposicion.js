// api/cron-reposicion.js — AGENTE DE REPOSICIÓN (el vendedor digital de la
// distribuidora hacia SUS compradores que YA tiene).
//
// La plata que se repite en mayorista no está en el cliente nuevo: está en que
// el comprador habitual no se olvide de reponer. Este agente mira el RITMO real
// de cada comprador (mediana de días entre sus pedidos) y, cuando se atrasa
// respecto de su propio patrón, le manda un recordatorio con lo que suele pedir.
//
// Corre una vez por día (ver vercel.json). Dos candados, igual que el resto de
// la familia de agentes:
//   • Apagado por defecto: solo corre si REORDER_AGENT_ENABLED === 'true'.
//   • Genérico por-org: solo actúa sobre orgs con brandcfg.reorderReminders ===
//     true (Configuración → Portal B2B).
//
// REGLAS (anti-spam, por diseño):
//   • NO usa calendario fijo. Usa el ritmo observado del comprador. Si no tiene
//     al menos MIN_ORDERS pedidos, no hay patrón → no se le avisa.
//   • Solo avisa si se atrasó de verdad (días desde el último pedido ≥ su ritmo ×
//     OVERDUE_FACTOR, y nunca antes de MIN_GAP_DAYS para no molestar a los que
//     piden muy seguido).
//   • Período de enfriamiento entre recordatorios (reorder_reminders.last_reminded_at).
//   • Se saltea a quien ya pidió hace poco o lleva demasiado sin pedir (churn ≠
//     reposición). Solo a compradores con email cargado en su ficha.
//   • Auth por CRON_SECRET, como el resto de los crons.
//
// Canal: email (reusa _email.js, sin bloqueo de plantilla de Meta). WhatsApp
// queda como mejora futura cuando haya plantilla aprobada.
// ----------------------------------------------------------------------------

import { sendEmail, templates } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.REORDER_AGENT_ENABLED === 'true';

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };

const DAY = 24 * 60 * 60 * 1000;

// Parámetros del ritmo. Conservadores a propósito: mejor avisar de menos que
// spamear. Ajustables sin tocar la lógica.
const MIN_ORDERS    = 3;    // pedidos mínimos para inferir un ritmo real
const OVERDUE_FACTOR= 1.3;  // atraso = ritmo × esto antes de considerarlo vencido
const MIN_GAP_DAYS  = 5;    // nunca avisar antes de estos días (compradores muy frecuentes)
const MAX_GAP_DAYS  = 120;  // más que esto = probable churn, no reposición
const COOLDOWN_DAYS = 10;   // enfriamiento mínimo entre recordatorios al mismo comprador
const LOOKBACK_DAYS = 180;  // ventana de historial que miramos
const MAX_SENDS     = 60;   // tope de envíos por corrida (control de costo/spam)

async function sbGet(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// Mediana de una lista de números (días entre pedidos).
function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
    return res.status(200).json({ ok: true, skipped: 'REORDER_AGENT_ENABLED!=true' });
  }

  const now = Date.now();

  // 1) Orgs con el recordatorio prendido (igual patrón que carrito abandonado).
  const cfgRes = await fetch(
    SB_URL + '/rest/v1/app_config?key=eq.brandcfg&select=org_id,value',
    { headers: H }
  );
  if (!cfgRes.ok) return res.status(500).json({ error: 'config DB error' });
  const cfgRows = await cfgRes.json();

  const enabledOrgs = new Map();
  for (const row of cfgRows) {
    const v = row.value || {};
    if (v.reorderReminders === true) {
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
      `&select=cliente_id,cliente_nombre,items,creado_en&order=cliente_id.asc,creado_en.asc&limit=2000`
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
      `reorder_reminders?org_id=eq.${encodeURIComponent(orgId)}` +
      `&last_reminded_at=gte.${encodeURIComponent(cutoffCooldown)}&select=cliente_id`
    );
    const enEnfriamiento = new Set(recientes.map(r => r.cliente_id));

    for (const [clienteId, pedidos] of porCliente) {
      if (sent >= MAX_SENDS) break;
      if (pedidos.length < MIN_ORDERS) { skipped++; continue; }          // sin ritmo
      if (enEnfriamiento.has(clienteId)) { skipped++; continue; }        // ya avisado

      // Ritmo: mediana de días entre pedidos consecutivos.
      const fechas = pedidos.map(p => new Date(p.creado_en).getTime()).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < fechas.length; i++) gaps.push((fechas[i] - fechas[i - 1]) / DAY);
      const ritmo = median(gaps);
      if (!ritmo) { skipped++; continue; }

      const diasDesdeUltimo = (now - fechas[fechas.length - 1]) / DAY;
      const umbral = Math.max(MIN_GAP_DAYS, ritmo * OVERDUE_FACTOR);
      // ¿Se atrasó respecto de SU ritmo, pero no tanto como para ser churn?
      if (diasDesdeUltimo < umbral || diasDesdeUltimo > MAX_GAP_DAYS) { skipped++; continue; }

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
        const tpl = templates.reposicion({
          empresa: org.name,
          nombre,
          productos,
          dias: Math.round(diasDesdeUltimo),
          portalUrl,
          logoUrl: org.logoUrl,
        });
        await sendEmail({ to: email, ...tpl });

        // Registrar el envío (upsert) para respetar el enfriamiento.
        await fetch(`${SB_URL}/rest/v1/reorder_reminders?on_conflict=org_id,cliente_id`, {
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
