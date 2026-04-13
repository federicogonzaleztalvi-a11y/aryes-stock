// src/components/EstadoCuentaPDF.jsx
// Renderiza estado de cuenta de un cliente como HTML imprimible via window.print()
// Uso: <EstadoCuentaPDF cliente={obj} cfes={[]} cobros={[]} brandCfg={} onClose={fn} />

import { useEffect, useRef } from 'react';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return '$ ' + Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}

export default function EstadoCuentaPDF({ cliente, cfes = [], cobros = [], brandCfg, onClose }) {
  const printRef = useRef(null);

  useEffect(() => {
    const id = 'edocuenta-print-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media print {
        body > *:not(#edocuenta-print-root) { display: none !important; }
        #edocuenta-print-root {
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
    const el = printRef.current;
    if (!el) return;
    el.id = 'edocuenta-print-root';
    document.body.appendChild(el.cloneNode(true));
    window.print();
    setTimeout(() => {
      const clone = document.getElementById('edocuenta-print-root');
      if (clone && clone !== el) clone.remove();
    }, 500);
  };

  const G = brandCfg?.color || '#059669';
  const brandName = brandCfg?.name || 'Pazque';
  const today = fmtFecha(new Date().toISOString());

  // Build movimientos sorted by date
  const movs = [
    ...cfes.map(c => ({ ...c, _tipo: 'cfe', _fecha: c.fecha })),
    ...cobros.map(c => ({ ...c, _tipo: 'cobro', _fecha: c.fecha })),
  ].sort((a, b) => new Date(a._fecha) - new Date(b._fecha));

  // Calculate running balance
  let saldo = 0;
  const withSaldo = movs.map(m => {
    if (m._tipo === 'cfe') saldo += m.total || 0;
    else saldo -= m.monto || 0;
    return { ...m, _saldoAcum: saldo };
  });

  // Totals
  const totalDebito = cfes.reduce((s, c) => s + (c.total || 0), 0);
  const totalCredito = cobros.reduce((s, c) => s + (c.monto || 0), 0);
  const saldoFinal = totalDebito - totalCredito;

  const S = {
    sans: "'Inter','Helvetica Neue',Arial,sans-serif",
    th: { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e2de', textAlign: 'left' },
    td: { padding: '7px 10px', fontSize: 11, color: '#1a1a18', borderBottom: '1px solid #f0f0ec' },
    tdRight: { padding: '7px 10px', fontSize: 11, color: '#1a1a18', borderBottom: '1px solid #f0f0ec', textAlign: 'right', fontFamily: 'monospace' },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e2de', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontFamily: S.sans, fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>Estado de cuenta — {cliente?.nombre || 'Cliente'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={{ padding: '8px 18px', background: G, color: '#fff', border: 'none', borderRadius: 8, fontFamily: S.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Descargar PDF
            </button>
            <button onClick={onClose} style={{ padding: '8px 18px', background: '#f0f0ec', color: '#6a6a68', border: 'none', borderRadius: 8, fontFamily: S.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Print content */}
        <div ref={printRef} style={{ padding: '32px 36px', fontFamily: S.sans }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              {brandCfg?.logoUrl && (
                <img src={brandCfg.logoUrl} alt="logo" style={{ height: 40, objectFit: 'contain', maxWidth: 180, marginBottom: 8, display: 'block' }} onError={e => e.target.style.display = 'none'} />
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a18' }}>{brandName}</div>
              {brandCfg?.rut && <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2 }}>RUT: {brandCfg.rut}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: G, marginBottom: 4 }}>Estado de cuenta</div>
              <div style={{ fontSize: 11, color: '#6a6a68' }}>Fecha: {today}</div>
            </div>
          </div>

          {/* Client info */}
          <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '14px 18px', marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Cliente</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginTop: 2 }}>{cliente?.nombre || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>RUT</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginTop: 2 }}>{cliente?.rut || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Condición de pago</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginTop: 2 }}>{cliente?.condPago || '—'}</div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Total facturado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a18' }}>{fmtMoney(totalDebito)}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Total cobrado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: G }}>{fmtMoney(totalCredito)}</div>
            </div>
            <div style={{ background: saldoFinal > 0 ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (saldoFinal > 0 ? '#fecaca' : '#bbf7d0'), borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#9a9a98', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Saldo pendiente</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: saldoFinal > 0 ? '#dc2626' : G }}>{fmtMoney(saldoFinal)}</div>
            </div>
          </div>

          {/* Movements table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Comprobante</th>
                <th style={S.th}>Tipo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Débito</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Crédito</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {withSaldo.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: 24, color: '#9a9a98' }}>Sin movimientos</td></tr>
              ) : withSaldo.map((m, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={S.td}>{fmtFecha(m._fecha)}</td>
                  <td style={S.td}>
                    {m._tipo === 'cfe'
                      ? (m.numero || 'E-' + (m.id || '').slice(0, 6))
                      : 'Cobro #' + (m.nroCobro || (m.id || '').slice(0, 6))}
                  </td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: m._tipo === 'cfe' ? '#fef3c7' : '#dcfce7',
                      color: m._tipo === 'cfe' ? '#92400e' : '#166534',
                    }}>
                      {m._tipo === 'cfe' ? (m.tipo || 'e-Factura') : (m.metodo || 'Pago')}
                    </span>
                  </td>
                  <td style={S.tdRight}>{m._tipo === 'cfe' ? fmtMoney(m.total) : ''}</td>
                  <td style={S.tdRight}>{m._tipo === 'cobro' ? fmtMoney(m.monto) : ''}</td>
                  <td style={{ ...S.tdRight, fontWeight: 600, color: m._saldoAcum > 0 ? '#dc2626' : G }}>{fmtMoney(m._saldoAcum)}</td>
                </tr>
              ))}
            </tbody>
            {withSaldo.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid #1a1a18' }}>
                  <td colSpan={3} style={{ ...S.td, fontWeight: 700, borderBottom: 'none' }}>Totales</td>
                  <td style={{ ...S.tdRight, fontWeight: 700, borderBottom: 'none' }}>{fmtMoney(totalDebito)}</td>
                  <td style={{ ...S.tdRight, fontWeight: 700, borderBottom: 'none' }}>{fmtMoney(totalCredito)}</td>
                  <td style={{ ...S.tdRight, fontWeight: 700, borderBottom: 'none', color: saldoFinal > 0 ? '#dc2626' : G }}>{fmtMoney(saldoFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e2e2de', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9a9a98' }}>
            <span>Generado por {brandName} · {today}</span>
            <span>Documento informativo — no válido como comprobante fiscal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
