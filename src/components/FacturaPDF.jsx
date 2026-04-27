// src/components/FacturaPDF.jsx
// Renderiza un CFE/factura como HTML imprimible via window.print()
// Uso: <FacturaPDF cfe={cfe} brandCfg={brandCfg} onClose={fn} />

import { getOrgConfigStatic } from '../hooks/useOrgConfig.js';
import { useEffect, useRef } from 'react';
import { fmtMoney } from '../tabs/facturacion/constants.js';

function fmtFecha(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-UY', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return iso; }
}

export default function FacturaPDF({ cfe, brandCfg, onClose }) {
  const orgCfg = getOrgConfigStatic(brandCfg);
  const _defaultRate = orgCfg.defaultTaxRate;
  const printRef = useRef(null);

  useEffect(() => {
    const id = 'factura-print-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media print {
        body > *:not(#factura-print-root) { display: none !important; }
        #factura-print-root {
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
    el.id = 'factura-print-root';
    document.body.appendChild(el);
    window.print();
    setTimeout(() => {
      if (printRef.current?.parentNode === document.body) document.body.removeChild(el);
    }, 500);
  };

  const G = brandCfg?.color || '#059669';
  const items = cfe.items || [];
  const subtotal = items.reduce((s, it) => s + (it.cant * it.precio), 0);
  const descPct = cfe.descuento || 0;
  const descMonto = subtotal * (descPct / 100);
  const ivaTotal = items.reduce((s, it) => s + (it.cant * it.precio * (1 - descPct/100)) * ((it.iva || _defaultRate) / 100), 0);
  const total = cfe.total || (subtotal - descMonto + ivaTotal);
  const moneda = cfe.moneda || 'USD';

  // Determinar color y label por tipo de documento
  const tipoConfig = {
    'e-Factura':   { label: 'e-Factura',    color: '#059669' },
    'e-Ticket':    { label: 'e-Ticket',     color: '#3b82f6' },
    'e-N.Créd.':   { label: 'Nota de Crédito', color: '#d97706' },
    'e-N.Déb.':    { label: 'Nota de Débito',  color: '#dc2626' },
    'e-Remito':    { label: 'e-Remito',     color: '#8b5cf6' },
  };
  const tipoInfo = tipoConfig[cfe.tipo] || { label: cfe.tipo || 'Comprobante', color: G };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Arial, sans-serif' }}>

      {/* Barra de acciones */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:10000, display:'flex', gap:8 }}>
        <button onClick={handlePrint}
          style={{ background:G, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px',
            fontSize:14, fontWeight:700, cursor:'pointer' }}>
          🖨️ Imprimir / PDF
        </button>
        <button onClick={onClose}
          style={{ background:'#fff', color:'#333', border:'1px solid #ddd', borderRadius:8,
            padding:'10px 16px', fontSize:14, cursor:'pointer' }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Contenido del comprobante */}
      <div ref={printRef} style={{ background:'#fff', width:794, minHeight:600, maxHeight:'90vh',
        overflowY:'auto', borderRadius:8, boxShadow:'0 8px 40px rgba(0,0,0,0.25)',
        padding:'40px 48px', boxSizing:'border-box', fontFamily:'Arial, sans-serif',
        fontSize:13, color:'#1a1a18' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          marginBottom:28, borderBottom:`3px solid ${tipoInfo.color}`, paddingBottom:20 }}>
          <div>
            {brandCfg?.logoUrl && (
              <img src={brandCfg.logoUrl} alt="logo" style={{ height:48, objectFit:'contain', maxWidth:'180px', marginBottom:8, display:'block' }} onError={e => e.target.style.display='none'} />
            )}
            <div style={{ fontSize:20, fontWeight:700, color:tipoInfo.color }}>
              {brandCfg?.name || 'Empresa'}
            </div>
            {brandCfg?.rut      && <div style={{ fontSize:11, color:'#666', marginTop:2 }}>RUT: {brandCfg.rut}</div>}
            {brandCfg?.ownerPhone && <div style={{ fontSize:11, color:'#666' }}>Tel: {brandCfg.ownerPhone}</div>}
            {brandCfg?.email     && <div style={{ fontSize:11, color:'#666' }}>{brandCfg.email}</div>}
            {brandCfg?.direccion && <div style={{ fontSize:11, color:'#666' }}>{brandCfg.direccion}</div>}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ display:'inline-block', background:tipoInfo.color, color:'#fff',
              borderRadius:8, padding:'4px 14px', fontSize:13, fontWeight:700, marginBottom:8 }}>
              {tipoInfo.label}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:'#1a1a18', marginTop:4 }}>
              {cfe.nro || '—'}
            </div>
            <div style={{ fontSize:11, color:'#888', marginTop:4 }}>
              Emisión: {fmtFecha(cfe.fecha || cfe.createdAt)}
            </div>
            {cfe.vencimiento && (
              <div style={{ fontSize:11, color:'#888' }}>
                Vence: {fmtFecha(cfe.vencimiento)}
              </div>
            )}
            <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
              Estado: <span style={{ fontWeight:700, color: cfe.estado==='cobrado'?G:cfe.estado==='vencido'?'#dc2626':'#d97706' }}>
                {cfe.estado || 'pendiente'}
              </span>
            </div>
          </div>
        </div>

        {/* Datos del cliente */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <div style={{ background:'#f9f9f7', borderRadius:8, padding:'12px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase',
              letterSpacing:'0.1em', marginBottom:6 }}>Cliente</div>
            <div style={{ fontWeight:700, fontSize:14 }}>{cfe.clienteNombre || '—'}</div>
            {cfe.clienteRut && <div style={{ fontSize:11, color:'#555', marginTop:2 }}>RUT: {cfe.clienteRut}</div>}
          </div>
          <div style={{ background:'#f9f9f7', borderRadius:8, padding:'12px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase',
              letterSpacing:'0.1em', marginBottom:6 }}>Condiciones</div>
            <div style={{ fontSize:11, color:'#555', display:'grid', gap:3 }}>
              <div>Moneda: <strong>{moneda}</strong></div>
              {cfe.condPago && <div>Pago: <strong>{cfe.condPago}</strong></div>}
              {descPct > 0 && <div>Descuento: <strong>{descPct}%</strong></div>}
            </div>
          </div>
        </div>

        {/* Tabla de ítems */}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
          <thead>
            <tr style={{ background: tipoInfo.color }}>
              {['#','Concepto','Cant.','P. Unit.','IVA','Subtotal'].map((h, i) => (
                <th key={h} style={{ padding:'8px 10px', color:'#fff', fontSize:11, fontWeight:700,
                  textAlign: i >= 3 ? 'right' : i === 0 ? 'center' : 'left',
                  textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const lineBase = it.cant * it.precio;
              const lineDesc = lineBase * (1 - descPct/100);
              const lineIva  = lineDesc * ((it.iva || _defaultRate) / 100);
              const lineTotal = lineDesc + lineIva;
              return (
                <tr key={i} style={{ background: i%2===0?'#fff':'#f9f9f7', borderBottom:'1px solid #f0f0ec' }}>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontSize:12, color:'#888' }}>{i+1}</td>
                  <td style={{ padding:'8px 10px', fontSize:13, fontWeight:500 }}>{it.desc || it.nombre || '—'}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontSize:13 }}>{it.cant}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontSize:13 }}>{fmtMoney(it.precio, moneda)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, color:'#666' }}>{it.iva || 22}%</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontSize:13, fontWeight:600 }}>{fmtMoney(lineTotal, moneda)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totales */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:32 }}>
          <div style={{ width:280 }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13, borderBottom:'1px solid #eee' }}>
              <span style={{ color:'#666' }}>Subtotal neto</span>
              <span>{fmtMoney(subtotal - descMonto, moneda)}</span>
            </div>
            {descPct > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13, borderBottom:'1px solid #eee', color:'#d97706' }}>
                <span>Descuento ({descPct}%)</span>
                <span>-{fmtMoney(descMonto, moneda)}</span>
              </div>
            )}
            {/* Desglose IVA por tasa */}
            {[10, 22].map(tasa => {
              const base = items.filter(it => (it.iva||22) === tasa)
                .reduce((s, it) => s + it.cant * it.precio * (1 - descPct/100), 0);
              if (base <= 0) return null;
              return (
                <div key={tasa} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:'1px solid #eee', color:'#666' }}>
                  <span>IVA {tasa}%</span>
                  <span>{fmtMoney(base * tasa / 100, moneda)}</span>
                </div>
              );
            })}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:16, fontWeight:800, color:tipoInfo.color }}>
              <span>TOTAL</span>
              <span>{fmtMoney(total, moneda)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {cfe.notas && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8,
            padding:'10px 14px', marginBottom:24, fontSize:12, color:'#92400e' }}>
            <strong>Notas:</strong> {cfe.notas}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:24, textAlign:'center', fontSize:10, color:'#bbb',
          borderTop:'1px solid #eee', paddingTop:12 }}>
          Documento no válido como comprobante fiscal · {brandCfg?.name || ''}{brandCfg?.rut ? ` · RUT ${brandCfg.rut}` : ''} · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
