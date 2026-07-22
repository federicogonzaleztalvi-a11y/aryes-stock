// api/voz-pedido.js — "Pedido por voz/texto" del portal B2B (estilo Zapia).
// ============================================================================
// El cliente dicta (o escribe) su pedido en lenguaje natural — "mandame 2 cajas
// de tomate, 5 de cebolla y lo de siempre" — y este endpoint lo convierte en
// líneas de carrito usando el MISMO motor que el bot de WhatsApp
// (interpretarPedido) contra el catálogo con los precios de ESE cliente.
//
// Vive dentro del portal que controlamos (no depende de WhatsApp), así que no lo
// alcanza la restricción de Meta a asistentes de IA de terceros.
//
// Seguridad: requiere sesión de portal válida. org_id y cliente_id se DERIVAN de
// la sesión, nunca del body/query (defensa IDOR / cross-tenant), igual que
// api/catalogo.js.
//
// POST /api/voz-pedido   body: { texto }   headers: Authorization: Bearer <token>
//   → 200 { ok, lineas:[{productId,nombre,unidad,qty,precio,subtotal}],
//           sinPrecio:[{productId,nombre,qty}],
//           ambiguos:[{texto,qty,opciones:[{productId,nombre,unidad,precio}]}],
//           sinMatch:[string] }
// ============================================================================

import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';
import { getCatalogoCliente } from './_catalog.js';
import { interpretarPedido } from './_wa-interpret.js';
import { getUltimoPedido } from './_ultimo-pedido.js';

// Rate limit: máx 20 pedidos por voz por IP por minuto (cada uno gasta 1 llamada
// a Claude). Suficiente para uso real, freno para abuso.
const _rl = new Map();
function _checkRate(ip) {
  const now = Date.now();
  const recent = (_rl.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 20) return false;
  recent.push(now);
  _rl.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate(ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  // ── Sesión requerida: precios personalizados = dato privado del tenant ──
  const session = await validatePortalSession(getBearerToken(req));
  if (!session) return res.status(401).json({ error: 'Sesión requerida' });
  const org       = String(session.org_id || '').replace(/[^a-z0-9_-]/gi, '');
  const clienteId = String(session.cliente_id || '');
  if (!org || !clienteId) return res.status(401).json({ error: 'Sesión inválida' });

  // ── Body ──
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const texto = String(body?.texto || '').trim();
  if (!texto) return res.status(200).json({ ok: true, lineas: [], sinPrecio: [], ambiguos: [], sinMatch: [] });
  if (texto.length > 2000) return res.status(400).json({ error: 'Texto demasiado largo' });

  try {
    // Catálogo con la lista del cliente (misma fuente de verdad que portal y bot).
    let catalogo;
    try {
      catalogo = await getCatalogoCliente({ org, clienteId });
    } catch (e) {
      console.error('[voz-pedido] catálogo falló:', e.message);
      return res.status(502).json({ error: 'Database error' });
    }
    const { items = [], portalCfg = {} } = catalogo;

    // Respeta el apagado del catálogo a nivel org.
    if (portalCfg.portalCatalogo === false) {
      return res.status(200).json({ ok: true, lineas: [], sinPrecio: [], ambiguos: [], sinMatch: [] });
    }

    // "Repetir último pedido": líneas del último pedido del cliente, para que el
    // intérprete pueda expandir "mandame lo de siempre" / "repetime el último".
    // Nunca rompe el pedido: si falla, sigue como pedido normal sin expansión.
    let habituales = [];
    try {
      habituales = await getUltimoPedido({ org, clienteId });
    } catch (e) {
      console.error('[voz-pedido] último pedido falló (sigue sin él):', e.message);
    }

    const r = await interpretarPedido({ texto, catalogo: items, habituales });
    if (!r.ok) {
      // anthropic_not_configured / empty_catalog / parse_error / etc.
      const code = r.error || 'interpret_error';
      const status = code === 'anthropic_not_configured' ? 503 : 502;
      return res.status(status).json({ error: code });
    }

    return res.status(200).json({
      ok: true,
      lineas:    r.lineas,
      sinPrecio: r.sinPrecio,
      ambiguos:  r.ambiguos,
      sinMatch:  r.sinMatch,
    });
  } catch (err) {
    console.error('[voz-pedido] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
