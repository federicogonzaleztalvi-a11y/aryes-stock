// api/_ultimo-pedido.js — "Repetir último pedido" del cliente.
// ============================================================================
// Dado un cliente, busca su ÚLTIMO pedido real (la venta confirmada por el admin
// o el pedido del portal más reciente) y devuelve sus líneas tal cual, para que
// el cliente pueda repetirlo de un toque. Es concreto y predecible: recibe
// exactamente lo que pidió la última vez, con esas cantidades (a diferencia de un
// agregado por frecuencia, que mezcla todo lo que compró alguna vez).
//
// Misma fuente de verdad que el "Volver a pedir" del catálogo (ventas +
// b2b_orders): tomamos el más nuevo entre ambas tablas.
//
// Contrato:
//   getUltimoPedido({ org, clienteId }) → Promise<[
//     { productId, qtyTipica }               // líneas del último pedido
//   ]>
//   (no resuelve nombre/precio: eso lo pone quien lo use, contra el catálogo.
//    Usamos la clave `qtyTipica` para encajar sin cambios en interpretarPedido.)
// ============================================================================

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Normaliza los items de un pedido a [{ productId, qtyTipica }], sumando
// repetidos por si el mismo producto aparece en dos renglones.
function lineasDe(order) {
  const acc = new Map();
  for (const it of (order?.items || [])) {
    const id = it.productoId || it.productId || '';
    if (!id) continue;
    const q = Math.max(1, Math.floor(Number(it.qty || it.cantidad || 0)) || 1);
    acc.set(id, (acc.get(id) || 0) + q);
  }
  return [...acc.entries()].map(([productId, qtyTipica]) => ({ productId, qtyTipica }));
}

export async function getUltimoPedido({ org, clienteId } = {}) {
  if (!SB_URL || !SB_SVC || !clienteId) return [];
  const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

  let venta = null, portal = null;
  try {
    const [vRes, pRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/ventas?cliente_id=eq.' + encodeURIComponent(clienteId) +
        '&estado=neq.cancelada&select=items,created_at&order=created_at.desc&limit=1', { headers: H }),
      fetch(SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + encodeURIComponent(clienteId) +
        '&estado=neq.cancelada&select=items,creado_en&order=creado_en.desc&limit=1', { headers: H }),
    ]);
    if (vRes.ok) venta  = (await vRes.json().catch(() => []))[0] || null;
    if (pRes.ok) portal = (await pRes.json().catch(() => []))[0] || null;
  } catch {
    return [];   // sin historial accesible → no hay nada que repetir
  }

  // Elegimos el más reciente entre la última venta y el último pedido del portal.
  const tVenta  = venta  ? Date.parse(venta.created_at || 0)  : -Infinity;
  const tPortal = portal ? Date.parse(portal.creado_en || 0)  : -Infinity;
  const elegido = tPortal >= tVenta ? portal : venta;

  return elegido ? lineasDe(elegido) : [];
}
