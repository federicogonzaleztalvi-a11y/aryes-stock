/**
 * ReportePDF — Genera un reporte HTML imprimible del período seleccionado.
 *
 * Abre una ventana nueva con el reporte formateado para impresión/PDF.
 * No requiere librerías externas — usa window.print() del browser.
 *
 * Incluye:
 *   - Resumen ejecutivo (ventas, cobros, margen estimado)
 *   - Top 10 productos más vendidos
 *   - Tabla de ventas del período
 *   - Estado de cuenta corriente por cliente
 */

import { useState, useMemo } from 'react';
import { fmt } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

const G = '#1a8a3c';

const fmtDate = d => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PERIODOS = [
  { id: '7',   label: 'Últimos 7 días' },
  { id: '30',  label: 'Últimos 30 días' },
  { id: '90',  label: 'Últimos 90 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'ant', label: 'Mes anterior' },
];

function getPeriodoRange(id) {
  const hoy  = new Date();
  const fin  = new Date(hoy); fin.setHours(23, 59, 59, 999);
  let inicio;
  if (id === '7')  { inicio = new Date(hoy); inicio.setDate(hoy.getDate() - 7); }
  if (id === '30') { inicio = new Date(hoy); inicio.setDate(hoy.getDate() - 30); }
  if (id === '90') { inicio = new Date(hoy); inicio.setDate(hoy.getDate() - 90); }
  if (id === 'mes') {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  if (id === 'ant') {
    const mes = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
    const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    inicio = new Date(anio, mes, 1);
    fin.setTime(new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999).getTime());
  }
  inicio?.setHours(0, 0, 0, 0);
  return { inicio, fin };
}

function generarHTML({ empresa, periodo, labelPeriodo, ventas, cobros, clientes }) {
  const totalVentas  = ventas.filter(v => v.estado !== 'cancelada').reduce((a, v) => a + Number(v.total || 0), 0);
  const totalCobrado = cobros.reduce((a, c) => a + Number(c.monto || 0), 0);
  const pendiente    = totalVentas - totalCobrado;
  const nVentas      = ventas.filter(v => v.estado !== 'cancelada').length;
  const ticketProm   = nVentas > 0 ? totalVentas / nVentas : 0;

  // Top productos
  const prodMap = {};
  ventas.filter(v => v.estado !== 'cancelada').forEach(v => {
    (v.items || []).forEach(it => {
      const k = it.nombre || it.name || '?';
      if (!prodMap[k]) prodMap[k] = { nombre: k, unidad: it.unidad || '', cantidad: 0, total: 0 };
      prodMap[k].cantidad += Number(it.cantidad || 0);
      prodMap[k].total    += Number(it.subtotal || (it.cantidad * (it.precioUnit || 0)) || 0);
    });
  });
  const topProds = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // Deuda por cliente
  const deudaMap = {};
  clientes.forEach(c => { deudaMap[c.id] = { nombre: c.nombre || c.name, deuda: 0 }; });
  ventas.filter(v => v.estado !== 'cancelada' && v.clienteId).forEach(v => {
    if (!deudaMap[v.clienteId]) deudaMap[v.clienteId] = { nombre: v.clienteNombre, deuda: 0 };
    deudaMap[v.clienteId].deuda += Number(v.total || 0);
  });
  cobros.forEach(c => {
    if (c.clienteId && deudaMap[c.clienteId]) {
      deudaMap[c.clienteId].deuda -= Number(c.monto || 0);
    }
  });
  const deudores = Object.values(deudaMap).filter(d => d.deuda > 0.01).sort((a, b) => b.deuda - a.deuda).slice(0, 20);

  // Tabla de ventas
  const filasVentas = ventas
    .filter(v => v.estado !== 'cancelada')
    .sort((a, b) => new Date(b.fecha || b.creadoEn) - new Date(a.fecha || a.creadoEn))
    .slice(0, 50)
    .map(v => `
      <tr>
        <td>${v.nroVenta || '—'}</td>
        <td>${fmtDate(v.fecha || v.creadoEn)}</td>
        <td>${v.clienteNombre || '—'}</td>
        <td style="text-align:center">${v.items?.length || 0}</td>
        <td style="text-align:right;font-weight:600">${fmt.currencyCompact(v.total)}</td>
        <td style="text-align:center">
          <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;
            background:${v.estado === 'entregada' ? '#d1fae5' : v.estado === 'cancelada' ? '#fee2e2' : '#fef3c7'};
            color:${v.estado === 'entregada' ? '#065f46' : v.estado === 'cancelada' ? '#991b1b' : '#92400e'}">
            ${(v.estado || 'pendiente').toUpperCase()}
          </span>
        </td>
      </tr>
    `).join('');

  const filasTopProds = topProds.map((p, i) => `
    <tr>
      <td style="text-align:center;color:#9ca3af">${i + 1}</td>
      <td style="font-weight:500">${p.nombre}</td>
      <td style="text-align:center">${Number(p.cantidad).toLocaleString('es-UY')} ${p.unidad}</td>
      <td style="text-align:right;font-weight:700;color:${G}">${fmt.currencyCompact(p.total)}</td>
    </tr>
  `).join('');

  const filasDeuda = deudores.map(d => `
    <tr>
      <td style="font-weight:500">${d.nombre}</td>
      <td style="text-align:right;font-weight:700;color:#dc2626">${fmt.currencyCompact(d.deuda)}</td>
    </tr>
  `).join('');

  const hoy = new Date().toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte ${labelPeriodo} — ${empresa}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 48px 48px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid ${G}; padding-bottom: 20px; margin-bottom: 32px; }
    .empresa { font-size: 24px; font-weight: 800; color: ${G}; }
    .subtitulo { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .periodo-badge { text-align: right; }
    .periodo-badge .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .08em; }
    .periodo-badge .valor { font-size: 18px; font-weight: 700; color: #374151; margin-top: 4px; }
    .fecha-gen { font-size: 11px; color: #9ca3af; margin-top: 4px; }

    /* KPIs */
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 36px; }
    .kpi { background: #f9fafb; border-radius: 10px; padding: 16px 18px; border: 1px solid #e5e7eb; }
    .kpi-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px; }
    .kpi-valor { font-size: 22px; font-weight: 800; color: ${G}; }
    .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .kpi.alert .kpi-valor { color: #dc2626; }

    /* Secciones */
    .seccion { margin-bottom: 36px; }
    .seccion-titulo { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 14px;
      padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }

    /* Tablas */
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 9px 12px; text-align: left; font-size: 11px;
      font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }

    /* Footer */
    .footer { margin-top: 48px; border-top: 1px solid #e5e7eb; padding-top: 16px;
      display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }

    /* Print */
    @media print {
      .page { padding: 20px; max-width: 100%; }
      .no-print { display: none; }
      .kpis { grid-template-columns: repeat(4, 1fr); }
      tr { page-break-inside: avoid; }
      .seccion { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- Botón imprimir (no aparece en PDF) -->
  <div class="no-print" style="background:${G};padding:12px 48px;display:flex;align-items:center;justify-content:space-between;">
    <span style="color:#fff;font-weight:700;font-size:14px">📄 Reporte listo — revisalo y guardalo como PDF</span>
    <button onclick="window.print()" style="padding:10px 24px;background:#fff;color:${G};border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <div class="page">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="empresa">${empresa}</div>
        <div class="subtitulo">Reporte de Ventas y Cobranzas</div>
      </div>
      <div class="periodo-badge">
        <div class="label">Período</div>
        <div class="valor">${labelPeriodo}</div>
        <div class="fecha-gen">Generado: ${hoy}</div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">Total Ventas</div>
        <div class="kpi-valor">${fmt.currencyCompact(totalVentas)}</div>
        <div class="kpi-sub">${nVentas} venta${nVentas !== 1 ? 's' : ''}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ticket Promedio</div>
        <div class="kpi-valor">${fmt.currencyCompact(ticketProm)}</div>
        <div class="kpi-sub">por venta</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Cobrado</div>
        <div class="kpi-valor" style="color:#059669">${fmt.currencyCompact(totalCobrado)}</div>
        <div class="kpi-sub">${cobros.length} cobro${cobros.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="kpi ${pendiente > 1 ? 'alert' : ''}">
        <div class="kpi-label">Pendiente cobrar</div>
        <div class="kpi-valor">${fmt.currencyCompact(pendiente)}</div>
        <div class="kpi-sub">${pendiente > 0 ? deudores.length + ' clientes con deuda' : 'Sin deuda pendiente'}</div>
      </div>
    </div>

    <!-- Top productos -->
    ${topProds.length > 0 ? `
    <div class="seccion">
      <div class="seccion-titulo">📦 Top 10 Productos Más Vendidos</div>
      <table>
        <thead><tr><th>#</th><th>Producto</th><th style="text-align:center">Cantidad</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${filasTopProds}</tbody>
      </table>
    </div>` : ''}

    <!-- Tabla de ventas -->
    ${filasVentas ? `
    <div class="seccion">
      <div class="seccion-titulo">🧾 Detalle de Ventas del Período ${ventas.length > 50 ? '(últimas 50)' : ''}</div>
      <table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th style="text-align:center">Items</th><th style="text-align:right">Total</th><th style="text-align:center">Estado</th></tr></thead>
        <tbody>${filasVentas}</tbody>
      </table>
    </div>` : ''}

    <!-- Cuenta corriente -->
    ${deudores.length > 0 ? `
    <div class="seccion">
      <div class="seccion-titulo">💳 Clientes con Saldo Pendiente</div>
      <table>
        <thead><tr><th>Cliente</th><th style="text-align:right">Saldo pendiente</th></tr></thead>
        <tbody>${filasDeuda}</tbody>
        <tfoot>
          <tr style="font-weight:800;background:#fef2f2">
            <td style="padding:10px 12px;color:#dc2626">TOTAL PENDIENTE</td>
            <td style="padding:10px 12px;text-align:right;color:#dc2626;font-size:15px">${fmt.currencyCompact(deudores.reduce((a, d) => a + d.deuda, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>` : `
    <div class="seccion">
      <div class="seccion-titulo">💳 Cuenta Corriente</div>
      <div style="padding:20px;text-align:center;color:#059669;font-weight:700;background:#f0fdf4;border-radius:8px">
        ✓ Sin saldos pendientes en el período
      </div>
    </div>`}

    <!-- Footer -->
    <div class="footer">
      <span>${empresa} · Aryes Stock · Sistema de gestión comercial</span>
      <span>Página 1 · ${hoy}</span>
    </div>
  </div>
</body>
</html>`;
}

export default function ReportePDF() {
  const { ventas, cobros, clientes, brandCfg } = useApp();
  const [periodo,   setPeriodo]   = useState('mes');
  const [generando, setGenerando] = useState(false);

  const { inicio, fin } = useMemo(() => getPeriodoRange(periodo), [periodo]);
  const labelPeriodo = PERIODOS.find(p => p.id === periodo)?.label || periodo;
  const empresa = brandCfg?.name || 'Aryes';

  const ventasFiltradas = useMemo(() =>
    ventas.filter(v => {
      const fecha = new Date(v.fecha || v.creadoEn || 0);
      return fecha >= inicio && fecha <= fin;
    }),
  [ventas, inicio, fin]);

  const cobrosFiltrados = useMemo(() =>
    cobros.filter(c => {
      const fecha = new Date(c.fecha || c.creadoEn || 0);
      return fecha >= inicio && fecha <= fin;
    }),
  [cobros, inicio, fin]);

  const totalVentas  = ventasFiltradas.filter(v => v.estado !== 'cancelada').reduce((a, v) => a + Number(v.total || 0), 0);
  const totalCobrado = cobrosFiltrados.reduce((a, c) => a + Number(c.monto || 0), 0);
  const nVentas      = ventasFiltradas.filter(v => v.estado !== 'cancelada').length;

  const generar = () => {
    setGenerando(true);
    try {
      const html = generarHTML({
        empresa,
        periodo,
        labelPeriodo,
        ventas: ventasFiltradas,
        cobros: cobrosFiltrados,
        clientes,
      });
      const w = window.open('', '_blank', 'noopener,noreferrer,width=1000,height=800');
      if (w) {
        w.document.write(html);
        w.document.close();
      } else {
        // Fallback: download como HTML
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: `reporte-${periodo}-${new Date().toISOString().split('T')[0]}.html`,
        });
        a.click(); URL.revokeObjectURL(a.href);
      }
    } finally {
      setGenerando(false);
    }
  };

  const inp = { padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>

      {/* Header del panel */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
        display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 36 }}>📄</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Reporte de Ventas PDF</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Resumen ejecutivo · Top productos · Detalle ventas · Cuenta corriente
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Selector de período */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Período del reporte
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                style={{
                  padding: '7px 16px', border: `2px solid ${periodo === p.id ? G : '#e5e7eb'}`,
                  borderRadius: 20, background: periodo === p.id ? G : '#fff',
                  color: periodo === p.id ? '#fff' : '#6b7280',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview de datos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Ventas en el período', valor: nVentas, color: G },
            { label: 'Total facturado', valor: fmt.currencyCompact(totalVentas), color: G },
            { label: 'Total cobrado', valor: fmt.currencyCompact(totalCobrado), color: '#059669' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#f9fafb', borderRadius: 10,
              padding: '14px 16px', border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color }}>{kpi.valor}</div>
            </div>
          ))}
        </div>

        {/* Botón generar */}
        <button onClick={generar} disabled={generando}
          style={{ width: '100%', padding: '14px 24px',
            background: generando ? '#9ca3af' : G,
            color: '#fff', border: 'none', borderRadius: 10,
            cursor: generando ? 'default' : 'pointer',
            fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {generando ? '⏳ Generando...' : '🖨 Generar reporte PDF'}
        </button>

        <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
          Se abre en una nueva pestaña · Usá "Guardar como PDF" al imprimir · Compatible con todos los browsers
        </div>
      </div>
    </div>
  );
}
