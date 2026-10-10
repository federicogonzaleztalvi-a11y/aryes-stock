// api/cron-cobranzas.js — AGENTE DE COBRANZAS (el "vendedor digital" que persigue
// la plata que ya se vendió pero todavía no se cobró).
//
// En mayorista el dolor #1 no es vender: es cobrar. La deuda de los clientes vive
// en la cabeza de alguien y se persigue a mano, tarde y de a ratos. Este agente
// mira las facturas VENCIDAS con saldo pendiente de cada comprador y le manda un
// recordatorio de pago profesional, con el detalle de qué debe y cuánto hace que
// está vencido.
//
// Corre una vez por día (ver vercel.json). Dos candados, igual que el resto de la
// familia de agentes:
//   • Apagado por defecto: solo corre si COLLECTIONS_AGENT_ENABLED === 'true'.
//   • Genérico por-org: solo actúa sobre orgs con brandcfg.collectionsReminders ===
//     true (Configuración → Portal B2B).
//
// REGLAS (respetuoso, por diseño — es plata que el cliente debe, no un push):
//   • Solo factura VENCIDA de verdad: status emitida/cobrado_parcial, saldo > 0,
//     y vencida hace ≥ GRACE_DAYS (no molestar el día 1).
//   • Período de enfriamiento entre recordatorios (collections_reminders).
//   • Solo a compradores con email de cobranza/administración (o email general).
//   • Auth por CRON_SECRET, como el resto de los crons.
//
// Canal: email (reusa _email.js, sin bloqueo de plantilla de Meta).
// ----------------------------------------------------------------------------

import { sendEmail, templates } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.COLLECTIONS_AGENT_ENABLED === 'true';

const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };

const DAY = 24 * 60 * 60 * 1000;

// Parámetros. Conservadores a propósito. Ajustables sin tocar la lógica.
const GRACE_DAYS    = 3;   // no avisar antes de estos días de vencida (margen de acreditación)
const COOLDOWN_DAYS = 7;   // enfriamiento mínimo entre recordatorios al mismo comprador
const MAX_SENDS     = 80;  // tope de envíos por corrida (control de costo/spam)

async function sbGet(path) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Apagado por defecto: nada corre hasta que Federico prenda el flag.
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'COLLECTIONS_AGENT_ENABLED!=true' });
  }

  const now = Date.now();

  // 1) Orgs con el recordatorio de cobranza prendido (mismo patrón que el resto).
  const cfgRes = await fetch(
    SB_URL + '/rest/v1/app_config?key=eq.brandcfg&select=org_id,value',
    { headers: H }
  );
  if (!cfgRes.ok) return res.status(500).json({ error: 'config DB error' });
  const cfgRows = await cfgRes.json();

  const enabledOrgs = new Map();
  for (const row of cfgRows) {
    const v = row.value || {};
    if (v.collectionsReminders === true) {
      enabledOrgs.set(row.org_id, { name: v.name || '', logoUrl: v.logo || v.logoUrl || '' });
    }
  }
  if (enabledOrgs.size === 0) {
    return res.status(200).json({ ok: true, enabledOrgs: 0, sent: 0 });
  }

  const hoyIso = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
  let sent = 0, candidates = 0, skipped = 0;
  const errores = [];

  // Procesamos org por org para acotar cada query y respetar el aislamiento.
  for (const [orgId, org] of enabledOrgs) {
    if (sent >= MAX_SENDS) break;

    // 2) Facturas vencidas con saldo de la org (emitida o cobrada en parte).
    const facturas = await sbGet(
      `invoices?org_id=eq.${encodeURIComponent(orgId)}` +
      `&status=in.(emitida,cobrado_parcial)` +
      `&fecha_venc=lt.${encodeURIComponent(hoyIso)}` +
      `&select=id,cliente_id,cliente_nombre,numero,total,saldo_pendiente,fecha_venc,moneda&order=cliente_id.asc,fecha_venc.asc&limit=3000`
    );
    if (!facturas.length) continue;

    // 3) Agrupar por comprador, quedándonos solo con las que tienen saldo y pasaron
    //    el margen de gracia.
    const porCliente = new Map();
    for (const f of facturas) {
      if (!f.cliente_id) continue;
      const saldo = Number(f.saldo_pendiente != null ? f.saldo_pendiente : f.total) || 0;
      if (saldo <= 0) continue;
      const diasVencida = Math.floor((now - new Date(f.fecha_venc).getTime()) / DAY);
      if (diasVencida < GRACE_DAYS) continue;
      if (!porCliente.has(f.cliente_id)) porCliente.set(f.cliente_id, []);
      porCliente.get(f.cliente_id).push({ ...f, saldo, diasVencida });
    }
    if (porCliente.size === 0) continue;

    // 4) Enfriamiento: a quién ya le avisamos hace poco en esta org.
    const cutoffCooldown = new Date(now - COOLDOWN_DAYS * DAY).toISOString();
    const recientes = await sbGet(
      `collections_reminders?org_id=eq.${encodeURIComponent(orgId)}` +
      `&last_reminded_at=gte.${encodeURIComponent(cutoffCooldown)}&select=cliente_id`
    );
    const enEnfriamiento = new Set(recientes.map(r => r.cliente_id));

    for (const [clienteId, lista] of porCliente) {
      if (sent >= MAX_SENDS) break;
      if (enEnfriamiento.has(clienteId)) { skipped++; continue; }

      candidates++;

      // Ficha del comprador: nombre + email de cobranza (o general). Sin email no
      // podemos avisar.
      let nombre = lista[0]?.cliente_nombre || '';
      let email = '';
      try {
        const cli = await sbGet(
          `clients?id=eq.${encodeURIComponent(clienteId)}&select=nombre,email,email_cobranza&limit=1`
        );
        nombre = cli[0]?.nombre || nombre;
        email = (cli[0]?.email_cobranza || cli[0]?.email || '').trim();
      } catch { /* sin ficha → sin email */ }
      if (!email) { skipped++; continue; }

      const totalDeuda = lista.reduce((s, f) => s + f.saldo, 0);
      const simbolo = (lista[0]?.moneda === 'USD') ? 'US$' : '$';
      const portalUrl = 'https://pazque.com/pedidos?org=' + encodeURIComponent(orgId);

      try {
        const tpl = templates.cobranzas({
          empresa: org.name,
          nombre,
          facturas: lista.map(f => ({ numero: f.numero, saldo: f.saldo, diasVencida: f.diasVencida })),
          totalDeuda,
          simbolo,
          portalUrl,
          logoUrl: org.logoUrl,
        });
        await sendEmail({ to: email, ...tpl });

        // Registrar el envío (upsert) para respetar el enfriamiento.
        await fetch(`${SB_URL}/rest/v1/collections_reminders?on_conflict=org_id,cliente_id`, {
          method: 'POST',
          headers: { ...HJSON, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            org_id: orgId, cliente_id: clienteId,
            last_reminded_at: new Date().toISOString(),
            reminder_count: 1,
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
