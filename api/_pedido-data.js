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
export function buildLineas(items, baseMap = {}) {
  return (items || []).map((i) => {
    const unit = Number(i.precioUnit) || 0;
    const id = pid(i);
    const qty = Number(i.cantidad || i.qty) || 0;
    return {
      codigo: baseMap[id]?.codigo || '',
      nombre: i.nombre || i.productName || '',
      unidad: i.unidad || i.unit || '',
      qty,
      precioBase: (baseMap[id]?.precio) || unit,
      precioUnit: unit,
      subtotal: Number(i.subtotal) || (unit * qty),
    };
  });
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
