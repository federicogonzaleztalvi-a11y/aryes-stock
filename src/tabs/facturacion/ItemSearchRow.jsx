import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { G, F, IVA_RATES, fmtMoney } from './constants.js';

function ItemSearchRow({ productos, onAdd }) {
  const { brandCfg } = useApp();
  const [query,    setQuery]    = React.useState('');
  const [cant,     setCant]     = React.useState('1');
  const [precio,   setPrecio]   = React.useState('');
  const [iva,      setIva]      = React.useState(brandCfg?.iva_default || 22);
  const [open,     setOpen]     = React.useState(false);
  const [cursor,   setCursor]   = React.useState(0);
  const [override, setOverride] = React.useState(false); // true = price manually edited

  const searchRef = React.useRef(null);
  const cantRef   = React.useRef(null);
  const precioRef = React.useRef(null);

  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return productos.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode||'').includes(q) ||
      (p.brand||'').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, productos]);

  const selectProduct = p => {
    setQuery(p.name);
    if (!override) setPrecio(String(p.salePrice || p.unitCost || ''));
    setOpen(false);
    setCursor(0);
    // Auto-focus qty
    setTimeout(() => cantRef.current?.select(), 50);
  };

  const commit = () => {
    const desc  = query.trim();
    const c2    = parseFloat(cant)  || 1;
    const pr    = parseFloat(precio)|| 0;
    if (!desc || !pr) return;
    const prod  = productos.find(p => p.name === desc);
    onAdd({ id: crypto.randomUUID(), prodId: prod?.id||'', desc, cant: c2, precio: pr, iva });
    // Reset for next item — keep focus in search
    setQuery(''); setCant('1'); setPrecio(''); setOverride(false);
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  const onKeySearch = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    else if (e.key === 'Enter' && open && results[cursor]) { selectProduct(results[cursor]); }
    else if (e.key === 'Enter' && !open) { cantRef.current?.select(); }
    else if (e.key === 'Escape') { setOpen(false); }
    else { setOpen(true); setCursor(0); }
  };

  const onKeyCant = e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); precioRef.current?.select(); }
  };

  const onKeyPrecio = e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Tab')   { e.preventDefault(); commit(); }
  };

  // Use free-text if no products in catalog
  const freeText = productos.length === 0;

  return (
    <div style={{ background:'#f9f9f7', borderRadius:10, padding:'12px 14px',
      border:'1px solid #e2e2de', marginBottom:12 }}>
      <div style={{ display:'flex', gap:6, alignItems:'flex-end', marginBottom:4 }}>
        {['Producto / Descripción','Cant.','Precio','IVA',''].map(h =>
          <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
            letterSpacing:'0.09em', textTransform:'uppercase', color:'#9a9a98',
            flex: h==='Producto / Descripción'?3 : h==='Cant.'?.7 : h==='Precio'?1.2 : h==='IVA'?.8 : 0,
            minWidth: h===''?36:0 }}>{h}</div>
        )}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>

        {/* Search / freetext */}
        <div style={{ flex:3, position:'relative' }}>
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={e=>{ setQuery(e.target.value); setOpen(true); }}
            onKeyDown={onKeySearch}
            onFocus={()=>query&&setOpen(true)}
            onBlur={()=>setTimeout(()=>setOpen(false),150)}
            placeholder={freeText ? "Descripción del ítem" : "Buscar producto… (nombre, código, marca)"}
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 11px',
              border:`1.5px solid ${query?G:'#e2e2de'}`, borderRadius:7,
              fontFamily:F.sans, fontSize:13, outline:'none',
              background: '#fff', color:'#1a1a18' }}
          />
          {/* Dropdown */}
          {open && results.length > 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
              background:'#fff', borderRadius:10, border:'1px solid #e2e2de',
              boxShadow:'0 8px 32px rgba(0,0,0,.12)', overflow:'hidden' }}>
              {results.map((p,i)=>(
                <div key={p.id}
                  onMouseDown={()=>selectProduct(p)}
                  style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'9px 14px', cursor:'pointer',
                    background: i===cursor ? '#f0f7ec' : 'transparent',
                    borderBottom: i<results.length-1?'1px solid #f5f5f3':'none',
                    transition:'background .08s',
                  }}>
                  <div>
                    <span style={{ fontFamily:F.sans, fontSize:13, fontWeight:600, color:'#1a1a18' }}>{p.name}</span>
                    {p.brand && <span style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginLeft:8 }}>{p.brand}</span>}
                    {p.barcode && <span style={{ fontFamily:F.mono, fontSize:10, color:'#c8c8c4', marginLeft:8 }}>{p.barcode}</span>}
                  </div>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <span style={{ fontFamily:F.mono, fontSize:12, color:'#6a6a68' }}>
                      Stock: {p.stock||0} {p.unit||''}
                    </span>
                    {(p.salePrice||p.unitCost) > 0 && (
                      <span style={{ fontFamily:F.mono, fontSize:13, fontWeight:700, color:G }}>
                        {fmt.currency(p.salePrice||p.unitCost)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ padding:'6px 14px', background:'#f9f9f7', fontFamily:F.sans, fontSize:10,
                color:'#c8c8c4', borderTop:'1px solid #f0f0ec' }}>
                ↑↓ navegar · Enter seleccionar · Esc cerrar
              </div>
            </div>
          )}
        </div>

        {/* Cant */}
        <input ref={cantRef} type="number" value={cant} min="0.001" step="any"
          onChange={e=>setCant(e.target.value)}
          onKeyDown={onKeyCant}
          onFocus={e=>e.target.select()}
          style={{ flex:.7, padding:'8px 9px', border:'1.5px solid #e2e2de', borderRadius:7,
            fontFamily:F.mono, fontSize:13, textAlign:'right', outline:'none',
            background:'#fff', color:'#1a1a18', boxSizing:'border-box', width:'100%' }} />

        {/* Precio */}
        <div style={{ flex:1.2, position:'relative' }}>
          <input ref={precioRef} type="number" value={precio} min="0" step="0.01"
            onChange={e=>{ setPrecio(e.target.value); setOverride(true); }}
            onKeyDown={onKeyPrecio}
            onFocus={e=>e.target.select()}
            placeholder="0.00"
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 9px',
              border:`1.5px solid ${precio&&parseFloat(precio)>0?G:'#e2e2de'}`,
              borderRadius:7, fontFamily:F.mono, fontSize:13, textAlign:'right',
              outline:'none', background:'#fff', color:'#1a1a18' }} />
        </div>

        {/* IVA */}
        <select value={iva} onChange={e=>setIva(Number(e.target.value))}
          style={{ flex:.8, padding:'8px 8px', border:'1.5px solid #e2e2de', borderRadius:7,
            fontFamily:F.sans, fontSize:12, outline:'none', background:'#fff',
            color:'#1a1a18', boxSizing:'border-box', width:'100%' }}>
          {IVA_RATES.map(r=><option key={r} value={r}>{r===0?'Exento':r+'%'}</option>)}
        </select>

        {/* Add btn */}
        <button onClick={commit}
          title="Agregar (Enter)"
          style={{ flexShrink:0, width:36, height:36, background:G, color:'#fff',
            border:'none', borderRadius:7, cursor:'pointer', fontSize:20,
            display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
      </div>
      <div style={{ fontFamily:F.sans, fontSize:10, color:'#c8c8c4', marginTop:5 }}>
        Enter en precio agrega el ítem · Tab pasa al siguiente campo · se puede seguir ingresando sin mouse
      </div>
    </div>
  );
}

// ─── Inline-editable items table ──────────────────────────────────────────

export default ItemSearchRow;
