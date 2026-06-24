import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';
import { useConfirm } from './ConfirmDialog.jsx';

const G = '#059669';
const SANS = 'Inter,system-ui,sans-serif';

const catOf = (p) => String(p.category || p.categoria || '').trim();

export default function CategoriasManager({ onClose }) {
  const { products, setProducts } = useApp();
  const { confirm, ConfirmDialog } = useConfirm();
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const cats = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => {
      const c = catOf(p);
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products]);

  const sinCategoria = useMemo(() => (products || []).filter((p) => !catOf(p)).length, [products]);

  const flash = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const applyRename = async (oldCat) => {
    const nuevo = (edits[oldCat] ?? oldCat).trim();
    if (!nuevo) { flash('El nombre no puede quedar vacío', 'err'); return; }
    if (nuevo === oldCat) return;
    const existe = cats.some((c) => c.name.toLowerCase() === nuevo.toLowerCase() && c.name !== oldCat);
    if (existe) {
      const ok = await confirm({
        title: `¿Unir “${oldCat}” con “${nuevo}”?`,
        description: `Todos los productos de “${oldCat}” van a pasar a la categoría “${nuevo}”.`,
        confirmText: 'Unir',
      });
      if (!ok) return;
    }
    setBusy(oldCat);
    const snap = products;
    setProducts((ps) => ps.map((p) => (catOf(p) === oldCat ? { ...p, category: nuevo } : p)));
    try {
      const r = await db.patch('products', { category: nuevo }, { category: oldCat });
      if (r === null) throw new Error('fail');
      setEdits((e) => { const n = { ...e }; delete n[oldCat]; return n; });
      flash(`✓ Guardado — ahora se llama “${nuevo}”`);
    } catch {
      setProducts(snap);
      flash('No se pudo guardar el cambio. Probá de nuevo.', 'err');
    } finally { setBusy(''); }
  };

  const eliminar = async (cat, count) => {
    const ok = await confirm({
      title: `¿Quitar la categoría “${cat}”?`,
      description: `Los ${count} producto${count !== 1 ? 's' : ''} quedan sin categoría (no se eliminan). Podés reasignarlos cuando quieras desde Inventario.`,
      variant: 'danger',
      confirmText: 'Quitar categoría',
    });
    if (!ok) return;
    setBusy(cat);
    const snap = products;
    setProducts((ps) => ps.map((p) => (catOf(p) === cat ? { ...p, category: '' } : p)));
    try {
      const r = await db.patch('products', { category: '' }, { category: cat });
      if (r === null) throw new Error('fail');
      flash(`✓ Categoría “${cat}” quitada`);
    } catch {
      setProducts(snap);
      flash('No se pudo quitar la categoría. Probá de nuevo.', 'err');
    } finally { setBusy(''); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: SANS }}>
      {ConfirmDialog}
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 580, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f0f0ee' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, margin: 0, color: '#1a1a18' }}>Categorías</h2>
              <p style={{ fontSize: 12.5, color: '#6a6a68', margin: '6px 0 0', lineHeight: 1.5 }}>
                Renombrá o uní categorías. El cambio aplica a todos los productos de esa categoría y se actualiza en el portal de tus clientes.
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9a9a98', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {msg && (
          <div style={{ margin: '12px 24px 0', background: msg.type === 'err' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.type === 'err' ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, color: msg.type === 'err' ? '#dc2626' : G }}>
            {msg.text}
          </div>
        )}

        <div style={{ padding: '14px 24px 20px', overflowY: 'auto' }}>
          {cats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a9a98', fontSize: 13 }}>
              No hay categorías todavía. Asignales una categoría a tus productos desde Inventario.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {cats.map(({ name, count }) => {
                const val = edits[name] ?? name;
                const changed = val.trim() !== name && val.trim() !== '';
                const isBusy = busy === name;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '8px 10px 8px 12px' }}>
                    <input
                      value={val}
                      onChange={(e) => setEdits((s) => ({ ...s, [name]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && changed) applyRename(name); }}
                      disabled={isBusy}
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${changed ? G : '#e2e2de'}`, borderRadius: 7, fontSize: 13, fontFamily: SANS, background: '#fff', outline: 'none' }}
                    />
                    <span title={`${count} producto${count !== 1 ? 's' : ''}`} style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', background: '#f0f0ee', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                      {count} prod.
                    </span>
                    <button onClick={() => applyRename(name)} disabled={!changed || isBusy}
                      style={{ padding: '7px 14px', background: changed && !isBusy ? G : '#e5e7eb', color: changed && !isBusy ? '#fff' : '#9a9a98', border: 'none', borderRadius: 7, cursor: changed && !isBusy ? 'pointer' : 'default', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {isBusy ? '…' : 'Guardar'}
                    </button>
                    <button onClick={() => eliminar(name, count)} disabled={isBusy} title="Quitar categoría"
                      style={{ padding: '7px 9px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {sinCategoria > 0 && (
            <div style={{ marginTop: 14, fontSize: 12, color: '#9a9a98' }}>
              {sinCategoria} producto{sinCategoria !== 1 ? 's' : ''} sin categoría — no aparecen como filtro en el portal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
