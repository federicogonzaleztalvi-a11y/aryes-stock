import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const calcPrecio = (base, desc) => Math.round(Number(base||0) * (1 - Number(desc||0) / 100));

// Fallback listas when Supabase hasn't loaded yet (mirrors DB seed)
const DEFAULT_LISTAS = [
  { id:'A', nombre:'Lista A - Mayorista', descuento:20, color:'#3b82f6', activa:true },
  { id:'B', nombre:'Lista B - HORECA',    descuento:10, color:'#8b5cf6', activa:true },
  { id:'C', nombre:'Lista C - Minorista', descuento: 0, color:'#f59e0b', activa:true },
];

function PreciosTab() {
  const {
    products: prods,
    priceListas, setPriceListas,
    priceListItems, setPriceListItems,
  } = useApp();

  const G = '#3a7d1e';
  const inp = {
    padding:'7px 10px', border:'1px solid #e5e7eb', borderRadius:6,
    fontSize:13, fontFamily:'inherit', width:'100%', boxSizing:'border-box',
  };

  // Use Supabase-backed listas, falling back to defaults while loading
  const listas = priceListas.length > 0 ? priceListas : DEFAULT_LISTAS;

  const [listaActiva, setListaActiva] = useState('A');
  const [busq,        setBusq]        = useState('');
  const [msg,         setMsg]         = useState('');
  const [editDesc,    setEditDesc]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const lista = listas.find(l => l.id === listaActiva) || listas[0];

  // Build a Map of productUuid → precio for the active list (fast lookup)
  const customMap = useMemo(() => {
    const m = new Map();
    priceListItems
      .filter(it => it.listaId === listaActiva)
      .forEach(it => m.set(it.productUuid, it.precio));
    return m;
  }, [priceListItems, listaActiva]);

  const filtered = prods.filter(p => {
    const n = (p.nombre || p.name || '').toLowerCase();
    return !busq || n.includes(busq.toLowerCase());
  });

  // ── Save global discount for a list ──────────────────────────────────────
  const guardarDescuento = async (listaId, nuevo) => {
    const nuevoNum = Number(nuevo);
    setSaving(true);
    // Optimistic update
    setPriceListas(ls => ls.map(l => l.id === listaId ? { ...l, descuento: nuevoNum } : l));
    setEditDesc(false);
    setMsg('Lista actualizada');
    setTimeout(() => setMsg(''), 2500);

    db.upsert('price_lists', {
      id: listaId,
      nombre: lista.nombre,
      descuento: nuevoNum,
      color: lista.color,
      activa: lista.activa !== false,
    }, 'id')
      .catch(e => console.warn('[PreciosTab] upsert price_lists failed:', e?.message || e))
      .finally(() => setSaving(false));
  };

  // ── Save / clear a per-product custom price ───────────────────────────────
  const setPrecioCustom = async (prodId, listaId, rawPrecio) => {
    const precio = Number(rawPrecio) || 0;

    // Optimistic update of priceListItems
    const existing = priceListItems.find(it => it.listaId === listaId && it.productUuid === prodId);
    if (precio === 0 && existing) {
      // Remove
      setPriceListItems(items => items.filter(it => !(it.listaId === listaId && it.productUuid === prodId)));
      db.del('price_list_items', { lista_id: listaId, product_uuid: prodId })
        .catch(e => console.warn('[PreciosTab] del price_list_items failed:', e?.message || e));
    } else if (precio > 0) {
      // Upsert
      const newItem = { id: existing?.id || crypto.randomUUID(), listaId, productUuid: prodId, precio, updatedAt: new Date().toISOString() };
      setPriceListItems(items =>
        existing
          ? items.map(it => it.id === existing.id ? newItem : it)
          : [...items, newItem]
      );
      db.upsert('price_list_items', {
        id: newItem.id, lista_id: listaId, product_uuid: prodId,
        precio, updated_at: newItem.updatedAt,
      }, 'id')
        .catch(e => console.warn('[PreciosTab] upsert price_list_items failed:', e?.message || e));
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportarLista = () => {
    const rows = [
      ['Producto', 'Precio Venta', `Descuento ${lista.descuento}%`, 'Precio Final', 'Precio Custom'],
      ...filtered.map(p => {
        const base   = Number(p.precioVenta || p.precio || p.price || 0);
        const custom = customMap.get(p.id);
        const final  = custom && custom > 0 ? custom : calcPrecio(base, lista.descuento);
        return [
          p.nombre || p.name || '',
          '$' + base,
          lista.descuento + '%',
          '$' + final,
          custom && custom > 0 ? '$' + custom : 'Auto',
        ];
      }),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `lista-${listaActiva}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={{ padding:'28px 36px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:28, color:'#1a1a1a', margin:0 }}>
            Listas de Precios
          </h2>
          <p style={{ fontSize:12, color:'#888', margin:'4px 0 0' }}>
            Precios diferenciados por tipo de cliente — sincronizados entre dispositivos
          </p>
        </div>
        <button onClick={exportarLista}
          style={{ padding:'8px 16px', background:G, color:'#fff', border:'none',
                   borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
          Exportar CSV
        </button>
      </div>

      {/* Status message */}
      {msg && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
                      padding:'8px 14px', marginBottom:12, color:G, fontSize:12, fontWeight:600 }}>
          {msg}
        </div>
      )}

      {/* List selector tabs */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {listas.filter(l => l.activa !== false).map(l => (
          <button key={l.id}
            onClick={() => { setListaActiva(l.id); setEditDesc(false); }}
            style={{
              padding:'10px 20px', borderRadius:10,
              border:`2px solid ${listaActiva === l.id ? l.color : '#e5e7eb'}`,
              background: listaActiva === l.id ? l.color + '18' : '#fff',
              color: listaActiva === l.id ? l.color : '#666',
              fontWeight:700, fontSize:13, cursor:'pointer',
            }}>
            {l.nombre}
            <span style={{ marginLeft:8, fontSize:11, opacity:.8 }}>-{l.descuento}%</span>
          </button>
        ))}
      </div>

      {/* Active list config bar */}
      {lista && (
        <div style={{ background:'#fff', borderRadius:12, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)',
                      marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{lista.nombre}</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
              Descuento base sobre precio venta: <strong>{lista.descuento}%</strong>
            </div>
          </div>
          {editDesc ? (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" id="newDisc" defaultValue={lista.descuento}
                min="0" max="100" style={{ ...inp, width:70 }} />
              <button
                onClick={() => guardarDescuento(listaActiva, document.getElementById('newDisc').value)}
                disabled={saving}
                style={{ padding:'7px 14px', background:G, color:'#fff', border:'none',
                         borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Guardar
              </button>
              <button onClick={() => setEditDesc(false)}
                style={{ padding:'7px 12px', background:'#fff', border:'1px solid #e5e7eb',
                         borderRadius:6, cursor:'pointer', fontSize:13 }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setEditDesc(true)}
              style={{ padding:'7px 14px', background:'#fff', border:'1px solid #e5e7eb',
                       borderRadius:8, cursor:'pointer', fontSize:13 }}>
              Editar descuento
            </button>
          )}
        </div>
      )}

      {/* Product search */}
      <input value={busq} onChange={e => setBusq(e.target.value)}
        placeholder="Buscar producto..." style={{ ...inp, marginBottom:12 }} />

      {/* Product table */}
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
              {['Producto', 'Precio base', 'Desc.', 'Precio final', 'Precio custom', ''].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600,
                                     color:'#6b7280', fontSize:11, textTransform:'uppercase',
                                     letterSpacing:.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((p, i) => {
              const base   = Number(p.precioVenta || p.precio || p.price || 0);
              const custom = customMap.get(p.id);
              const hasCustom = custom && custom > 0;
              const final  = hasCustom ? custom : calcPrecio(base, lista?.descuento ?? 0);
              return (
                <tr key={p.id}
                  style={{ borderBottom:'1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding:'9px 14px', fontWeight:500 }}>{p.nombre || p.name}</td>
                  <td style={{ padding:'9px 14px', color:'#6b7280' }}>
                    ${base.toLocaleString('es-UY')}
                  </td>
                  <td style={{ padding:'9px 14px', color: lista?.color, fontWeight:600 }}>
                    -{lista?.descuento ?? 0}%
                  </td>
                  <td style={{ padding:'9px 14px', fontWeight:700, color: hasCustom ? lista?.color : G }}>
                    ${final.toLocaleString('es-UY')}
                    {hasCustom && <span style={{ fontSize:10, color: lista?.color, marginLeft:4 }}>custom</span>}
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <input type="number"
                      placeholder={`Auto: $${calcPrecio(base, lista?.descuento ?? 0)}`}
                      value={hasCustom ? custom : ''}
                      onChange={e => setPrecioCustom(p.id, listaActiva, e.target.value || 0)}
                      style={{ ...inp, width:110, fontSize:12 }} />
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    {hasCustom && (
                      <button onClick={() => setPrecioCustom(p.id, listaActiva, 0)}
                        style={{ padding:'3px 8px', background:'#fff', border:'1px solid #fecaca',
                                 borderRadius:4, cursor:'pointer', fontSize:10, color:'#dc2626' }}>
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding:24, textAlign:'center', color:'#888', fontSize:13 }}>
            Sin productos para mostrar
          </div>
        )}
        {filtered.length > 50 && (
          <div style={{ padding:'8px 14px', textAlign:'center', color:'#888', fontSize:12,
                        borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
            Mostrando 50 de {filtered.length} productos — usá el buscador para filtrar
          </div>
        )}
      </div>
    </section>
  );
}

export default PreciosTab;
