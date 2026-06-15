import BackButton from '../components/BackButton.jsx';
import ImportadorPrecios from './ImportadorPrecios.jsx';
import { fmt , getOrgId, getAuthHeaders } from '../lib/constants.js';
// src/tabs/PreciosListasTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';

const G = '#059669';
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SKEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

function H(extra = {}) { return getAuthHeaders({ Accept: 'application/json', ...extra }); }
async function sb(path, opts = {}) {
  const { headers: _h, ...rest } = opts;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...rest, headers: H(_h || {}) });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  if (opts.method === 'DELETE' || opts.method === 'PATCH' || r.status === 204) return null;
  return r.json();
}
function calcFinal(base, dg, item, dtoCat) {
  // Jerarquía: precio fijo producto > dto producto > dto categoría > dto global > base
  if (item && item.precio > 0) return item.precio;
  if (item && (item.descuento || 0) > 0) return Math.round(base * (1 - item.descuento / 100) * 100) / 100;
  if (dtoCat > 0) return Math.round(base * (1 - dtoCat / 100) * 100) / 100;
  if (dg > 0) return Math.round(base * (1 - dg / 100) * 100) / 100;
  return base;
}

function EditorPrecios({ lista, onBack, onListaUpdated, listas }) {
  const { products, clientes, setClientes} = useApp();
  const [items, setItems] = useState([]);
  const [busq, setBusq] = useState('');
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');
  const [dtoGlobal, setDtoGlobal] = useState(String(lista.descuento || 0));
  const [soloSpec, setSoloSpec] = useState(false);
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [copiarUuid, setCopiarUuid] = useState(null);
  const [copiarSel, setCopiarSel] = useState({});
  const [dtosCat, setDtosCat] = useState(lista.descuentos_categoria || {});
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  useEffect(() => { sb(`price_list_items?lista_id=eq.${lista.id}`).then(d => setItems(d || [])).catch(() => {}); }, [lista.id]);
  const saveGlobal = async val => {
    const v = parseFloat(val); if (isNaN(v) || v < 0 || v > 100) return;
    await sb(`price_lists?id=eq.${lista.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ descuento: v }) });
    onListaUpdated({ ...lista, descuento: v }); flash('✅ Descuento global guardado');
  };
  const saveDtoCat = async (categoria, valStr) => {
    const v = parseFloat(valStr);
    const nuevos = { ...dtosCat };
    if (valStr === '' || isNaN(v) || v <= 0) { delete nuevos[categoria]; }
    else if (v > 100) { return; }
    else { nuevos[categoria] = v; }
    setDtosCat(nuevos);
    try {
      await sb(`price_lists?id=eq.${lista.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ descuentos_categoria: nuevos }) });
      onListaUpdated({ ...lista, descuentos_categoria: nuevos });
      flash('✅ Descuento de categoría guardado');
    } catch (e) { flash('❌ ' + e.message); }
  };
  const saveItem = async (uuid, tipo, valStr) => {
    const val = parseFloat(valStr); setSaving(s => ({ ...s, [uuid]: true }));
    try {
      const ex = items.find(it => it.product_uuid === uuid);
      const empty = valStr === '' || isNaN(val) || val === 0;
      if (empty) { if (ex) { await sb(`price_list_items?id=eq.${ex.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== ex.id)); } }
      else {
        const patch = tipo === 'precio' ? { precio: val, descuento: 0 } : { descuento: val, precio: 0 };
        if (ex) { const u = await sb(`price_list_items?id=eq.${ex.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch) }); setItems(prev => prev.map(it => it.id === ex.id ? (u?.[0] || { ...it, ...patch }) : it)); }
        else { const n = await sb('price_list_items', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ lista_id: lista.id, org_id: getOrgId(), product_uuid: uuid, precio: tipo === 'precio' ? val : 0, descuento: tipo === 'descuento' ? val : 0 }) }); setItems(prev => [...prev, n?.[0] || {}]); }
      }
    } catch (e) { flash('❌ ' + e.message); }
    setSaving(s => ({ ...s, [uuid]: false }));
  };
  const clearItem = async uuid => { const ex = items.find(it => it.product_uuid === uuid); if (!ex) return; await sb(`price_list_items?id=eq.${ex.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== ex.id)); };
  const copiarAListas = async (uuid, destinos) => {
    const ex = items.find(it => it.product_uuid === uuid);
    if (!ex) { flash('❌ El producto no tiene precio en esta lista'); return; }
    setSaving(s => ({ ...s, [uuid]: true }));
    let ok = 0;
    let errores = 0;
    for (const destId of destinos) {
      try {
        // borrar fila previa del producto en la lista destino (si existe), luego insertar limpia
        await sb(`price_list_items?lista_id=eq.${destId}&product_uuid=eq.${uuid}`, { method: 'DELETE' });
        await sb('price_list_items', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ lista_id: destId, org_id: getOrgId(), product_uuid: uuid, precio: ex.precio || 0, descuento: ex.descuento || 0 }) });
        ok++;
      } catch (e) { errores++; console.error('[copiarAListas] fallo en lista', destId, e.message); }
    }
    flash(errores > 0 ? `⚠️ Copiado a ${ok} de ${destinos.length} listas (${errores} con error)` : `✅ Precio copiado a ${ok} lista${ok !== 1 ? 's' : ''}`);
    setSaving(s => ({ ...s, [uuid]: false }));
    setCopiarUuid(null); setCopiarSel({});
  };
  const dg = parseFloat(dtoGlobal) || 0;
  const overrides = items.filter(it => it.precio > 0 || (it.descuento || 0) > 0).length;
  const tieneItem = p => { const it = items.find(i => i.product_uuid === (p.uuid || p.id)); return !!(it && (it.precio > 0 || (it.descuento || 0) > 0)); };
  // "Sin precio en lista" = sin precio fijo/dto propio Y la lista no tiene dto global ni de categoría
  // que lo cubra → en el portal cae al precio base, que puede no ser confiable. Hay que revisarlos.
  const sinPrecio = p => { if (tieneItem(p)) return false; const cat = p.category || p.categoria || ''; const dtoCat = Number(dtosCat[cat] || 0); return dg <= 0 && dtoCat <= 0; };
  const sinPrecioCount = (products || []).filter(sinPrecio).length;
  const prods = (products || []).filter(p => { const nm = (p.name || p.nombre || '').toLowerCase(); if (busq && !nm.includes(busq.toLowerCase())) return false; if (soloSpec && !tieneItem(p)) return false; if (soloSinPrecio && !sinPrecio(p)) return false; return true; });
  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <BackButton onBack={onBack} parent="Listas de precios" current={lista?.nombre || ''} />
        <div style={{ flex: 1 }}><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lista.nombre}</h2><p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{overrides > 0 ? `${overrides} producto${overrides !== 1 ? 's' : ''} con precio especial` : 'Sin overrides — aplica el descuento global'}</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', padding: '8px 14px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Dto. global:</span>
          <input type="number" min={0} max={100} step="0.5" value={dtoGlobal} onChange={e => setDtoGlobal(e.target.value)} onBlur={e => saveGlobal(e.target.value)} style={{ width: 60, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, textAlign: 'center', fontWeight: 700 }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>%</span>
        </div>
      </div>
      {msg && <div style={{ background: msg.startsWith('❌') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.startsWith('❌') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: msg.startsWith('❌') ? '#dc2626' : G, fontWeight: 600 }}>{msg}</div>}
      {sinPrecioCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>{sinPrecioCount} producto{sinPrecioCount !== 1 ? 's' : ''} sin precio en esta lista</div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>En el portal usan el precio base (que puede no ser confiable). Revisalos y ponéles un precio fijo, o un descuento global/por categoría.</div>
          </div>
          <button onClick={() => setSoloSinPrecio(v => !v)} style={{ padding: '8px 16px', background: soloSinPrecio ? '#9a3412' : '#fff', color: soloSinPrecio ? '#fff' : '#9a3412', border: '1.5px solid #9a3412', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{soloSinPrecio ? 'Ver todos' : 'Revisar estos'}</button>
        </div>
      )}
      {(() => {
        const catsDisponibles = [...new Set((products || []).map(p => p.category || p.categoria).filter(Boolean))].sort();
        if (catsDisponibles.length === 0) return null;
        return (
          <div style={{ background: '#fff', border: '1px solid #f0f0ec', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Descuentos por categoría</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Se aplica a todos los productos de la categoría. Tiene prioridad sobre el descuento global, pero un precio fijo o descuento por producto lo pisa.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {catsDisponibles.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, background: (dtosCat[cat] || 0) > 0 ? '#f0fdf4' : '#f9fafb', border: `1px solid ${(dtosCat[cat] || 0) > 0 ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 9, padding: '6px 10px' }}>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{cat}</span>
                  <input type="number" min={0} max={100} step="0.5" defaultValue={(dtosCat[cat] || 0) > 0 ? dtosCat[cat] : ''} placeholder="0" onBlur={e => saveDtoCat(cat, e.target.value)} style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center', fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 320, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 13, outline: 'none' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}><input type="checkbox" checked={soloSpec} onChange={e => setSoloSpec(e.target.checked)} />Solo con precio especial</label>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{prods.length} de {(products || []).length}</span>
      </div>
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>💡 <strong>Precio fijo</strong> = precio exacto. <strong>Dto. %</strong> = descuento individual sobre precio base. El precio fijo tiene prioridad.</div>
      {copiarUuid && (() => {
        const prodCopiar = (products || []).find(p => (p.uuid || p.id) === copiarUuid);
        const otras = (listas || []).filter(l => l.id !== lista.id);
        const seleccionadas = Object.keys(copiarSel).filter(k => copiarSel[k]);
        return (
          <div onClick={() => setCopiarUuid(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 380, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Copiar precio a otras listas</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{prodCopiar?.name || prodCopiar?.nombre || 'Producto'} — se copiará el precio de <strong>{lista.nombre}</strong></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {otras.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>No hay otras listas a las que copiar.</div>}
                {otras.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1.5px solid ${copiarSel[l.id] ? G : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', background: copiarSel[l.id] ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={!!copiarSel[l.id]} onChange={e => setCopiarSel(s => ({ ...s, [l.id]: e.target.checked }))} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{l.nombre}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setCopiarUuid(null)} style={{ padding: '9px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
                <button disabled={seleccionadas.length === 0 || saving[copiarUuid]} onClick={() => copiarAListas(copiarUuid, seleccionadas)} style={{ padding: '9px 18px', background: seleccionadas.length === 0 ? '#d1d5db' : G, color: '#fff', border: 'none', borderRadius: 8, cursor: seleccionadas.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>{saving[copiarUuid] ? '...' : `Copiar a ${seleccionadas.length || ''} lista${seleccionadas.length !== 1 ? 's' : ''}`}</button>
              </div>
            </div>
          </div>
        );
      })()}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Producto</th>
            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Precio base</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: .5, minWidth: 110 }}>Precio fijo</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: .5, minWidth: 100 }}>Dto. %</th>
            <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: G, textTransform: 'uppercase', letterSpacing: .5 }}>Precio final</th>
            <th style={{ padding: '10px 12px', width: 40 }}></th>
          </tr></thead>
          <tbody>
            {prods.slice(0, 300).map((p, i) => {
              const uuid = p.uuid || p.id, base = Number(p.precio_venta || p.precioVenta || 0);
              const item = items.find(it => it.product_uuid === uuid);
              const tieneOverride = item && (item.precio > 0 || (item.descuento || 0) > 0);
              const catProd = p.category || p.categoria || '';
              const dtoCatProd = Number(dtosCat[catProd] || 0);
              const final = calcFinal(base, dg, item, dtoCatProd);
              const ahorro = base > 0 && final < base ? Math.round((1 - final / base) * 100) : 0;
              const rowBg = item?.precio > 0 ? '#fffdf0' : (item?.descuento || 0) > 0 ? '#fdf8ff' : 'transparent';
              return (<tr key={uuid} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: rowBg, opacity: saving[uuid] ? 0.6 : 1 }}>
                <td style={{ padding: '8px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{p.name || p.nombre}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{p.category || p.categoria} · {p.unit || p.unidad}</div></td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{base > 0 ? fmt.currency(base) : <span style={{ color: '#e5e7eb' }}>—</span>}</td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}><input key={`pf-${uuid}-${item?.id}`} type="number" min={0} step="0.01" placeholder={base > 0 ? base.toFixed(2) : '—'} defaultValue={item?.precio > 0 ? item.precio : ''} onBlur={e => saveItem(uuid, 'precio', e.target.value)} style={{ width: 90, padding: '5px 8px', border: `1.5px solid ${item?.precio > 0 ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, textAlign: 'right', background: item?.precio > 0 ? '#fffbeb' : '#fafafa' }} /></td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><input key={`dto-${uuid}-${item?.id}`} type="number" min={0} max={100} step="0.5" placeholder={dg > 0 ? String(dg) : '0'} defaultValue={(item?.descuento || 0) > 0 ? item.descuento : ''} onBlur={e => saveItem(uuid, 'descuento', e.target.value)} style={{ width: 58, padding: '5px 8px', border: `1.5px solid ${(item?.descuento || 0) > 0 ? '#c4b5fd' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, textAlign: 'center', background: (item?.descuento || 0) > 0 ? '#faf5ff' : '#fafafa' }} /><span style={{ fontSize: 11, color: '#9ca3af' }}>%</span></div></td>
                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{base > 0 ? (<div><span style={{ fontSize: 14, fontWeight: 800, color: tieneOverride ? (item?.precio > 0 ? '#d97706' : '#7c3aed') : (dg > 0 ? G : '#374151') }}>{fmt.currency(final)}</span>{ahorro > 0 && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 6 }}>-{ahorro}%</span>}</div>) : <span style={{ color: '#e5e7eb', fontSize: 12 }}>sin precio</span>}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{tieneOverride && (listas || []).length > 1 && <button title="Copiar precio a otras listas" onClick={() => { setCopiarUuid(uuid); setCopiarSel({}); }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>⧉</button>}{tieneOverride && <button title="Quitar de esta lista" onClick={() => clearItem(uuid)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>}</td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PreciosListasTab() {
  const { clientes, setClientes, products } = useApp();
  const [listas, setListas] = useState([]);
  const [listItems, setListItems] = useState({});
  const [cliMap, setCliMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [vistaEditar, setVistaEditar] = useState(null);
  const [vistaImportar, setVistaImportar] = useState(false);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fNombre, setFNombre] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDto, setFDto] = useState('0');
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sb(`price_lists?org_id=eq.${getOrgId()}&order=creado_en.desc`);
      setListas(data || []);
      const im = {}, cm = {};
      for (const l of (data || [])) { im[l.id] = await sb(`price_list_items?lista_id=eq.${l.id}`).catch(() => []); cm[l.id] = await sb(`clients?lista_id=eq.${l.id}&select=id,name,phone`).catch(() => []); }
      setListItems(im); setCliMap(cm);
    } catch (e) { flash('❌ ' + e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  const crearLista = async () => {
    if (!fNombre.trim()) { flash('❌ Nombre requerido'); return; }
    setSaving(true);
    try {
      const n = await sb('price_lists', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ id: 'lista_' + Math.random().toString(36).slice(2, 10), org_id: getOrgId(), nombre: fNombre.trim(), descuento: Number(fDto) || 0, activa: true }) });
      const lista = n?.[0]; if (!lista) throw new Error('Sin respuesta');
      setListas(ls => [lista, ...ls]); setListItems(m => ({ ...m, [lista.id]: [] })); setCliMap(m => ({ ...m, [lista.id]: [] }));
      setFNombre(''); setFDesc(''); setFDto('0'); setShowForm(false); flash(`✅ Lista "${lista.nombre}" creada`);
    } catch (e) { flash('❌ ' + e.message); }
    setSaving(false);
  };
  const eliminarLista = async l => {
    if (!window.confirm(`¿Eliminar lista "${l.nombre}"?`)) return;
    try { await sb(`price_lists?id=eq.${l.id}`, { method: 'DELETE' }); setListas(ls => ls.filter(x => x.id !== l.id)); } catch (e) { flash('❌ ' + e.message); }
  };
  const asignarCliente = async (cid, lid) => {
    try { await sb(`clients?id=eq.${cid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ lista_id: lid || null }) }); setClientes(cs => cs.map(c => c.id === cid ? { ...c, lista_id: lid || null } : c)); await loadAll(); } catch (e) { flash('❌ ' + e.message); }
  };
  if (vistaEditar) return <EditorPrecios lista={vistaEditar} listas={listas} onBack={() => { setVistaEditar(null); loadAll(); }} onListaUpdated={u => { setListas(ls => ls.map(l => l.id === u.id ? u : l)); setVistaEditar(u); }} />;
  if (vistaImportar) return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => setVistaImportar(false)} style={{ marginBottom: 20, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
      <ImportadorPrecios products={products} listas={listas} onPreciosGuardados={() => { flash('✅ Precios actualizados'); setVistaImportar(false); loadAll(); }} />
    </div>
  );
  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Listas de precios</h2><p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Precios personalizados por cliente en el portal B2B.</p></div>
        <button onClick={() => setShowForm(true)} style={{ background: G, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Nueva lista</button>
        <button onClick={() => setVistaImportar(true)} style={{ background: '#fff', color: G, border: '2px solid ' + G, padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>📋 Importar precios</button>
      </div>
      {msg && <div style={{ background: msg.startsWith('❌') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.startsWith('❌') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: msg.startsWith('❌') ? '#dc2626' : G, fontWeight: 600 }}>{msg}</div>}
      {showForm && (
        <div style={{ background: '#f0fdf4', border: `1px solid ${G}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: G }}>Nueva lista de precios</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px auto auto', gap: 10, alignItems: 'end' }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Nombre *</label><input value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Mayoristas, VIP..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Descripción</label><input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Clientes &gt; 500/mes" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Dto. %</label><input type="number" min={0} max={100} value={fDto} onChange={e => setFDto(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, textAlign: 'center' }} /></div>
            <button onClick={crearLista} disabled={saving} style={{ padding: '9px 18px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? .7 : 1, whiteSpace: 'nowrap' }}>{saving ? '...' : 'Crear'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          </div>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando listas...</div> : listas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec' }}><div style={{ fontSize: 40, marginBottom: 12 }}>💰</div><div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Sin listas de precios</div><p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>Creá una lista para dar precios especiales a tus clientes en el portal B2B.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
          {listas.map(lista => {
            const its = listItems[lista.id] || [], cc = (cliMap[lista.id] || []).length, ov = its.filter(it => it.precio > 0 || (it.descuento || 0) > 0).length;
            return (
              <div key={lista.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec', boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{lista.nombre}</div>{lista.descripcion && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lista.descripcion}</div>}</div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: lista.descuento > 0 ? '#16a34a' : '#9ca3af' }}>{lista.descuento > 0 ? `-${lista.descuento}%` : '—'}</div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .4 }}>Dto. global</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: ov > 0 ? '#d97706' : '#9ca3af' }}>{ov}</div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .4 }}>Precios esp.</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: cc > 0 ? '#3b82f6' : '#9ca3af' }}>{cc}</div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .4 }}>Clientes</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setVistaEditar(lista)} style={{ padding: '8px 16px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Editar precios</button>
                    <button onClick={() => eliminarLista(lista)} style={{ padding: '8px 12px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Eliminar</button>
                  </div>
                </div>
                {cc > 0 && <div style={{ padding: '6px 20px 10px', borderTop: '1px solid #f9fafb', display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(cliMap[lista.id] || []).slice(0, 10).map(c => <span key={c.id} style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{c.name}</span>)}{cc > 10 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{cc - 10} más</span>}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Asignar lista a clientes</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>El cliente verá sus precios al entrar al portal B2B.</p>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f9fafb' }}><th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Cliente</th><th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Teléfono</th><th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Lista asignada</th></tr></thead>
            <tbody>
              {(clientes || []).slice(0, 150).map((c, i) => (
                <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{c.name || c.nombre}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12, color: '#6b7280' }}>{c.phone || c.telefono || '—'}</td>
                  <td style={{ padding: '9px 16px' }}>
                    <select value={c.lista_id || ''} onChange={e => asignarCliente(c.id, e.target.value || null)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: c.lista_id ? '#f0fdf4' : '#fff', color: c.lista_id ? G : '#6b7280', fontWeight: c.lista_id ? 700 : 400 }}>
                      <option value="">Sin lista (precio base)</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}{l.descuento > 0 ? ` (-${l.descuento}%)` : ''}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
