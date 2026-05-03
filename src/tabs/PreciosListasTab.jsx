import BackButton from '../components/BackButton.jsx';
import { fmt , getOrgId } from '../lib/constants.js';
// src/tabs/PreciosListasTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';

const G = '#059669';
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SKEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

function H(extra = {}) { return { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Accept: 'application/json', ...extra }; }
async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H(opts.headers || {}), ...opts });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  if (opts.method === 'DELETE') return null;
  return r.json();
}
function calcFinal(base, dg, item) {
  if (!item) return dg > 0 ? Math.round(base * (1 - dg / 100) * 100) / 100 : base;
  if (item.precio > 0) return item.precio;
  const dto = item.descuento || 0;
  if (dto > 0) return Math.round(base * (1 - dto / 100) * 100) / 100;
  return dg > 0 ? Math.round(base * (1 - dg / 100) * 100) / 100 : base;
}

function EditorPrecios({ lista, onBack, onListaUpdated }) {
  const { products, clientes, setClientes} = useApp();
  const [items, setItems] = useState([]);
  const [busq, setBusq] = useState('');
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');
  const [dtoGlobal, setDtoGlobal] = useState(String(lista.descuento || 0));
  const [soloSpec, setSoloSpec] = useState(false);
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  useEffect(() => { sb(`price_list_items?lista_id=eq.${lista.id}`).then(d => setItems(d || [])).catch(() => {}); }, [lista.id]);
  const saveGlobal = async val => {
    const v = parseFloat(val); if (isNaN(v) || v < 0 || v > 100) return;
    await sb(`price_lists?id=eq.${lista.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ descuento: v }) });
    onListaUpdated({ ...lista, descuento: v }); flash('✅ Descuento global guardado');
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
        else { const n = await sb('price_list_items', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ lista_id: lista.id, product_uuid: uuid, precio: tipo === 'precio' ? val : 0, descuento: tipo === 'descuento' ? val : 0 }) }); setItems(prev => [...prev, n?.[0] || {}]); }
      }
    } catch (e) { flash('❌ ' + e.message); }
    setSaving(s => ({ ...s, [uuid]: false }));
  };
  const clearItem = async uuid => { const ex = items.find(it => it.product_uuid === uuid); if (!ex) return; await sb(`price_list_items?id=eq.${ex.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== ex.id)); };
  const dg = parseFloat(dtoGlobal) || 0;
  const overrides = items.filter(it => it.precio > 0 || (it.descuento || 0) > 0).length;
  const prods = (products || []).filter(p => { const nm = (p.name || p.nombre || '').toLowerCase(); if (busq && !nm.includes(busq.toLowerCase())) return false; if (soloSpec) { const it = items.find(i => i.product_uuid === (p.uuid || p.id)); if (!it || (it.precio === 0 && (it.descuento || 0) === 0)) return false; } return true; });
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 320, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 13, outline: 'none' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}><input type="checkbox" checked={soloSpec} onChange={e => setSoloSpec(e.target.checked)} />Solo con precio especial</label>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{prods.length} de {(products || []).length}</span>
      </div>
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>💡 <strong>Precio fijo</strong> = precio exacto. <strong>Dto. %</strong> = descuento individual sobre precio base. El precio fijo tiene prioridad.</div>
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
              const final = calcFinal(base, dg, item);
              const ahorro = base > 0 && final < base ? Math.round((1 - final / base) * 100) : 0;
              const rowBg = item?.precio > 0 ? '#fffdf0' : (item?.descuento || 0) > 0 ? '#fdf8ff' : 'transparent';
              return (<tr key={uuid} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: rowBg, opacity: saving[uuid] ? 0.6 : 1 }}>
                <td style={{ padding: '8px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{p.name || p.nombre}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{p.category || p.categoria} · {p.unit || p.unidad}</div></td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{base > 0 ? fmt.currencyCompact(base) : <span style={{ color: '#e5e7eb' }}>—</span>}</td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}><input key={`pf-${uuid}-${item?.id}`} type="number" min={0} step="0.01" placeholder={base > 0 ? base.toFixed(2) : '—'} defaultValue={item?.precio > 0 ? item.precio : ''} onBlur={e => saveItem(uuid, 'precio', e.target.value)} style={{ width: 90, padding: '5px 8px', border: `1.5px solid ${item?.precio > 0 ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, textAlign: 'right', background: item?.precio > 0 ? '#fffbeb' : '#fafafa' }} /></td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><input key={`dto-${uuid}-${item?.id}`} type="number" min={0} max={100} step="0.5" placeholder={dg > 0 ? String(dg) : '0'} defaultValue={(item?.descuento || 0) > 0 ? item.descuento : ''} onBlur={e => saveItem(uuid, 'descuento', e.target.value)} style={{ width: 58, padding: '5px 8px', border: `1.5px solid ${(item?.descuento || 0) > 0 ? '#c4b5fd' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, textAlign: 'center', background: (item?.descuento || 0) > 0 ? '#faf5ff' : '#fafafa' }} /><span style={{ fontSize: 11, color: '#9ca3af' }}>%</span></div></td>
                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{base > 0 ? (<div><span style={{ fontSize: 14, fontWeight: 800, color: tieneOverride ? (item?.precio > 0 ? '#d97706' : '#7c3aed') : (dg > 0 ? G : '#374151') }}>{fmt.currencyCompact(final)}</span>{ahorro > 0 && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 6 }}>-{ahorro}%</span>}</div>) : <span style={{ color: '#e5e7eb', fontSize: 12 }}>sin precio</span>}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{tieneOverride && <button onClick={() => clearItem(uuid)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>}</td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PreciosListasTab() {
  const { clientes, setClientes } = useApp();
  const [listas, setListas] = useState([]);
  const [listItems, setListItems] = useState({});
  const [cliMap, setCliMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [vistaEditar, setVistaEditar] = useState(null);
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
      const data = await sb(`price_lists?org_id=eq.${getOrgId()}&order=created_at.desc`);
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
      const n = await sb('price_lists', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ org_id: getOrgId(), nombre: fNombre.trim(), descripcion: fDesc.trim(), descuento: Number(fDto) || 0, activa: true }) });
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
  if (vistaEditar) return <EditorPrecios lista={vistaEditar} onBack={() => { setVistaEditar(null); loadAll(); }} onListaUpdated={u => { setListas(ls => ls.map(l => l.id === u.id ? u : l)); setVistaEditar(u); }} />;
  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Listas de precios</h2><p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Precios personalizados por cliente en el portal B2B.</p></div>
        <button onClick={() => setShowForm(true)} style={{ background: G, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Nueva lista</button>
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
