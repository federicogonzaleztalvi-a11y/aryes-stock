// api/cron-carrito-abandonado.js — Recordatorio de carrito abandonado (estilo Amazon).
//
// Corre cada hora (ver vercel.json). Busca clientes del portal B2B que dejaron
// productos en el carrito pero NO confirmaron el pedido, y les manda un email.
//
// Dos etapas, sin spamear (ver supabase-carrito-abandonado.sql):
//   reminder_stage 0 → carrito nuevo / recién editado (lo resetea /api/cart)
//   reminder_stage 1 → ya mandamos el 1er aviso (carrito con ≥4h sin tocar)
//   reminder_stage 2 → ya mandamos el 2do aviso (carrito con ≥24h sin tocar) — fin
//
// Genérico por-org: solo actúa sobre orgs que tienen el toggle
// brandcfg.abandonedCartEmails === true (Configuración → Portal B2B).
//
// Solo llega a clientes con email cargado en su ficha (clients.email). Si el
// cliente no tiene email, se saltea silenciosamente.

import { sendEmail, templates } from './_email.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC };
const HJSON = { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();

  // 1) Orgs con el recordatorio prendido. Traemos todos los brandcfg y filtramos
  //    en JS (el flag vive dentro del jsonb `value`). Mapa org → {name, logoUrl}.
  const cfgRes = await fetch(
    SB_URL + '/rest/v1/app_config?key=eq.brandcfg&select=org_id,value',
    { headers: H }
  );
  if (!cfgRes.ok) return res.status(500).json({ error: 'config DB error' });
  const cfgRows = await cfgRes.json();

  const enabledOrgs = new Map();
  for (const row of cfgRows) {
    const v = row.value || {};
    if (v.abandonedCartEmails === true) {
      enabledOrgs.set(row.org_id, { name: v.name || '', logoUrl: v.logo || v.logoUrl || '' });
    }
  }
  if (enabledOrgs.size === 0) {
    return res.status(200).json({ ok: true, enabledOrgs: 0, sent: 0 });
  }

  // 2) Carritos pendientes de recordatorio: stage < 2 y con al menos 4h sin tocar.
  //    Acotamos a los últimos 7 días para no perseguir carritos viejos abandonados
  //    hace meses (el índice parcial portal_carts_reminder_idx hace esto barato).
  const olderThan = new Date(now - FOUR_HOURS).toISOString();
  const newerThan = new Date(now - SEVEN_DAYS).toISOString();
  const cartsRes = await fetch(
    SB_URL + '/rest/v1/portal_carts?reminder_stage=lt.2' +
      '&updated_at=lte.' + encodeURIComponent(olderThan) +
      '&updated_at=gte.' + encodeURIComponent(newerThan) +
      '&select=org_id,client_id,items,updated_at,reminder_stage&limit=200',
    { headers: H }
  );
  if (!cartsRes.ok) return res.status(500).json({ error: 'carts DB error' });
  const carts = await cartsRes.json();

  let sent = 0;
  let skipped = 0;

  for (const cart of carts) {
    const org = enabledOrgs.get(cart.org_id);
    if (!org) { skipped++; continue; }                       // org sin el toggle

    // Carrito vacío → no hay nada que recordar.
    const lineCount = cart.items && typeof cart.items === 'object'
      ? Object.keys(cart.items).length : 0;
    if (lineCount === 0) { skipped++; continue; }

    const age = now - new Date(cart.updated_at).getTime();

    // Etapa objetivo según antigüedad:
    //   stage 0 + ≥4h  → mandar aviso 1
    //   stage 1 + ≥24h → mandar aviso 2
    //   resto          → todavía no toca
    let targetStage = 0;
    if (cart.reminder_stage === 0 && age >= FOUR_HOURS) targetStage = 1;
    else if (cart.reminder_stage === 1 && age >= TWENTY_FOUR_HOURS) targetStage = 2;
    if (targetStage === 0) { skipped++; continue; }

    // Safety: si el cliente YA confirmó un pedido después de tocar el carrito,
    // no le recordamos (el carrito quedó "sucio" pero el pedido salió). El cliente
    // limpia su carrito al confirmar, pero esto cubre carreras / clientes con varios
    // dispositivos.
    try {
      const ordRes = await fetch(
        SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + encodeURIComponent(cart.client_id) +
          '&org_id=eq.' + encodeURIComponent(cart.org_id) +
          '&creado_en=gte.' + encodeURIComponent(cart.updated_at) +
          '&select=id&limit=1',
        { headers: H }
      );
      if (ordRes.ok) {
        const orders = await ordRes.json();
        if (orders.length > 0) { skipped++; continue; }
      }
    } catch { /* si falla el chequeo, seguimos: peor caso un recordatorio de más */ }

    // Ficha del cliente: necesitamos nombre + email. Sin email no podemos avisar.
    let nombre = '';
    let email = '';
    try {
      const cliRes = await fetch(
        SB_URL + '/rest/v1/clients?id=eq.' + encodeURIComponent(cart.client_id) +
          '&select=nombre,email&limit=1',
        { headers: H }
      );
      if (cliRes.ok) {
        const cli = await cliRes.json();
        nombre = cli[0]?.nombre || '';
        email = (cli[0]?.email || '').trim();
      }
    } catch { /* sin ficha → no avisamos */ }
    if (!email) { skipped++; continue; }

    const portalUrl = 'https://pazque.com/pedidos?org=' + encodeURIComponent(cart.org_id);

    try {
      const tpl = templates.carritoAbandonado({
        empresa: org.name,
        nombre,
        lineCount,
        portalUrl,
        logoUrl: org.logoUrl,
        stage: targetStage,
      });
      await sendEmail({ to: email, ...tpl });

      // Avanzar la etapa para no repetir el mismo aviso.
      await fetch(
        SB_URL + '/rest/v1/portal_carts?org_id=eq.' + encodeURIComponent(cart.org_id) +
          '&client_id=eq.' + encodeURIComponent(cart.client_id),
        {
          method: 'PATCH',
          headers: HJSON,
          body: JSON.stringify({ reminder_stage: targetStage, reminded_at: new Date().toISOString() }),
        }
      );
      sent++;
    } catch (e) {
      console.error('[cron-carrito-abandonado] envío falló:', cart.org_id, cart.client_id, e.message);
    }
  }

  return res.status(200).json({ ok: true, enabledOrgs: enabledOrgs.size, carts: carts.length, sent, skipped });
}
