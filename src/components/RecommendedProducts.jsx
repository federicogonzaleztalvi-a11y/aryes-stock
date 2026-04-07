import React from 'react';

var G = '#1a8a3c';

export default function RecommendedProducts({ recommended, onAdd, carrito }) {
  if (!recommended || recommended.length === 0) return null;

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '16px 24px 0' }}>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{'\u{1F4A1}'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Recomendado para vos</span>
          <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 500, marginLeft: 4 }}>
            Basado en lo que compran distribuidoras similares
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
                <div style={{ fontSize: 15, fontWeight: 800, color: G }}>
                  {'$' + Number(p.precio || 0).toFixed(2)}
                </div>
                <button onClick={function() { onAdd(p.id); }} style={{
                  background: inCart > 0 ? '#d1fae5' : G,
                  color: inCart > 0 ? '#166534' : '#fff',
                  border: 'none', borderRadius: 8, padding: '6px 0',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 'auto'
                }}>
                  {inCart > 0 ? '\u2713 En carrito (' + inCart + ')' : '+ Agregar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
