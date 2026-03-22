import React, { useState, useMemo } from 'react';
import { LS, db } from '../lib/constants.js';

// ─── Tokens ───────────────────────────────────────────────────────────────
const G  = '#3a7d1e';
const F  = {
  sans:  "'DM Sans', system-ui, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono:  "'DM Mono', 'Fira Code', monospace",
};

// ─── Constants ────────────────────────────────────────────────────────────
const COND_PAGO = [
  { value: 'contado',    label: 'Contado',        dias: 0   },  // kept for legacy
  { value: 'credito_15', label: 'Crédito 15 días', dias: 15  },
  { value: 'credito_30', label: 'Crédito 30 días', dias: 30  },
  { value: 'credito_60', label: 'Crédito 60 días', dias: 60  },
  { value: 'credito_90', label: 'Crédito 90 días', dias: 90  },
];

const METODOS_COBRO = ['Transferencia', 'Cheque', 'Efectivo', 'Tarjeta', 'Otro'];

const CFE_TIPOS = {
  'e-Factura': { icon: '🧾', code: 'eFact' },
  'e-Ticket':  { icon: '🎫', code: 'eTick' },
  'e-Remito':  { icon: '📦', code: 'eRem'  },
  'e-N.Créd.': { icon: '↩',  code: 'eNC'   },
};

const CFE_STATUS = {
  borrador:  { label: 'Borrador',  color: '#6a6a68', bg: '#f0f0ec' },
  pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fffbeb' },
  emitida:   { label: 'Emitida',   color: '#2563eb', bg: '#eff6ff' },
  aceptada:  { label: 'Aceptada',  color: '#16a34a', bg: '#f0fdf4' },
  rechazada: { label: 'Rechazada', color: '#dc2626', bg: '#fef2f2' },
  anulada:   { label: 'Anulada',   color: '#9a9a98', bg: '#f9f9f7' },
  cobrada:   { label: 'Cobrada',   color: '#16a34a', bg: '#f0fdf4' },
};

const IVA_RATES = [22, 10, 0];
const MONEDAS   = ['UYU', 'USD', 'EUR'];

// ─── Helpers ──────────────────────────────────────────────────────────────
const newId  = () => crypto.randomUUID();
const today  = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
const daysUntil = d => d ? Math.floor((new Date(d).getTime() - Date.now()) / 86400000) : null;

const fmtMoney = (n, cur='UYU') => {
  const sym = cur==='UYU'?'$':cur==='USD'?'US$':'€';
  return `${sym} ${Number(n||0).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
};
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtDateShort = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';

const agingBucket = dias => {
  if (dias <= 0)  return { label: 'Al día',   color: '#16a34a', bg: '#f0fdf4', pri: 0 };
  if (dias <= 30) return { label: '1-30d',     color: '#d97706', bg: '#fffbeb', pri: 1 };
  if (dias <= 60) return { label: '31-60d',    color: '#ea580c', bg: '#fff7ed', pri: 2 };
  if (dias <= 90) return { label: '61-90d',    color: '#dc2626', bg: '#fef2f2', pri: 3 };
  return                  { label: '+90d',      color: '#7f1d1d', bg: '#fef2f2', pri: 4 };
};

// ─── Small components ─────────────────────────────────────────────────────
const Pill = ({ status }) => {
  const s = CFE_STATUS[status] || CFE_STATUS.pendiente;
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5,
    background:s.bg, color:s.color, fontFamily:F.sans, fontSize:10,
    fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase',
    padding:'3px 9px', borderRadius:20, whiteSpace:'nowrap' }}>
    <span style={{ width:5, height:5, borderRadius:'50%', background:s.color }} />
    {s.label}
  </span>;
};

const TabBtn = ({ active, onClick, children }) =>
  <button onClick={onClick} style={{
    padding:'9px 18px', border:'none', cursor:'pointer', fontFamily:F.sans,
    fontSize:13, fontWeight:active?700:500, background:'none',
    borderBottom:`2px solid ${active?G:'transparent'}`,
    color: active?G:'#6a6a68', transition:'all .15s',
  }}>{children}</button>;

const Lbl = ({ children }) =>
  <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
    textTransform:'uppercase', color:'#9a9a98', marginBottom:5 }}>{children}</div>;

const Inp = ({ style={}, ...p }) =>
  <input {...p} style={{ width:'100%', boxSizing:'border-box', padding:'8px 11px',
    border:'1.5px solid #e2e2de', borderRadius:7, fontFamily:F.sans, fontSize:13,
    color:'#1a1a18', outline:'none', background:'#fff', ...style }} />;

const Sel = ({ children, style={}, ...p }) =>
  <select {...p} style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #e2e2de',
    borderRadius:7, fontFamily:F.sans, fontSize:13, color:'#1a1a18',
    outline:'none', background:'#fff', ...style }}>{children}</select>;

// ─── KPI Card ─────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, accent='#e2e2de', danger=false, onClick }) =>
  <div onClick={onClick} style={{
    background:'#fff', borderRadius:12, padding:'18px 22px',
    borderTop:`3px solid ${accent}`, cursor:onClick?'pointer':'default',
  }}>
    <Lbl>{label}</Lbl>
    <div style={{ fontFamily:F.serif, fontSize:32, fontWeight:400,
      color: danger&&Number(value)>0 ? '#dc2626' : '#1a1a18', lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:5 }}>{sub}</div>}
  </div>;

// ─── Quick Invoice Modal ───────────────────────────────────────────────────
// ─── Fast Item Search + Add ────────────────────────────────────────────────
// Keyboard-driven product search with autocomplete dropdown
function ItemSearchRow({ productos, onAdd }) {
  const [query,    setQuery]    = React.useState('');
  const [cant,     setCant]     = React.useState('1');
  const [precio,   setPrecio]   = React.useState('');
  const [iva,      setIva]      = React.useState(22);
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
                        {fmtMoney(p.salePrice||p.unitCost)}
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
function ItemsTable({ items, setItems, moneda }) {
  const [editCell, setEditCell] = React.useState(null); // {id, field}

  const updateItem = (id, field, val) => {
    setItems(prev => prev.map(it =>
      it.id === id ? { ...it, [field]: field==='iva'?Number(val):field==='desc'?val:parseFloat(val)||0 } : it
    ));
    setEditCell(null);
  };

  if (!items.length) return (
    <div style={{ border:'1.5px dashed #e2e2de', borderRadius:10, padding:'20px',
      textAlign:'center', color:'#9a9a98', fontFamily:F.sans, fontSize:13, marginBottom:12 }}>
      Sin líneas aún — buscá un producto arriba o escribí la descripción
    </div>
  );

  return (
    <div style={{ border:'1px solid #e2e2de', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:F.sans, fontSize:13 }}>
        <thead>
          <tr style={{ background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
            {['#','Descripción','Cant.','Precio unit.','IVA','Total',''].map(h=>
              <th key={h} style={{ padding:'8px 12px',
                textAlign: ['Cant.','Precio unit.','Total'].includes(h)?'right':h==='#'||h===''?'center':'left',
                fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.09em',
                textTransform:'uppercase', color:'#9a9a98', whiteSpace:'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const lineTotal = it.cant * it.precio * (1 + it.iva/100);
            return (
              <tr key={it.id} style={{ borderBottom:'1px solid #f0f0ec',
                background: i%2===0?'#fff':'#fafaf8' }}>
                {/* # */}
                <td style={{ padding:'8px 12px', textAlign:'center', color:'#9a9a98', fontSize:11, width:32 }}>{i+1}</td>

                {/* Desc — inline editable */}
                <td style={{ padding:'4px 8px' }}>
                  {editCell?.id===it.id && editCell.field==='desc'
                    ? <input autoFocus defaultValue={it.desc}
                        onBlur={e=>updateItem(it.id,'desc',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:'100%', boxSizing:'border-box', padding:'5px 8px',
                          border:`1.5px solid ${G}`, borderRadius:5, fontFamily:F.sans,
                          fontSize:13, outline:'none', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'desc'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontWeight:500,
                          color:'#1a1a18', borderRadius:4, minHeight:28,
                          ':hover':{background:'#f0f7ec'} }}>
                        {it.desc}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:4 }}>✎</span>
                      </div>
                  }
                </td>

                {/* Cant — inline editable */}
                <td style={{ padding:'4px 8px', textAlign:'right', width:70 }}>
                  {editCell?.id===it.id && editCell.field==='cant'
                    ? <input autoFocus type="number" defaultValue={it.cant} min="0.001" step="any"
                        onFocus={e=>e.target.select()}
                        onBlur={e=>updateItem(it.id,'cant',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:70, padding:'5px 6px', border:`1.5px solid ${G}`,
                          borderRadius:5, fontFamily:F.mono, fontSize:13, outline:'none',
                          textAlign:'right', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'cant'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontFamily:F.mono,
                          textAlign:'right', color:'#3a3a38' }}>
                        {it.cant}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:2 }}>✎</span>
                      </div>
                  }
                </td>

                {/* Precio — inline editable */}
                <td style={{ padding:'4px 8px', textAlign:'right', width:110 }}>
                  {editCell?.id===it.id && editCell.field==='precio'
                    ? <input autoFocus type="number" defaultValue={it.precio} min="0" step="0.01"
                        onFocus={e=>e.target.select()}
                        onBlur={e=>updateItem(it.id,'precio',e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') e.target.blur(); }}
                        style={{ width:100, padding:'5px 6px', border:`1.5px solid ${G}`,
                          borderRadius:5, fontFamily:F.mono, fontSize:13, outline:'none',
                          textAlign:'right', background:'#f0f7ec' }} />
                    : <div onClick={()=>setEditCell({id:it.id,field:'precio'})}
                        title="Click para editar"
                        style={{ padding:'6px 4px', cursor:'text', fontFamily:F.mono,
                          textAlign:'right', color:'#3a3a38' }}>
                        {fmtMoney(it.precio, moneda)}
                        <span style={{ color:'#d1d5db', fontSize:10, marginLeft:2 }}>✎</span>
                      </div>
                  }
                </td>

                {/* IVA */}
                <td style={{ padding:'8px 12px', textAlign:'right', width:70 }}>
                  <select value={it.iva}
                    onChange={e=>updateItem(it.id,'iva',e.target.value)}
                    style={{ border:'none', background:'transparent', fontFamily:F.sans,
                      fontSize:12, color:'#6a6a68', cursor:'pointer', outline:'none' }}>
                    {IVA_RATES.map(r=><option key={r} value={r}>{r===0?'Ex':r+'%'}</option>)}
                  </select>
                </td>

                {/* Total */}
                <td style={{ padding:'8px 12px', textAlign:'right', width:110 }}>
                  <span style={{ fontFamily:F.serif, fontSize:15, color:G }}>
                    {fmtMoney(lineTotal, moneda)}
                  </span>
                </td>

                {/* Delete */}
                <td style={{ padding:'8px 10px', textAlign:'center', width:36 }}>
                  <button onClick={()=>setItems(prev=>prev.filter(x=>x.id!==it.id))}
                    title="Eliminar línea"
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#d1d5db', fontSize:16, lineHeight:1, padding:2,
                      borderRadius:4, transition:'color .1s' }}
                    onMouseEnter={e=>e.currentTarget.style.color='#dc2626'}
                    onMouseLeave={e=>e.currentTarget.style.color='#d1d5db'}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding:'6px 14px', background:'#f9f9f7', borderTop:'1px solid #f0f0ec',
        fontFamily:F.sans, fontSize:10, color:'#c8c8c4' }}>
        Click en cualquier celda para editar · IVA cambiable directo en cada línea
      </div>
    </div>
  );
}

// ─── Modal Factura ─────────────────────────────────────────────────────────
function ModalFactura({ clientes, productos, prefill=null, onSave, onClose }) {
  const prefCliente = prefill?.clienteId
    ? clientes.find(c=>c.id===prefill.clienteId) : null;

  const COND_DEFAULT = COND_PAGO.find(c=>c.value==='credito_30')||COND_PAGO[0];
  const condCliente = prefCliente
    ? COND_PAGO.find(c=>c.value===prefCliente.condPago)||COND_DEFAULT
    : COND_DEFAULT;

  const [tipo,       setTipo]       = useState('e-Factura');
  const [moneda,     setMoneda]     = useState('UYU');
  const [fecha,      setFecha]      = useState(today());
  const [fechaVenc,  setFechaVenc]  = useState(
    condCliente.dias > 0 ? addDays(today(), condCliente.dias) : ''
  );
  const [clienteId,      setClienteId]      = useState(prefCliente?.id||'');
  const [clienteNombre,  setClienteNombre]  = useState(prefCliente?.nombre||'');
  const [clienteRut,     setClienteRut]     = useState(prefCliente?.rut||'');
  const [items,      setItems]      = useState(prefill?.items||[]);
  const [notas,      setNotas]      = useState(prefill?.notas||'');
  const [descuento,  setDescuento]  = useState(0);

  const handleCliente = id => {
    const c = clientes.find(x=>x.id===id);
    if (!c) return;
    setClienteId(id); setClienteNombre(c.nombre); setClienteRut(c.rut||'');
    const cond = COND_PAGO.find(p=>p.value===c.condPago)||COND_PAGO[0];
    if (cond.dias > 0) setFechaVenc(addDays(today(), cond.dias));
    else setFechaVenc('');
  };

  const subtotal  = items.reduce((s,it)=>s+it.cant*it.precio, 0);
  const descMonto = subtotal * (descuento/100);
  const ivaTotal  = items.reduce((s,it)=>s+(it.cant*it.precio*(1-descuento/100))*(it.iva/100), 0);
  const total     = subtotal - descMonto + ivaTotal;
  const canSave   = clienteNombre && items.length > 0;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center',
      justifyContent:'center', background:'rgba(10,10,8,.55)', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#fff', borderRadius:20, width:800, maxHeight:'94vh',
        overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 32px 80px rgba(0,0,0,.22)' }}>

        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f0f0ec',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            <div>
              <Lbl>Nuevo CFE</Lbl>
              <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18' }}>Emitir comprobante</div>
            </div>
            {/* Quick tipo selector inline */}
            <div style={{ display:'flex', gap:4 }}>
              {Object.keys(CFE_TIPOS).map(t=>(
                <button key={t} onClick={()=>setTipo(t)} style={{
                  padding:'5px 10px', border:`1.5px solid ${tipo===t?G:'#e2e2de'}`,
                  borderRadius:20, fontFamily:F.sans, fontSize:11, fontWeight:tipo===t?700:500,
                  cursor:'pointer', background:tipo===t?'#f0f7ec':'#fff',
                  color:tipo===t?G:'#6a6a68', transition:'all .12s',
                }}>
                  {CFE_TIPOS[t].icon} {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'#f0f0ec', border:'none', borderRadius:8,
            width:32, height:32, cursor:'pointer', fontSize:16, color:'#6a6a68', flexShrink:0 }}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'16px 24px' }}>

          {/* Fila: cliente + fecha + venc + moneda — compacta */}
          <div style={{ display:'grid', gridTemplateColumns:'2.5fr 1fr 1fr 0.8fr', gap:12, marginBottom:14 }}>
            <div>
              <Lbl>Cliente *</Lbl>
              {clientes.length > 0
                ? <Sel value={clienteId} onChange={e=>handleCliente(e.target.value)}>
                    <option value="">— Seleccionar cliente —</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.condPago&&c.condPago!=='contado'?' ★':''}</option>)}
                  </Sel>
                : <Inp value={clienteNombre} onChange={e=>setClienteNombre(e.target.value)} placeholder="Nombre" />
              }
            </div>
            <div><Lbl>Fecha emisión</Lbl>
              <Inp type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
            </div>
            <div><Lbl>Vencimiento</Lbl>
              <Inp type="date" value={fechaVenc} onChange={e=>setFechaVenc(e.target.value)} />
            </div>
            <div><Lbl>Moneda</Lbl>
              <Sel value={moneda} onChange={e=>setMoneda(e.target.value)}>
                {MONEDAS.map(m=><option key={m}>{m}</option>)}
              </Sel>
            </div>
          </div>

          {/* Info cliente si seleccionado */}
          {clienteId && (() => {
            const cli = clientes.find(x=>x.id===clienteId);
            if (!cli) return null;
            const cond = COND_PAGO.find(c=>c.value===cli.condPago);
            return (
              <div style={{ background:'#f0f7ec', borderRadius:8, padding:'8px 14px',
                display:'flex', gap:20, marginBottom:12, alignItems:'center' }}>
                {cli.rut && <span style={{ fontFamily:F.mono, fontSize:11, color:'#6a6a68' }}>RUT {cli.rut}</span>}
                {cond && <span style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:G }}>✓ {cond.label}</span>}
                {cli.limiteCredito && <span style={{ fontFamily:F.sans, fontSize:11, color:'#6a6a68' }}>Límite: {fmtMoney(cli.limiteCredito)}</span>}
                {cli.emailFacturacion && <span style={{ fontFamily:F.sans, fontSize:11, color:'#6a6a68' }}>📧 {cli.emailFacturacion}</span>}
              </div>
            );
          })()}

          {/* ── PRODUCTO SEARCH + TABLE (the key UX) ── */}
          <ItemSearchRow productos={productos} onAdd={it=>setItems(prev=>[...prev,it])} />
          <ItemsTable items={items} setItems={setItems} moneda={moneda} />

          {/* Notas + totales */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 200px', gap:16 }}>
            <div>
              <Lbl>Notas</Lbl>
              <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={2}
                placeholder="Condición de pago, referencia, instrucciones..."
                style={{ width:'100%', boxSizing:'border-box', padding:'8px 11px',
                  border:'1.5px solid #e2e2de', borderRadius:7, fontFamily:F.sans,
                  fontSize:13, resize:'vertical', outline:'none' }} />
            </div>
            <div style={{ display:'grid', gap:5, alignContent:'start' }}>
              {[['Subtotal', fmtMoney(subtotal,moneda)],
                ['IVA total', fmtMoney(ivaTotal,moneda)],
                descuento>0 ? ['Descuento', `-${fmtMoney(descMonto,moneda)}`] : null,
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between',
                  fontFamily:F.sans, fontSize:12, color:'#6a6a68' }}>
                  <span>{l}</span><span style={{ fontFamily:F.mono }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid #1a1a18', paddingTop:8,
                display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:F.sans, fontSize:14, fontWeight:700 }}>TOTAL</span>
                <span style={{ fontFamily:F.serif, fontSize:22, color:G }}>{fmtMoney(total,moneda)}</span>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                <Lbl>Desc %</Lbl>
                <Inp type="number" min="0" max="100" value={descuento}
                  onChange={e=>setDescuento(Number(e.target.value))}
                  style={{ textAlign:'right', fontFamily:F.mono, padding:'5px 8px' }} />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding:'12px 24px 18px', borderTop:'1px solid #f0f0ec',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontFamily:F.sans, fontSize:12, color:'#9a9a98' }}>
            {items.length} línea{items.length!==1?'s':''} · {fmtMoney(total,moneda)}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>onSave({tipo,moneda,fecha,fechaVenc,clienteId,clienteNombre,clienteRut,items,notas,descuento,subtotal,ivaTotal,total,status:'borrador'})}
              disabled={!canSave} style={{ background:'#f0f0ec', color:'#3a3a38', border:'none',
              borderRadius:8, padding:'9px 18px', fontFamily:F.sans, fontSize:13,
              fontWeight:600, cursor:'pointer', opacity:!canSave?.4:1 }}>
              Borrador
            </button>
            <button onClick={()=>onSave({tipo,moneda,fecha,fechaVenc,clienteId,clienteNombre,clienteRut,items,notas,descuento,subtotal,ivaTotal,total,status:'emitida'})}
              disabled={!canSave} style={{ background:G, color:'#fff', border:'none',
              borderRadius:8, padding:'9px 24px', fontFamily:F.sans, fontSize:13, fontWeight:600,
              cursor:'pointer', opacity:!canSave?.4:1,
              boxShadow:'0 2px 8px rgba(58,125,30,.3)' }}>
              Emitir CFE →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function FacturacionTab({ products=[], clientes: clientesProp=[] }) {
  const KCFE  = 'aryes-cfe';
  const KCOB  = 'aryes-cobros';
  const KCLI  = 'aryes-clients';
  const KSEQ  = 'aryes-cfe-seq';

  const [cfes,    setCfes]    = useState(()=>LS.get(KCFE,[]));
  const [cobros,  setCobros]  = useState(()=>LS.get(KCOB,[]));
  const [clientes,setClientes]= useState(()=>{
    const c = LS.get(KCLI,[]);
    return clientesProp.length>0 ? clientesProp : c;
  });
  const [seq,     setSeq]     = useState(()=>LS.get(KSEQ,1));

  const [vista,   setVista]   = useState('comprobantes');
  const [showCFE, setShowCFE] = useState(false);
  const [showCob, setShowCob] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCli,    setFiltroCli]    = useState('todos');
  const [busq,         setBusq]         = useState('');
  const [detalleCli,   setDetalleCli]   = useState(null);

  const saveCfes  = arr => { setCfes(arr);   LS.set(KCFE,arr); };
  const saveCobros= arr => { setCobros(arr); LS.set(KCOB,arr); };

  // ── Emitir CFE ────────────────────────────────────────────────────────
  const handleSaveCFE = form => {
    const code   = CFE_TIPOS[form.tipo]?.code||'CFE';
    const numero = `${code}-${String(seq).padStart(6,'0')}`;
    const nuevo  = { ...form, id:newId(), numero,
      saldoPendiente: form.total,
      createdAt: new Date().toISOString() };
    saveCfes([nuevo,...cfes]);
    setSeq(s=>{ const n=s+1; LS.set(KSEQ,n); return n; });
    setShowCFE(false); setPrefill(null);
    // Persist to Supabase (non-blocking)
    db.upsert('ventas',{ id:nuevo.id, numero, tipo:nuevo.tipo,
      cliente_id:nuevo.clienteId||null, cliente_nombre:nuevo.clienteNombre,
      cliente_rut:nuevo.clienteRut||'', total:nuevo.total, moneda:nuevo.moneda,
      fecha:nuevo.fecha, fecha_venc:nuevo.fechaVenc||null,
      status:nuevo.status, items:nuevo.items, notas:nuevo.notas,
      created_at:nuevo.createdAt
    }).catch(()=>{});
  };

  // ── Registrar cobro ────────────────────────────────────────────────────
  const handleSaveCobro = ({ clienteId, monto, metodo, fecha, fechaCheque, notas, facturasAplicar }) => {
    const cobro = { id:newId(), clienteId, monto, metodo, fecha, fechaCheque, notas,
      facturasAplicar, createdAt:new Date().toISOString() };
    saveCobros([cobro,...cobros]);

    // Update saldo pendiente en cada CFE aplicado
    let remaining = monto;
    const updCfes = cfes.map(c => {
      if (!facturasAplicar.includes(c.id) || remaining<=0) return c;
      const saldo  = c.saldoPendiente||c.total||0;
      const aplicar= Math.min(saldo, remaining);
      remaining   -= aplicar;
      const newSaldo = saldo - aplicar;
      return { ...c,
        saldoPendiente: newSaldo,
        status: newSaldo<=0.01 ? 'cobrada' : 'cobrado_parcial',
      };
    });
    saveCfes(updCfes);
    setShowCob(false);
  };

  const anular = id => {
    if (!window.confirm('¿Anular este CFE?')) return;
    saveCfes(cfes.map(c=>c.id===id ? {...c,status:'anulada'} : c));
  };

  // ── Computed ──────────────────────────────────────────────────────────
  const cfesFiltrados = useMemo(()=>cfes.filter(c=>{
    if (filtroStatus!=='todos'&&c.status!==filtroStatus) return false;
    if (filtroCli!=='todos'&&c.clienteId!==filtroCli) return false;
    if (busq) { const q=busq.toLowerCase();
      return (c.numero||'').toLowerCase().includes(q)||(c.clienteNombre||'').toLowerCase().includes(q); }
    return true;
  }),[cfes,filtroStatus,filtroCli,busq]);

  // Deudores: CFEs emitidas/parciales con saldo
  const deudores = useMemo(()=>{
    const map = {};
    cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&(c.saldoPendiente||c.total)>0)
      .forEach(c=>{
        if (!map[c.clienteId]) map[c.clienteId]={
          clienteId:c.clienteId, nombre:c.clienteNombre, facturas:[], totalDeuda:0, diasMaxVenc:0
        };
        const dias = c.fechaVenc ? Math.max(0,-daysUntil(c.fechaVenc)) : 0;
        map[c.clienteId].facturas.push(c);
        map[c.clienteId].totalDeuda += (c.saldoPendiente||c.total||0);
        if (dias > map[c.clienteId].diasMaxVenc) map[c.clienteId].diasMaxVenc = dias;
      });
    return Object.values(map).sort((a,b)=>b.diasMaxVenc-a.diasMaxVenc);
  },[cfes]);

  const totalDeuda    = deudores.reduce((s,d)=>s+d.totalDeuda,0);
  const vencidasHoy   = cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc&&daysUntil(c.fechaVenc)<0);
  const venceEsta     = cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc&&daysUntil(c.fechaVenc)>=0&&daysUntil(c.fechaVenc)<=7);
  const totalEmitido  = cfes.filter(c=>['emitida','aceptada','cobrada'].includes(c.status)).reduce((s,c)=>s+c.total,0);

  const clienteDetalle = detalleCli ? clientes.find(c=>c.id===detalleCli)||{id:detalleCli,nombre:'Cliente'} : null;
  const cfesCliente    = detalleCli ? cfes.filter(c=>c.clienteId===detalleCli) : [];
  const cobrosCliente  = detalleCli ? cobros.filter(c=>c.clienteId===detalleCli) : [];

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="au" style={{ maxWidth:1200 }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@400;500&display=swap" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
        marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <Lbl>Facturación electrónica · Cuentas corrientes</Lbl>
          <h1 style={{ fontFamily:F.serif, fontSize:38, fontWeight:400, color:'#1a1a18',
            margin:0, letterSpacing:'-.02em', lineHeight:1 }}>Facturación</h1>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>setShowCob(true)} style={{ background:'#fff', color:G,
            border:`1.5px solid ${G}`, borderRadius:10, padding:'10px 20px',
            fontFamily:F.sans, fontSize:13, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6 }}>
            💰 Registrar cobro
          </button>
          <button onClick={()=>{setPrefill(null);setShowCFE(true);}} style={{
            background:G, color:'#fff', border:'none', borderRadius:10,
            padding:'10px 24px', fontFamily:F.sans, fontSize:13, fontWeight:600,
            cursor:'pointer', display:'flex', alignItems:'center', gap:8,
            boxShadow:'0 2px 8px rgba(58,125,30,.3)',
          }}>+ Nuevo CFE</button>
        </div>
      </div>

      {/* ── Alerta proveedor DGI ───────────────────────────────────── */}
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10,
        padding:'12px 18px', display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
        <span style={{ fontSize:18 }}>🔗</span>
        <div style={{ flex:1, fontFamily:F.sans, fontSize:13 }}>
          <b style={{ color:'#1e40af' }}>Proveedor habilitado DGI no configurado — </b>
          <span style={{ color:'#3b82f6' }}>CFEs guardados localmente. Cuando confirmes UCFE o pymo, se enviarán automáticamente.</span>
        </div>
        <span style={{ background:'#dbeafe', color:'#2563eb', fontFamily:F.sans, fontSize:11,
          fontWeight:700, padding:'4px 12px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap' }}>
          Configurar →
        </span>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
        background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
        <KpiCard label="Deuda total" value={totalDeuda>0?fmtMoney(totalDeuda):'—'}
          sub={`${deudores.length} clientes con saldo`} accent={totalDeuda>0?'#dc2626':'#e2e2de'} danger />
        <KpiCard label="Facturas vencidas" value={vencidasHoy.length}
          sub="sin cobrar" accent={vencidasHoy.length>0?'#dc2626':'#e2e2de'} danger
          onClick={()=>{setVista('informes');}} />
        <KpiCard label="Vencen esta semana" value={venceEsta.length}
          sub="próximos 7 días" accent={venceEsta.length>0?'#d97706':'#e2e2de'} />
        <KpiCard label="Emitido total" value={totalEmitido>0?fmtMoney(totalEmitido):'—'}
          sub={`${cfes.filter(c=>c.status==='cobrada').length} cobradas`} accent={G} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div style={{ borderBottom:'1px solid #e2e2de', marginBottom:22, display:'flex', gap:0 }}>
        {[
          ['comprobantes','🧾 Comprobantes'],
          ['cuenta',      '📊 Cuenta corriente'],
          ['cobros',      '💰 Cobros'],
          ['informes',    '📋 Informes'],
        ].map(([v,l])=>
          <TabBtn key={v} active={vista===v} onClick={()=>setVista(v)}>{l}</TabBtn>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          VISTA: COMPROBANTES
      ══════════════════════════════════════════════════════════════ */}
      {vista==='comprobantes' && (
        <div>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="Buscar por número o cliente..."
              style={{ flex:1, minWidth:200, padding:'8px 14px 8px 36px', border:'1.5px solid #e2e2de',
                borderRadius:8, fontFamily:F.sans, fontSize:13, outline:'none',
                backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a9a98' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")",
                backgroundRepeat:'no-repeat', backgroundPosition:'12px center' }} />
            <Sel value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} style={{ width:180 }}>
              <option value="todos">Todos los clientes</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Sel>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['todos',...Object.keys(CFE_STATUS)].map(s=>(
                <button key={s} onClick={()=>setFiltroStatus(s)} style={{
                  padding:'6px 14px', borderRadius:20, fontFamily:F.sans, fontSize:12,
                  fontWeight:filtroStatus===s?700:500, cursor:'pointer',
                  border:`1.5px solid ${filtroStatus===s?G:'#e2e2de'}`,
                  background:filtroStatus===s?'#f0f7ec':'#fff',
                  color:filtroStatus===s?G:'#6a6a68', transition:'all .12s',
                }}>
                  {s==='todos'?'Todos':CFE_STATUS[s].label}
                </button>
              ))}
            </div>
          </div>

          {cfesFiltrados.length===0 ? (
            <div style={{ textAlign:'center', padding:'60px 40px', background:'#fff',
              borderRadius:12, border:'1px solid #e2e2de' }}>
              <div style={{ fontSize:48, marginBottom:14, opacity:.5 }}>🧾</div>
              <div style={{ fontFamily:F.serif, fontSize:26, color:'#1a1a18', marginBottom:8 }}>Sin comprobantes aún</div>
              <div style={{ fontFamily:F.sans, fontSize:14, color:'#9a9a98', marginBottom:24 }}>
                Emití tu primer CFE para empezar a gestionar facturación electrónica.
              </div>
              <button onClick={()=>setShowCFE(true)} style={{ background:G, color:'#fff',
                border:'none', borderRadius:10, padding:'12px 28px', fontFamily:F.sans,
                fontSize:14, fontWeight:600, cursor:'pointer' }}>+ Nuevo CFE</button>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de', overflow:'hidden' }}>
              <div style={{ display:'grid',
                gridTemplateColumns:'130px 110px 1fr 90px 120px 110px 100px',
                padding:'10px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                {['Número','Tipo','Cliente','Fecha','Venc.','Total','Estado'].map(h=>
                  <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                    letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
              </div>
              {cfesFiltrados.map((c,i)=>{
                const vencida = c.fechaVenc && daysUntil(c.fechaVenc)<0 &&
                  ['emitida','cobrado_parcial'].includes(c.status);
                return (
                  <div key={c.id} style={{
                    display:'grid',
                    gridTemplateColumns:'130px 110px 1fr 90px 120px 110px 100px',
                    padding:'13px 18px',
                    borderBottom:i<cfesFiltrados.length-1?'1px solid #f0f0ec':'none',
                    background: vencida?'#fef2f2' : i%2===0?'#fff':'#fafaf8',
                    transition:'background .1s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f7ec'}
                  onMouseLeave={e=>e.currentTarget.style.background=vencida?'#fef2f2':i%2===0?'#fff':'#fafaf8'}>
                    <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:600, color:'#1a1a18',
                      display:'flex', alignItems:'center' }}>{c.numero}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:F.sans, fontSize:12 }}>
                      {CFE_TIPOS[c.tipo]?.icon} {c.tipo}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans,
                      fontSize:13, fontWeight:500, color:'#1a1a18' }}>
                      <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                        style={{ background:'none', border:'none', cursor:'pointer',
                        fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0,
                        textDecoration:'underline', textDecorationColor:'#b8d9a8' }}>
                        {c.clienteNombre||'—'}
                      </button>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans,
                      fontSize:12, color:'#9a9a98' }}>{fmtDateShort(c.fecha)}</div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.sans, fontSize:12,
                      color: vencida?'#dc2626':'#9a9a98', fontWeight:vencida?700:400 }}>
                      {c.fechaVenc ? (vencida
                        ? `Vencida ${Math.abs(daysUntil(c.fechaVenc))}d`
                        : fmtDateShort(c.fechaVenc)) : '—'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', fontFamily:F.serif,
                      fontSize:16, color:G }}>{fmtMoney(c.total,c.moneda)}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Pill status={c.status} />
                      {c.status!=='anulada'&&c.status!=='cobrada' && (
                        <button onClick={()=>anular(c.id)} title="Anular" style={{
                          background:'none', border:'none', cursor:'pointer',
                          color:'#9a9a98', fontSize:14, padding:0 }}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: CUENTA CORRIENTE
      ══════════════════════════════════════════════════════════════ */}
      {vista==='cuenta' && (
        <div>
          {/* Selector de cliente */}
          <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ flex:1, maxWidth:320 }}>
              <Lbl>Ver cuenta de</Lbl>
              <Sel value={detalleCli||''} onChange={e=>setDetalleCli(e.target.value||null)}>
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Sel>
            </div>
            {clienteDetalle && (
              <button onClick={()=>{setPrefill({clienteId:clienteDetalle.id,clienteNombre:clienteDetalle.nombre});setShowCFE(true);}}
                style={{ background:G, color:'#fff', border:'none', borderRadius:8,
                padding:'9px 18px', fontFamily:F.sans, fontSize:13, fontWeight:600,
                cursor:'pointer', marginTop:18 }}>+ Facturar</button>
            )}
          </div>

          {!clienteDetalle ? (
            <div style={{ textAlign:'center', padding:'48px', color:'#9a9a98',
              fontFamily:F.sans, fontSize:13, background:'#f9f9f7', borderRadius:12 }}>
              Seleccioná un cliente para ver su cuenta corriente
            </div>
          ) : (
            <div>
              {/* Header cliente */}
              <div style={{ background:'#fff', borderRadius:12, padding:'20px 24px',
                border:'1px solid #e2e2de', marginBottom:16,
                display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16 }}>
                {[
                  ['Cliente', clienteDetalle.nombre],
                  ['RUT', clienteDetalle.rut||'—'],
                  ['Cond. pago', COND_PAGO.find(c=>c.value===clienteDetalle.condPago)?.label||'—'],
                  ['Límite crédito', clienteDetalle.limiteCredito
                    ? fmtMoney(clienteDetalle.limiteCredito) : 'Sin límite'],
                ].map(([l,v])=>(
                  <div key={l}>
                    <Lbl>{l}</Lbl>
                    <div style={{ fontFamily:F.sans, fontSize:14, fontWeight:600, color:'#1a1a18' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* KPIs del cliente */}
              {(() => {
                const deudaCliente = cfesCliente
                  .filter(c=>['emitida','cobrado_parcial'].includes(c.status))
                  .reduce((s,c)=>s+(c.saldoPendiente||c.total||0),0);
                const vencidasCli = cfesCliente.filter(c=>
                  ['emitida','cobrado_parcial'].includes(c.status)&&
                  c.fechaVenc&&daysUntil(c.fechaVenc)<0);
                const cobradoCli  = cobrosCliente.reduce((s,c)=>s+c.monto,0);
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
                    background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                    <KpiCard label="Saldo deudor" value={deudaCliente>0?fmtMoney(deudaCliente):'—'}
                      accent={deudaCliente>0?'#dc2626':G} danger={deudaCliente>0} />
                    <KpiCard label="Facturas vencidas" value={vencidasCli.length}
                      accent={vencidasCli.length>0?'#dc2626':'#e2e2de'} danger={vencidasCli.length>0} />
                    <KpiCard label="Total cobrado" value={cobradoCli>0?fmtMoney(cobradoCli):'—'}
                      sub={`${cobrosCliente.length} cobros registrados`} accent={G} />
                    <KpiCard label="CFEs totales" value={cfesCliente.length}
                      sub={`${cfesCliente.filter(c=>c.status==='cobrada').length} cobradas`} />
                  </div>
                );
              })()}

              {/* Movimientos */}
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
                overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f0f0ec',
                  fontFamily:F.sans, fontSize:11, fontWeight:700, letterSpacing:'0.1em',
                  textTransform:'uppercase', color:'#9a9a98',
                  display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px 110px' }}>
                  {['Fecha','Comprobante/Cobro','Débito','Crédito','Saldo','Estado'].map(h=>
                    <div key={h}>{h}</div>)}
                </div>
                {/* Combinar CFEs + cobros del cliente ordenados por fecha */}
                {(() => {
                  const movs = [
                    ...cfesCliente.map(c=>({...c, _tipo:'cfe', _fecha:c.fecha})),
                    ...cobrosCliente.map(c=>({...c, _tipo:'cobro', _fecha:c.fecha})),
                  ].sort((a,b)=>new Date(b._fecha)-new Date(a._fecha));

                  let saldo = 0;
                  // calc saldo running (reverse)
                  const withSaldo = [...movs].reverse().map(m=>{
                    if (m._tipo==='cfe') saldo += m.total||0;
                    else saldo -= m.monto||0;
                    return {...m, _saldoAcum:saldo};
                  }).reverse();

                  if (withSaldo.length===0) return (
                    <div style={{ padding:'32px', textAlign:'center', color:'#9a9a98',
                      fontFamily:F.sans, fontSize:13 }}>
                      Sin movimientos para este cliente
                    </div>
                  );

                  return withSaldo.map((m,i)=>(
                    <div key={m.id} style={{
                      display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px 110px',
                      padding:'12px 18px', fontFamily:F.sans, fontSize:13,
                      borderBottom:i<withSaldo.length-1?'1px solid #f0f0ec':'none',
                      background: m._tipo==='cfe'&&m.status==='anulada'?'#f9f9f7':
                        i%2===0?'#fff':'#fafaf8',
                    }}>
                      <div style={{ color:'#9a9a98', fontSize:12 }}>{fmtDateShort(m._fecha)}</div>
                      <div style={{ fontWeight:500 }}>
                        {m._tipo==='cfe'
                          ? <><span style={{ fontFamily:F.mono, fontSize:12 }}>{m.numero}</span>
                              <span style={{ color:'#9a9a98', marginLeft:8, fontSize:11 }}>{m.tipo}</span></>
                          : <><span style={{ color:G, fontWeight:700 }}>💰 Cobro</span>
                              <span style={{ color:'#9a9a98', marginLeft:8, fontSize:11 }}>{m.metodo}</span></>
                        }
                      </div>
                      <div style={{ fontFamily:F.mono, color:'#dc2626', fontWeight:m._tipo==='cfe'?700:400 }}>
                        {m._tipo==='cfe' ? fmtMoney(m.total,m.moneda) : ''}
                      </div>
                      <div style={{ fontFamily:F.mono, color:G, fontWeight:m._tipo==='cobro'?700:400 }}>
                        {m._tipo==='cobro' ? fmtMoney(m.monto) : ''}
                      </div>
                      <div style={{ fontFamily:F.mono, fontSize:12, color:m._saldoAcum>0?'#dc2626':G, fontWeight:700 }}>
                        {fmtMoney(Math.abs(m._saldoAcum))}
                      </div>
                      <div>{m._tipo==='cfe'&&<Pill status={m.status}/>}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: COBROS
      ══════════════════════════════════════════════════════════════ */}
      {vista==='cobros' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:16 }}>
            <div style={{ fontFamily:F.sans, fontSize:13, color:'#6a6a68' }}>
              {cobros.length} cobros registrados
            </div>
            <button onClick={()=>setShowCob(true)} style={{ background:G, color:'#fff',
              border:'none', borderRadius:8, padding:'9px 18px', fontFamily:F.sans,
              fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Registrar cobro</button>
          </div>

          {cobros.length===0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:'#f9f9f7',
              borderRadius:12, color:'#9a9a98', fontFamily:F.sans, fontSize:13 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>💰</div>
              Sin cobros registrados aún
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
              overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 140px 120px 80px',
                padding:'10px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                {['Fecha','Cliente','Método','Monto','Facturas'].map(h=>
                  <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                    letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
              </div>
              {cobros.map((c,i)=>{
                const cli = clientes.find(x=>x.id===c.clienteId);
                return (
                  <div key={c.id} style={{
                    display:'grid', gridTemplateColumns:'100px 1fr 140px 120px 80px',
                    padding:'13px 18px', fontFamily:F.sans, fontSize:13,
                    borderBottom:i<cobros.length-1?'1px solid #f0f0ec':'none',
                    background:i%2===0?'#fff':'#fafaf8',
                  }}>
                    <div style={{ color:'#9a9a98', fontSize:12 }}>{fmtDateShort(c.fecha)}</div>
                    <div style={{ fontWeight:600 }}>
                      <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                        style={{ background:'none', border:'none', cursor:'pointer',
                        fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0 }}>
                        {cli?.nombre||c.clienteId||'—'}
                      </button>
                    </div>
                    <div style={{ color:'#6a6a68' }}>
                      <span style={{ background:'#f0f0ec', padding:'2px 8px', borderRadius:20,
                        fontSize:11, fontWeight:600 }}>{c.metodo}</span>
                      {c.fechaCheque && <span style={{ marginLeft:6, fontSize:11, color:'#9a9a98' }}>
                        dep. {fmtDateShort(c.fechaCheque)}</span>}
                    </div>
                    <div style={{ fontFamily:F.serif, fontSize:18, color:G, fontWeight:400 }}>
                      {fmtMoney(c.monto)}
                    </div>
                    <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98' }}>
                      {c.facturasAplicar?.length>0 ? `${c.facturasAplicar.length} fact.` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: INFORMES
      ══════════════════════════════════════════════════════════════ */}
      {vista==='informes' && (
        <div style={{ display:'grid', gap:24 }}>

          {/* Resumen aging */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
            padding:'20px 24px' }}>
            <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18', marginBottom:16 }}>
              Antigüedad de deuda (Aging)
            </div>
            {(() => {
              const buckets = { 'Al día':0, '1-30d':0, '31-60d':0, '61-90d':0, '+90d':0 };
              const colors  = { 'Al día':'#16a34a', '1-30d':'#d97706', '31-60d':'#ea580c', '61-90d':'#dc2626', '+90d':'#7f1d1d' };
              cfes.filter(c=>['emitida','cobrado_parcial'].includes(c.status)&&c.fechaVenc)
                .forEach(c=>{
                  const d = -daysUntil(c.fechaVenc);
                  const b = agingBucket(d);
                  if (buckets[b.label]!==undefined) buckets[b.label]+=(c.saldoPendiente||c.total||0);
                });
              const total = Object.values(buckets).reduce((s,v)=>s+v,0)||1;
              return (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1,
                  background:'#e2e2de', borderRadius:10, overflow:'hidden' }}>
                  {Object.entries(buckets).map(([label,val])=>(
                    <div key={label} style={{ background:'#fff', padding:'16px 18px',
                      borderTop:`3px solid ${colors[label]}` }}>
                      <div style={{ fontFamily:F.sans, fontSize:11, fontWeight:700,
                        color:colors[label], marginBottom:6, textTransform:'uppercase',
                        letterSpacing:'0.08em' }}>{label}</div>
                      <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18' }}>
                        {val>0?fmtMoney(val):'—'}
                      </div>
                      <div style={{ height:4, background:'#f0f0ec', borderRadius:2, marginTop:8 }}>
                        <div style={{ height:'100%', background:colors[label], borderRadius:2,
                          width:`${(val/total)*100}%`, transition:'width .4s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Listado de deudores */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e2de',
            overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f0f0ec',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:F.serif, fontSize:22, color:'#1a1a18' }}>Listado de deudores</div>
              <div style={{ fontFamily:F.sans, fontSize:13, color:'#9a9a98' }}>
                {deudores.length} clientes · {fmtMoney(totalDeuda)} total
              </div>
            </div>
            {deudores.length===0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#16a34a',
                fontFamily:F.sans, fontSize:14, fontWeight:600 }}>
                ✓ Sin deudores — todas las cuentas al día
              </div>
            ) : (
              <>
                <div style={{ display:'grid',
                  gridTemplateColumns:'1fr 80px 120px 110px 80px 100px',
                  padding:'9px 18px', background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                  {['Cliente','Facturas','Total deuda','Venc. máx.','Aging',''].map(h=>
                    <div key={h} style={{ fontFamily:F.sans, fontSize:10, fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{h}</div>)}
                </div>
                {deudores.map((d,i)=>{
                  const bkt = agingBucket(d.diasMaxVenc);
                  return (
                    <div key={d.clienteId} style={{
                      display:'grid', gridTemplateColumns:'1fr 80px 120px 110px 80px 100px',
                      padding:'13px 18px', fontFamily:F.sans, fontSize:13,
                      borderBottom:i<deudores.length-1?'1px solid #f0f0ec':'none',
                      background:i%2===0?'#fff':'#fafaf8',
                    }}>
                      <div style={{ fontWeight:600 }}>
                        <button onClick={()=>{setDetalleCli(d.clienteId);setVista('cuenta');}}
                          style={{ background:'none', border:'none', cursor:'pointer',
                          fontFamily:F.sans, fontSize:13, fontWeight:700, color:G, padding:0,
                          textDecoration:'underline', textDecorationColor:'#b8d9a8' }}>
                          {d.nombre||'—'}
                        </button>
                      </div>
                      <div style={{ color:'#6a6a68' }}>{d.facturas.length}</div>
                      <div style={{ fontFamily:F.serif, fontSize:17, color:'#dc2626', fontWeight:400 }}>
                        {fmtMoney(d.totalDeuda)}
                      </div>
                      <div style={{ fontFamily:F.sans, fontSize:12,
                        color:d.diasMaxVenc>0?'#dc2626':'#16a34a', fontWeight:d.diasMaxVenc>0?700:400 }}>
                        {d.diasMaxVenc>0?`${d.diasMaxVenc}d vencida`:'Al día'}
                      </div>
                      <div>
                        <span style={{ background:bkt.bg, color:bkt.color,
                          fontFamily:F.sans, fontSize:10, fontWeight:700,
                          padding:'3px 9px', borderRadius:20, textTransform:'uppercase',
                          letterSpacing:'0.07em' }}>{bkt.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>{setDetalleCli(d.clienteId);setVista('cuenta');}}
                          style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:'#2563eb',
                          background:'#eff6ff', border:'none', borderRadius:6, padding:'4px 10px',
                          cursor:'pointer' }}>Ver</button>
                        <button onClick={()=>setShowCob(true)}
                          style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:G,
                          background:'#f0f7ec', border:'none', borderRadius:6, padding:'4px 10px',
                          cursor:'pointer' }}>Cobrar</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Facturas vencidas detalle */}
          {vencidasHoy.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #fecaca',
              overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #fecaca',
                background:'#fef2f2', display:'flex', justifyContent:'space-between' }}>
                <div style={{ fontFamily:F.serif, fontSize:22, color:'#dc2626' }}>
                  ⚠ Facturas vencidas ({vencidasHoy.length})
                </div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:'#dc2626', fontWeight:600 }}>
                  {fmtMoney(vencidasHoy.reduce((s,c)=>s+(c.saldoPendiente||c.total||0),0))} pendiente
                </div>
              </div>
              {vencidasHoy.map((c,i)=>(
                <div key={c.id} style={{
                  display:'grid', gridTemplateColumns:'120px 1fr 100px 110px 80px 90px',
                  padding:'12px 20px', fontFamily:F.sans, fontSize:13,
                  borderBottom:i<vencidasHoy.length-1?'1px solid #fef2f2':'none',
                  background:i%2===0?'#fff':'#fafaf8',
                }}>
                  <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:600 }}>{c.numero}</div>
                  <div style={{ fontWeight:600 }}>
                    <button onClick={()=>{setDetalleCli(c.clienteId);setVista('cuenta');}}
                      style={{ background:'none', border:'none', cursor:'pointer',
                      fontFamily:F.sans, fontSize:13, fontWeight:600, color:G, padding:0 }}>
                      {c.clienteNombre}
                    </button>
                  </div>
                  <div style={{ fontFamily:F.mono, color:G }}>{fmtMoney(c.saldoPendiente||c.total,c.moneda)}</div>
                  <div style={{ color:'#dc2626', fontWeight:700, fontSize:12 }}>
                    Vencida hace {Math.abs(daysUntil(c.fechaVenc))} días
                  </div>
                  <div><Pill status={c.status}/></div>
                  <div>
                    <button onClick={()=>setShowCob(true)}
                      style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, color:G,
                      background:'#f0f7ec', border:'none', borderRadius:6, padding:'4px 10px',
                      cursor:'pointer' }}>Cobrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────────────── */}
      {showCFE && (
        <ModalFactura
          clientes={clientes} productos={products}
          prefill={prefill}
          onSave={handleSaveCFE}
          onClose={()=>{setShowCFE(false);setPrefill(null);}}
        />
      )}
      {showCob && (
        <ModalCobro
          clientes={clientes} cfes={cfes}
          onSave={handleSaveCobro}
          onClose={()=>setShowCob(false)}
        />
      )}
    </div>
  );
}

export default FacturacionTab;
