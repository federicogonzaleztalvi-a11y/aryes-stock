// src/tabs/DescuentosTab.jsx — Tabla de SOLO LECTURA: Producto | Precio | Descuento %
//
// Vista de referencia, sin edición. El precio sale del precio base del producto
// (precioVenta) y el descuento posible se deriva del MEJOR descuento por volumen
// ya cargado en cada producto (volume_tiers: [{min, dto}]). No toca la DB ni crea
// datos nuevos — solo muestra lo que ya existe. Genérico por-org.
import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { fmt } from '../lib/constants.js';

const G = '#059669';

// Mejor descuento posible del producto = el % más alto entre sus escalas de volumen.
function dtoPosible(p) {
  const tiers = Array.isArray(p.volume_tiers) ? p.volume_tiers : [];
  let max = 0;
  for (const t of tiers) {
    const d = Number(t?.dto) || 0;
    if (d > max) max = d;
  }
  return max;
}

export default function DescuentosTab() {
  const { products } = useApp();
  const [busq, setBusq] = useState('');

  const rows = useMemo(() => {
    const q = busq.trim().toLowerCase();
    return (products || [])
      .filter(p => (p.name || p.nombre || '').trim())
      .filter(p => !q || (p.name || p.nombre || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .map(p => ({
        id: p.id,
        nombre: p.name || p.nombre || '',
        categoria: p.category || '',
        precio: Number(p.precioVenta) || 0,
        dto: dtoPosible(p),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [products, busq]);

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Descuentos</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          Precio de cada producto y su descuento posible. Vista de referencia (solo lectura).
        </p>
      </div>

      <input
        type="text"
        value={busq}
        onChange={e => setBusq(e.target.value)}
        placeholder="Buscar producto o categoría…"
        style={{ width: '100%', maxWidth: 360, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }}
      />

      <div style={{ border: '1px solid #f0ede8', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#faf9f7', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#5a5a58' }}>Producto</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#5a5a58', textAlign: 'right' }}>Precio</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#5a5a58', textAlign: 'right', width: 150 }}>Descuento posible</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ padding: '24px 14px', textAlign: 'center', color: '#9a9a98' }}>Sin productos para mostrar.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #f3f1ee' }}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#1a1a18' }}>{r.nombre}</div>
                  {r.categoria && <div style={{ fontSize: 11, color: '#9a9a98' }}>{r.categoria}</div>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt.currency(r.precio)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  {r.dto > 0 ? (
                    <span style={{ display: 'inline-block', background: '#f0fdf4', color: G, border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>
                      {r.dto}%
                    </span>
                  ) : (
                    <span style={{ color: '#c4c4c2' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
