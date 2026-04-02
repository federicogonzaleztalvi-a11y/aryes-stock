import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db, SB_URL, SKEY, getOrgId, fmt} from '../lib/constants.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const round2  = n => Math.round(Number(n) * 100) / 100;
const margen  = (costo, venta) => costo > 0 && venta > 0 ? ((venta - costo) / costo * 100).toFixed(1) : '—';
const calcDes = (base, desc) => Math.round(Number(base || 0) * (1 - Number(desc || 0) / 100));

const DEFAULT_LISTAS = [
  { id: 'A', nombre: 'Lista A - Mayorista', descuento: 20, color: '#3b82f6', activa: true },
  { id: 'B', nombre: 'Lista B - HORECA',    descuento: 10, color: '#8b5cf6', activa: true },
  { id: 'C', nombre: 'Lista C - Minorista', descuento: 0,  color: '#f59e0b', activa: true },
];

const G   = '#1a8a3c';
const inp = { padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };

// ── Vista: Precios base (precio_venta por producto) ────────────────────────
function VistaBase({ prods, setProducts }) {
  const [busq,       setBusq]       = useState('');
  const [catFiltro,  setCatFiltro]  = useState('Todos');
  const [margenGlobal, setMargenGlobal] = useState('');
  const [edits,      setEdits]      = useState({}); // { prodId: newPrecio }
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState('');
  const [paginaActual, setPaginaActual] = useState(0);
  const POR_PAG = 50;

  const cats = useMemo(() => ['Todos', ...new Set(prods.map(p => p.category || 'General'))].sort(), [prods]);

  const filtered = useMemo(() => prods.filter(p => {
    const n = (p.name || '').toLowerCase();
    const matchQ = !busq || n.includes(busq.toLowerCase());
    const matchC = catFiltro === 'Todos' || (p.category || 'General') === catFiltro;
    return matchQ && matchC;
  }), [prods, busq, catFiltro]);

  const pagina = filtered.slice(paginaActual * POR_PAG, (paginaActual + 1) * POR_PAG);
  const totalPags = Math.ceil(filtered.length / POR_PAG);

  // Cambio individual
  const setEdit = (id, val) => {
    setEdits(prev => ({ ...prev, [id]: val }));
  };

  // Aplicar margen global sobre unitCost de todos los productos filtrados
  const aplicarMargen = () => {
    const pct = parseFloat(margenGlobal);
    if (isNaN(pct) || pct < 0 || pct > 500) {
      setMsg('❌ Margen inválido — ingresá un número entre 0 y 500');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    const newEdits = { ...edits };
    filtered.forEach(p => {
      if (p.unitCost > 0) {
        newEdits[p.id] = round2(p.unitCost * (1 + pct / 100));
      }
    });
    setEdits(newEdits);
    setMsg(`✓ Margen ${pct}% aplicado a ${Object.keys(newEdits).length} productos — revisá y guardá`);
    setTimeout(() => setMsg(''), 5000);
  };

  // Guardar todos los cambios en batch
  const guardar = async () => {
    const cambios = Object.entries(edits).filter(([, v]) => v !== '' && !isNaN(Number(v)));
    if (!cambios.length) { setMsg('Sin cambios para guardar'); setTimeout(() => setMsg(''), 2000); return; }

    setSaving(true);
    setMsg(`Guardando ${cambios.length} precios...`);

    // Batch PATCH en grupos de 50
    const orgId = getOrgId();
    let ok = 0; let err = 0;

    for (const [prodId, rawPrecio] of cambios) {
      const precio = round2(Number(rawPrecio));
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/products?uuid=eq.${encodeURIComponent(prodId)}&org_id=eq.${encodeURIComponent(orgId)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SKEY,
              Authorization: `Bearer ${(JSON.parse(localStorage.getItem('aryes-session') || 'null'))?.access_token || SKEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ precio_venta: precio }),
          }
        );
        if (r.ok) {
          ok++;
          // Actualizar AppContext optimistamente
          setProducts(ps => ps.map(p => p.id === prodId ? { ...p, precioVenta: precio } : p));
        } else {
          err++;
        }
      } catch { err++; }
    }

    setEdits({});
    setSaving(false);
    setMsg(`✅ ${ok} precios actualizados${err > 0 ? ` · ${err} errores` : ''}`);
    setTimeout(() => setMsg(''), 5000);
  };

  const pendientes = Object.keys(edits).filter(k => edits[k] !== '').length;

  return (
    <div>
      {/* Barra de herramientas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Buscar</div>
          <input value={busq} onChange={e => { setBusq(e.target.value); setPaginaActual(0); }}
            placeholder="Nombre de producto..." style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Categoría</div>
          <select value={catFiltro} onChange={e => { setCatFiltro(e.target.value); setPaginaActual(0); }}
            style={{ ...inp, background: '#fff' }}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Aplicar margen global */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: G, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Margen sobre costo (%)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number" min="0" max="500" step="0.5"
                value={margenGlobal}
                onChange={e => setMargenGlobal(e.target.value)}
                placeholder="ej: 40"
                style={{ ...inp, width: 80 }}
              />
              <button onClick={aplicarMargen}
                style={{ padding: '6px 14px', background: G, color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Aplicar a {catFiltro === 'Todos' ? 'todos' : catFiltro}
              </button>
            </div>
          </div>
        </div>

        {/* Guardar cambios */}
        <button onClick={guardar} disabled={saving || pendientes === 0}
          style={{ padding: '9px 20px', background: pendientes > 0 ? G : '#e5e7eb',
            color: pendientes > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8,
            cursor: pendientes > 0 ? 'pointer' : 'default', fontWeight: 700, fontSize: 13,
            whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
          {saving ? 'Guardando...' : pendientes > 0 ? `💾 Guardar ${pendientes} cambios` : 'Sin cambios'}
        </button>
      </div>

      {/* Mensaje de estado */}
      {msg && (
        <div style={{ padding: '9px 14px', background: msg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${msg.startsWith('❌') ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 8, fontSize: 13, color: msg.startsWith('❌') ? '#dc2626' : G,
          marginBottom: 12, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['Producto', 'Categoría', 'Costo', 'Margen actual', 'Precio venta', 'Nuevo precio'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                  color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagina.map((p, i) => {
              const costo  = Number(p.unitCost)    || 0;
              const actual = Number(p.precioVenta) || 0;
              const nuevo  = edits[p.id];
              const precioMostrar = nuevo !== undefined ? Number(nuevo) : actual;
              const hasEdit = nuevo !== undefined && nuevo !== '';
              const margenActual = margen(costo, actual);
              const margenNuevo  = nuevo !== undefined && nuevo !== '' ? margen(costo, Number(nuevo)) : null;

              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6',
                  background: hasEdit ? '#fffbeb' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 500, maxWidth: 260 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    {p.brand && <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.brand}</div>}
                  </td>
                  <td style={{ padding: '8px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {p.category || 'General'}
                  </td>
                  <td style={{ padding: '8px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {costo > 0 ? fmt.currencyCompact(costo) : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: margenActual === '—' ? '#d1d5db' : G, fontWeight: 600 }}>
                      {margenActual === '—' ? '—' : `+${margenActual}%`}
                    </span>
                    {margenNuevo && margenNuevo !== margenActual && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#f59e0b' }}>
                        → {margenNuevo}%
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: G, whiteSpace: 'nowrap' }}>
                    {actual > 0 ? fmt.currencyCompact(actual) : <span style={{ color: '#fbbf24', fontWeight: 600 }}>Sin precio</span>}
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={actual > 0 ? fmt.currencyCompact(actual) : 'Ingresar precio'}
                      value={nuevo !== undefined ? nuevo : ''}
                      onChange={e => setEdit(p.id, e.target.value)}
                      style={{
                        ...inp,
                        width: 120,
                        borderColor: hasEdit ? '#fbbf24' : '#e5e7eb',
                        background: hasEdit ? '#fffbeb' : '#fff',
                        fontWeight: hasEdit ? 700 : 400,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Sin productos para mostrar
          </div>
        )}

        {/* Paginación */}
        {totalPags > 1 && (
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {filtered.length} productos · página {paginaActual + 1} de {totalPags}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPaginaActual(p => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
                style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
                  background: '#fff', cursor: paginaActual === 0 ? 'default' : 'pointer',
                  fontSize: 13, color: paginaActual === 0 ? '#d1d5db' : '#374151' }}>
                ← Anterior
              </button>
              <button onClick={() => setPaginaActual(p => Math.min(totalPags - 1, p + 1))}
                disabled={paginaActual === totalPags - 1}
                style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
                  background: '#fff', cursor: paginaActual === totalPags - 1 ? 'default' : 'pointer',
                  fontSize: 13, color: paginaActual === totalPags - 1 ? '#d1d5db' : '#374151' }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vista: Listas de precios (descuentos por lista) ────────────────────────
function VistaListas({ prods, priceListas, setPriceListas, priceListItems, setPriceListItems }) {
  const listas = priceListas.length > 0 ? priceListas : DEFAULT_LISTAS;

  const [listaActiva, setListaActiva] = useState(listas[0]?.id || 'A');
  const [busq,        setBusq]        = useState('');
  const [msg,         setMsg]         = useState('');
  const [editDesc,    setEditDesc]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const lista = listas.find(l => l.id === listaActiva) || listas[0];

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

  const guardarDescuento = async (listaId, nuevo) => {
    const nuevoNum = Number(nuevo);
    setSaving(true);
    setPriceListas(ls => ls.map(l => l.id === listaId ? { ...l, descuento: nuevoNum } : l));
    setEditDesc(false);
    setMsg('Lista actualizada');
    setTimeout(() => setMsg(''), 2500);
    db.upsert('price_lists', { id: listaId, nombre: lista.nombre, descuento: nuevoNum, color: lista.color, activa: lista.activa !== false }, 'id')
      .catch(e => console.warn('[PreciosTab] upsert failed:', e?.message))
      .finally(() => setSaving(false));
  };

  const setPrecioCustom = async (prodId, listaId, rawPrecio) => {
    const precio = Number(rawPrecio) || 0;
    const existing = priceListItems.find(it => it.listaId === listaId && it.productUuid === prodId);
    if (precio === 0 && existing) {
      setPriceListItems(items => items.filter(it => !(it.listaId === listaId && it.productUuid === prodId)));
      db.del('price_list_items', { lista_id: listaId, product_uuid: prodId }).catch(() => {});
    } else if (precio > 0) {
      const newItem = { id: existing?.id || crypto.randomUUID(), listaId, productUuid: prodId, precio, updatedAt: new Date().toISOString() };
      setPriceListItems(items => existing ? items.map(it => it.id === existing.id ? newItem : it) : [...items, newItem]);
      db.upsert('price_list_items', { id: newItem.id, lista_id: listaId, product_uuid: prodId, precio, updated_at: newItem.updatedAt }, 'id').catch(() => {});
    }
  };

  const exportarLista = () => {
    const rows = [
      ['Producto', 'Precio Base', `Desc ${lista.descuento}%`, 'Precio Final', 'Precio Custom'],
      ...filtered.map(p => {
        const base   = Number(p.precioVenta || 0);
        const custom = customMap.get(p.id);
        const final  = custom && custom > 0 ? custom : calcDes(base, lista.descuento);
        return [p.name || '', '$' + base, lista.descuento + '%', '$' + final, custom && custom > 0 ? '$' + custom : 'Auto'];
      }),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lista-${listaActiva}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {listas.filter(l => l.activa !== false).map(l => (
            <button key={l.id} onClick={() => { setListaActiva(l.id); setEditDesc(false); }}
              style={{ padding: '10px 20px', borderRadius: 10,
                border: `2px solid ${listaActiva === l.id ? l.color : '#e5e7eb'}`,
                background: listaActiva === l.id ? l.color + '18' : '#fff',
                color: listaActiva === l.id ? l.color : '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {l.nombre}<span style={{ marginLeft: 8, fontSize: 11, opacity: .8 }}>-{l.descuento}%</span>
            </button>
          ))}
        </div>
        <button onClick={exportarLista}
          style={{ padding: '8px 16px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          Exportar CSV
        </button>
      </div>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: G, fontSize: 12, fontWeight: 600 }}>{msg}</div>}

      {lista && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{lista.nombre}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Descuento base: <strong>{lista.descuento}%</strong></div>
          </div>
          {editDesc ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" id="newDisc" defaultValue={lista.descuento} min="0" max="100" style={{ ...inp, width: 70 }} />
              <button onClick={() => guardarDescuento(listaActiva, document.getElementById('newDisc').value)} disabled={saving}
                style={{ padding: '7px 14px', background: G, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Guardar</button>
              <button onClick={() => setEditDesc(false)}
                style={{ padding: '7px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setEditDesc(true)}
              style={{ padding: '7px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              Editar descuento %
            </button>
          )}
        </div>
      )}

      <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar producto..." style={{ ...inp, width: '100%', marginBottom: 12 }} />

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['Producto', 'Precio base', 'Desc.', 'Precio final', 'Precio custom', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((p, i) => {
              const base = Number(p.precioVenta || 0);
              const custom = customMap.get(p.id);
              const hasCustom = custom && custom > 0;
              const final = hasCustom ? custom : calcDes(base, lista?.descuento ?? 0);
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '9px 14px', color: '#6b7280' }}>{fmt.currencyCompact(base)}</td>
                  <td style={{ padding: '9px 14px', color: lista?.color, fontWeight: 600 }}>-{lista?.descuento ?? 0}%</td>
                  <td style={{ padding: '9px 14px', fontWeight: 700, color: hasCustom ? lista?.color : G }}>
                    {fmt.currencyCompact(final)}{hasCustom && <span style={{ fontSize: 10, color: lista?.color, marginLeft: 4 }}>custom</span>}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <input type="number" placeholder={`Auto: ${fmt.currencyCompact(calcDes(base, lista?.descuento ?? 0))}`}
                      value={hasCustom ? custom : ''}
                      onChange={e => setPrecioCustom(p.id, listaActiva, e.target.value || 0)}
                      style={{ ...inp, width: 110, fontSize: 12 }} />
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {hasCustom && <button onClick={() => setPrecioCustom(p.id, listaActiva, 0)}
                      style={{ padding: '3px 8px', background: '#fff', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#dc2626' }}>Reset</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin productos</div>}
        {filtered.length > 100 && <div style={{ padding: '8px 14px', textAlign: 'center', color: '#888', fontSize: 12, borderTop: '1px solid #f3f4f6' }}>Mostrando 100 de {filtered.length} — usá el buscador</div>}
      </div>
    </div>
  );
}

// ── PreciosTab principal ───────────────────────────────────────────────────
function PreciosTab() {
  const { products, setProducts, priceListas, setPriceListas, priceListItems, setPriceListItems } = useApp();
  const [vista, setVista] = useState('base'); // 'base' | 'listas'

  const tabStyle = (active) => ({
    padding: '9px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: active ? G : '#fff',
    color: active ? '#fff' : '#6b7280',
    borderBottom: active ? `3px solid ${G}` : '3px solid transparent',
    transition: 'all .15s',
  });

  return (
    <section style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, color: '#1a1a1a', margin: 0 }}>
            Gestión de Precios
          </h2>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            Precio venta base · Listas con descuentos por tipo de cliente
          </p>
        </div>
      </div>

      {/* Tabs de vista */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        <button style={tabStyle(vista === 'base')}   onClick={() => setVista('base')}>
          💲 Precios venta base
        </button>
        <button style={tabStyle(vista === 'listas')} onClick={() => setVista('listas')}>
          📋 Listas de precios
        </button>
      </div>

      {vista === 'base' && (
        <VistaBase prods={products} setProducts={setProducts} />
      )}
      {vista === 'listas' && (
        <VistaListas
          prods={products}
          priceListas={priceListas} setPriceListas={setPriceListas}
          priceListItems={priceListItems} setPriceListItems={setPriceListItems}
        />
      )}
    </section>
  );
}

export default PreciosTab;
