// api/broadcast.js — Broadcasts por WhatsApp (re-enganche de clientes).
// ----------------------------------------------------------------------------
// El "broadcasts" de Choco: el distribuidor manda un mensaje proactivo por
// WhatsApp a sus clientes (ej. reactivar a los que no compran hace tiempo, o
// empujar un producto). Reusa la misma infra de envío que el OTP (Meta Cloud API).
//
// IMPORTANTE (política de Meta): WhatsApp NO permite mensajes proactivos en texto
// libre fuera de la ventana de 24h. Para iniciar conversación hay que usar una
// PLANTILLA pre-aprobada (igual que 'pazque_otp'). Por eso el envío va por
// template configurable (WA_BROADCAST_TEMPLATE) con un único parámetro de cuerpo
// {{1}} = el texto ya personalizado. El distribuidor debe tener esa plantilla
// aprobada en Meta Business Manager. Si no está aprobada, Meta devuelve error y
// se reporta por recipient.
//
// Identidad: se valida el access_token del admin y se deriva el org DEL SERVIDOR.
// Solo rol admin (mandar mensajes masivos es acción sensible).
//
// GET  /api/broadcast?action=audiencia&dias=30  → clientes dormidos (>= N dias sin pedir)
// POST /api/broadcast?action=send               → { clienteIds, mensaje } envia a cada uno

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_TEMPLATE = process.env.WA_BROADCAST_TEMPLATE || 'pazque_broadcast';
const WA_LANG     = process.env.WA_BROADCAST_LANG || 'es_AR';

const MAX_RECIPIENTS = 200;   // tope por request (defensivo, costo y rate)

// Valida el JWT del admin y resuelve { org } desde la tabla users. Solo admin.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const userData = await userRes.json();
  const email = userData?.email;
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

function digits(p) { return String(p || '').replace(/\D/g, ''); }

// Último pedido por cliente combinando ventas + b2b_orders (misma lógica de fuentes
// que el resto del portal: una venta importada o un pedido del portal cuentan igual).
async function lastOrderByClient(org, svcH) {
  const last = {};  // cliente_id -> ms del último pedido
  const bump = (cid, iso) => {
    if (!cid || !iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return;
    if (!last[cid] || t > last[cid]) last[cid] = t;
  };
  const [vRes, bRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/ventas?org_id=eq.${encodeURIComponent(org)}&estado=neq.cancelada&select=cliente_id,fecha,created_at&order=created_at.desc&limit=5000`, { headers: svcH }),
    fetch(`${SB_URL}/rest/v1/b2b_orders?org_id=eq.${encodeURIComponent(org)}&estado=neq.cancelada&select=cliente_id,creado_en&order=creado_en.desc&limit=5000`, { headers: svcH }),
  ]);
  if (vRes.ok) (await vRes.json()).forEach(v => bump(v.cliente_id, v.created_at || v.fecha));
  if (bRes.ok) (await bRes.json()).forEach(o => bump(o.cliente_id, o.creado_en));
  return last;
}

// Manda una plantilla de WhatsApp con un único parámetro de cuerpo (el texto ya
// personalizado). phoneId/token pueden ser los de la org si tiene sender propio.
async function sendTemplate({ to, texto, phoneId, token }) {
  const res = await fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: WA_TEMPLATE,
        language: { code: WA_LANG },
        components: [{ type: 'body', parameters: [{ type: 'text', text: texto }] }],
      },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });

  const svcKey = SB_SVC || SB_ANON;
  const svcH = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };
  const action = req.query?.action || 'audiencia';

  // ── GET audiencia: clientes dormidos (>= N dias sin pedir, o que nunca pidieron) ──
  if (action === 'audiencia' && req.method === 'GET') {
    let dias = parseInt(req.query.dias, 10);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) dias = 30;
    const cutoff = Date.now() - dias * 24 * 60 * 60 * 1000;

    const cRes = await fetch(
      `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(admin.org)}&phone=not.is.null&select=id,name,phone&limit=5000`,
      { headers: svcH }
    );
    if (!cRes.ok) return res.status(502).json({ error: 'Error al leer clientes' });
    const clients = await cRes.json();
    const last = await lastOrderByClient(admin.org, svcH);

    const dormidos = (Array.isArray(clients) ? clients : [])
      .filter(c => digits(c.phone).length >= 8)
      .map(c => {
        const lt = last[c.id] || 0;
        return { id: c.id, name: c.name || 'Cliente', tel: digits(c.phone),
          ultimoPedido: lt ? new Date(lt).toISOString() : null,
          diasSinPedir: lt ? Math.floor((Date.now() - lt) / 86400000) : null };
      })
      // Dormido = nunca pidió, o su último pedido es de hace >= N días.
      .filter(c => c.ultimoPedido === null || new Date(c.ultimoPedido).getTime() <= cutoff)
      // Más dormidos primero (los que nunca pidieron van arriba).
      .sort((a, b) => (b.diasSinPedir == null ? Infinity : b.diasSinPedir) - (a.diasSinPedir == null ? Infinity : a.diasSinPedir));

    return res.status(200).json({ dias, total: dormidos.length, clientes: dormidos });
  }

  // ── POST send: manda el mensaje (plantilla) a la lista de clienteIds dada ──
  if (action === 'send' && req.method === 'POST') {
    const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (!(await checkRateLimit('broadcast:' + admin.org + ':' + _ip, 3600, 10, { failClosed: true })))
      return res.status(429).json({ error: 'Demasiados envíos. Esperá un rato.' });

    if (!WA_TOKEN || !WA_PHONE_ID)
      return res.status(503).json({ error: 'WhatsApp no configurado para envíos.' });

    const { clienteIds, mensaje } = req.body || {};
    if (!Array.isArray(clienteIds) || !clienteIds.length)
      return res.status(400).json({ error: 'Elegí al menos un cliente.' });
    if (!mensaje || !String(mensaje).trim())
      return res.status(400).json({ error: 'Escribí un mensaje.' });
    if (clienteIds.length > MAX_RECIPIENTS)
      return res.status(400).json({ error: `Máximo ${MAX_RECIPIENTS} destinatarios por envío.` });

    // Traer los clientes pedidos, SCOPED al org (no se confía el id del body).
    const idList = clienteIds.map(id => `"${String(id).replace(/[^a-z0-9-]/gi, '')}"`).join(',');
    const cRes = await fetch(
      `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(admin.org)}&id=in.(${idList})&select=id,name,phone`,
      { headers: svcH }
    );
    if (!cRes.ok) return res.status(502).json({ error: 'Error al leer clientes' });
    const clients = (await cRes.json()).filter(c => digits(c.phone).length >= 8);

    // Sender propio de la org si está configurado (white-label multi-tenant).
    let phoneId = WA_PHONE_ID, token = WA_TOKEN;
    try {
      const oRes = await fetch(
        `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(admin.org)}&select=whatsapp_sender&limit=1`,
        { headers: svcH }
      );
      const o = (await oRes.json())?.[0];
      if (o?.whatsapp_sender?.phone_id && o?.whatsapp_sender?.token) {
        phoneId = o.whatsapp_sender.phone_id; token = o.whatsapp_sender.token;
      }
    } catch { /* fallback a sender Pazque */ }

    let enviados = 0, fallidos = 0;
    const errores = [];
    const results = await Promise.allSettled(clients.map(c => {
      // {nombre} → nombre real del cliente; el resto del texto va tal cual.
      const texto = String(mensaje).replace(/\{nombre\}/gi, c.name || 'Cliente').slice(0, 900);
      return sendTemplate({ to: digits(c.phone), texto, phoneId, token });
    }));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') enviados++;
      else { fallidos++; if (errores.length < 3) errores.push({ cliente: clients[i]?.name, error: String(r.reason?.message || r.reason).slice(0, 160) }); }
    });

    return res.status(200).json({ ok: true, enviados, fallidos, errores });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}
