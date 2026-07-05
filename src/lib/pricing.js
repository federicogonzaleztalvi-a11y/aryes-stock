// src/lib/pricing.js — Lógica PURA de precios del carrito B2B.
// Sin React, sin red, sin DOM: es la MISMA matemática que usa el carrito del
// portal (PedidosPage / CartDrawer) para calcular cada línea y los totales.
// Se extrae acá para poder testearla de verdad — los tests importan ESTAS
// funciones, no copias. Si esta lógica cambia, el test se entera.
//
// Reglas de negocio (wholesale):
//  - Descuento aplicable a una línea = el MAYOR entre el descuento puntual del
//    producto (descGlobal) y la escala por volumen que alcanza la cantidad.
//  - Caja cerrada: el descuento por caja completa aplica SÓLO a las unidades que
//    completan cajas enteras; el resto va a precio normal. NO se suma al puntual:
//    se usa el mayor de los dos. Sólo aplica si la lista del cliente lo habilitó
//    (en ese caso el API expone unidades_por_caja y descuento_caja > 0).
//  - Precios redondeados a 2 decimales en cada paso, igual que producción.

const round2 = (n) => Math.round(n * 100) / 100;

// Descuento por volumen: % de la mejor escala cuyo mínimo alcanza qty.
// item.volume_tiers = [{min,dto}] viene saneado y ordenado del API.
export function volTierDto(item, qty) {
  const tiers = Array.isArray(item?.volume_tiers) ? item.volume_tiers : [];
  let dto = 0;
  for (const t of tiers) { if (qty >= t.min) dto = t.dto; }
  return dto;
}

// Calcula una línea del carrito a partir del producto y la cantidad.
// Devuelve el precio unitario efectivo, el neto (sin IVA) y el IVA de la línea,
// más los datos del nudge "te falta poco para completar caja".
export function calcLinea(item, qty) {
  const ivaRate = item.iva_rate != null ? Number(item.iva_rate) : 0;
  // Base sobre la que se aplican los descuentos. En el modelo v2 el servidor manda
  // el precio base SIN descontar (precioBase) + los descuentos por separado, así
  // que acá se resuelve todo junto con max() y nunca se apilan. En el modelo viejo
  // (sin reglasV2) item.precio ya viene con el descuento de lista aplicado — se usa
  // tal cual, igual que siempre.
  const base = item.reglasV2 ? (Number(item.precioBase) || 0) : item.precio;
  const volDto = volTierDto(item, qty);
  const descPct = Math.max(item.descGlobal || 0, volDto);
  const precioReg = descPct > 0 ? round2(base * (1 - descPct / 100)) : base;

  const cajaUnid = Number(item.unidades_por_caja) || 0;
  const cajaDtoCfg = Number(item.descuento_caja) || 0;
  const aplicaCaja = cajaUnid > 0 && cajaDtoCfg > 0;

  // tramos: desglose de la línea por precio unitario. Cuando hay caja cerrada,
  // las unidades que completan cajas pagan el precio distribuidor y las sueltas
  // el precio normal → son dos tramos distintos, nunca un % promedio. dtoPct es
  // el descuento de ese tramo respecto de la base (coincide con lo configurado).
  let netoLinea, precioConDto, faltanParaCaja = 0, ahorroSiCompleta = 0, tramos;
  if (aplicaCaja) {
    const cajas = Math.floor(qty / cajaUnid);
    const unidConCaja = cajas * cajaUnid;
    const unidResto = qty - unidConCaja;
    const descPctCaja = Math.max(cajaDtoCfg, descPct);
    const precioCaja = round2(base * (1 - descPctCaja / 100));
    netoLinea = unidConCaja * precioCaja + unidResto * precioReg;
    precioConDto = qty > 0 ? round2(netoLinea / qty) : precioReg;
    if (unidConCaja > 0 && precioCaja < precioReg) {
      tramos = [{ unidades: unidConCaja, precioUnit: precioCaja, dtoPct: descPctCaja, distribuidor: true }];
      if (unidResto > 0) tramos.push({ unidades: unidResto, precioUnit: precioReg, dtoPct: descPct, distribuidor: false });
    } else {
      // La caja no da precio mejor que el suelto (o no se completó ninguna) → precio uniforme.
      tramos = [{ unidades: qty, precioUnit: precioReg, dtoPct: descPct, distribuidor: false }];
    }
    // Nudge "vendedor": si faltan pocas unidades para completar otra caja,
    // cuánto ahorraría llevándolas a precio de caja en vez de suelto.
    if (unidResto > 0 && precioCaja < precioReg) {
      faltanParaCaja = cajaUnid - unidResto;
      ahorroSiCompleta = round2((precioReg - precioCaja) * cajaUnid);
    }
  } else {
    precioConDto = precioReg;
    netoLinea = precioReg * qty;
    tramos = [{ unidades: qty, precioUnit: precioReg, dtoPct: descPct, distribuidor: false }];
  }
  const ivaLinea = netoLinea * (ivaRate / 100);
  return {
    ivaRate, descPct, volDto, precioConDto, netoLinea, ivaLinea, tramos,
    cajaUnid: aplicaCaja ? cajaUnid : 0, faltanParaCaja, ahorroSiCompleta,
  };
}

// Totales del carrito a partir de las líneas ya calculadas.
// subtotalNeto = mercadería sin IVA (criterio para mínimo de pedido wholesale).
export function calcTotales(lineasConCalc) {
  const subtotalNeto = lineasConCalc.reduce((s, l) => s + l.netoLinea, 0);
  const ivaTotal = lineasConCalc.reduce((s, l) => s + l.ivaLinea, 0);
  return { subtotalNeto, ivaTotal, total: subtotalNeto + ivaTotal };
}
