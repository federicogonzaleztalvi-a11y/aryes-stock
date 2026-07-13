// api/_habituales.js — "Lo de siempre" del cliente.
// ============================================================================
// Dado un cliente, mira su historial real de compras (ventas confirmadas por el
// admin + pedidos hechos por el portal) y devuelve sus productos habituales
// ordenados por frecuencia, con la CANTIDAD TÍPICA de cada uno (la que más se
// repite). Sirve para que el pedido por voz entienda "mandame lo de siempre" y
// arme el pedido habitual con las cantidades que el cliente suele llevar.
//
// Misma fuente de verdad que el "Volver a pedir" del catálogo (ventas +
// b2b_orders), así que ambos reflejan la actividad real del cliente.
//
// Contrato:
//   getHabituales({ org, clienteId, max? }) → Promise<[
//     { productId, freq, qtyTipica }         // ordenado por freq desc
//   ]>
//   (no resuelve nombre/precio: eso lo pone quien lo use, contra el catálogo)
// ============================================================================

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Moda (valor más frecuente) de una lista de cantidades. Ante empate, el mayor
// —si a veces pedís 2 y a veces 3 del mismo, mejor sugerir de más que de menos.
function moda(nums) {
  const cuenta = new Map();
  for (const n of nums) {
    const v = Math.max(1, Math.floor(Number(n) || 0));
    cuenta.set(v, (cuenta.get(v) || 0) + 1);
  }
  let best = 1, bestC = 0;
  for (const [v, c] of cuenta) {
    if (c > bestC || (c === bestC && v > best)) { best = v; bestC = c; }
  }
  return best;
}

export async function getHabituales({ org, clienteId, max = 30 } = {}) {
  if (!SB_URL || !SB_SVC || !clienteId) return [];
  const H = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

  let ventas = [], portal = [];
  try {
    const [vRes, pRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/ventas?cliente_id=eq.' + encodeURIComponent(clienteId) +
        '&estado=neq.cancelada&select=items&order=created_at.desc&limit=50', { headers: H }),
      fetch(SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + encodeURIComponent(clienteId) +
        '&estado=neq.cancelada&select=items&order=creado_en.desc&limit=50', { headers: H }),
    ]);
    if (vRes.ok) ventas = await vRes.json().catch(() => []);
    if (pRes.ok) portal = await pRes.json().catch(() => []);
  } catch {
    return [];   // sin historial accesible → "lo de siempre" simplemente no aplica
  }

  // freq: en cuántos pedidos aparece cada producto. qtys: todas las cantidades
  // vistas, para sacar la típica.
  const freq = new Map();
  const qtys = new Map();
  const registrar = (orders) => {
    for (const o of orders || []) {
      for (const it of (o.items || [])) {
        const id = it.productoId || it.productId || '';
        if (!id) continue;
        const q = Number(it.qty || it.cantidad || 0);
        freq.set(id, (freq.get(id) || 0) + 1);
        if (!qtys.has(id)) qtys.set(id, []);
        if (q > 0) qtys.get(id).push(q);
      }
    }
  };
  registrar(ventas);
  registrar(portal);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([productId, f]) => ({
      productId,
      freq: f,
      qtyTipica: moda(qtys.get(productId) || []),
    }));
}
