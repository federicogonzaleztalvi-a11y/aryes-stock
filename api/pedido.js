// api/pedido.js — B2B portal order endpoint
// SECURITY: validates portal session token
// ATP: calls create_b2b_order_with_reservations RPC (atomic)
//   - validates available_stock for all items
//   - creates all reservations
//   - inserts b2b_order
//   - all in one Postgres transaction (all-or-nothing)
// INTERNAL OPS: unaffected — VentasTab / create_venta unchanged

import { checkRateLimit } from './_rate-limit.js';
import { log, withObservability } from './_log.js';
import { setCorsHeaders } from './_cors.js';
import { generarOrdenPDF } from './_pedido-pdf.js';
import { sendEmail, templates } from './_email.js';
// Núcleo compartido de creación de pedido (mismo cierre para portal y bot WhatsApp).
import { createB2BOrder } from './_create-order.js';
// SECURITY (A3): usar la validación compartida que además exige revoked=false.
// La copia local no chequeaba `revoked`, así un token revocado (logout / baja de
// cliente) seguía autenticando hasta expirar por TTL.
import { validatePortalSession } from './_session.js';


const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  process.env.APP_URL || 'https://pazque.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};


// Construye el PDF del comprobante de un pedido YA guardado. Reusado por la
// descarga (GET ?action=comprobante) y el envío por mail (POST ?action=email-comprobante),
// para que el documento sea idéntico en ambos caminos.
// SECURITY: el cliente sólo accede a SUS pedidos (cliente_id + org_id de la sesión).
// Devuelve null si el pedido no existe / no es del cliente; lanza ante fallo de red.
async function buildComprobantePdf(session, orderId) {
  const key = SB_SVC || SB_ANON;
  const hdr = { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } };
  const oRes = await fetch(
    `${SB_URL}/rest/v1/b2b_orders?id=eq.${encodeURIComponent(orderId)}&cliente_id=eq.${session.cliente_id}&org_id=eq.${session.org_id}&limit=1`,
    hdr
  );
  if (!oRes.ok) throw new Error('order_fetch_failed');
  const oRows = await oRes.json();
  if (!oRows?.length) return null;
  const pedido = oRows[0];
  const orderItems = pedido.items || [];
  // empresa
  const orgRes = await fetch(SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(session.org_id) + '&select=name', hdr);
  const empresa = (orgRes.ok ? (await orgRes.json())[0]?.name : '') || 'Pazque';
  // datos fiscales del cliente
  const cliRes = await fetch(SB_URL + '/rest/v1/clients?id=eq.' + encodeURIComponent(session.cliente_id) + '&select=name,codigo,rut,address,ciudad,horario_desde,horario_hasta,zona_entrega,cond_pago&limit=1', hdr);
  const cli = (cliRes.ok ? (await cliRes.json())[0] : null) || {};
  // precios base
  const ids = orderItems.map(i => i.id || i.productId).filter(Boolean);
  let baseMap = {};
  if (ids.length) {
    const prRes = await fetch(SB_URL + '/rest/v1/products?uuid=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=uuid,precio_venta,codigo', hdr);
    if (prRes.ok) (await prRes.json()).forEach(p => { baseMap[p.uuid] = { precio: Number(p.precio_venta) || 0, codigo: p.codigo || '' }; });
  }
  const lineas = orderItems.map(i => {
    const unit = Number(i.precioUnit) || 0;
    const pid = i.id || i.productId;
    const qty = Number(i.cantidad || i.qty) || 0;
    return {
      codigo: baseMap[pid]?.codigo || '',
      nombre: i.nombre || i.productName || '',
      unidad: i.unidad || i.unit || '',
      qty,
      precioBase: (baseMap[pid]?.precio) || unit,
      precioUnit: unit,
      subtotal: Number(i.subtotal) || (unit * qty),
    };
  });
  const subtotal = lineas.reduce((a, l) => a + l.subtotal, 0);
  const descuentoTotal = lineas.reduce((a, l) => a + Math.max(0, (l.precioBase - l.precioUnit) * l.qty), 0);
  const total = Number(pedido.total) || subtotal;
  const iva = Math.round(total - subtotal);
  const ref = 'OC-' + String(orderId).slice(0, 8).toUpperCase();
  const pdfBuf = await generarOrdenPDF({
    titulo: 'Comprobante de pedido',
    footer: 'Comprobante generado por ' + empresa + ' vía Pazque',
    nroOrden: ref,
    fecha: pedido.creado_en || new Date().toISOString(),
    empresa, currencySymbol: '$',
    cliente: {
      nombre: cli.name, codigo: cli.codigo, rut: cli.rut,
      direccion: cli.address, ciudad: cli.ciudad,
      horarioDesde: cli.horario_desde, horarioHasta: cli.horario_hasta,
      zonaEntrega: cli.zona_entrega, condPago: cli.cond_pago,
    },
    lineas, subtotal, descuentoTotal, iva, total,
    notas: pedido.notas || '',
  });
  return { pdfBuf, ref, empresa, total, filename: 'comprobante-' + ref + '.pdf' };
}

async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await checkRateLimit('pedido:' + _ip, 60, 10))) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });


  // ── GET /api/pedido?action=pendientes — lista pedidos B2B pendientes (operador) ──
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action !== 'pendientes')
      return res.status(401).json({ error: 'No autorizado' });
    // Require auth — derive org from authenticated user
    const authH = req.headers['authorization'] || '';
    const userToken = authH.startsWith('Bearer ') ? authH.slice(7) : null;
    if (!userToken) return res.status(401).json({ error: 'No autenticado' });
    const userRes = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + userToken } });
    if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });
    const userData = await userRes.json();
    const userMeta = userData?.user_metadata || userData?.raw_user_meta_data || {};
    const org = userMeta.org_id;
    if (!org) return res.status(403).json({ error: 'Usuario sin organización' });
    const key = SB_SVC || SB_ANON;
    const r = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?org_id=eq.${encodeURIComponent(org)}&estado=eq.pendiente&order=creado_en.desc&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(500).json({ error: 'Error al obtener pedidos' });
    

    return res.status(200).json({ ok: true, pedidos: await r.json() });
  }

  // ── GET /api/pedido?action=historial — historial del cliente autenticado ──
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action === 'historial') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const session = await validatePortalSession(token);
      if (!session) return res.status(401).json({ error: 'Sesión inválida' });
      const key = SB_SVC || SB_ANON;
      const r = await fetch(
        `${SB_URL}/rest/v1/b2b_orders?cliente_id=eq.${session.cliente_id}&org_id=eq.${session.org_id}&order=creado_en.desc&limit=30`,
        { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
      );
      if (!r.ok) return res.status(500).json({ error: 'Error al obtener historial' });
      

    return res.status(200).json({ ok: true, pedidos: await r.json() });
    }

    // ── GET ?action=comprobante&orderId=X — PDF descargable del pedido (cliente) ──
    if (action === 'comprobante') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const session = await validatePortalSession(token);
      if (!session) return res.status(401).json({ error: 'Sesión inválida' });
      const orderId = req.query?.orderId;
      if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
      try {
        const built = await buildComprobantePdf(session, orderId);
        if (!built) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="' + built.filename + '"');
        return res.status(200).send(built.pdfBuf);
      } catch (pdfErr) {
        log.warn('pedido', 'comprobante pdf failed', { error: pdfErr.message });
        return res.status(500).json({ error: 'No se pudo generar el comprobante' });
      }
    }

    return res.status(400).json({ error: 'action requerida' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── POST ?action=email-comprobante — envía el comprobante por mail al cliente ──
  // Lo dispara el cliente desde el portal tras confirmar; manda a una casilla que
  // él elige. Reusa el MISMO PDF que la descarga (buildComprobantePdf).
  if (req.query?.action === 'email-comprobante') {
    const authHeaderE = req.headers['authorization'] || '';
    const tokenE = authHeaderE.startsWith('Bearer ') ? authHeaderE.slice(7) : null;
    const sessionE = await validatePortalSession(tokenE);
    if (!sessionE) return res.status(401).json({ error: 'Sesión inválida' });
    const { orderId, to } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const dest = String(to || '').trim();
    if (!EMAIL_RE.test(dest)) return res.status(400).json({ error: 'Email inválido' });
    try {
      const built = await buildComprobantePdf(sessionE, orderId);
      if (!built) return res.status(404).json({ error: 'Pedido no encontrado' });
      const tpl = templates.comprobanteCliente(built.empresa, built.ref, built.total);
      const sent = await sendEmail({
        to: dest, subject: tpl.subject, html: tpl.html,
        attachments: [{ filename: built.filename, content: built.pdfBuf.toString('base64') }],
      });
      if (!sent) return res.status(502).json({ error: 'No se pudo enviar el email. Revisá la dirección e intentá de nuevo.' });
      log.info('pedido', 'comprobante emailed', { orderId, to: dest });
      return res.status(200).json({ ok: true });
    } catch (e) {
      log.warn('pedido', 'email-comprobante failed', { error: e.message });
      return res.status(500).json({ error: 'No se pudo enviar el comprobante' });
    }
  }

  // ── POST /api/pedido?action=confirmar — confirmar pedido B2B → venta (operador) ──
  const actionConfirm = req.query?.action;
  if (actionConfirm === 'confirmar') {
    // POST confirmar — require auth, derive org from user
    const authHC = req.headers['authorization'] || '';
    const userTokenC = authHC.startsWith('Bearer ') ? authHC.slice(7) : null;
    if (!userTokenC) return res.status(401).json({ error: 'No autenticado' });
    const userResC = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + userTokenC } });
    if (!userResC.ok) return res.status(401).json({ error: 'Sesion invalida' });
    const userDataC = await userResC.json();
    const userMetaC = userDataC?.user_metadata || userDataC?.raw_user_meta_data || {};
    const org = userMetaC.org_id;
    if (!org) return res.status(403).json({ error: 'Usuario sin organización' });

    // SECURITY: confirmar un pedido (genera venta y muta stock) es acción de
    // operación — sólo admin/operador. Un vendedor no debería confirmarlos.
    let roleC = userMetaC.role || null;
    if (!roleC && userDataC?.email) {
      const roleRes = await fetch(
        `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(userDataC.email)}&select=role&limit=1`,
        { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' } }
      );
      if (roleRes.ok) { const rows = await roleRes.json(); roleC = rows?.[0]?.role || null; }
    }
    if (!['admin', 'operador'].includes(roleC))
      return res.status(403).json({ error: 'No autorizado: requiere rol operador o admin' });

    const { orderId, operador = 'admin' } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const key = SB_SVC || SB_ANON;
    const orderRes = await fetch(
      `${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}&org_id=eq.${encodeURIComponent(org)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }
    );
    const orders = await orderRes.json();
    if (!orders?.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = orders[0];
    if (pedido.estado !== 'pendiente')
      return res.status(409).json({ error: `Pedido ya en estado: ${pedido.estado}` });
    const nroRes = await fetch(`${SB_URL}/rest/v1/rpc/next_nro_venta`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const nroVenta = nroRes.ok ? await nroRes.json() : `V-B2B-${Date.now()}`;
    const itemsVenta = (pedido.items || []).map(item => ({
      productId:   item.id         || '',
      productName: item.nombre     || '',
      qty:         item.cantidad   || 0,
      unit:        item.unidad     || 'un',
      unitPrice:   item.precioUnit || 0,
      subtotal:    item.subtotal   || 0,
    }));
    const ventaId = crypto.randomUUID();
    const now = new Date().toISOString();
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'confirmada', confirmado_en: now, confirmado_por: operador }),
    });
    log.info('pedido', 'b2b confirmado', { orderId, nroVenta, cliente: pedido.cliente_nombre });
    

    return res.status(200).json({ ok: true, venta: {
      id: ventaId, nroVenta,
      clientId: pedido.cliente_id || '', clientName: pedido.cliente_nombre,
      clientTel: pedido.cliente_tel || '', items: itemsVenta,
      total: pedido.total, estado: 'confirmada',
      origen: 'b2b_portal', b2bOrderId: pedido.id,
      date: now, createdAt: now,
    }});
  }

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const authHeader    = req.headers['authorization'] || '';
  const token         = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const portalSession = await validatePortalSession(token);

  if (!portalSession) {
    log.warn('pedido', 'unauthorized — invalid or missing session token');
    return res.status(401).json({ error: 'Sesión inválida. Iniciá sesión nuevamente.' });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const {
    items          = [],
    total          = 0,
    notas          = '',
    idempotencyKey = null,
  } = req.body || {};

  if (!items.length) {
    return res.status(400).json({ error: 'El pedido no tiene productos' });
  }

  // Identity from validated server-side session — never trust the body
  const org           = portalSession.org_id;
  const clienteId     = portalSession.cliente_id;
  const clienteTel    = portalSession.tel;
  const clienteNombre = (req.body?.clienteNombre || '').substring(0, 100);

  // ── 3. Crear el pedido vía núcleo compartido ─────────────────────────────
  // createB2BOrder hace: validación de UUID + detección de anomalías + RPC
  // atómico (con reintentos idempotentes) + push + mail con PDF. Devuelve un
  // resultado estructurado que mapeamos a HTTP acá. El bot de WhatsApp llamará a
  // la MISMA función y mapeará el resultado a un mensaje.
  const result = await createB2BOrder({
    org, clienteId, clienteNombre, clienteTel,
    items, total, notas, idempotencyKey,
  });

  if (!result.ok) {
    switch (result.code) {
      case 'invalid_client':
        return res.status(400).json({ error: 'Tu cuenta no está habilitada para pedidos. Cerrá sesión y volvé a entrar.' });
      case 'insufficient_stock':
        return res.status(409).json({
          error:     `Stock insuficiente para: ${result.nombre}. Disponible: ${result.available}. Actualizá tu pedido.`,
          productId: result.productId,
          available: result.available,
        });
      case 'product_not_found':
        return res.status(404).json({ error: 'Uno o más productos no fueron encontrados.' });
      case 'unreachable':
        return res.status(502).json({ error: 'No pudimos conectar con el servidor. Intentá de nuevo en unos segundos.' });
      default:
        return res.status(502).json({ error: 'Error al procesar el pedido. Intentá de nuevo.' });
    }
  }

  return res.status(200).json({ ok: true, orderId: result.orderId, ...(result.idempotent ? { idempotent: true } : {}) });
}

export default withObservability('pedido', handler);
