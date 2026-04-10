// src/components/EtiquetasPDF.jsx
// 3 tipos de etiquetas imprimibles via window.print()
// Uso:
//   <EtiquetasPDF tipo="producto"  data={producto}  brandCfg={cfg} onClose={fn} />
//   <EtiquetasPDF tipo="pallet"    data={recepcion} brandCfg={cfg} onClose={fn} />
//   <EtiquetasPDF tipo="despacho"  data={venta}     brandCfg={cfg} onClose={fn} />

import { useEffect, useRef } from 'react';

function QR({ value, size = 120 }) {
  const encoded = encodeURIComponent(value || 'aryes');
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=4`}
      alt="QR"
      width={size}
      height={size}
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  );
}

function useEtiquetaPrintStyles() {
  useEffect(() => {
    const id = 'etiqueta-print-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media print {
        body > *:not(#etiqueta-print-root) { display: none !important; }
        #etiqueta-print-root {
          display: block !important;
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99999;
          background: #fff;
        }
        @page { size: A4; margin: 1cm; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

function fmtFecha(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}

function EtiquetaProducto({ producto, brandCfg }) {
  const G = brandCfg?.color || '#059669';
  const qrValue = `ARYES-SKU:${producto.uuid || producto.id}|${producto.name}`;
  return (
    <div style={{ width: 320, border: `2px solid ${G}`, borderRadius: 8, fontFamily: 'Arial, sans-serif', overflow: 'hidden', pageBreakInside: 'avoid' }}>
      <div style={{ background: G, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{brandCfg?.name || 'ARYES'}</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>ETIQUETA DE PRODUCTO</div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a18', lineHeight: 1.3, marginBottom: 6 }}>{producto.name || '—'}</div>
          {producto.category && <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{producto.category}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#666' }}>Código</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a18' }}>#{producto.id || (producto.uuid || '').slice(0,8) || '—'}</div>
            {producto.unit && <><div style={{ fontSize: 10, color: '#666' }}>Unidad</div><div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a18' }}>{producto.unit}</div></>}
            {producto.precio_venta > 0 && <><div style={{ fontSize: 10, color: '#666' }}>Precio</div><div style={{ fontSize: 10, fontWeight: 700, color: G }}>${Number(producto.precio_venta).toFixed(2)}</div></>}
            {producto.stock >= 0 && <><div style={{ fontSize: 10, color: '#666' }}>Stock</div><div style={{ fontSize: 10, fontWeight: 700, color: producto.stock === 0 ? '#dc2626' : '#1a1a18' }}>{producto.stock} {producto.unit || 'u.'}</div></>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <QR value={qrValue} size={90} />
          <div style={{ fontSize: 8, color: '#aaa', marginTop: 3 }}>{(producto.uuid || '').slice(0, 8)}</div>
        </div>
      </div>
      <div style={{ background: '#f9f9f7', padding: '5px 12px', fontSize: 9, color: '#bbb', textAlign: 'center' }}>
        {new Date().toLocaleDateString('es-UY')} · {brandCfg?.name || 'Pazque'}
      </div>
    </div>
  );
}

function EtiquetaPallet({ recepcion, brandCfg }) {
  const G = brandCfg?.color || '#059669';
  const qrValue = `ARYES-PALLET:${recepcion.id || Date.now()}|LOTE:${recepcion.lote || 'SL'}|VENC:${recepcion.vencimiento || 'SV'}`;
  const filas = [
    ['Proveedor', recepcion.proveedorNombre || recepcion.proveedor || '—'],
    ['Fecha ingreso', fmtFecha(recepcion.fecha || recepcion.createdAt)],
    ['Lote', recepcion.lote || 'Sin lote'],
    ['Vencimiento', recepcion.vencimiento ? fmtFecha(recepcion.vencimiento) : 'Sin venc.'],
    ['Cantidad', `${recepcion.cantidad || '—'} ${recepcion.unidad || 'u.'}`],
    ['Ubicación', recepcion.ubicacion || 'Sin asignar'],
    ['Receptor', recepcion.receptor || '—'],
  ];
  return (
    <div style={{ width: 380, border: `2px solid ${G}`, borderRadius: 8, fontFamily: 'Arial, sans-serif', overflow: 'hidden', pageBreakInside: 'avoid' }}>
      <div style={{ background: G, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{brandCfg?.name || 'ARYES'}</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>ETIQUETA DE PALLET</div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a18', lineHeight: 1.3, marginBottom: 8 }}>{recepcion.productoNombre || recepcion.producto || '—'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
            {filas.map(([label, value]) => [
              <div key={label+'l'} style={{ fontSize: 10, color: '#888', paddingTop: 1 }}>{label}</div>,
              <div key={label+'v'} style={{ fontSize: 11, fontWeight: 700, color: '#1a1a18' }}>{value}</div>
            ])}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <QR value={qrValue} size={100} />
          <div style={{ fontSize: 8, color: '#aaa', marginTop: 3 }}>ID: {String(recepcion.id || '').slice(0, 8)}</div>
        </div>
      </div>
      {recepcion.lote && (
        <div style={{ margin: '0 14px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>LOTE: {recepcion.lote}</span>
          {recepcion.vencimiento && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>VENCE: {fmtFecha(recepcion.vencimiento)}</span>}
        </div>
      )}
      <div style={{ background: '#f9f9f7', padding: '5px 12px', fontSize: 9, color: '#bbb', textAlign: 'center' }}>
        {new Date().toLocaleDateString('es-UY')} · {brandCfg?.name || 'Pazque'}
      </div>
    </div>
  );
}

function EtiquetaDespacho({ venta, brandCfg }) {
  const G = brandCfg?.color || '#059669';
  const trackingUrl = `${window.location.origin}/tracking?ruta=${venta.rutaId || ''}&cliente=${venta.clienteId || ''}&org=${venta.org_id || 'aryes'}`;
  const items = venta.items || [];
  return (
    <div style={{ width: 380, border: `3px solid ${G}`, borderRadius: 8, fontFamily: 'Arial, sans-serif', overflow: 'hidden', pageBreakInside: 'avoid' }}>
      <div style={{ background: G, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{brandCfg?.name || 'ARYES'}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>ETIQUETA DE DESPACHO</div>
        </div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{venta.nroVenta || '#—'}</div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ background: '#f0fdf4', border: `1px solid ${G}`, borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Destinatario</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a18' }}>{venta.clienteNombre || '—'}</div>
          {venta.clienteDireccion && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{venta.clienteDireccion}</div>}
          {venta.clienteTel && <div style={{ fontSize: 11, color: '#555' }}>Tel: {venta.clienteTel}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Contenido ({items.length} ítem{items.length !== 1 ? 's' : ''})
            </div>
            {items.slice(0, 8).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', borderBottom: '1px solid #f0f0ec' }}>
                <span style={{ color: '#1a1a18', flex: 1 }}>{it.nombre || it.productoNombre || '—'}</span>
                <span style={{ color: '#555', fontWeight: 600, marginLeft: 8 }}>{it.cantidad} {it.unidad || 'u.'}</span>
              </div>
            ))}
            {items.length > 8 && <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>+ {items.length - 8} ítems más (ver remito)</div>}
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px' }}>
              <div style={{ fontSize: 9, color: '#888' }}>Fecha</div>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{fmtFecha(venta.fechaEntrega || venta.createdAt)}</div>
              {venta.condPago && <><div style={{ fontSize: 9, color: '#888' }}>Pago</div><div style={{ fontSize: 10, fontWeight: 700 }}>{venta.condPago}</div></>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <QR value={trackingUrl} size={100} />
            <div style={{ fontSize: 8, color: '#888', marginTop: 3, maxWidth: 100 }}>Escanear para tracking</div>
          </div>
        </div>
      </div>
      <div style={{ background: '#f9f9f7', padding: '5px 12px', fontSize: 9, color: '#bbb', textAlign: 'center' }}>
        {new Date().toLocaleDateString('es-UY')} · {brandCfg?.name || 'Pazque'}
      </div>
    </div>
  );
}

export default function EtiquetasPDF({ tipo, data, brandCfg, onClose, cantidad = 1 }) {
  const printRef = useRef(null);
  useEtiquetaPrintStyles();
  const G = brandCfg?.color || '#059669';

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    el.id = 'etiqueta-print-root';
    document.body.appendChild(el);
    window.print();
    setTimeout(() => {
      if (printRef.current?.parentNode === document.body) document.body.removeChild(el);
    }, 500);
  };

  const renderEtiqueta = () => {
    switch (tipo) {
      case 'producto': return <EtiquetaProducto  producto={data}  brandCfg={brandCfg} />;
      case 'pallet':   return <EtiquetaPallet    recepcion={data} brandCfg={brandCfg} />;
      case 'despacho': return <EtiquetaDespacho  venta={data}     brandCfg={brandCfg} />;
      default: return null;
    }
  };

  const titulos = { producto: 'Etiqueta de producto', pallet: 'Etiqueta de pallet', despacho: 'Etiqueta de despacho' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginRight: 8 }}>{titulos[tipo] || 'Etiqueta'}</div>
        <button onClick={handlePrint} style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Imprimir / PDF
        </button>
        <button onClick={onClose} style={{ background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
          ✕ Cerrar
        </button>
      </div>
      <div ref={printRef} style={{ background: '#f5f5f7', padding: 40, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
        {Array.from({ length: cantidad }).map((_, i) => <div key={i}>{renderEtiqueta()}</div>)}
      </div>
    </div>
  );
}
