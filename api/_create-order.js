// api/_create-order.js — núcleo compartido de creación de pedido B2B
// ============================================================================
// Quién lo usa:
//   - api/pedido.js      → portal web (identidad por sesión de portal)
//   - api/whatsapp.js    → bot de pedidos (identidad por teléfono)  [futuro]
//
// Por qué existe:
//   El cierre de un pedido (anomalías → RPC atómico → push → mail con PDF) tiene
//   que ser IDÉNTICO venga del portal o del bot: mismo pedido, mismo mail, mismo
//   PDF, misma idempotencia. Antes vivía inline en api/pedido.js. Extraído acá
//   para reusarlo sin duplicar y sin que las dos rutas se desincronicen.
//
// Contrato:
//   createB2BOrder({ org, clienteId, clienteNombre, clienteTel, items, total,
//                    notas, idempotencyKey }) → Promise<Result>
//
//   NO toca req/res. Devuelve un objeto y el caller decide cómo responderlo
//   (HTTP en el portal, mensaje de WhatsApp en el bot).
//
//   Éxito:   { ok: true,  orderId, idempotent?: boolean }
//   Fallo:   { ok: false, code, ...detalles }
//     code = 'invalid_client'      → cliente_id no es UUID (no se puede pedir)
//     code = 'insufficient_stock'  → { productId, available, nombre }
//     code = 'product_not_found'
//     code = 'unreachable'         → RPC inalcanzable (red/5xx persistente)
//     code = 'rpc_error'           → fallo no clasificado del RPC
// ============================================================================

import webpush from 'web-push';
import { log } from './_log.js';
import { sendEmail, templates } from './_email.js';
import { generarOrdenPDF } from './_pedido-pdf.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Crea un pedido B2B de forma atómica y dispara notificaciones (push + mail).
 * La identidad del cliente ya viene resuelta y verificada por el caller.
 */
export async function createB2BOrder({
  org,
  clienteId,
  clienteNombre = '',
  clienteTel = '',
  items = [],
  total = 0,
  notas = '',
  idempotencyKey = null,
}) {
  // El RPC tipa p_cliente_id como UUID. Un cliente con id no-UUID (filas legacy o
  // de test cuyo clients.id es string) hace que Postgres tire 22P02, que antes
  // emergía como un 502 opaco. Lo detectamos acá y devolvemos un código claro.
  if (!UUID_RE.test(clienteId || '')) {
    log.error('create-order', 'cliente_id no es UUID — no se puede crear pedido', { clienteId, org });
    return { ok: false, code: 'invalid_client' };
  }

  // Pre-generamos el ID del pedido (se usa como reference_id de las reservas).
  const orderId = crypto.randomUUID();

  const rpcHeaders = {
    apikey:          SB_SVC || SB_ANON,
    Authorization:  `Bearer ${SB_SVC || SB_ANON}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // ── Detección de anomalías — marca pedidos inusuales para revisión admin ───
  let requiere_revision = false;
  let anomaly_reasons = [];
  try {
    const histRes = await fetch(
      SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + clienteId + '&org_id=eq.' + org + '&order=creado_en.desc&limit=10&select=items,total',
      { headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), Accept: 'application/json' } }
    );
    if (histRes.ok) {
      const history = await histRes.json();
      if (history && history.length >= 2) {
        var avgTotal = history.reduce(function(s, o) { return s + Number(o.total || 0); }, 0) / history.length;
        if (Number(total) > avgTotal * 3 && avgTotal > 0) {
          requiere_revision = true;
          anomaly_reasons.push('Total $' + Number(total).toFixed(0) + ' es ' + Math.round(Number(total)/avgTotal) + 'x el promedio ($' + Math.round(avgTotal) + ')');
        }
        var histQty = {};
        history.forEach(function(o) { (o.items || []).forEach(function(it) {
          var k = it.productId || it.productoId || '';
          if (!histQty[k]) histQty[k] = [];
          histQty[k].push(Number(it.qty || it.cantidad || 0));
        }); });
        items.forEach(function(it) {
          var k = it.productId || '';
          var qty = Number(it.qty || it.cantidad || 0);
          if (histQty[k] && histQty[k].length >= 2) {
            var avgQty = histQty[k].reduce(function(s,v){return s+v;},0) / histQty[k].length;
            if (qty > avgQty * 3 && avgQty > 0) {
              requiere_revision = true;
              anomaly_reasons.push((it.nombre || k) + ': ' + qty + ' unidades (promedio: ' + Math.round(avgQty) + ')');
            }
          }
        });
      } else if (history.length === 0 && Number(total) > 500) {
        requiere_revision = true;
        anomaly_reasons.push('Primer pedido del cliente con total alto: $' + Number(total).toFixed(0));
      }
    }
  } catch (anomalyErr) {
    // No fatal — seguimos sin chequeo de anomalías
    log.warn('create-order', 'anomaly check failed (non-fatal)', { error: anomalyErr.message });
  }

  // ── RPC atómico: create_b2b_order_with_reservations ────────────────────────
  // Valida stock disponible de TODOS los items, crea TODAS las reservas e inserta
  // el pedido — todo en una transacción Postgres. Si un item no alcanza → rollback
  // completo, sin estado parcial.
  const rpcPayload = JSON.stringify({
    p_order_id:        orderId,
    p_org_id:          org,
    p_cliente_id:      clienteId,
    p_cliente_nombre:  clienteNombre,
    p_cliente_tel:     clienteTel,
    p_items:           items,
    p_total:           Number(total) || 0,
    p_notas:           notas || '',
    p_idempotency_key: idempotencyKey || null,
    p_ttl_hours:       6,
  });

  // Leemos el body como TEXT una vez, con reintentos ante fallos transitorios
  // (throw de red o 5xx upstream como statement timeout o pool agotado en un
  // pico). Backoff corto para darle aire al pool. Reintentar SOLO es seguro con
  // idempotencyKey: si el primer intento commiteó pero se perdió la respuesta, el
  // retry pega contra el check de idempotencia y devuelve el pedido existente en
  // vez de duplicar. Sin key NO reintentamos (una respuesta perdida duplicaría).
  const rpcUrl    = `${SB_URL}/rest/v1/rpc/create_b2b_order_with_reservations`;
  const canRetry  = !!idempotencyKey;
  const MAX_TRIES = canRetry ? 3 : 1;
  const BACKOFF   = [300, 800];
  const sleep     = (ms) => new Promise((r) => setTimeout(r, ms));
  let rpcRes   = null;
  let rpcText  = '';
  let rpcThrew = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const isLast = attempt === MAX_TRIES - 1;
    try {
      rpcRes   = await fetch(rpcUrl, { method: 'POST', headers: rpcHeaders, body: rpcPayload });
      rpcText  = await rpcRes.text();
      rpcThrew = null;
      if (rpcRes.status >= 500 && !isLast) {
        log.warn('create-order', 'RPC transient upstream error — retrying', { status: rpcRes.status, attempt });
        await sleep(BACKOFF[attempt] || 800);
        continue;
      }
      break;
    } catch (netErr) {
      rpcThrew = netErr;
      log.warn('create-order', 'RPC network error', { attempt, error: netErr.message });
      if (!isLast) { await sleep(BACKOFF[attempt] || 800); continue; }
    }
  }

  if (rpcThrew || !rpcRes) {
    log.error('create-order', 'RPC unreachable', { error: rpcThrew?.message });
    return { ok: false, code: 'unreachable' };
  }

  let rpcBody = null;
  try { rpcBody = rpcText ? JSON.parse(rpcText) : null; } catch { /* body upstream no-JSON */ }

  if (!rpcRes.ok) {
    const errMsg = rpcBody?.message || rpcBody?.details || rpcText || '';

    if (errMsg.includes('item_insufficient:')) {
      // Formato: 'item_insufficient:{productId}:{available}:{requested}'
      const parts     = errMsg.split(':');
      const productId = parts[1] || '';
      const available = parts[2] || '0';
      const itemMatch = items.find(i => i.productId === productId);
      const nombre    = itemMatch?.nombre || productId;
      log.warn('create-order', 'insufficient stock', { productId, available });
      return { ok: false, code: 'insufficient_stock', productId, available: Number(available), nombre };
    }

    if (errMsg.includes('product_not_found')) {
      log.warn('create-order', 'product not found in RPC', { errMsg });
      return { ok: false, code: 'product_not_found' };
    }

    // Hit idempotente — el pedido ya existe
    if (rpcBody?.idempotent) {
      log.info('create-order', 'idempotent hit', { orderId: rpcBody.orderId });
      return { ok: true, orderId: rpcBody.orderId, idempotent: true };
    }

    log.error('create-order', 'RPC error', {
      status:  rpcRes.status,
      code:    rpcBody?.code || null,
      errMsg,
      rawBody: rpcText ? rpcText.slice(0, 800) : '(empty)',
    });
    return { ok: false, code: 'rpc_error' };
  }

  const result = rpcBody || {};

  if (result?.idempotent) {
    log.info('create-order', 'idempotent hit via RPC', { orderId: result.orderId });
    return { ok: true, orderId: result.orderId, idempotent: true };
  }

  const finalOrderId = result.orderId || orderId;
  log.info('create-order', 'order created with reservations', {
    orderId: finalOrderId, org, clienteId, items: items.length, total,
  });

  // ── Notificaciones (no fatales) — se hace best-effort, no afecta el ok ─────
  await notifyOrder({
    org, clienteId, clienteNombre, items, total, notas,
    orderId: finalOrderId, requiere_revision, anomaly_reasons,
  });

  return { ok: true, orderId: finalOrderId };
}

/**
 * Efectos secundarios post-pedido: marca de anomalías + push al admin + mail con
 * PDF a la casilla de la org. Todo best-effort; un fallo acá nunca invalida el
 * pedido ya commiteado.
 */
async function notifyOrder({ org, clienteId, clienteNombre, items, total, notas, orderId, requiere_revision, anomaly_reasons }) {
  // Patch de flags de anomalía si se detectaron
  if (requiere_revision) {
    await fetch(SB_URL + '/rest/v1/b2b_orders?id=eq.' + orderId, {
      method: 'PATCH',
      headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ requiere_revision: true, anomaly_reasons: anomaly_reasons }),
    }).catch(function() {});
    log.info('create-order', 'anomaly detected', { orderId, reasons: anomaly_reasons });
  }

  // ── Push al admin de la org ───────────────────────────────────────────────
  try {
    const pushSubs = await fetch(
      SB_URL + '/rest/v1/push_subscriptions?org_id=eq.' + encodeURIComponent(org) + '&limit=20',
      { headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), Accept: 'application/json' } }
    );
    if (pushSubs.ok) {
      const subs = await pushSubs.json();
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:hola@pazque.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
        const payload = JSON.stringify({
          title: 'Nuevo pedido B2B',
          body: (clienteNombre || 'Un cliente') + ' hizo un pedido por $' + Number(total).toFixed(0),
          icon: '/pazque-logo.png',
          tag: 'b2b-order-' + orderId,
          url: '/app/pedidos',
        });
        await Promise.allSettled(
          subs.map(sub => {
            try {
              // push_subscriptions guarda los campos PLANOS (endpoint/p256dh/auth).
              // Reconstruimos el shape que espera web-push igual que api/push.js.
              const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
              return webpush.sendNotification(subscription, payload);
            } catch { return Promise.resolve(); }
          })
        );
        log.info('create-order', 'push sent', { org, subs: subs.length });
      }
    }
  } catch (pushErr) {
    log.warn('create-order', 'push notification failed (non-fatal)', { error: pushErr.message });
  }

  // ── Mail a la org (solo si tiene casilla configurada) ─────────────────────
  try {
    const orgRes = await fetch(
      SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(org) + '&select=order_notify_email,name',
      { headers: { apikey: SB_SVC || SB_ANON, Authorization: 'Bearer ' + (SB_SVC || SB_ANON), Accept: 'application/json' } }
    );
    if (orgRes.ok) {
      const orgRows = await orgRes.json();
      const notifyEmail = orgRows?.[0]?.order_notify_email;
      if (notifyEmail) {
        const empresa = orgRows[0].name || 'Pazque';
        const currencySymbol = '$';
        const tpl = templates.nuevoPedido(clienteNombre || 'Cliente', items, total, empresa, currencySymbol);

        // Genera orden de compra en PDF (uso interno) y adjunta. Si falla, el mail va igual.
        let attachments;
        try {
          const k = SB_SVC || SB_ANON;
          const hdr = { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' } };
          const cliRes = await fetch(SB_URL + '/rest/v1/clients?id=eq.' + encodeURIComponent(clienteId) + '&select=name,codigo,rut,address,ciudad,horario_desde,horario_hasta,zona_entrega,cond_pago&limit=1', hdr);
          const cli = (cliRes.ok ? (await cliRes.json())[0] : null) || {};
          const ids = items.map(i => i.id || i.productId).filter(Boolean);
          let baseMap = {};
          if (ids.length) {
            const prRes = await fetch(SB_URL + '/rest/v1/products?uuid=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=uuid,precio_venta,codigo', hdr);
            if (prRes.ok) (await prRes.json()).forEach(p => { baseMap[p.uuid] = { precio: Number(p.precio_venta) || 0, codigo: p.codigo || '' }; });
          }
          const lineas = items.map(i => {
            const unit = Number(i.precioUnit) || 0;
            const pid = i.id || i.productId;
            return {
              codigo: baseMap[pid]?.codigo || '',
              nombre: i.nombre || i.productName || '',
              unidad: i.unidad || i.unit || '',
              qty: Number(i.cantidad || i.qty) || 0,
              precioBase: (baseMap[pid]?.precio) || unit,
              precioUnit: unit,
              subtotal: Number(i.subtotal) || (unit * (Number(i.cantidad || i.qty) || 0)),
            };
          });
          const subtotal = lineas.reduce((a, l) => a + l.subtotal, 0);
          const descuentoTotal = lineas.reduce((a, l) => a + Math.max(0, (l.precioBase - l.precioUnit) * l.qty), 0);
          const iva = Math.round(Number(total) - subtotal);
          const pdfBuf = await generarOrdenPDF({
            nroOrden: 'OC-' + String(orderId).slice(0, 8).toUpperCase(),
            fecha: new Date().toISOString(),
            empresa, currencySymbol,
            cliente: {
              nombre: cli.name || clienteNombre, codigo: cli.codigo, rut: cli.rut,
              direccion: cli.address, ciudad: cli.ciudad,
              horarioDesde: cli.horario_desde, horarioHasta: cli.horario_hasta,
              zonaEntrega: cli.zona_entrega, condPago: cli.cond_pago,
            },
            lineas, subtotal, descuentoTotal, iva, total: Number(total) || 0,
            notas: notas || '',
          });
          const nombreLimpio = (clienteNombre || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,30);
          attachments = [{ filename: 'orden-' + nombreLimpio + '-OC-' + String(orderId).slice(0,8).toUpperCase() + '.pdf', content: pdfBuf.toString('base64') }];
        } catch (pdfErr) {
          log.warn('create-order', 'pdf generation failed (non-fatal)', { error: pdfErr.message });
        }

        await sendEmail({ to: notifyEmail, subject: tpl.subject, html: tpl.html, attachments });
        log.info('create-order', 'order email sent', { org, to: notifyEmail, pdf: !!attachments });
      }
    }
  } catch (mailErr) {
    log.warn('create-order', 'order email failed (non-fatal)', { error: mailErr.message });
  }
}
