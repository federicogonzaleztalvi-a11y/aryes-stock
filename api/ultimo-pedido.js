// api/ultimo-pedido.js — "Repetir último pedido" (endpoint del chip del portal).
// ============================================================================
// El cliente toca "Repetir último pedido" y le devolvemos su último pedido ya
// resuelto contra su lista de precios, listo para revisar y confirmar. NO usa
// Claude: es una lectura directa (rápida y sin costo), a diferencia del pedido
// por voz/foto que sí interpreta lenguaje natural.
//
// Seguridad: requiere sesión de portal válida. org_id y cliente_id se DERIVAN de
// la sesión, nunca del body/query (igual que voz-pedido / foto-pedido).
//
// POST /api/ultimo-pedido   Authorization: Bearer <token>
//   → 200 { ok, lineas:[{productId,nombre,unidad,qty,precio,subtotal}],
//           sinPrecio:[{productId,nombre,qty}], sinMatch:[] }
// ============================================================================

import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';
import { getCatalogoCliente } from './_catalog.js';
import { getUltimoPedido } from './_ultimo-pedido.js';

export default async function handler(req, res) {
  await setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await validatePortalSession(getBearerToken(req));
  if (!session) return res.status(401).json({ error: 'Sesión requerida' });
  const org       = String(session.org_id || '').replace(/[^a-z0-9_-]/gi, '');
  const clienteId = String(session.cliente_id || '');
  if (!org || !clienteId) return res.status(401).json({ error: 'Sesión inválida' });

  try {
    let catalogo;
    try {
      catalogo = await getCatalogoCliente({ org, clienteId });
    } catch (e) {
      console.error('[ultimo-pedido] catálogo falló:', e.message);
      return res.status(502).json({ error: 'Database error' });
    }
    const { items = [], portalCfg = {} } = catalogo;
    if (portalCfg.portalCatalogo === false) {
      return res.status(200).json({ ok: true, lineas: [], sinPrecio: [], sinMatch: [] });
    }

    const ultimo = await getUltimoPedido({ org, clienteId });
    const porId = new Map(items.map(p => [p.id, p]));

    const lineas = [], sinPrecio = [];
    for (const l of ultimo) {
      const prod = porId.get(l.productId);
      if (!prod?.id) continue;                       // ya no está en el catálogo → se omite
      const qty = Math.max(1, Math.floor(Number(l.qtyTipica) || 1));
      const precio = Number(prod.precio) || 0;
      if (precio <= 0) {
        sinPrecio.push({ productId: prod.id, nombre: prod.nombre, qty });
        continue;
      }
      lineas.push({
        productId: prod.id,
        nombre:    prod.nombre,
        unidad:    prod.unidad || 'un',
        qty,
        precio,
        subtotal:  Math.round(precio * qty * 100) / 100,
      });
    }

    return res.status(200).json({ ok: true, lineas, sinPrecio, sinMatch: [] });
  } catch (err) {
    console.error('[ultimo-pedido] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
