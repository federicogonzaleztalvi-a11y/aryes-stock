// api/_pricing.js — Espejo server-side de la matemática PURA de precios.
// ============================================================================
// Es la MISMA lógica que src/lib/pricing.js (carrito del portal). Se replica acá
// —en vez de importar a través del borde api↔src— para no arriesgar el bundle de
// Vercel con un import cross-directory en un deploy crítico. Ambos archivos deben
// mantenerse en sync: si cambia una regla de precio, cambiar los dos.
//
// Uso: revalidar server-side el total que manda el cliente (Fix #4). El cliente
// no es fuente de verdad de precios; el catálogo (getCatalogoCliente) sí lo es.
// ============================================================================

const round2 = (n) => Math.round(n * 100) / 100;

// Descuento por volumen: % de la mejor escala cuyo mínimo alcanza qty.
export function volTierDto(item, qty) {
  const tiers = Array.isArray(item && item.volume_tiers) ? item.volume_tiers : [];
  let dto = 0;
  for (const t of tiers) { if (qty >= t.min) dto = t.dto; }
  return dto;
}

// Calcula una línea a partir del producto (del catálogo) y la cantidad.
export function calcLinea(item, qty) {
  const ivaRate = item.iva_rate != null ? Number(item.iva_rate) : 0;
  const base = item.reglasV2 ? (Number(item.precioBase) || 0) : item.precio;
  const volDto = volTierDto(item, qty);
  const descPct = Math.max(item.descGlobal || 0, volDto);
  const precioReg = descPct > 0 ? round2(base * (1 - descPct / 100)) : base;

  const cajaUnid = Number(item.unidades_por_caja) || 0;
  const cajaDtoCfg = Number(item.descuento_caja) || 0;
  const aplicaCaja = cajaUnid > 0 && cajaDtoCfg > 0;

  let netoLinea, precioConDto;
  if (aplicaCaja) {
    const cajas = Math.floor(qty / cajaUnid);
    const unidConCaja = cajas * cajaUnid;
    const unidResto = qty - unidConCaja;
    const descPctCaja = Math.max(cajaDtoCfg, descPct);
    const precioCaja = round2(base * (1 - descPctCaja / 100));
    netoLinea = unidConCaja * precioCaja + unidResto * precioReg;
    precioConDto = qty > 0 ? round2(netoLinea / qty) : precioReg;
  } else {
    precioConDto = precioReg;
    netoLinea = precioReg * qty;
  }
  const ivaLinea = netoLinea * (ivaRate / 100);
  return { ivaRate, descPct, volDto, precioConDto, netoLinea, ivaLinea };
}

// Totales a partir de las líneas ya calculadas.
export function calcTotales(lineasConCalc) {
  const subtotalNeto = lineasConCalc.reduce((s, l) => s + l.netoLinea, 0);
  const ivaTotal = lineasConCalc.reduce((s, l) => s + l.ivaLinea, 0);
  return { subtotalNeto, ivaTotal, total: subtotalNeto + ivaTotal };
}
