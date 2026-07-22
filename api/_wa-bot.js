// api/_wa-bot.js — orquestador del bot de pedidos por WhatsApp (Fase 3)
// ============================================================================
// Une las piezas puras de las fases anteriores en una máquina de estados por
// conversación:
//
//   getCatalogoCliente  (api/_catalog.js)     → catálogo + precios del cliente
//   interpretarPedido   (api/_wa-interpret.js) → texto libre → líneas
//   createB2BOrder      (api/_create-order.js) → cierre atómico del pedido
//
// Contrato (NO toca req/res; el webhook decide cómo enviar las respuestas):
//   procesarMensajeBot({ phone_number_id, from, text, messageId }, deps?)
//     → Promise<{ replies: string[], org?, estado?, handled }>
//
//   handled=false  → el bot NO tomó el mensaje (org sin bot, sin cliente, o
//                    mensaje duplicado). El webhook sigue su curso normal y NO
//                    debe responder nada del bot. Esto es lo que evita romper el
//                    OTP: si el número/cliente no es de bot, devolvemos handled:false.
//
// Multi-tenant: la org sale de wa_accounts[phone_number_id] (modelo Tech
// Provider) o de WA_DEFAULT_ORG en el piloto de un solo número. NUNCA hardcodear
// una org. El bot sólo se activa si la org lo habilitó (portalCfg.botPedidos).
//
// Máquina de estados (wa_conversations.estado):
//   idle      → llega texto → interpretar → guardar carrito → 'revision'
//   revision  → "si/dale/ok"   → crear pedido → 'idle'
//             → "no/cancelar"   → descartar    → 'idle'
//             → otro texto      → re-interpretar (reemplaza carrito) → 'revision'
// ============================================================================

import { log } from './_log.js';
import { getCatalogoCliente } from './_catalog.js';
import { interpretarPedido } from './_wa-interpret.js';
import { createB2BOrder } from './_create-order.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const WA_DEFAULT_ORG = process.env.WA_DEFAULT_ORG || '';

// TTL del carrito en revisión: pasado esto, un "si" no confirma un carrito viejo.
const CART_TTL_MS = 60 * 60 * 1000; // 1h

const CONFIRM_RE = /^(si|sí|s|dale|ok|oka|okay|listo|confirmo|confirmar|va|vale|sale|perfecto|👍|de una)\b/i;
const CANCEL_RE  = /^(no|nop|cancelar|cancela|cancelá|anular|anula|borrar|borra|nada|olvidalo|dejá|deja)\b/i;

function svcHeaders(extra = {}) {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    Accept: 'application/json',
    ...extra,
  };
}

const money = n => '$' + (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR');

// ── Resolución de org por número de Meta (phone_number_id) ───────────────────
async function resolveOrg(phone_number_id) {
  if (phone_number_id) {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/wa_accounts?phone_number_id=eq.${encodeURIComponent(phone_number_id)}&select=org_id,display_name&limit=1`,
        { headers: svcHeaders() }
      );
      if (r.ok) {
        const rows = await r.json();
        if (rows?.[0]?.org_id) return { org: rows[0].org_id, displayName: rows[0].display_name || '' };
      }
    } catch (e) {
      log.warn('wa-bot', 'wa_accounts lookup falló', { error: e.message });
    }
  }
  // Piloto de un solo número: org por env (configurable, no hardcodeada).
  if (WA_DEFAULT_ORG) return { org: WA_DEFAULT_ORG, displayName: '' };
  return { org: null, displayName: '' };
}

// ── Resolución del cliente por teléfono dentro de la org ─────────────────────
// Mismo patrón que api/otp-send.js: clients por org + phone, fallback client_phones.
async function resolveCliente(org, from) {
  const tel = String(from || '').replace(/[^0-9]/g, '');
  if (!tel) return null;
  const last8 = tel.slice(-8);

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/clients?org_id=eq.${encodeURIComponent(org)}` +
        `&or=(phone.eq.${tel},phone.like.*${last8})` +
        `&select=id,name,lista_id,portal_activo&limit=1`,
      { headers: svcHeaders() }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows?.[0]?.id) return rows[0];
    }
  } catch (e) {
    log.warn('wa-bot', 'clients lookup falló', { error: e.message });
  }

  // Fallback: número secundario en client_phones → resolver cliente.
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/client_phones?phone=like.*${last8}&active=eq.true&select=client_id&limit=1`,
      { headers: svcHeaders() }
    );
    if (r.ok) {
      const rows = await r.json();
      const cid = rows?.[0]?.client_id;
      if (cid) {
        const cr = await fetch(
          `${SB_URL}/rest/v1/clients?id=eq.${cid}&org_id=eq.${encodeURIComponent(org)}&select=id,name,lista_id,portal_activo&limit=1`,
          { headers: svcHeaders() }
        );
        if (cr.ok) {
          const rows2 = await cr.json();
          if (rows2?.[0]?.id) return rows2[0];
        }
      }
    }
  } catch (e) {
    log.warn('wa-bot', 'client_phones lookup falló', { error: e.message });
  }
  return null;
}

// ── Estado de conversación ───────────────────────────────────────────────────
async function loadConversation(phone_number_id, from) {
  const pid = phone_number_id || '';
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/wa_conversations?phone_number_id=eq.${encodeURIComponent(pid)}` +
        `&from_number=eq.${encodeURIComponent(from)}&limit=1`,
      { headers: svcHeaders() }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows?.[0]) return rows[0];
    }
  } catch (e) {
    log.warn('wa-bot', 'loadConversation falló', { error: e.message });
  }
  return null;
}

async function saveConversation(row) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/wa_conversations?on_conflict=phone_number_id,from_number`,
      {
        method: 'POST',
        headers: svcHeaders({
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
      }
    );
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      log.error('wa-bot', 'saveConversation falló', { status: r.status, body: body.slice(0, 200) });
    }
  } catch (e) {
    log.error('wa-bot', 'saveConversation excepción', { error: e.message });
  }
}

// ── Render del carrito a texto de WhatsApp ───────────────────────────────────
function renderCarrito(cart, displayName) {
  const lineas = cart.lineas || [];
  const sinPrecio = cart.sinPrecio || [];
  const ambiguos = cart.ambiguos || [];
  const sinMatch = cart.sinMatch || [];
  const partes = [];

  if (lineas.length) {
    partes.push('*Tu pedido:*');
    lineas.forEach(l => {
      partes.push(`• ${l.qty} × ${l.nombre} (${l.unidad}) — ${money(l.subtotal)}`);
    });
    partes.push(`\n*Total: ${money(cart.total || 0)}*`);
  }

  if (ambiguos.length) {
    partes.push('\n_Decime cuál de estos querés (respondé con el nombre):_');
    ambiguos.forEach(a => {
      const opts = a.opciones.map(o => o.nombre).join(', ');
      partes.push(`• "${a.texto}" (${a.qty}) → ${opts}`);
    });
  }

  if (sinPrecio.length) {
    partes.push('\n_Estos no tienen precio en tu lista (los consultamos aparte):_');
    sinPrecio.forEach(s => partes.push(`• ${s.qty} × ${s.nombre}`));
  }

  if (sinMatch.length) {
    partes.push('\n_No encontré en el catálogo:_ ' + sinMatch.join(', '));
  }

  if (!lineas.length) {
    // Nada con precio para confirmar.
    if (ambiguos.length || sinPrecio.length || sinMatch.length) {
      return partes.join('\n') + '\n\nNo pude armar un pedido con precio. Revisá los productos o escribime de nuevo.';
    }
    return 'No entendí ningún producto. Probá escribiendo, por ejemplo: "10 cajas de coca, 5 de agua".';
  }

  partes.push('\n¿Confirmás el pedido? Respondé *SI* para confirmar o *NO* para cancelar.');
  return partes.join('\n');
}

function cartTotal(lineas) {
  return Math.round((lineas || []).reduce((a, l) => a + (Number(l.subtotal) || 0), 0) * 100) / 100;
}

// ── Orquestador principal ────────────────────────────────────────────────────
/**
 * Procesa un mensaje entrante del bot. Devuelve los textos a responder.
 * deps inyectables para tests (default = módulos reales).
 */
export async function procesarMensajeBot(
  { phone_number_id, from, text, messageId },
  deps = {}
) {
  const _getCatalogo = deps.getCatalogo || getCatalogoCliente;
  const _interpretar = deps.interpretar || interpretarPedido;
  const _crearPedido = deps.crearPedido || createB2BOrder;
  const _load = deps.loadConversation || loadConversation;
  const _save = deps.saveConversation || saveConversation;
  const _resolveOrg = deps.resolveOrg || resolveOrg;
  const _resolveCliente = deps.resolveCliente || resolveCliente;

  const NOOP = { replies: [], handled: false };
  const texto = String(text || '').trim();

  // 1. Org del número entrante.
  const { org, displayName } = await _resolveOrg(phone_number_id);
  if (!org) return NOOP;

  // 2. Cliente por teléfono. Sin cliente → no es flujo de bot (no rompemos nada).
  const cliente = await _resolveCliente(org, from);
  if (!cliente || cliente.portal_activo === false) return NOOP;

  // 3. Catálogo + config de la org. El bot se activa sólo si la org lo habilitó.
  let catalogo;
  try {
    catalogo = await _getCatalogo({ org, clienteId: cliente.id });
  } catch (e) {
    log.error('wa-bot', 'getCatalogo falló', { org, error: e.message });
    return NOOP;
  }
  const cfg = catalogo.portalCfg || {};
  if (cfg.botPedidos !== true) return NOOP;          // bot apagado para esta org
  if (cfg.portalPedidos === false) return NOOP;       // pedidos deshabilitados

  // 4. Estado + idempotencia por message_id (Meta reintenta webhooks).
  const conv = await _load(phone_number_id, from);
  if (conv && messageId && conv.last_message_id === messageId) {
    return { replies: [], handled: true };            // ya procesado
  }
  const estado = conv?.estado || 'idle';
  const carritoPrev = conv?.carrito || {};
  const cartExpired = conv?.expires_at ? new Date(conv.expires_at).getTime() < Date.now() : false;

  const base = {
    org_id: org,
    cliente_id: cliente.id,
    phone_number_id: phone_number_id || null,
    from_number: from,
    last_message_id: messageId || null,
  };

  // ── Estado: revisión (hay un carrito esperando confirmación) ──────────────
  if (estado === 'revision' && !cartExpired) {
    if (CONFIRM_RE.test(texto)) {
      const lineas = carritoPrev.lineas || [];
      if (!lineas.length) {
        await _save({ ...base, estado: 'idle', carrito: {}, expires_at: null });
        return { replies: ['No hay un pedido con precio para confirmar. Escribime tu pedido de nuevo.'], handled: true, org, estado: 'idle' };
      }
      const items = lineas.map(l => ({
        productId: l.productId,
        nombre: l.nombre,
        unidad: l.unidad,
        cantidad: l.qty,
        precioUnit: l.precio,
        subtotal: l.subtotal,
      }));
      const total = cartTotal(lineas);

      const result = await _crearPedido({
        org,
        clienteId: cliente.id,
        clienteNombre: cliente.name || '',
        clienteTel: from,
        items,
        total,
        notas: 'Pedido por WhatsApp',
        idempotencyKey: `${from}-${messageId || total}`,
      });

      if (result.ok) {
        await _save({ ...base, estado: 'idle', carrito: {}, expires_at: null });
        const ref = String(result.orderId || '').slice(0, 8);
        return {
          replies: [`✅ ¡Pedido confirmado! Total ${money(total)}.\nNº de referencia: ${ref}\nGracias 🙌`],
          handled: true, org, estado: 'idle',
        };
      }

      // Fallo del cierre → mensaje claro, dejamos el carrito para reintentar.
      let msg;
      if (result.code === 'insufficient_stock') {
        msg = `Uy, no tengo stock suficiente de *${result.nombre}* (disponible: ${result.available}). Ajustá la cantidad y mandame el pedido de nuevo.`;
        await _save({ ...base, estado: 'idle', carrito: {}, expires_at: null });
      } else if (result.code === 'invalid_client') {
        msg = 'No pude validar tu cuenta para tomar el pedido. Escribinos y lo resolvemos.';
        await _save({ ...base, estado: 'idle', carrito: {}, expires_at: null });
      } else {
        msg = 'No pude cerrar el pedido en este momento. Probá de nuevo en un ratito.';
      }
      return { replies: [msg], handled: true, org, estado: 'idle' };
    }

    if (CANCEL_RE.test(texto)) {
      await _save({ ...base, estado: 'idle', carrito: {}, expires_at: null });
      return { replies: ['Listo, cancelé el pedido. Cuando quieras escribime de nuevo 👋'], handled: true, org, estado: 'idle' };
    }
    // Cualquier otro texto en revisión → re-interpretar (reemplaza el carrito).
  }

  // ── Estado: idle (o revisión con texto nuevo / carrito vencido) ───────────
  const interp = await _interpretar({ texto, catalogo: catalogo.items || [] });
  if (!interp.ok) {
    log.warn('wa-bot', 'interpretación falló', { org, error: interp.error });
    return { replies: ['No pude leer tu pedido ahora mismo. Probá de nuevo en un momento.'], handled: true, org, estado };
  }

  const cart = {
    lineas: interp.lineas || [],
    sinPrecio: interp.sinPrecio || [],
    ambiguos: interp.ambiguos || [],
    sinMatch: interp.sinMatch || [],
    total: cartTotal(interp.lineas),
  };

  const hayAlgo = cart.lineas.length || cart.sinPrecio.length || cart.ambiguos.length || cart.sinMatch.length;
  // Si quedaron ítems ambiguos pendientes de aclarar, seguimos en 'revision' aunque
  // no haya líneas todavía: así el próximo mensaje del cliente (ej. "Nestlé") se
  // re-interpreta contra el mismo catálogo en vez de tratarse como pedido nuevo.
  const nuevoEstado = (cart.lineas.length || cart.ambiguos.length) ? 'revision' : 'idle';

  await _save({
    ...base,
    estado: nuevoEstado,
    carrito: nuevoEstado === 'revision' ? cart : {},
    expires_at: nuevoEstado === 'revision' ? new Date(Date.now() + CART_TTL_MS).toISOString() : null,
  });

  return {
    replies: [renderCarrito(cart, displayName)],
    handled: true,
    org,
    estado: nuevoEstado,
    debug: hayAlgo ? undefined : 'sin_items',
  };
}
