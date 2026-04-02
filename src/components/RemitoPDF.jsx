// src/components/RemitoPDF.jsx — Delivery note / Remito
// Print-ready component — renders as HTML, printed via window.print()
// Read-only: no state mutations, no side effects
// Usage: <RemitoPDF venta={venta} brandCfg={brandCfg} onClose={fn} />

import { useEffect, useRef } from 'react';
import { fmt } from '../lib/constants.js';


function fmtFecha(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

export default function RemitoPDF({ venta, brandCfg, onClose }) {
  const printRef = useRef(null);

  // Inject print styles once
  useEffect(() => {
    const id = 'remito-print-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media print {
        body > *:not(#remito-print-root) { display: none !important; }
        #remito-print-root {
          display: block !important;
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99999;
          background: #fff;
        }
        @page { size: A4; margin: 1.2cm; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const handlePrint = () => {
    // Temporarily show the print div at top level
    const el = printRef.current;
    if (!el) return;
    el.id = 'remito-print-root';
    document.body.appendChild(el);
    window.print();
    // Re-attach to component after print dialog closes
    setTimeout(() => {
      printRef.current?.parentNode !== document.body
        ? null
        : document.body.removeChild(el);
    }, 500);
  };

  const moneda   = venta.moneda || 'USD';
  const items    = venta.items || [];
  const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) * Number(it.precioUnit || 0)), 0);
  const descuento = venta.descuento || 0;
  const descMonto = subtotal * (descuento / 100);
  const total    = venta.total || (subtotal - descMonto);
  const G        = brandCfg?.color || '#1a8a3c';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Action bar */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 10000,
        display: 'flex', gap: 8,
      }}>
        <button
          onClick={handlePrint}
          style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Imprimir / Guardar PDF
        </button>
        <button
          onClick={onClose}
          style={{ background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Remito content */}
      <div
        ref={printRef}
        style={{
          background: '#fff', width: 794, minHeight: 600, maxHeight: '90vh',
          overflowY: 'auto', borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          padding: '40px 48px', boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1a1a18',
        }}>

        {/* Header: company + remito number */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, borderBottom: `3px solid ${G}`, paddingBottom: 20 }}>
          <div>
            {brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height: 48, marginBottom: 8, display: 'block' }} />
            )}
            <div style={{ fontSize: 20, fontWeight: 700, color: G }}>{brandCfg?.name || 'Empresa'}</div>
            {brandCfg?.rut       && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>RUT: {brandCfg.rut}</div>}
            {brandCfg?.ownerPhone && <div style={{ fontSize: 11, color: '#666' }}>Tel: {brandCfg.ownerPhone}</div>}
            {brandCfg?.email      && <div style={{ fontSize: 11, color: '#666' }}>{brandCfg.email}</div>}
            {brandCfg?.direccion  && <div style={{ fontSize: 11, color: '#666' }}>{brandCfg.direccion}</div>}
            {brandCfg?.web        && <div style={{ fontSize: 11, color: '#666' }}>{brandCfg.web}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18' }}>REMITO</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: G, marginTop: 4 }}>{venta.nroVenta || '—'}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Fecha: {fmtFecha(venta.createdAt || venta.fecha)}
            </div>
            {venta.fechaEntrega && (
              <div style={{ fontSize: 11, color: '#888' }}>
                Entrega: {fmtFecha(venta.fechaEntrega)}
              </div>
            )}
          </div>
        </div>

        {/* Client data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Cliente
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{venta.clienteNombre || '—'}</div>
            {venta.clienteRut      && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>RUT: {venta.clienteRut}</div>}
            {venta.clienteTel      && <div style={{ fontSize: 11, color: '#555' }}>Tel: {venta.clienteTel}</div>}
            {venta.clienteDireccion && <div style={{ fontSize: 11, color: '#555' }}>{venta.clienteDireccion}</div>}
          </div>
          <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Condiciones
            </div>
            <div style={{ fontSize: 11, color: '#555', display: 'grid', gap: 3 }}>
              <div>Moneda: <strong>{moneda}</strong></div>
              {venta.condPago && <div>Pago: <strong>{venta.condPago}</strong></div>}
              {descuento > 0 && <div>Descuento: <strong>{descuento}%</strong></div>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ background: G }}>
              {['#', 'Producto', 'Cantidad', 'Unidad', 'P. Unit.', 'Subtotal'].map((h, i) => (
                <th key={h} style={{
                  padding: '8px 10px', color: '#fff', fontSize: 11,
                  fontWeight: 700, textAlign: i >= 4 ? 'right' : i === 0 ? 'center' : 'left',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const lineTotal = Number(it.cantidad) * Number(it.precioUnit || 0);
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f7' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: '#888' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 500 }}>{it.nombre || it.productoNombre || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13 }}>{Number(it.cantidad)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#666' }}>{it.unidad || ''}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13 }}>{fmt.currency(it.precioUnit, moneda)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt.currency(lineTotal, moneda)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#666' }}>Subtotal</span>
              <span>{fmt.currency(subtotal, moneda)}</span>
            </div>
            {descuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #eee', color: '#d97706' }}>
                <span>Descuento ({descuento}%)</span>
                <span>-{fmt.currency(descMonto, moneda)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 16, fontWeight: 800, color: G }}>
              <span>TOTAL</span>
              <span>{fmt.currency(total, moneda)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {venta.notas && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 12, color: '#92400e' }}>
            <strong>Notas:</strong> {venta.notas}
          </div>
        )}

        {/* Signature area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 16 }}>
          {['Recibí conforme', 'Entregado por'].map(label => (
            <div key={label}>
              <div style={{ borderTop: '1px solid #999', paddingTop: 8, fontSize: 11, color: '#666', textAlign: 'center' }}>
                {label}
              </div>
              <div style={{ height: 40 }} />
              <div style={{ borderTop: '1px solid #ccc', fontSize: 10, color: '#aaa', textAlign: 'center', paddingTop: 4 }}>
                Firma y aclaración
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#bbb', borderTop: '1px solid #eee', paddingTop: 12 }}>
          Documento no válido como comprobante fiscal · {brandCfg?.name || ''}{brandCfg?.rut ? ` · RUT ${brandCfg.rut}` : ''} · {new Date().getFullYear()}
        </div>

      </div>
    </div>
  );
}
