import React from 'react';

var G = '#059669';

export default function BuyAgainRow({ buyAgain, onAdd, onRemove, carrito, brandCfg }) {
  if (!buyAgain || buyAgain.length === 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5">
          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>Volver a pedir</span>
        <span style={{ fontSize: 12, color: '#9a9a98' }}>Lo que pedís habitualmente</span>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {buyAgain.map(function(p) {
          var inCart = (carrito && carrito[p.id]) || 0;
          return (
            <div key={p.id} style={{
              flex: '0 0 auto', width: 150, background: '#fff', borderRadius: 10, padding: 12,
              border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', lineHeight: 1.3,
                minHeight: 34, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.nombre}
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: G }}>
                  {p.precio > 0 ? '$ ' + Math.round(Number(p.precio)) : 'Consultar'}
                </span>
                {p.precio > 0 && (
                  <span style={{ fontSize: 11, color: '#9a9a98', marginLeft: 4 }}>{'/ ' + (p.unidad || 'un')}</span>
                )}
                {p.precio > 0 && (
                  <div style={{ fontSize: 10, color: '#a0a098' }}>
                    {'+ ' + (brandCfg?.tax_name || 'IVA') + ' ' + (p.iva_rate || brandCfg?.iva_default || 22) + '%'}
                  </div>
                )}
              </div>
              {inCart > 0 ? (
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', marginTop: 'auto', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' } },
                  React.createElement('button', { onClick: function(e) { e.stopPropagation(); onRemove && onRemove(p); }, 'aria-label': 'Quitar uno', style: { width: 32, height: 32, border: 'none', background: '#f0fdf4', color: G, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, '\u2212'),
                  React.createElement('span', { style: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1a1a18', minWidth: 28 } }, inCart),
                  React.createElement('button', { onClick: function(e) { e.stopPropagation(); onAdd(p); }, 'aria-label': 'Agregar uno', style: { width: 32, height: 32, border: 'none', background: '#f0fdf4', color: G, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, '+')
                )
              ) : (
                <button onClick={function() { onAdd(p); }} style={{
                  background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 0',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 'auto', width: '100%',
                }}>
                  + Agregar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
