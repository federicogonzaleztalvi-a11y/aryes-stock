// PedidosPortalPanel — Muestra pedidos del portal B2B pendientes de importar
// Se usa en VentasTab. El admin ve los pedidos entrantes y los importa con un click.

import { useState, useEffect, useCallback } from 'react';

const G = '#3a7d1e';
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SKEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

function fmtUSD(n) {
  return 'US$ ' + Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1)  return 'ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffMin < 1440) return `hace ${Math.floor(diffMin/60)} h`;
  return d.toLocaleDateString('es-UY');
}

export default function PedidosPortalPanel({ onImportar }) {
  const [orders,  setOrders]  = useState([]);
  const [open,    setOpen]    = useState(true);
  const [loading, setLoading] = useState(false);
  const [expand,  setExpand]  = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!SB_URL || !SKEY) return;
    setLoading(true);
    try {
      // Need auth headers — try session
      const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
      const token   = session?.access_token || SKEY;
      const r = await fetch(
        `${SB_URL}/rest/v1/b2b_orders?estado=eq.pendiente&order=creado_en.desc&limit=20`,
        { headers: { apikey: SKEY, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      const d = await r.json();
      if (Array.isArray(d)) setOrders(d);
    } catch {/* silent */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 30_000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  if (orders.length === 0 && !loading) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `2px solid ${G}`,
      marginBottom: 20, overflow: 'hidden',
      boxShadow: orders.length > 0 ? '0 2px 12px rgba(58,125,30,.12)' : 'none' }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          background: orders.length > 0 ? '#f0fdf4' : '#f9fafb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛒</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: G }}>
              Pedidos del portal
            </span>
            {orders.length > 0 && (
              <span style={{ marginLeft: 8, background: G, color: '#fff',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {orders.length} nuevo{orders.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); fetchOrders(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#6b7280' }}>
            {loading ? '...' : '↻ actualizar'}
          </button>
          <span style={{ color: '#6b7280', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          {orders.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No hay pedidos pendientes de importar
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {orders.map(order => {
                const isExpanded = expand === order.id;
                return (
                  <div key={order.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10,
                    overflow: 'hidden' }}>
                    {/* Order header */}
                    <div style={{ padding: '12px 16px', display: 'flex',
                      alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      cursor: 'pointer', background: isExpanded ? '#f9fafb' : '#fff' }}
                      onClick={() => setExpand(isExpanded ? null : order.id)}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                          {order.cliente_nombre}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {order.cliente_tel && `📱 ${order.cliente_tel} · `}
                          {fmtTs(order.creado_en)}
                          {order.notas && <span style={{ marginLeft: 6, color: '#d97706' }}>📝 nota</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: G }}>
                          {fmtUSD(order.total)}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {Array.isArray(order.items) ? order.items.length : 0} producto{(Array.isArray(order.items) ? order.items.length : 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); onImportar(order);
                        setOrders(prev => prev.filter(o => o.id !== order.id)); }}
                        style={{ padding: '8px 16px', background: G, color: '#fff',
                          border: 'none', borderRadius: 8, cursor: 'pointer',
                          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✓ Importar
                      </button>
                    </div>
                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ padding: '12px 16px', background: '#fafafa',
                        borderTop: '1px solid #f3f4f6' }}>
                        {Array.isArray(order.items) && order.items.map((it, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                            fontSize: 13, padding: '4px 0', borderBottom: i < order.items.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                            <span>{it.cantidad} × {it.nombre} <span style={{ color: '#9ca3af' }}>({it.unidad})</span></span>
                            <span style={{ fontWeight: 600, color: G }}>{fmtUSD(it.subtotal)}</span>
                          </div>
                        ))}
                        {order.notas && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280',
                            background: '#fffbeb', padding: '6px 10px', borderRadius: 6 }}>
                            📝 {order.notas}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
