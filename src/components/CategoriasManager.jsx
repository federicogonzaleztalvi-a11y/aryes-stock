import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useConfirm } from './ConfirmDialog.jsx';

const G = '#059669';
const SANS = 'Inter,system-ui,sans-serif';

const catOf = (p) => String(p.category || p.categoria || '').trim();
const subOf = (p) => String(p.subcategoria || '').trim();

function getToken() {
  try { return JSON.parse(localStorage.getItem('aryes-session') || 'null')?.access_token || ''; }
  catch { return ''; }
}
// Todas las escrituras van por /api/categories (service_role, bypassea RLS).
// Las policies RLS de `categories` bloquean el INSERT desde el cliente, por eso
// crear/renombrar/borrar/reordenar tienen que pasar por el server.
async function apiCat(action, method, body) {
  const token = getToken();
  if (!token) throw new Error('Tu sesión expiró. Cerrá sesión y volvé a entrar.');
  const res = await fetch(`/api/categories?action=${action}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new Error('Tu sesión expiró o no tenés permisos de admin. Cerrá sesión y volvé a entrar.');
  if (!res.ok) throw new Error(data?.error || 'Error');
  return data;
}

// Editor de la taxonomía de categorías. El árbol que se ve es la UNIÓN de la
// tabla `categories` (orden, categorías vacías, subcategorías) + lo que los
// productos ya usan (products.category / products.subcategoria). Regla de oro:
// si un producto tiene categoría, esa categoría SIEMPRE aparece, aunque no tenga
// fila todavía (se marca _virtual y la primera escritura la materializa).
export default function CategoriasManager({ onClose }) {
  const { products, setProducts } = useApp();
  const { confirm, ConfirmDialog } = useConfirm();

  const [cats, setCats] = useState(null);   // filas de la tabla (null = cargando)
  const [tree, setTree] = useState([]);     // árbol unión, mutable por arrastre
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaSub, setNuevaSub] = useState({});

  const flash = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const cargar = useCallback(async () => {
    try { const rows = await apiCat('list', 'GET'); setCats(Array.isArray(rows) ? rows : []); }
    catch { setCats([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Conteos de productos por categoría / subcategoría (para los chips).
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

  // Árbol UNIÓN (tabla + productos). Cada nodo: { key, nombre, _virtual, subs }.
  const arbol = useMemo(() => {
    const madres = new Map();
    (cats || []).filter((c) => !c.parent_id).forEach((c) => {
      madres.set(c.nombre.toLowerCase(), { key: c.nombre.toLowerCase(), nombre: c.nombre, orden: c.orden ?? 0, _virtual: false, _subs: new Map() });
    });
    (products || []).forEach((p) => {
      const c = catOf(p); if (!c) return;
      const k = c.toLowerCase();
      if (!madres.has(k)) madres.set(k, { key: k, nombre: c, orden: 9990 + madres.size, _virtual: true, _subs: new Map() });
    });
    const madreById = new Map();
    (cats || []).filter((c) => !c.parent_id).forEach((c) => { const m = madres.get(c.nombre.toLowerCase()); if (m) madreById.set(c.id, m); });
    (cats || []).filter((c) => c.parent_id).forEach((c) => {
      const m = madreById.get(c.parent_id); if (!m) return;
      m._subs.set(c.nombre.toLowerCase(), { key: c.nombre.toLowerCase(), nombre: c.nombre, orden: c.orden ?? 0, _virtual: false });
    });
    (products || []).forEach((p) => {
      const c = catOf(p), s = subOf(p); if (!c || !s) return;
      const m = madres.get(c.toLowerCase()); if (!m) return;
      const sk = s.toLowerCase();
      if (!m._subs.has(sk)) m._subs.set(sk, { key: sk, nombre: s, orden: 9990 + m._subs.size, _virtual: true });
    });
    return [...madres.values()]
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
      .map((m) => ({ key: m.key, nombre: m.nombre, _virtual: m._virtual, subs: [...m._subs.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')) }));
  }, [cats, products]);

  // Sincronizar árbol → tree, salvo mientras se arrastra (para no pisar el drag).
  const dragging = useRef(false);
  const treeRef = useRef([]);
  useEffect(() => { treeRef.current = tree; }, [tree]);
  useEffect(() => { if (!dragging.current) setTree(arbol); }, [arbol]);

  const sinCategoria = useMemo(() => (products || []).filter((p) => !catOf(p)).length, [products]);

  const editKey = (cat, parentNombre) => (parentNombre ? `s:${parentNombre.toLowerCase()}:${cat.key}` : `m:${cat.key}`);

  // ── Crear ────────────────────────────────────────────────────────────────────
  const crearCat = async () => {
    const nombre = nuevaCat.trim(); if (!nombre) return;
    if (tree.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) { flash('Ya existe una categoría con ese nombre', 'err'); return; }
    setBusy('nueva');
    try { await apiCat('create', 'POST', { nombre }); setNuevaCat(''); await cargar(); flash(`✓ Categoría “${nombre}” creada`); }
    catch (e) { flash(e.message || 'No se pudo crear la categoría.', 'err'); }
    finally { setBusy(''); }
  };

  const crearSub = async (madre) => {
    const nombre = (nuevaSub[madre.key] || '').trim(); if (!nombre) return;
    if (madre.subs.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase())) { flash('Ya existe esa subcategoría', 'err'); return; }
    setBusy(`sub-${madre.key}`);
    try { await apiCat('create', 'POST', { nombre, parent_nombre: madre.nombre }); setNuevaSub((s) => ({ ...s, [madre.key]: '' })); await cargar(); flash(`✓ Subcategoría “${nombre}” creada`); }
    catch (e) { flash(e.message || 'No se pudo crear la subcategoría.', 'err'); }
    finally { setBusy(''); }
  };

  // ── Renombrar (propaga a productos server-side) ──────────────────────────────
  const renombrar = async (cat, esMadre, parentNombre) => {
    const bk = editKey(cat, parentNombre);
    const nuevo = (edits[bk] ?? cat.nombre).trim();
    if (!nuevo || nuevo === cat.nombre) return;
    const hermanos = esMadre ? tree : (tree.find((m) => m.nombre === parentNombre)?.subs || []);
    if (hermanos.some((c) => c.key !== cat.key && c.nombre.toLowerCase() === nuevo.toLowerCase())) { flash('Ya existe otra con ese nombre en el mismo nivel', 'err'); return; }
    setBusy(bk);
    const snap = products;
    const campo = esMadre ? 'category' : 'subcategoria';
    setProducts((ps) => ps.map((p) => ((esMadre ? catOf(p) : subOf(p)) === cat.nombre ? { ...p, [campo]: nuevo } : p)));
    try {
      await apiCat('rename', 'PATCH', { es_madre: esMadre, nombre_actual: cat.nombre, nombre_nuevo: nuevo, parent_nombre: parentNombre || '' });
      setEdits((e) => { const n = { ...e }; delete n[bk]; return n; });
      await cargar();
      flash(`✓ Ahora se llama “${nuevo}”`);
    } catch (e) { setProducts(snap); flash(e.message || 'No se pudo guardar el cambio.', 'err'); }
    finally { setBusy(''); }
  };

  // ── Borrar ────────────────────────────────────────────────────────────────────
  const borrar = async (cat, esMadre, parentNombre) => {
    const count = (esMadre ? countMadre : countSub).get(cat.nombre.toLowerCase()) || 0;
    const subInfo = esMadre && cat.subs?.length ? ` También se eliminan sus ${cat.subs.length} subcategoría${cat.subs.length !== 1 ? 's' : ''}.` : '';
    const ok = await confirm({
      title: `¿Quitar ${esMadre ? 'la categoría' : 'la subcategoría'} “${cat.nombre}”?`,
      description: `${count > 0 ? `Los ${count} producto${count !== 1 ? 's' : ''} quedan sin ${esMadre ? 'categoría' : 'subcategoría'} (no se eliminan).` : 'No tiene productos asignados.'}${subInfo}`,
      variant: 'danger', confirmText: 'Quitar',
    });
    if (!ok) return;
    const bk = editKey(cat, parentNombre);
    setBusy(bk);
    const snap = products;
    const campo = esMadre ? 'category' : 'subcategoria';
    const subNames = esMadre && cat.subs?.length ? new Set(cat.subs.map((s) => s.nombre.toLowerCase())) : null;
    setProducts((ps) => ps.map((p) => {
      let np = p;
      if ((esMadre ? catOf(p) : subOf(p)) === cat.nombre) np = { ...np, [campo]: '' };
      if (subNames && subNames.has(subOf(p).toLowerCase())) np = { ...np, subcategoria: '' };
      return np;
    }));
    try { await apiCat('delete', 'DELETE', { es_madre: esMadre, nombre: cat.nombre, parent_nombre: parentNombre || '' }); await cargar(); flash(`✓ “${cat.nombre}” quitada`); }
    catch (e) { setProducts(snap); flash(e.message || 'No se pudo quitar.', 'err'); }
    finally { setBusy(''); }
  };

  // ── Reordenar por arrastre ───────────────────────────────────────────────────
  const persistOrden = useCallback(async (nextTree) => {
    const payload = { madres: nextTree.map((m) => ({ nombre: m.nombre, subs: m.subs.map((s) => s.nombre) })) };
    try { const rows = await apiCat('reorder', 'POST', payload); setCats(Array.isArray(rows) ? rows : (c) => c); }
    catch (e) { flash(e.message || 'No se pudo guardar el orden.', 'err'); await cargar(); }
  }, [cargar]);

  const drag = useRef(null);          // { kind:'madre'|'sub', key, madreKey? }
  const [dragBk, setDragBk] = useState(null);
  const madreRefs = useRef([]);
  const subRefs = useRef({});

  const targetIdx = (els, y) => {
    let target = els.length - 1;
    for (let j = 0; j < els.length; j++) { const el = els[j]; if (!el) continue; const r = el.getBoundingClientRect(); if (y < r.top + r.height / 2) { target = j; break; } }
    return target;
  };

  const onMadreDown = (madre) => (e) => { e.preventDefault(); drag.current = { kind: 'madre', key: madre.key }; dragging.current = true; setDragBk(`m:${madre.key}`); try { e.target.setPointerCapture(e.pointerId); } catch { /* noop */ } };
  const onMadreMove = (e) => {
    const d = drag.current; if (d?.kind !== 'madre') return;
    const target = targetIdx(madreRefs.current, e.clientY);
    setTree((t) => { const cur = t.findIndex((m) => m.key === d.key); if (cur < 0 || target === cur) return t; const o = [...t]; const [mv] = o.splice(cur, 1); o.splice(target, 0, mv); return o; });
  };
  const onSubDown = (madreKey, sub) => (e) => { e.preventDefault(); drag.current = { kind: 'sub', madreKey, key: sub.key }; dragging.current = true; setDragBk(`s:${madreKey}:${sub.key}`); try { e.target.setPointerCapture(e.pointerId); } catch { /* noop */ } };
  const onSubMove = (e) => {
    const d = drag.current; if (d?.kind !== 'sub') return;
    const target = targetIdx(subRefs.current[d.madreKey] || [], e.clientY);
    setTree((t) => t.map((m) => {
      if (m.key !== d.madreKey) return m;
      const cur = m.subs.findIndex((s) => s.key === d.key); if (cur < 0 || target === cur) return m;
      const o = [...m.subs]; const [mv] = o.splice(cur, 1); o.splice(target, 0, mv); return { ...m, subs: o };
    }));
  };
  const onDragUp = async (e) => {
    try { e.target.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!drag.current) return;
    drag.current = null; setDragBk(null);
    const snapshot = treeRef.current;
    dragging.current = false;
    await persistOrden(snapshot);
  };

  const inpBase = { padding: '8px 10px', border: '1px solid #e2e2de', borderRadius: 7, fontSize: 13, fontFamily: SANS, background: '#fff', outline: 'none' };
  const chip = (n) => (
    <span title={`${n} producto${n !== 1 ? 's' : ''}`} style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', background: '#f0f0ee', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{n} prod.</span>
  );
  const handleStyle = (bk) => ({ border: '1px solid #e2e2de', background: '#f5f5f0', color: '#9a9a98', borderRadius: 6, width: 26, height: 32, cursor: dragBk === bk ? 'grabbing' : 'grab', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0, touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' });

  const filaCat = (cat, esMadre, parentNombre, onDown, onMove) => {
    const bk = editKey(cat, parentNombre);
    const val = edits[bk] ?? cat.nombre;
    const changed = val.trim() !== cat.nombre && val.trim() !== '';
    const isBusy = busy === bk;
    const n = (esMadre ? countMadre : countSub).get(cat.nombre.toLowerCase()) || 0;
    const isDrag = dragBk === bk;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isDrag ? '#ecfdf5' : (esMadre ? '#fafafa' : '#fff'), border: `1px solid ${isDrag ? '#a7f3d0' : '#eee'}`, borderRadius: 9, padding: esMadre ? '8px 10px' : '6px 8px', opacity: isDrag ? 0.9 : 1, transition: 'background .1s' }}>
        <button onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onDragUp} title="Arrastrar para reordenar" style={handleStyle(bk)}>⠿</button>
        <input
          value={val}
          onChange={(e) => setEdits((s) => ({ ...s, [bk]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter' && changed) renombrar(cat, esMadre, parentNombre); }}
          disabled={isBusy}
          style={{ ...inpBase, flex: 1, border: `1px solid ${changed ? G : '#e2e2de'}`, fontSize: esMadre ? 13 : 12.5, fontWeight: esMadre ? 600 : 400 }}
        />
        {chip(n)}
        <button onClick={() => renombrar(cat, esMadre, parentNombre)} disabled={!changed || isBusy}
          style={{ padding: '7px 12px', background: changed && !isBusy ? G : '#e5e7eb', color: changed && !isBusy ? '#fff' : '#9a9a98', border: 'none', borderRadius: 7, cursor: changed && !isBusy ? 'pointer' : 'default', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
          {isBusy ? '…' : 'Guardar'}
        </button>
        <button onClick={() => borrar(cat, esMadre, parentNombre)} disabled={isBusy} title="Quitar"
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
                Creá categorías y subcategorías a tu gusto. Arrastrá el <span style={{ fontWeight: 700 }}>⠿</span> para ordenarlas — así se ven en el portal de tus clientes.
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
          ) : tree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9a9a98', fontSize: 13 }}>
              Todavía no hay categorías. Creá la primera arriba.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {tree.map((madre, i) => (
                <div key={madre.key} ref={(el) => { madreRefs.current[i] = el; }}>
                  {filaCat(madre, true, '', onMadreDown(madre), onMadreMove)}
                  {/* Subcategorías */}
                  <div style={{ marginLeft: 22, marginTop: 6, display: 'grid', gap: 6, borderLeft: '2px solid #f0f0ee', paddingLeft: 12 }}>
                    {madre.subs.map((sub, j) => (
                      <div key={sub.key} ref={(el) => { (subRefs.current[madre.key] ||= [])[j] = el; }}>
                        {filaCat(sub, false, madre.nombre, onSubDown(madre.key, sub), onSubMove)}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={nuevaSub[madre.key] || ''} onChange={(e) => setNuevaSub((s) => ({ ...s, [madre.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') crearSub(madre); }}
                        placeholder={`+ Subcategoría de ${madre.nombre}`} style={{ ...inpBase, flex: 1, fontSize: 12, padding: '6px 9px' }} />
                      <button onClick={() => crearSub(madre)} disabled={!(nuevaSub[madre.key] || '').trim() || busy === `sub-${madre.key}`}
                        style={{ padding: '6px 12px', background: (nuevaSub[madre.key] || '').trim() ? '#ecfdf5' : '#f5f5f0', color: (nuevaSub[madre.key] || '').trim() ? G : '#9a9a98', border: `1px solid ${(nuevaSub[madre.key] || '').trim() ? '#a7f3d0' : '#eee'}`, borderRadius: 7, cursor: (nuevaSub[madre.key] || '').trim() ? 'pointer' : 'default', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {busy === `sub-${madre.key}` ? '…' : '+ Sub'}
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
