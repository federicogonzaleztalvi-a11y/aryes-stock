// src/tabs/PortalAdminTab.jsx
// Vista admin del portal B2B — gestión de pedidos y catálogo
import { useState, useEffect } from 'react';
import { db, SB_URL, getAuthHeaders } from '../lib/constants.js';
import { T, Btn } from '../lib/ui.jsx';
import { useApp } from '../context/AppContext.tsx';

const G = '#059669';

function fmtFecha(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

function estadoBadge(estado) {
  const map = {
    pendiente:  { bg:'#fef3c7', color:'#92400e', label:'Pendiente' },
    confirmado: { bg:'#d1fae5', color:'#065f46', label:'Confirmado' },
    cancelado:  { bg:'#fee2e2', color:'#991b1b', label:'Cancelado' },
    importado:  { bg:'#e0e7ff', color:'#3730a3', label:'Importado' },
  };
  const s = map[estado] || { bg:'#f3f4f6', color:'#374151', label: estado || '—' };
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600 }}>
      {s.label}
    </span>
  );
}

export default function PortalAdminTab() {
  const { products, ventas, setVentas, isDemoMode } = useApp();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoSel, setPedidoSel] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [msg, setMsg] = useState('');
  const [importando, setImportando] = useState(false);

  const importarAVenta = async (order) => {
    if (importando) return;
    setImportando(true);
    try {
      const ventaId = crypto.randomUUID();
      // Generate nroVenta locally
      const nums = (ventas || []).map(v => parseInt((v.nroVenta || 'V-0000').replace('V-', '')) || 0);
      const nroVenta = 'V-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
      
      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
      const enrichedItems = items.map(it => {
        const prod = products.find(p =>
          p.id === (it.productId || it.productoId || it.product_id) ||
          (p.nombre || p.name || '').toLowerCase() === (it.nombre || it.name || '').toLowerCase()
        );
        return {
          productoId: it.productId || it.productoId || it.product_id || '',
          nombre: it.nombre || it.name || '',
          precioUnit: Number(it.precio || it.precioUnit || it.price || 0),
          costoUnit: prod ? Number(prod.unitCost || 0) : 0,
          unidad: it.unidad || it.unit || 'u.',
          cantidad: Number(it.qty || it.cantidad || 0),
        };
      });

      const newVenta = {
        id: ventaId, nroVenta,
        clienteId: order.cliente_id || '',
        clienteNombre: order.cliente_nombre || '',
        items: enrichedItems,
        total: Number(order.total || 0),
        descuento: 0, estado: 'pendiente',
        fecha: new Date().toISOString().slice(0, 10),
        notas: order.notas || '',
        origenPortal: true, orderId: order.id,
        creadoEn: new Date().toISOString(), estadoLog: [],
      };

      // Add to ventas state
      setVentas(v => [newVenta, ...v]);

      if (!isDemoMode) {
        // Persist venta to Supabase
        await db.upsert('ventas', {
          id: newVenta.id, nro_venta: newVenta.nroVenta,
          cliente_id: newVenta.clienteId, cliente_nombre: newVenta.clienteNombre,
          items: newVenta.items, total: newVenta.total, descuento: 0,
          estado: 'pendiente', fecha: newVenta.fecha, notas: newVenta.notas,
          b2b_order_id: order.id,
        }, 'id').catch(e => console.warn('[PortalAdmin] venta upsert failed:', e));

        // Mark b2b_order as importado
        await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'importado', venta_id: ventaId }),
        }).catch(() => {});
      }

      // Update local state
      cambiarEstado(order.id, 'importado');
      setPedidoSel(null);
      showMsg('Pedido importado como venta ' + nroVenta);
    } catch (e) {
      console.error('[PortalAdmin] Import error:', e);
      showMsg('Error al importar: ' + (e.message || 'intentá de nuevo'));
    } finally {
      setImportando(false);
    }
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/b2b_orders?order=created_at.desc&limit=100`,
        { headers: getAuthHeaders() }
      );
      const data = await r.json();
      setPedidos(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error('[PortalAdmin] Error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (id, nuevoEstado) => {
    await fetch(`${SB_URL}/rest/v1/b2b_orders?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: nuevoEstado }),
    });
    setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: nuevoEstado } : p));
    if (pedidoSel?.id === id) setPedidoSel(p => ({ ...p, status: nuevoEstado }));
    showMsg(`Estado actualizado a "${nuevoEstado}"`);
  };

  const filtrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro);
  const counts = {
    todos: pedidos.length,
    pendiente: pedidos.filter(p => p.status === 'pendiente').length,
    confirmado: pedidos.filter(p => p.status === 'confirmado').length,
    importado: pedidos.filter(p => p.status === 'importado').length,
    cancelado: pedidos.filter(p => p.status === 'cancelado').length,
  };

  return (
    <div className="au" style={{ display:'grid', gap:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:T.serif, fontSize:28, fontWeight:500, color:T.text, margin:0, letterSpacing:'-.02em' }}>Portal B2B</h1>
          <div style={{ fontSize:13, color:T.textSm, marginTop:4 }}>Pedidos recibidos de clientes via portal</div>
        </div>
        <Btn onClick={cargar} variant="ghost">↺ Actualizar</Btn>
      </div>

      {/* Toast */}
      {msg && (
        <div style={{ background:G, color:'#fff', borderRadius:8, padding:'10px 16px', fontSize:13, fontWeight:600 }}>
          ✓ {msg}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[['todos','Todos'],['pendiente','Pendientes'],['confirmado','Confirmados'],['importado','Importados'],['cancelado','Cancelados']].map(([key, label]) => (
          <button key={key} onClick={() => setFiltro(key)} style={{
            padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
            background: filtro === key ? G : T.muted,
            color: filtro === key ? '#fff' : T.textSm,
            border: filtro === key ? 'none' : `1px solid ${T.border}`,
          }}>
            {label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      {/* Tabla de pedidos */}
      <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:'auto', background:T.card }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:T.textSm, fontSize:13 }}>Cargando pedidos...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:15, fontWeight:600, color:T.text }}>No hay pedidos</div>
            <div style={{ fontSize:13, color:T.textSm, marginTop:6 }}>
              {filtro === 'todos' ? 'Cuando tus clientes hagan pedidos por el portal aparecerán acá.' : `No hay pedidos con estado "${filtro}".`}
            </div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:T.muted, borderBottom:`1px solid ${T.border}` }}>
                {['#','Cliente','Ítems','Total','Fecha','Estado',''].map(h => (
                  <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.textSm, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const items = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
                return (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background: i%2===0 ? T.card : T.cardWarm, cursor:'pointer' }}
                    onClick={() => setPedidoSel(p)}
                    onMouseEnter={e => e.currentTarget.style.background = T.hover}
                    onMouseLeave={e => e.currentTarget.style.background = i%2===0 ? T.card : T.cardWarm}>
                    <td style={{ padding:'11px 13px', fontSize:11, color:T.textXs, fontFamily:'monospace' }}>{String(p.id).slice(0,8)}</td>
                    <td style={{ padding:'11px 13px', fontSize:13, fontWeight:500, color:T.text }}>{p.cliente_nombre || p.cliente_id || '—'}</td>
                    <td style={{ padding:'11px 13px', fontSize:13, color:T.textSm }}>{items.length} ítem{items.length !== 1 ? 's' : ''}</td>
                    <td style={{ padding:'11px 13px', fontSize:13, fontWeight:600, color:G }}>${Number(p.total || 0).toFixed(2)}</td>
                    <td style={{ padding:'11px 13px', fontSize:12, color:T.textSm, whiteSpace:'nowrap' }}>{fmtFecha(p.created_at)}</td>
                    <td style={{ padding:'11px 13px' }}>{estadoBadge(p.status)}</td>
                    <td style={{ padding:'11px 13px' }}>
                      <button onClick={e => { e.stopPropagation(); setPedidoSel(p); }}
                        style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', color:T.textSm }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel detalle pedido */}
      {pedidoSel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setPedidoSel(null)}>
          <div style={{ background:'#fff', borderRadius:12, width:560, maxHeight:'85vh', overflowY:'auto', padding:28, fontFamily:T.sans }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Pedido del portal</div>
                <div style={{ fontSize:12, color:T.textSm, marginTop:2 }}>#{String(pedidoSel.id).slice(0,8)} · {fmtFecha(pedidoSel.created_at)}</div>
              </div>
              <button onClick={() => setPedidoSel(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:T.textSm }}>×</button>
            </div>

            {/* Cliente */}
            <div style={{ background:'#f9f9f7', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Cliente</div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{pedidoSel.cliente_nombre || '—'}</div>
              {pedidoSel.cliente_tel && <div style={{ fontSize:12, color:T.textSm, marginTop:2 }}>Tel: {pedidoSel.cliente_tel}</div>}
            </div>

            {/* Items */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Productos</div>
              {(Array.isArray(pedidoSel.items) ? pedidoSel.items : JSON.parse(pedidoSel.items || '[]')).map((it, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                  <span style={{ color:T.text, flex:1 }}>{it.nombre || it.name || '—'}</span>
                  <span style={{ color:T.textSm, marginLeft:12 }}>{it.cantidad || it.qty} {it.unidad || 'u.'}</span>
                  <span style={{ color:G, fontWeight:600, marginLeft:12 }}>${Number((it.cantidad || it.qty) * (it.precio || it.price || 0)).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10, fontSize:15, fontWeight:700, color:G }}>
                Total: ${Number(pedidoSel.total || 0).toFixed(2)}
              </div>
            </div>

            {/* Notas */}
            {pedidoSel.notas && (
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
                <strong>Notas:</strong> {pedidoSel.notas}
              </div>
            )}

            {/* Estado actual */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Estado</div>
              {estadoBadge(pedidoSel.status)}
            </div>

            {/* Acciones */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {(pedidoSel.status === 'pendiente' || pedidoSel.status === 'confirmado') && pedidoSel.status !== 'importado' && (
                <button onClick={() => importarAVenta(pedidoSel)} disabled={importando}
                  style={{ flex:1, background:'#1e40af', color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor: importando ? 'wait' : 'pointer', opacity: importando ? 0.7 : 1 }}>
                  {importando ? '⏳ Importando...' : '📥 Importar a venta'}
                </button>
              )}
              {pedidoSel.status === 'pendiente' && (
                <>
                  <button onClick={() => cambiarEstado(pedidoSel.id, 'confirmado')}
                    style={{ flex:1, background:G, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    ✓ Confirmar pedido
                  </button>
                  <button onClick={() => cambiarEstado(pedidoSel.id, 'cancelado')}
                    style={{ flex:1, background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    × Cancelar
                  </button>
                </>
              )}
              {pedidoSel.status === 'confirmado' && (
                <button onClick={() => cambiarEstado(pedidoSel.id, 'pendiente')}
                  style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 16px', fontSize:13, cursor:'pointer', color:T.textSm }}>
                  ↩ Volver a pendiente
                </button>
              )}
              <button onClick={() => setPedidoSel(null)}
                style={{ background:T.muted, color:T.textSm, border:'none', borderRadius:8, padding:'11px 16px', fontSize:13, cursor:'pointer' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
