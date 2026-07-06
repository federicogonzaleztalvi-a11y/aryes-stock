import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db, getOrgId } from '../lib/constants.js';
import { useConfirm } from './ConfirmDialog.jsx';

const G = '#059669';
const SANS = 'Inter,system-ui,sans-serif';

const catOf = (p) => String(p.category || p.categoria || '').trim();
const subOf = (p) => String(p.subcategoria || '').trim();

// Editor de la taxonomía de categorías. Fuente de verdad: tabla `categories`
// (madre = parent_id null; subcategoría = parent_id apunta a la madre). Los
// productos guardan la categoría madre en products.category (texto) y la
// subcategoría en products.subcategoria (texto) — por eso al renombrar se
// propaga a los productos, para que el portal siga agrupando bien.
export default function CategoriasManager({ onClose }) {
  const { products, setProducts } = useApp();
  const { confirm, ConfirmDialog } = useConfirm();
  const org = getOrgId();

  const [cats, setCats] = useState(null); // null = cargando
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaSub, setNuevaSub] = useState({}); // { [madreId]: texto }

  const flash = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const cargar = useCallback(async () => {
    const rows = await db.get('categories', `org_id=eq.${org}&order=orden.asc,nombre.asc`);
    setCats(Array.isArray(rows) ? rows : []);
    return Array.isArray(rows) ? rows : [];
  }, [org]);

  // Auto-reparación: toda categoría/subcategoría que un producto esté usando pero
  // que no tenga fila en `categories` se crea sola. Así nada "desaparece" del
  // editor por más que la siembra inicial no haya cargado — la fuente de verdad
  // de qué EXISTE sigue siendo, como mínimo, lo que los productos ya usan.
  const backfill = useCallback(async (rows) => {
    const madresExist = new Map();  // nombre.toLowerCase() -> id
    const subsExist = new Set();    // `${parent_id}::${nombre.toLowerCase()}`
    rows.forEach((c) => {
      if (!c.parent_id) madresExist.set(c.nombre.toLowerCase(), c.id);
      else subsExist.add(`${c.parent_id}::${c.nombre.toLowerCase()}`);
    });

    // 1. Categorías madre que usan los productos y faltan en la tabla.
    const madresProd = [...new Set((products || []).map(catOf).filter(Boolean))];
    let ordenBase = rows.filter((c) => !c.parent_id).length;
    let inserto = false;
    for (const nombre of madresProd) {
      if (madresExist.has(nombre.toLowerCase())) continue;
      const r = await db.insert('categories', { org_id: org, nombre, parent_id: null, orden: ordenBase++ });
      if (Array.isArray(r) && r[0]) { madresExist.set(nombre.toLowerCase(), r[0].id); inserto = true; }
    }

    // 2. Subcategorías (category + subcategoria) que faltan bajo su madre.
    const paresProd = [...new Set((products || [])
      .filter((p) => catOf(p) && subOf(p))
      .map((p) => `${catOf(p)}::${subOf(p)}`))];
    for (const par of paresProd) {
      const [cat, sub] = par.split('::');
      const parentId = madresExist.get(cat.toLowerCase());
      if (!parentId) continue;
      if (subsExist.has(`${parentId}::${sub.toLowerCase()}`)) continue;
      const r = await db.insert('categories', { org_id: org, nombre: sub, parent_id: parentId, orden: 0 });
      if (Array.isArray(r) && r[0]) { subsExist.add(`${parentId}::${sub.toLowerCase()}`); inserto = true; }
    }

    if (inserto) await cargar();
  }, [org, products, cargar]);

  useEffect(() => { cargar().then((rows) => backfill(rows)); }, [cargar, backfill]);

  // Conteo de productos por nombre de categoría madre y por subcategoría.
  const countMadre = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => { const c = catOf(p); if (c) m.set(c.toLowerCase(), (m.get(c.toLowerCase()) || 0) + 1); });
    return m;
  }, [products]);
  const countSub = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => { const s = subOf(p); if (s) m.set(s.toLowerCase(), (m.get(s.toLowerCase()) || 0) + 1); });
    return m;
  }, [products]);

  // Árbol: UNIÓN de la tabla `categories` y de lo que los productos ya usan.
  // Regla de oro: si un producto tiene categoría, esa categoría SIEMPRE aparece
  // en el editor — aunque la fila en la tabla no exista (siembra fallida, RLS,
  // etc.). La tabla sólo agrega orden, categorías vacías y subcategorías encima.
  // Las categorías "virtuales" (derivadas de productos, sin fila) se marcan con
  // _virtual y sus operaciones caen en los productos, no en la tabla.
  const arbol = useMemo(() => {
    const madres = new Map(); // nombre.toLowerCase() -> madre
    // 1. Madres de la tabla (reales, con id y orden).
    (cats || []).filter((c) => !c.parent_id).forEach((c) => {
      madres.set(c.nombre.toLowerCase(), { id: c.id, nombre: c.nombre, orden: c.orden ?? 0, _virtual: false, subsMap: new Map() });
    });
    // 2. Madres que usan los productos y faltan en la tabla → virtuales.
    (products || []).forEach((p) => {
      const c = catOf(p); if (!c) return;
      const k = c.toLowerCase();
      if (!madres.has(k)) madres.set(k, { id: `v:${k}`, nombre: c, orden: 9990 + madres.size, _virtual: true, subsMap: new Map() });
    });
    // 3. Subcategorías de la tabla.
    (cats || []).filter((c) => c.parent_id).forEach((c) => {
      const madre = [...madres.values()].find((m) => m.id === c.parent_id);
      if (!madre) return;
      madre.subsMap.set(c.nombre.toLowerCase(), { id: c.id, nombre: c.nombre, orden: c.orden ?? 0, _virtual: false, parent_id: madre.id });
    });
    // 4. Subcategorías que usan los productos y faltan → virtuales.
    (products || []).forEach((p) => {
      const c = catOf(p), s = subOf(p); if (!c || !s) return;
      const madre = madres.get(c.toLowerCase()); if (!madre) return;
      const k = s.toLowerCase();
      if (!madre.subsMap.has(k)) madre.subsMap.set(k, { id: `v:${c.toLowerCase()}::${k}`, nombre: s, orden: 9990 + madre.subsMap.size, _virtual: true, parent_id: madre.id });
    });
    return [...madres.values()]
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
      .map((m) => ({ ...m, subs: [...m.subsMap.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')) }));
  }, [cats, products]);

  const sinCategoria = useMemo(() => (products || []).filter((p) => !catOf(p)).length, [products]);

  // ── Crear ──────────────────────────────────────────────────────────────────
  const crearCat = async () => {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    if (arbol.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) { flash('Ya existe una categoría con ese nombre', 'err'); return; }
    setBusy('nueva');
    const orden = arbol.length;
    const r = await db.insert('categories', { org_id: org, nombre, parent_id: null, orden });
    if (r) { setNuevaCat(''); await cargar(); flash(`✓ Categoría “${nombre}” creada`); }
    else flash('No se pudo crear la categoría. Probá de nuevo.', 'err');
    setBusy('');
  };

  const crearSub = async (madre) => {
    const nombre = (nuevaSub[madre.id] || '').trim();
    if (!nombre) return;
    if (madre.subs.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase())) { flash('Ya existe esa subcategoría', 'err'); return; }
    setBusy(`sub-${madre.id}`);
    const r = await db.insert('categories', { org_id: org, nombre, parent_id: madre.id, orden: madre.subs.length });
    if (r) { setNuevaSub((s) => ({ ...s, [madre.id]: '' })); await cargar(); flash(`✓ Subcategoría “${nombre}” creada`); }
    else flash('No se pudo crear la subcategoría. Probá de nuevo.', 'err');
    setBusy('');
  };

  // ── Renombrar (propaga a productos) ─────────────────────────────────────────
  const renombrar = async (cat) => {
    const nuevo = (edits[cat.id] ?? cat.nombre).trim();
    if (!nuevo || nuevo === cat.nombre) return;
    const esMadre = !cat.parent_id;
    const hermanos = esMadre ? arbol : (arbol.find((m) => m.id === cat.parent_id)?.subs || []);
    if (hermanos.some((c) => c.id !== cat.id && c.nombre.toLowerCase() === nuevo.toLowerCase())) { flash('Ya existe otra con ese nombre en el mismo nivel', 'err'); return; }
    setBusy(cat.id);
    const snap = products;
    // Optimista sobre productos + persistencia de la fila de categoría (si existe).
    const campo = esMadre ? 'category' : 'subcategoria';
    const matchVal = cat.nombre;
    setProducts((ps) => ps.map((p) => ((esMadre ? catOf(p) : subOf(p)) === matchVal ? { ...p, [campo]: nuevo } : p)));
    try {
      if (!cat._virtual) {
        const rCat = await db.patch('categories', { nombre: nuevo }, { id: cat.id });
        if (rCat === null) throw new Error('fail');
      }
      await db.patch('products', { [campo]: nuevo }, { [campo]: matchVal });
      setEdits((e) => { const n = { ...e }; delete n[cat.id]; return n; });
      await cargar();
      flash(`✓ Ahora se llama “${nuevo}”`);
    } catch {
      setProducts(snap);
      flash('No se pudo guardar el cambio. Probá de nuevo.', 'err');
    } finally { setBusy(''); }
  };

  // ── Borrar ──────────────────────────────────────────────────────────────────
  const borrar = async (cat) => {
    const esMadre = !cat.parent_id;
    const count = (esMadre ? countMadre : countSub).get(cat.nombre.toLowerCase()) || 0;
    const subInfo = esMadre && cat.subs?.length ? ` También se eliminan sus ${cat.subs.length} subcategoría${cat.subs.length !== 1 ? 's' : ''}.` : '';
    const ok = await confirm({
      title: `¿Quitar ${esMadre ? 'la categoría' : 'la subcategoría'} “${cat.nombre}”?`,
      description: `${count > 0 ? `Los ${count} producto${count !== 1 ? 's' : ''} quedan sin ${esMadre ? 'categoría' : 'subcategoría'} (no se eliminan).` : 'No tiene productos asignados.'}${subInfo}`,
      variant: 'danger',
      confirmText: 'Quitar',
    });
    if (!ok) return;
    setBusy(cat.id);
    const snap = products;
    const campo = esMadre ? 'category' : 'subcategoria';
    setProducts((ps) => ps.map((p) => ((esMadre ? catOf(p) : subOf(p)) === cat.nombre ? { ...p, [campo]: '' } : p)));
    try {
      // Al borrar una madre, la FK on delete cascade se lleva las subcategorías.
      // Las subcategorías de esos productos también quedan huérfanas → limpiar.
      if (esMadre && cat.subs?.length) {
        const subNames = new Set(cat.subs.map((s) => s.nombre.toLowerCase()));
        setProducts((ps) => ps.map((p) => (subNames.has(subOf(p).toLowerCase()) ? { ...p, subcategoria: '' } : p)));
        for (const s of cat.subs) await db.patch('products', { subcategoria: '' }, { subcategoria: s.nombre });
      }
      if (!cat._virtual) await db.del('categories', { id: cat.id });
      await db.patch('products', { [campo]: '' }, { [campo]: cat.nombre });
      await cargar();
      flash(`✓ “${cat.nombre}” quitada`);
    } catch {
      setProducts(snap);
      flash('No se pudo quitar. Probá de nuevo.', 'err');
    } finally { setBusy(''); }
  };

  // Asegura que una categoría tenga fila real en la tabla (crea la fila si es
  // virtual). Devuelve el id real o null si no se pudo persistir.
  const materializar = async (cat) => {
    if (!cat._virtual) return cat.id;
    let parent_id = null;
    if (cat.parent_id) {
      const madre = arbol.find((m) => m.id === cat.parent_id);
      parent_id = madre ? await materializar(madre) : null;
      if (!parent_id) return null;
    }
    const r = await db.insert('categories', { org_id: org, nombre: cat.nombre, parent_id, orden: cat.orden ?? 0 });
    return Array.isArray(r) && r[0] ? r[0].id : null;
  };

  // ── Reordenar (intercambia orden con el vecino) ─────────────────────────────
  const mover = async (lista, idx, dir) => {
    const otro = idx + dir;
    if (otro < 0 || otro >= lista.length) return;
    const a = lista[idx], b = lista[otro];
    setBusy(a.id);
    try {
      const aId = await materializar(a);
      const bId = await materializar(b);
      if (!aId || !bId) throw new Error('fail');
      const ao = a.orden ?? idx, bo = b.orden ?? otro;
      await db.patch('categories', { orden: bo }, { id: aId });
      await db.patch('categories', { orden: ao }, { id: bId });
      await cargar();
    } catch { flash('No se pudo reordenar. Probá de nuevo.', 'err'); }
    finally { setBusy(''); }
  };

  const inpBase = { padding: '8px 10px', border: '1px solid #e2e2de', borderRadius: 7, fontSize: 13, fontFamily: SANS, background: '#fff', outline: 'none' };
  const chip = (n) => (
    <span title={`${n} producto${n !== 1 ? 's' : ''}`} style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', background: '#f0f0ee', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{n} prod.</span>
  );

  const filaCat = (cat, lista, idx, esMadre) => {
    const val = edits[cat.id] ?? cat.nombre;
    const changed = val.trim() !== cat.nombre && val.trim() !== '';
    const isBusy = busy === cat.id;
    const n = (esMadre ? countMadre : countSub).get(cat.nombre.toLowerCase()) || 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: esMadre ? '#fafafa' : '#fff', border: '1px solid #eee', borderRadius: 9, padding: esMadre ? '8px 10px 8px 12px' : '6px 8px 6px 10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <button onClick={() => mover(lista, idx, -1)} disabled={idx === 0 || isBusy} title="Subir" style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#d4d4d0' : '#9a9a98', fontSize: 10, lineHeight: 1, padding: 0 }}>▲</button>
          <button onClick={() => mover(lista, idx, 1)} disabled={idx === lista.length - 1 || isBusy} title="Bajar" style={{ background: 'none', border: 'none', cursor: idx === lista.length - 1 ? 'default' : 'pointer', color: idx === lista.length - 1 ? '#d4d4d0' : '#9a9a98', fontSize: 10, lineHeight: 1, padding: 0 }}>▼</button>
        </div>
        <input
          value={val}
          onChange={(e) => setEdits((s) => ({ ...s, [cat.id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter' && changed) renombrar(cat); }}
          disabled={isBusy}
          style={{ ...inpBase, flex: 1, border: `1px solid ${changed ? G : '#e2e2de'}`, fontSize: esMadre ? 13 : 12.5, fontWeight: esMadre ? 600 : 400 }}
        />
        {chip(n)}
        <button onClick={() => renombrar(cat)} disabled={!changed || isBusy}
          style={{ padding: '7px 12px', background: changed && !isBusy ? G : '#e5e7eb', color: changed && !isBusy ? '#fff' : '#9a9a98', border: 'none', borderRadius: 7, cursor: changed && !isBusy ? 'pointer' : 'default', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
          {isBusy ? '…' : 'Guardar'}
        </button>
        <button onClick={() => borrar(cat)} disabled={isBusy} title="Quitar"
          style={{ padding: '7px 9px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: SANS }}>
      {ConfirmDialog}
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 620, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f0f0ee' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, margin: 0, color: '#1a1a18' }}>Categorías</h2>
              <p style={{ fontSize: 12.5, color: '#6a6a68', margin: '6px 0 0', lineHeight: 1.5 }}>
                Creá categorías y subcategorías a tu gusto, ordenalas y renombralas. Se ven así en el portal de tus clientes.
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
          {/* Crear categoría nueva */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') crearCat(); }}
              placeholder="Nueva categoría — ej: Bebidas" style={{ ...inpBase, flex: 1 }} />
            <button onClick={crearCat} disabled={!nuevaCat.trim() || busy === 'nueva'}
              style={{ padding: '8px 16px', background: nuevaCat.trim() ? G : '#e5e7eb', color: nuevaCat.trim() ? '#fff' : '#9a9a98', border: 'none', borderRadius: 7, cursor: nuevaCat.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
              {busy === 'nueva' ? '…' : '+ Agregar'}
            </button>
          </div>

          {cats === null ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9a9a98', fontSize: 13 }}>Cargando…</div>
          ) : arbol.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9a9a98', fontSize: 13 }}>
              Todavía no hay categorías. Creá la primera arriba.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {arbol.map((madre, i) => (
                <div key={madre.id}>
                  {filaCat(madre, arbol, i, true)}
                  {/* Subcategorías */}
                  <div style={{ marginLeft: 22, marginTop: 6, display: 'grid', gap: 6, borderLeft: '2px solid #f0f0ee', paddingLeft: 12 }}>
                    {madre.subs.map((sub, j) => (
                      <div key={sub.id}>{filaCat(sub, madre.subs, j, false)}</div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={nuevaSub[madre.id] || ''} onChange={(e) => setNuevaSub((s) => ({ ...s, [madre.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') crearSub(madre); }}
                        placeholder={`+ Subcategoría de ${madre.nombre}`} style={{ ...inpBase, flex: 1, fontSize: 12, padding: '6px 9px' }} />
                      <button onClick={() => crearSub(madre)} disabled={!(nuevaSub[madre.id] || '').trim() || busy === `sub-${madre.id}`}
                        style={{ padding: '6px 12px', background: (nuevaSub[madre.id] || '').trim() ? '#ecfdf5' : '#f5f5f0', color: (nuevaSub[madre.id] || '').trim() ? G : '#9a9a98', border: `1px solid ${(nuevaSub[madre.id] || '').trim() ? '#a7f3d0' : '#eee'}`, borderRadius: 7, cursor: (nuevaSub[madre.id] || '').trim() ? 'pointer' : 'default', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {busy === `sub-${madre.id}` ? '…' : '+ Sub'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sinCategoria > 0 && (
            <div style={{ marginTop: 16, fontSize: 12, color: '#9a9a98' }}>
              {sinCategoria} producto{sinCategoria !== 1 ? 's' : ''} sin categoría — no aparecen como filtro en el portal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
