import PDFDocument from 'pdfkit';

const VERDE = '#059669';
const GRIS = '#6a6a68';
const OSCURO = '#1a1a18';
const LINEA = '#e5e5e1';

function money(sym, n) {
  return (sym || '$') + ' ' + Math.round(Number(n) || 0).toLocaleString('es-UY');
}
function fecha(iso) {
  try { return new Date(iso || Date.now()).toLocaleDateString('es-UY', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return ''; }
}
function condPagoLabel(c) {
  const map = { contado:'Contado', credito_15:'Credito 15 dias', credito_30:'Credito 30 dias', credito_60:'Credito 60 dias', credito_90:'Credito 90 dias' };
  return map[c] || c || '-';
}

export function generarOrdenPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const sym = data.currencySymbol || '$';
      const pageW = doc.page.width - 96;
      const left = 48;
      const right = left + pageW;

      doc.fillColor(OSCURO).fontSize(20).font('Helvetica-Bold').text(data.empresa || 'Pazque', left, 48);
      doc.fillColor(GRIS).fontSize(9).font('Helvetica').text(data.titulo || 'Orden de compra', left, 74);
      doc.fillColor(OSCURO).fontSize(11).font('Helvetica-Bold').text('N ' + (data.nroOrden || '-'), left, 48, { width: pageW, align: 'right' });
      doc.fillColor(GRIS).fontSize(9).font('Helvetica').text('Fecha: ' + fecha(data.fecha), left, 66, { width: pageW, align: 'right' });
      doc.moveTo(left, 96).lineTo(right, 96).strokeColor(VERDE).lineWidth(2).stroke();

      let y = 112;
      const c = data.cliente || {};
      doc.fillColor(VERDE).fontSize(10).font('Helvetica-Bold').text('CLIENTE', left, y);
      y += 16;
      doc.fillColor(OSCURO).fontSize(12).font('Helvetica-Bold').text(c.nombre || '-', left, y);
      y += 18;
      doc.fontSize(9).font('Helvetica').fillColor(GRIS);
      const fila = (label, val) => {
        if (!val) return;
        doc.font('Helvetica-Bold').fillColor(GRIS).text(label + ': ', left, y, { continued: true });
        doc.font('Helvetica').fillColor(OSCURO).text(String(val));
        y += 14;
      };
      fila('Codigo', c.codigo);
      fila('RUT', c.rut);
      const dir = [c.direccion, c.ciudad].filter(Boolean).join(', ');
      fila('Direccion', dir);
      const hor = (c.horarioDesde && c.horarioHasta) ? (c.horarioDesde + ' a ' + c.horarioHasta) : '';
      fila('Horario de entrega', hor);
      fila('Zona', c.zonaEntrega);
      fila('Condicion de pago', condPagoLabel(c.condPago));

      y += 8;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(LINEA).lineWidth(1).stroke();
      y += 14;

      const cols = { prod: left, cant: left+210, base: left+270, dto: left+340, unit: left+390, sub: left+460 };
      doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS);
      doc.text('PRODUCTO', cols.prod, y);
      doc.text('CANT', cols.cant, y, { width: 50, align: 'right' });
      doc.text('P. BASE', cols.base, y, { width: 60, align: 'right' });
      doc.text('DTO', cols.dto, y, { width: 40, align: 'right' });
      doc.text('P. UNIT', cols.unit, y, { width: 60, align: 'right' });
      doc.text('SUBTOTAL', cols.sub, y, { width: 51, align: 'right' });
      y += 14;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(LINEA).lineWidth(1).stroke();
      y += 8;

      (data.lineas || []).forEach(l => {
        if (y > doc.page.height - 180) { doc.addPage(); y = 48; }
        const base = Number(l.precioBase) || 0;
        const unit = Number(l.precioUnit) || 0;
        const dtoPct = base > 0 && unit < base ? Math.round((base - unit) / base * 100) : 0;
        doc.fontSize(9).font('Helvetica').fillColor(OSCURO);
        if (l.codigo) {
          doc.fontSize(7).font('Helvetica').fillColor(GRIS).text(l.codigo, cols.prod, y, { width: 200 });
          y += 9;
        }
        doc.fontSize(9).font('Helvetica').fillColor(OSCURO);
        doc.text(l.nombre || '', cols.prod, y, { width: 200 });
        doc.fillColor(GRIS).text((l.qty || 0) + ' ' + (l.unidad || ''), cols.cant, y, { width: 50, align: 'right' });
        doc.text(base ? money(sym, base) : '-', cols.base, y, { width: 60, align: 'right' });
        if (dtoPct > 0) doc.fillColor(VERDE).font('Helvetica-Bold').text('-' + dtoPct + '%', cols.dto, y, { width: 40, align: 'right' });
        else doc.fillColor(GRIS).font('Helvetica').text('-', cols.dto, y, { width: 40, align: 'right' });
        doc.fillColor(OSCURO).font('Helvetica').text(money(sym, unit), cols.unit, y, { width: 60, align: 'right' });
        doc.font('Helvetica-Bold').text(money(sym, l.subtotal), cols.sub, y, { width: 51, align: 'right' });
        const h = doc.heightOfString(l.nombre || '', { width: 200 });
        y += Math.max(h, 12) + 6;
      });

      doc.moveTo(left, y).lineTo(right, y).strokeColor(LINEA).lineWidth(1).stroke();
      y += 14;

      const labelX = left + 300;
      const labelW = 100;
      const valX = left + 405;
      const valW = right - valX;
      const totRow = (label, val, opts = {}) => {
        const { bold = false, color = GRIS, prefix = '' } = opts;
        doc.fontSize(bold ? 12 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, labelX, y, { width: labelW, align: 'right' });
        doc.fillColor(bold ? OSCURO : color).text(prefix + money(sym, val), valX, y, { width: valW, align: 'right' });
        y += bold ? 22 : 17;
      };
      totRow('Subtotal', data.subtotal);
      if (Number(data.descuentoTotal) > 0) totRow('Descuento', data.descuentoTotal, { color: VERDE, prefix: '-' });
      totRow('IVA (22%)', data.iva);
      doc.moveTo(labelX, y + 2).lineTo(right, y + 2).strokeColor(VERDE).lineWidth(1.5).stroke();
      y += 10;
      totRow('TOTAL', data.total, { bold: true });

      if (data.notas) {
        y += 14;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(GRIS).text('Observaciones', left, y);
        y += 14;
        doc.font('Helvetica').fillColor(OSCURO).text(data.notas, left, y, { width: pageW });
      }

      doc.fontSize(8).font('Helvetica').fillColor('#9a9a98')
         .text((data.footer || 'Documento interno generado por Pazque') + ' - ' + fecha(data.fecha), left, doc.page.height - 60, { width: pageW, align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
}
