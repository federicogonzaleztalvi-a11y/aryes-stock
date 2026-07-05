import BackButton from '../components/BackButton.jsx';
import ImportadorPrecios from './ImportadorPrecios.jsx';
import { fmt , getOrgId, getAuthHeaders } from '../lib/constants.js';
// src/tabs/PreciosListasTab.jsx
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calcLinea } from '../lib/pricing.js';

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

// ── Modelo v2 ────────────────────────────────────────────────────────────────
// Precio de un producto en una lista = precio especial fijo (opcional) O un
// conjunto de reglas de descuento. Reglas: [{condicion:'siempre'|'caja'|'cantidad', dto, min_unidades?}]
// El motor (api/_catalog.js) toma la MEJOR regla que aplica por unidad — nunca suma.
// Si hay precio especial (>0), ese ES el precio final y las reglas se ignoran.

const CONDICIONES = {
  siempre:  { label: 'Siempre',            hint: 'Se aplica a todas las unidades' },
  caja:     { label: 'Con caja cerrada',   hint: 'Solo a las unidades que completan cajas enteras' },
  cantidad: { label: 'Desde X unidades',   hint: 'Si la cantidad pedida alcanza el mínimo' },
};

// Mismo mapeo que reglasToComponentes en api/_catalog.js — solo para el preview
// del editor. La matemática real la hace calcLinea (importado), igual que el carrito.
function reglasComponentes(reglas) {
  let siempre = 0, caja = 0; const tiers = [];
  for (const r of reglas || []) {
    const dto = Number(r?.dto) || 0;
    if (r?.condicion === 'siempre') siempre = Math.max(siempre, dto);
    else if (r?.condicion === 'caja') caja = Math.max(caja, dto);
    else if (r?.condicion === 'cantidad') tiers.push({ min: Number(r?.min_unidades) || 0, dto });
  }
  tiers.sort((a, b) => a.min - b.min);
  return { siempre, caja, tiers };
}

// Arma el item que consume calcLinea a partir de la config del editor.
function previewItem(base, precioEsp, reglas, ivaRate, unidCaja) {
  if (precioEsp > 0) {
    return { precioBase: precioEsp, precio: precioEsp, iva_rate: ivaRate, descGlobal: 0, volume_tiers: [], unidades_por_caja: 0, descuento_caja: 0, reglasV2: true };
  }
  const { siempre, caja, tiers } = reglasComponentes(reglas);
  return { precioBase: base, iva_rate: ivaRate, descGlobal: siempre, volume_tiers: tiers, unidades_por_caja: caja > 0 ? unidCaja : 0, descuento_caja: caja, reglasV2: true };
}

// Reglas válidas para guardar: dto en (0,100]; cantidad exige min_unidades > 1.
function saneaReglas(reglas) {
  return (reglas || []).map(r => {
    const condicion = String(r?.condicion || '').trim();
    const dto = Number(r?.dto);
    if (!['siempre', 'caja', 'cantidad'].includes(condicion)) return null;
    if (!Number.isFinite(dto) || dto <= 0 || dto > 100) return null;
    if (condicion === 'cantidad') {
      const min = Math.floor(Number(r?.min_unidades));
      if (!Number.isFinite(min) || min <= 1) return null;
      return { condicion, dto, min_unidades: min };
    }
    return { condicion, dto };
  }).filter(Boolean);
}

// Reglas guardadas en el item (v2) o, si es una lista vieja, deriva el descuento
// legacy como una regla "Siempre" para que Federico la vea y la migre al editar.
function reglasDelItem(item) {
  if (Array.isArray(item?.reglas) && item.reglas.length > 0) return saneaReglas(item.reglas);
  if ((item?.descuento || 0) > 0) return [{ condicion: 'siempre', dto: Number(item.descuento) }];
  return [];
}

// Moneda con 2 decimales — solo para el editor (fmt.currency redondea a entero en toda la app).
function fmtPrecio(n) {
  return `$ ${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Resumen corto de las reglas de un producto para la celda de la tabla.
function badgesRegla(reglas) {
  return (reglas || []).map(r => {
    if (r.condicion === 'siempre') return `${r.dto}% siempre`;
    if (r.condicion === 'caja') return `${r.dto}% caja`;
    if (r.condicion === 'cantidad') return `${r.dto}% desde ${r.min_unidades}u`;
    return '';
  }).filter(Boolean);
}

// ── Modal: editar reglas de UN producto en la lista ──────────────────────────
function ModalReglas({ prod, item, onClose, onSave }) {
  const base = Number(prod.precio_venta || prod.precioVenta || 0);
  const unidCaja = Number(prod.unidades_por_caja || 0);
  const ivaRate = prod.iva_rate != null ? Number(prod.iva_rate) : 0;
  const [especial, setEspecial] = useState(item?.precio > 0 ? String(item.precio) : '');
  const [reglas, setReglas] = useState(reglasDelItem(item));
  const [saving, setSaving] = useState(false);
  const esp = parseFloat(especial) || 0;
  const usaEspecial = esp > 0;
  const comps = reglasComponentes(reglas);
  const cajaSinUnid = comps.caja > 0 && unidCaja <= 0;

  const addRegla = () => setReglas(rs => [...rs, { condicion: 'siempre', dto: '' }]);
  const setRegla = (i, patch) => setReglas(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const delRegla = (i) => setReglas(rs => rs.filter((_, j) => j !== i));

  // Cantidades de ejemplo para el preview: 1, la primera escala por cantidad, y una caja.
  const qtys = [...new Set([1, ...comps.tiers.map(t => t.min), unidCaja > 0 && comps.caja > 0 ? unidCaja : null, unidCaja > 0 && comps.caja > 0 ? unidCaja + 2 : null].filter(q => q && q > 0))].sort((a, b) => a - b).slice(0, 4);

  const guardar = async () => {
    setSaving(true);
    const limpias = usaEspecial ? [] : saneaReglas(reglas);
    await onSave(prod.uuid || prod.id, esp, limpias);
    setSaving(false);
  };

  const inp = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{prod.name || prod.nombre}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, marginBottom: 18 }}>Precio base <strong>{fmtPrecio(base)}</strong>{unidCaja > 0 ? ` · ${unidCaja} u/caja` : ' · sin caja definida'}{ivaRate > 0 ? ` · IVA ${ivaRate}%` : ''}</div>

        {/* Precio especial fijo */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Precio especial fijo</span>
            <input type="number" min={0} step="0.01" value={especial} onChange={e => setEspecial(e.target.value)} placeholder="opcional" style={{ ...inp, width: 120, textAlign: 'right', borderColor: '#fbbf24', background: '#fff' }} />
            {usaEspecial && <button onClick={() => setEspecial('')} style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>quitar</button>}
          </div>
          <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>Si lo ponés, ese es el precio final para esta lista y <strong>no se aplican descuentos</strong>.</div>
        </div>

        {/* Reglas de descuento */}
        <div style={{ opacity: usaEspecial ? 0.45 : 1, pointerEvents: usaEspecial ? 'none' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Descuentos</span>
            <button onClick={addRegla} style={{ background: '#f0fdf4', color: G, border: `1px solid #bbf7d0`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>+ Regla</button>
          </div>
          {reglas.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>Sin descuentos — se cobra el precio base.</div>}
          {reglas.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select value={r.condicion} onChange={e => setRegla(i, { condicion: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                {Object.entries(CONDICIONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={0} max={100} step="0.5" value={r.dto} onChange={e => setRegla(i, { dto: e.target.value })} placeholder="0" style={{ ...inp, width: 64, textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>%</span>
              </div>
              {r.condicion === 'cantidad' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>desde</span>
                  <input type="number" min={2} step="1" value={r.min_unidades || ''} onChange={e => setRegla(i, { min_unidades: e.target.value })} placeholder="24" style={{ ...inp, width: 64, textAlign: 'center' }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>u</span>
                </div>
              )}
              <button onClick={() => delRegla(i)} title="Quitar regla" style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 16, marginLeft: 'auto' }}>✕</button>
            </div>
          ))}
          {cajaSinUnid && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠️ Este producto no tiene "unidades por caja" definidas — el descuento por caja no se va a aplicar hasta cargarlas en el producto.</div>}
        </div>

        {/* Preview con la matemática real del carrito */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Vista previa (lo que paga el cliente)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: .4 }}>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}>Cantidad</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>Precio/u</th>
              <th style={{ textAlign: 'right', padding: '2px 4px' }}>Total neto</th>
            </tr></thead>
            <tbody>
              {qtys.map(q => {
                const r = calcLinea(previewItem(base, esp, usaEspecial ? [] : reglas, ivaRate, unidCaja), q);
                return (<tr key={q} style={{ borderTop: '1px solid #f0f0ec' }}>
                  <td style={{ padding: '5px 4px', color: '#374151' }}>{q} u</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 700, color: '#1a1a1a' }}>{fmtPrecio(r.precioConDto)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', color: '#6b7280' }}>{fmtPrecio(r.netoLinea)}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ padding: '9px 22px', background: G, color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function EditorPrecios({ lista, onBack, listas }) {
  const { products } = useApp();
  const [items, setItems] = useState([]);
  const [busq, setBusq] = useState('');
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');
  const [soloSpec, setSoloSpec] = useState(false);
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [editUuid, setEditUuid] = useState(null);
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  useEffect(() => { sb(`price_list_items?lista_id=eq.${lista.id}`).then(d => setItems(d || [])).catch(() => {}); }, [lista.id]);

  // Guarda precio especial + reglas de un producto. Escribe descuento:0 para
  // retirar el modelo viejo de ese producto (pasa a v2). Si queda todo vacío,
  // borra la fila (el producto cae al precio base).
  const saveProducto = async (uuid, precioEsp, reglas) => {
    setSaving(s => ({ ...s, [uuid]: true }));
    try {
      const ex = items.find(it => it.product_uuid === uuid);
      const vacio = (!precioEsp || precioEsp <= 0) && (!reglas || reglas.length === 0);
      if (vacio) {
        if (ex) { await sb(`price_list_items?id=eq.${ex.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== ex.id)); }
      } else {
        const patch = { precio: precioEsp > 0 ? precioEsp : 0, reglas, descuento: 0 };
        if (ex) {
          const u = await sb(`price_list_items?id=eq.${ex.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch) });
          setItems(prev => prev.map(it => it.id === ex.id ? (u?.[0] || { ...it, ...patch }) : it));
        } else {
          const n = await sb('price_list_items', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ lista_id: lista.id, org_id: getOrgId(), product_uuid: uuid, ...patch }) });
          setItems(prev => [...prev, n?.[0] || {}]);
        }
      }
      flash('✅ Guardado');
    } catch (e) { flash('❌ ' + e.message); }
    setSaving(s => ({ ...s, [uuid]: false }));
    setEditUuid(null);
  };

  const clearItem = async uuid => { const ex = items.find(it => it.product_uuid === uuid); if (!ex) return; await sb(`price_list_items?id=eq.${ex.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== ex.id)); flash('✅ Quitado de la lista'); };

  const itemDe = p => items.find(i => i.product_uuid === (p.uuid || p.id));
  const tieneItem = p => { const it = itemDe(p); return !!(it && (it.precio > 0 || (it.descuento || 0) > 0 || (Array.isArray(it.reglas) && it.reglas.length > 0))); };
  const sinPrecio = p => !tieneItem(p);
  const sinPrecioCount = (products || []).filter(sinPrecio).length;
  const overrides = (products || []).filter(tieneItem).length;
  const prods = (products || []).filter(p => { const nm = (p.name || p.nombre || '').toLowerCase(); if (busq && !nm.includes(busq.toLowerCase())) return false; if (soloSpec && !tieneItem(p)) return false; if (soloSinPrecio && !sinPrecio(p)) return false; return true; });

  const prodEdit = editUuid ? (products || []).find(p => (p.uuid || p.id) === editUuid) : null;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <BackButton onBack={onBack} parent="Listas de precios" current={lista?.nombre || ''} />
        <div style={{ flex: 1 }}><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lista.nombre}</h2><p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{overrides > 0 ? `${overrides} producto${overrides !== 1 ? 's' : ''} con precio o descuento propio` : 'Sin precios especiales — todos al precio base'}</p></div>
      </div>
      {msg && <div style={{ background: msg.startsWith('❌') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.startsWith('❌') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: msg.startsWith('❌') ? '#dc2626' : G, fontWeight: 600 }}>{msg}</div>}
      {sinPrecioCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>{sinPrecioCount} producto{sinPrecioCount !== 1 ? 's' : ''} sin precio propio en esta lista</div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>En el portal usan el precio base. Poneles un precio especial o un descuento.</div>
          </div>
          <button onClick={() => setSoloSinPrecio(v => !v)} style={{ padding: '8px 16px', background: soloSinPrecio ? '#9a3412' : '#fff', color: soloSinPrecio ? '#fff' : '#9a3412', border: '1.5px solid #9a3412', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{soloSinPrecio ? 'Ver todos' : 'Revisar estos'}</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 320, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 13, outline: 'none' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}><input type="checkbox" checked={soloSpec} onChange={e => setSoloSpec(e.target.checked)} />Solo con precio propio</label>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{prods.length} de {(products || []).length}</span>
      </div>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#1e40af' }}>💡 Cada producto tiene un <strong>precio especial fijo</strong> (opcional) o <strong>descuentos</strong>: Siempre, Con caja cerrada o Desde X unidades. Cuando hay varios, se aplica el mayor que corresponde — <strong>nunca se suman</strong>.</div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Código</th>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Producto</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, minWidth: 90 }}>Base</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: G, textTransform: 'uppercase', letterSpacing: .5, minWidth: 220 }}>Precio / descuentos</th>
            <th style={{ padding: '10px 12px', width: 90 }}></th>
          </tr></thead>
          <tbody>
            {prods.slice(0, 300).map((p, i) => {
              const uuid = p.uuid || p.id, base = Number(p.precio_venta || p.precioVenta || 0);
              const item = itemDe(p);
              const esp = item?.precio > 0 ? Number(item.precio) : 0;
              const reglas = reglasDelItem(item);
              const tiene = tieneItem(p);
              const badges = badgesRegla(reglas);
              return (<tr key={uuid} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: tiene ? '#f7fdf9' : 'transparent', opacity: saving[uuid] ? 0.6 : 1 }}>
                <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 12, color: (p.codigo || p.barcode) ? '#374151' : '#c8c4bc', whiteSpace: 'nowrap' }}>{p.codigo || p.barcode || '—'}</td>
                <td style={{ padding: '8px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{p.name || p.nombre}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{p.category || p.categoria} · {p.unit || p.unidad}</div></td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{base > 0 ? fmtPrecio(base) : <span style={{ color: '#ef4444', fontSize: 11 }}>sin base</span>}</td>
                <td style={{ padding: '8px 12px' }}>
                  {esp > 0 ? (
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>{fmtPrecio(esp)} <span style={{ fontSize: 10, fontWeight: 600, color: '#b45309' }}>fijo</span></span>
                  ) : badges.length > 0 ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges.map((b, k) => <span key={k} style={{ fontSize: 11, fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 20, padding: '2px 10px' }}>{b}</span>)}</div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#c8c4bc' }}>precio base</span>
                  )}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => setEditUuid(uuid)} style={{ padding: '6px 14px', background: tiene ? '#fff' : G, color: tiene ? G : '#fff', border: `1.5px solid ${G}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{tiene ? 'Editar' : 'Poner precio'}</button>
                  {tiene && <button title="Quitar de esta lista" onClick={() => clearItem(uuid)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>✕</button>}
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
      {prodEdit && <ModalReglas prod={prodEdit} item={itemDe(prodEdit)} onClose={() => setEditUuid(null)} onSave={saveProducto} />}
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
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await sb(`price_lists?org_id=eq.${getOrgId()}&order=creado_en.desc`);
      setListas(data || []);
      const im = {}, cm = {};
      for (const l of (data || [])) { im[l.id] = await sb(`price_list_items?lista_id=eq.${l.id}`).catch(() => []); cm[l.id] = await sb(`clients?lista_id=eq.${l.id}&select=id,name,phone`).catch(() => []); }
      setListItems(im); setCliMap(cm);
    } catch (e) { flash('❌ ' + e.message); }
    setLoading(false);
  };
  useEffect(() => { loadAll(); }, []);
  const crearLista = async () => {
    if (!fNombre.trim()) { flash('❌ Nombre requerido'); return; }
    setSaving(true);
    try {
      const n = await sb('price_lists', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ id: 'lista_' + Math.random().toString(36).slice(2, 10), org_id: getOrgId(), nombre: fNombre.trim(), descripcion: fDesc.trim() || null, descuento: 0, activa: true }) });
      const lista = n?.[0]; if (!lista) throw new Error('Sin respuesta');
      setListas(ls => [lista, ...ls]); setListItems(m => ({ ...m, [lista.id]: [] })); setCliMap(m => ({ ...m, [lista.id]: [] }));
      setFNombre(''); setFDesc(''); setShowForm(false); flash(`✅ Lista "${lista.nombre}" creada`);
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
  const countOverrides = its => (its || []).filter(it => it.precio > 0 || (it.descuento || 0) > 0 || (Array.isArray(it.reglas) && it.reglas.length > 0)).length;
  if (vistaEditar) return <EditorPrecios lista={vistaEditar} listas={listas} onBack={() => { setVistaEditar(null); loadAll(); }} />;
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Nombre *</label><input value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Mayoristas, VIP..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Descripción</label><input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Clientes &gt; 500/mes" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} /></div>
            <button onClick={crearLista} disabled={saving} style={{ padding: '9px 18px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? .7 : 1, whiteSpace: 'nowrap' }}>{saving ? '...' : 'Crear'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>Los precios y descuentos se cargan producto por producto al entrar a la lista.</div>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando listas...</div> : listas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec' }}><div style={{ fontSize: 40, marginBottom: 12 }}>💰</div><div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Sin listas de precios</div><p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>Creá una lista para dar precios especiales a tus clientes en el portal B2B.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
          {listas.map(lista => {
            const its = listItems[lista.id] || [], cc = (cliMap[lista.id] || []).length, ov = countOverrides(its);
            return (
              <div key={lista.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec', boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{lista.nombre}</div>{lista.descripcion && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lista.descripcion}</div>}</div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: ov > 0 ? '#d97706' : '#9ca3af' }}>{ov}</div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .4 }}>Con precio propio</div></div>
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
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
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
