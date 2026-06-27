// api/simpliroute.js — Integración con SimpliRoute (ruteo de entregas), self-service.
// ----------------------------------------------------------------------------
// Cada distribuidor conecta su PROPIA cuenta de SimpliRoute pegando su API token
// (lo saca de app2.simpliroute.com/#/uprofile/info). Pazque:
//   1. valida el token contra SimpliRoute (GET /v1/accounts/me/)
//   2. lo guarda en organizations.simpliroute (jsonb), SERVER-SIDE — nunca vuelve al browser
//   3. registra un webhook (visit_checkout_detailed) que apunta a esta misma función
//   4. empuja pedidos confirmados como "visitas" (POST /v1/routes/visits/)
//   5. recibe el webhook cuando el repartidor marca entregado y actualiza el pedido en Pazque
//
// Multi-tenant: TODO scoped por org. El token vive del lado del servidor. Genérico:
// si la org no conectó SimpliRoute, el push es un no-op silencioso.
//
// GET  ?action=status                       → { connected, enabled, account }
// POST ?action=connect    { token }         → valida, guarda, registra webhook
// POST ?action=disconnect                   → borra credenciales y webhook
// POST ?action=toggle     { enabled }       → prende/apaga el auto-envío
// POST ?action=push       { orderId }       → empuja un pedido como visita
// POST ?action=webhook&org=&secret=...      → SimpliRoute notifica entrega (sin auth admin)

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SR_BASE = 'https://api.simpliroute.com';

function svcHeaders() {
  const svcKey = SB_SVC || SB_ANON;
  return { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json', 'Content-Type': 'application/json' };
}

// Valida el JWT del admin y resuelve { org }. Solo rol admin (configurar
// integraciones y empujar entregas es acción sensible). Mismo patrón que broadcast.js.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

// Lee la config de SimpliRoute de la org (objeto guardado en organizations.simpliroute).
async function getConfig(org) {
  const r = await fetch(
    `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=simpliroute&limit=1`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return null;
  return (await r.json())?.[0]?.simpliroute || null;
}

async function saveConfig(org, cfg) {
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ simpliroute: cfg }),
  });
}

function srHeaders(token) {
  return { Authorization: 'Token ' + token, 'Content-Type': 'application/json' };
}

// Valida el token pegando a /v1/accounts/me/. Devuelve la cuenta o null.
async function validateToken(token) {
  try {
    const r = await fetch(`${SR_BASE}/v1/accounts/me/`, { headers: srHeaders(token) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Registra (best-effort) el webhook de entrega apuntando a nuestra función.
async function registerWebhook(token, url) {
  try {
    const r = await fetch(`${SR_BASE}/v1/addons/webhooks/`, {
      method: 'POST', headers: srHeaders(token),
      body: JSON.stringify({ webhook: 'visit_checkout_detailed', url }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.id != null ? d.id : null;
  } catch { return null; }
}

async function deleteWebhook(token, id) {
  if (!id) return;
  try { await fetch(`${SR_BASE}/v1/addons/webhooks/${id}/`, { method: 'DELETE', headers: srHeaders(token) }); }
  catch { /* best-effort */ }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function digits(p) { return String(p || '').replace(/\D/g, ''); }

// Empuja un pedido (b2b_order) como visita en SimpliRoute. Devuelve {ok, skipped?, visitId?, error?}.
async function pushOrder(org, orderId, cfg) {
  if (!cfg?.token || !cfg?.enabled) return { ok: false, skipped: 'no_conectado' };

  // Traer el pedido SCOPED al org (no se confía el id del body).
  const oRes = await fetch(
    `${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(orderId)}&org_id=eq.${encodeURIComponent(org)}&select=id,cliente_id,cliente_nombre,cliente_tel,total,notas&limit=1`,
    { headers: svcHeaders() }
  );
  if (!oRes.ok) return { ok: false, error: 'No se pudo leer el pedido' };
  const order = (await oRes.json())?.[0];
  if (!order) return { ok: false, error: 'Pedido no encontrado' };

  // Dirección y datos de contacto del cliente.
  let address = '', ciudad = '', name = order.cliente_nombre || 'Cliente', tel = order.cliente_tel || '';
  if (order.cliente_id) {
    try {
      const cRes = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${encodeURIComponent(order.cliente_id)}&org_id=eq.${encodeURIComponent(org)}&select=name,address,ciudad,phone&limit=1`,
        { headers: svcHeaders() }
      );
      const c = (await cRes.json())?.[0];
      if (c) { address = c.address || ''; ciudad = c.ciudad || ''; name = c.name || name; tel = tel || c.phone || ''; }
    } catch { /* sin dirección → SimpliRoute geocodifica lo que haya */ }
  }
  const fullAddr = [address, ciudad].filter(Boolean).join(', ');
  if (!fullAddr) return { ok: false, error: 'El cliente no tiene dirección cargada' };

  const visit = {
    title: name,
    address: fullAddr,
    planned_date: todayISO(),
    contact_name: name,
    contact_phone: digits(tel) ? '+' + digits(tel) : '',
    reference: String(order.id),       // ← clave para reconciliar el webhook de entrega
    load: Number(order.total) || 0,
    notes: order.notas || '',
  };

  try {
    const r = await fetch(`${SR_BASE}/v1/routes/visits/`, {
      method: 'POST', headers: srHeaders(cfg.token), body: JSON.stringify(visit),
    });
    if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 200) };
    const d = await r.json();
    return { ok: true, visitId: d?.id };
  } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 200) }; }
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const action = req.query?.action || 'status';

  // ── Webhook de SimpliRoute: entrega completada. SIN auth admin (lo llama
  //    SimpliRoute), se valida con org+secret en la query que generamos al conectar. ──
  if (action === 'webhook') {
    const org = req.query.org;
    const secret = req.query.secret;
    if (!org || !secret) return res.status(400).json({ error: 'Faltan parámetros' });
    const cfg = await getConfig(org);
    if (!cfg || cfg.webhook_secret !== secret) return res.status(401).json({ error: 'No autorizado' });

    const body = req.body || {};
    const status = body.status || body.visit?.status || body.data?.status;
    const reference = body.reference || body.visit?.reference || body.data?.reference;

    // Solo entregas completadas con referencia (= id del pedido) actualizan Pazque.
    if (reference && (status === 'completed' || status === 'partial')) {
      // Marca el pedido entregado → mueve el stepper del portal del cliente (Fase 1d).
      await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(reference)}&org_id=eq.${encodeURIComponent(org)}`, {
        method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'entregada' }),
      }).catch(() => {});
      // Espeja a la venta vinculada para la pestaña Ventas del admin (best-effort).
      try {
        const oRes = await fetch(
          `${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(reference)}&org_id=eq.${encodeURIComponent(org)}&select=venta_id&limit=1`,
          { headers: svcHeaders() }
        );
        const ventaId = (await oRes.json())?.[0]?.venta_id;
        if (ventaId) {
          await fetch(`${SB_URL}/rest/v1/ventas?id=eq.${encodeURIComponent(ventaId)}&org_id=eq.${encodeURIComponent(org)}`, {
            method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=minimal' },
            body: JSON.stringify({ estado: 'entregada' }),
          });
        }
      } catch { /* la venta se actualiza igual a mano si falla */ }
    }
    return res.status(200).json({ ok: true });   // los webhooks esperan 200 siempre
  }

  // ── El resto requiere admin ──
  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });
  const org = admin.org;

  // ── GET status: ¿está conectado? (nunca devuelve el token) ──
  if (action === 'status' && req.method === 'GET') {
    const cfg = await getConfig(org);
    return res.status(200).json({
      connected: !!cfg?.token,
      enabled: !!cfg?.enabled,
      account: cfg?.account_name || null,
    });
  }

  // ── POST connect: valida el token, lo guarda y registra el webhook ──
  if (action === 'connect' && req.method === 'POST') {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Pegá tu API token de SimpliRoute.' });

    const account = await validateToken(token);
    if (!account) return res.status(400).json({ error: 'El token no es válido. Revisalo en tu perfil de SimpliRoute.' });

    const webhook_secret = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2)) + Date.now().toString(36);
    const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'pazque.com');
    const webhookUrl = `${base}/api/simpliroute?action=webhook&org=${encodeURIComponent(org)}&secret=${encodeURIComponent(webhook_secret)}`;
    const webhook_id = await registerWebhook(token, webhookUrl);

    const account_name = account?.company?.name || account?.name || account?.email || 'Cuenta SimpliRoute';
    await saveConfig(org, { token, enabled: true, account_name, webhook_secret, webhook_id });
    return res.status(200).json({ ok: true, connected: true, enabled: true, account: account_name });
  }

  // ── POST disconnect: borra credenciales y webhook ──
  if (action === 'disconnect' && req.method === 'POST') {
    const cfg = await getConfig(org);
    if (cfg?.token) await deleteWebhook(cfg.token, cfg.webhook_id);
    await saveConfig(org, null);
    return res.status(200).json({ ok: true, connected: false });
  }

  // ── POST toggle: prende/apaga el auto-envío sin desconectar ──
  if (action === 'toggle' && req.method === 'POST') {
    const cfg = await getConfig(org);
    if (!cfg?.token) return res.status(400).json({ error: 'Primero conectá SimpliRoute.' });
    cfg.enabled = !!req.body?.enabled;
    await saveConfig(org, cfg);
    return res.status(200).json({ ok: true, enabled: cfg.enabled });
  }

  // ── POST push: empuja un pedido como visita ──
  if (action === 'push' && req.method === 'POST') {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'Falta el pedido.' });
    const cfg = await getConfig(org);
    const r = await pushOrder(org, orderId, cfg);
    if (r.skipped) return res.status(200).json({ ok: false, skipped: r.skipped });
    if (!r.ok) return res.status(400).json({ error: r.error || 'No se pudo enviar a SimpliRoute.' });
    return res.status(200).json({ ok: true, visitId: r.visitId });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}
