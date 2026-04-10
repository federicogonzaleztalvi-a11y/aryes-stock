import React from 'react';

var G = '#059669';

export default function RecommendedProducts({ recommended, onAdd, onRemove, carrito }) {
  if (!recommended || recommended.length === 0) return null;

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '16px 24px 0' }}>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{'\u{1F4A1}'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Recomendado para vos</span>
          <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 500, marginLeft: 4 }}>
            
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
          {recommended.map(function(p) {
            var inCart = (carrito && carrito[p.id]) || 0;
            return (
              <div key={p.id} style={{
                background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0',
                display: 'flex', flexDirection: 'column', gap: 6
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', lineHeight: 1.3 }}>{p.nombre}</div>
                {p.reason && (
                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>{p.reason}</div>
                )}
                <div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: G }}>
                    {'$ ' + Math.round(Number(p.precio || 0))}
                  </span>
                  <span style={{ fontSize: 11, color: '#9a9a98', marginLeft: 4 }}>{'/ ' + (p.unit || p.unidad || 'un')}</span>
                  <div style={{ fontSize: 10, color: '#a0a098' }}>
                    {'$' + Math.round(Number(p.precio || 0) / 1.22) + ' + IVA ' + (p.iva_rate || 22) + '%'}
                  </div>
                </div>
                {inCart > 0 ? (
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 0, marginTop: 'auto', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' } },
                    React.createElement('button', { onClick: function(e) { e.stopPropagation(); onRemove && onRemove(p); }, style: { width: 32, height: 32, border: 'none', background: '#f0fdf4', color: G, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, '\u2212'),
                    React.createElement('span', { style: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1a1a18', minWidth: 28 } }, inCart),
                    React.createElement('button', { onClick: function(e) { e.stopPropagation(); onAdd(p); }, style: { width: 32, height: 32, border: 'none', background: '#f0fdf4', color: G, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, '+')
                  )
                ) : (
                  <button onClick={function() { onAdd(p); }} style={{
                    background: G, color: '#fff',
                    border: 'none', borderRadius: 8, padding: '6px 0',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 'auto', width: '100%'
                  }}>
                    + Agregar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
