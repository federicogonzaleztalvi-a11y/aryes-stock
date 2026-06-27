// src/lib/stock.js — Lógica PURA de stock y total de una venta (admin / VentasTab).
// Sin React, sin Supabase, sin DOM: es la MISMA matemática que usa guardarVenta
// para validar disponibilidad, descontar inventario al crear la venta y
// restaurarlo al cancelarla. Se extrae acá para poder testearla de verdad —
// los tests importan ESTAS funciones, no copias. Si esta lógica cambia, el test
// se entera.
//
// Camino más crítico del negocio: un bug acá = vender stock que no existe o no
// descontar el inventario de una venta confirmada (doble gasto de stock).

// Total de la venta = Σ(cantidad × precioUnit), menos el descuento global %.
export function totalVenta(items, desc = 0) {
  const sub = items.reduce((a, it) => a + Number(it.cantidad) * Number(it.precioUnit), 0);
  return sub * (1 - Number(desc) / 100);
}

// Valida disponibilidad antes de crear la venta.
// Devuelve un array de strings de error (vacío = todo OK).
export function validarStock(items, products) {
  const errors = [];
  items.forEach((it) => {
    const prod = products.find((p) => p.id === it.productoId);
    if (prod) {
      if (Number(it.cantidad) > Number(prod.stock || 0)) {
        errors.push(
          `Stock insuficiente: ${it.nombre} → disponible ${prod.stock || 0}, solicitado ${it.cantidad}`
        );
      }
    }
  });
  return errors;
}

// Captura el stock ANTES de descontar — es el lock value que necesita
// patchWithLock (optimistic concurrency) para no pisar una venta concurrente.
export function snapshotStock(items, products) {
  return Object.fromEntries(
    items.map((it) => [it.productoId, Number(products.find((p) => p.id === it.productoId)?.stock || 0)])
  );
}

// Descuenta el stock vendido (optimista). Devuelve un array NUEVO de products
// con el stock actualizado; no muta el original. El stock nunca baja de 0.
// `now` (opcional) setea updatedAt en las filas tocadas, igual que producción.
export function deducirStock(items, products, now) {
  const updProds = [...products];
  items.forEach((it) => {
    const idx = updProds.findIndex((p) => p.id === it.productoId);
    if (idx > -1) {
      const newStock = Math.max(0, Number(updProds[idx].stock || 0) - Number(it.cantidad));
      updProds[idx] = { ...updProds[idx], stock: newStock, ...(now ? { updatedAt: now } : {}) };
    }
  });
  return updProds;
}

// Restaura el stock al cancelar una venta. Suma de vuelta las cantidades.
// Devuelve un array NUEVO; no muta el original.
export function restaurarStock(items, products, now) {
  const updProds = [...products];
  items.forEach((it) => {
    const idx = updProds.findIndex((p) => p.id === it.productoId);
    if (idx > -1) {
      const restoredStock = Number(updProds[idx].stock || 0) + Number(it.cantidad);
      updProds[idx] = { ...updProds[idx], stock: restoredStock, ...(now ? { updatedAt: now } : {}) };
    }
  });
  return updProds;
}
