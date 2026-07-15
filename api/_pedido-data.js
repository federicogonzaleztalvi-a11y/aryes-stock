// api/_pedido-data.js — Armado PURO del payload de la orden de compra (PDF/mail).
// Sin pdfkit, sin red, sin DOM: sólo da forma a los datos del pedido que luego
// consume generarOrdenPDF. Antes esta lógica estaba COPIADA en 3 lugares
// (api/pedido.js comprobante + vista previa, api/_create-order.js email), así
// que un bug en el fallback de precio base había que arreglarlo 3 veces.
// Acá vive una sola vez y se testea de verdad (_pedido-data.test.js).

// Resuelve el id del producto sea cual sea la forma del item (portal, bot, admin).
const pid = (i) => i.id || i.productId || i.productoId;

// Mapea los items del carrito a las líneas del PDF.
// baseMap[uuid] = { precio, codigo } viene de products (precio_venta + codigo).
// precioBase cae al precioUnit si el producto no está en baseMap (sin lista).
//
// Caja cerrada: si un item trae `tramos` (más de uno), lo desglosamos en una
// línea por tramo — las unidades a precio distribuidor y las sueltas van en
// filas separadas, igual que el carrito, en vez de un único % promedio. El
// stock/reserva no se toca: eso usa la cantidad total del item, no los tramos.
export function buildLineas(items, baseMap = {}) {
  const out = [];
  (items || []).forEach((i) => {
    const id = pid(i);
    const codigo = baseMap[id]?.codigo || '';
    const nombre = i.nombre || i.productName || '';
    const unidad = i.unidad || i.unit || '';
    const unitBlended = Number(i.precioUnit) || 0;
    const precioBase = (baseMap[id]?.precio) || unitBlended;
    const tramos = Array.isArray(i.tramos) ? i.tramos : [];

    if (tramos.length > 1) {
      tramos.forEach((t) => {
        const q = Number(t.unidades) || 0;
        const unit = Number(t.precioUnit) || 0;
        out.push({
          codigo,
          nombre: nombre + (t.distribuidor ? ' (caja cerrada)' : ''),
          unidad, qty: q, precioBase, precioUnit: unit,
          subtotal: Math.round(unit * q * 100) / 100,
        });
      });
      return;
    }

    const qty = Number(i.cantidad || i.qty) || 0;
    out.push({
      codigo, nombre, unidad, qty, precioBase,
      precioUnit: unitBlended,
      subtotal: Number(i.subtotal) || (unitBlended * qty),
    });
  });
  return out;
}

// Subtotal (mercadería) y descuento total a partir de las líneas ya armadas.
// El IVA/total NO se calculan acá: divergen entre comprobante y vista previa
// (distinto fallback de total), así que se dejan en cada call-site.
export function sumLineas(lineas) {
  const subtotal = lineas.reduce((a, l) => a + l.subtotal, 0);
  const descuentoTotal = lineas.reduce((a, l) => a + Math.max(0, (l.precioBase - l.precioUnit) * l.qty), 0);
  return { subtotal, descuentoTotal };
}

// Datos fiscales del cliente para el encabezado del PDF.
// fallbackNombre cubre el caso del email (usa el nombre del pedido si el
// cliente no trae name); en el comprobante se omite y queda cli.name tal cual.
export function mapClienteFiscal(cli = {}, fallbackNombre) {
  return {
    nombre: cli.name || fallbackNombre,
    codigo: cli.codigo,
    rut: cli.rut,
    direccion: cli.address,
    ciudad: cli.ciudad,
    horarioDesde: cli.horario_desde,
    horarioHasta: cli.horario_hasta,
    zonaEntrega: cli.zona_entrega,
    condPago: cli.cond_pago,
  };
}
