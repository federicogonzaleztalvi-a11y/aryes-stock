import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { db, SB_URL, SKEY } from '../lib/constants.js';

// ── helpers ───────────────────────────────────────────────────────────────────
const G   = '#059669';
const fmt = (n, cur='USD') => {
  const sym = cur==='UYU'?'$':cur==='USD'?'US$':'€';
  return `${sym} ${Number(n||0).toLocaleString('es-UY',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
};
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const today   = () => new Date().toISOString().split('T')[0];
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };

function etaBadge(ea, st) {
  if (st === 'delivered' || st === 'received') return { label: '✅ Llegó', color: '#059669', bg: '#f0fdf4' };
  if (!ea) return { label: 'Sin ETA', color: '#9ca3af', bg: '#f9fafb' };
  const d = new Date(ea + 'T12:00:00'), n = new Date(); n.setHours(0,0,0,0);
  const diff = Math.round((d - n) / 86400000);
  if (diff < 0)   return { label: `🔴 ${Math.abs(diff)}d atrasado`, color: '#dc2626', bg: '#fef2f2' };
  if (diff === 0) return { label: '🟡 Hoy', color: '#d97706', bg: '#fffbeb' };
  if (diff <= 3)  return { label: `🟠 En ${diff}d`, color: '#f97316', bg: '#fff7ed' };
  if (diff <= 7)  return { label: `🟢 En ${diff}d`, color: '#059669', bg: '#f0fdf4' };
  return { label: `📅 En ${diff}d`, color: '#6b7280', bg: '#f9fafb' };
}
function ETAInput({ orderId, value, status, onSave }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(value || '');
  const badge = etaBadge(value, status);
  const save = () => { setEditing(false); if (val !== (value || '')) onSave(orderId, val || null); };
  if (editing) return <input type="date" value={val} onChange={e => setVal(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && save()} autoFocus style={{ padding:'3px 6px', border:'1.5px solid #059669', borderRadius:6, fontSize:12, outline:'none', width:120 }} />;
  return <span onClick={() => setEditing(true)} title="Clic para editar ETA" style={{ cursor:'pointer', fontSize:11, fontWeight:700, color:badge.color, background:badge.bg, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{badge.label}</span>;
}


const STATUS_CFG = {
  pendiente:     { label:'Pendiente',     color:'#d97706', bg:'#fffbeb' },
  pagada_parcial:{ label:'Pago parcial',  color:'#6366f1', bg:'#eef2ff' },
  pagada:        { label:'Pagada',        color:'#16a34a', bg:'#f0fdf4' },
  vencida:       { label:'Vencida',       color:'#dc2626', bg:'#fef2f2' },
};

function Pill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendiente;
  return (
    <span style={{
      display:'inline-block', padding:'2px 10px', borderRadius:20,
      fontSize:11, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
      color:cfg.color, background:cfg.bg,
    }}>{cfg.label}</span>
  );
}

const emptyForm = {
  proveedorId:'', proveedorNombre:'', numero:'', fecha:today(),
  fechaVenc:addDays(today(),30), moneda:'USD',
  subtotal:'', ivaTotal:'0', notas:'',
};

function ComprasTab() {
  const { purchaseInvoices, setPurchaseInvoices, suppliers, products, setProducts } = useApp();
  const { confirm, ConfirmDialog } = useConfirm();

  const [vista,       setVista]       = useState('lista');

  const saveETA = async (orderId, date) => {
    if (typeof SB_URL !== 'undefined' && SB_URL && typeof SKEY !== 'undefined' && SKEY) {
      fetch(SB_URL + '/rest/v1/purchase_invoices?id=eq.' + orderId, { method:'PATCH', headers:{ apikey:SKEY, Authorization:'Bearer '+SKEY, 'Content-Type':'application/json', Prefer:'return=minimal' }, body:JSON.stringify({ expected_arrival: date }) }).catch(()=>{});
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, expected_arrival: date } : o));
  };
  const [form,        setForm]        = useState(emptyForm);
  // Line items in the form
  const [lineItems,   setLineItems]   = useState([]);
  const [lineForm,    setLineForm]    = useState({ productoId:'', nombre:'', cantidad:'', unidad:'', precioUnit:'' });
  const [filtro,      setFiltro]      = useState('todos');
  const [busq,        setBusq]        = useState('');
  const [selId,       setSelId]       = useState(null);
  const [msg,         setMsg]         = useState('');
  const [saving,      setSaving]      = useState(false);
  const [pagoMonto,   setPagoMonto]   = useState('');
  const [showPago,    setShowPago]    = useState(false);

  const sel = purchaseInvoices.find(p => p.id === selId);
  const inp = { padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13, fontFamily:'inherit', width:'100%', boxSizing:'border-box' };
  const showMsg = (t,ms=3500) => { setMsg(t); setTimeout(()=>setMsg(''),ms); };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = purchaseInvoices.filter(p => p.status !== 'pagada');
    const deuda  = active.reduce((s,p) => s + Number(p.saldoPendiente||0), 0);
    const now    = Date.now();
    const vencidas = active.filter(p =>
      p.fechaVenc && new Date(p.fechaVenc+'T12:00:00').getTime() < now
    ).length;
    const esteMes = purchaseInvoices.filter(p => {
      const d = new Date(p.creadoEn); const n = new Date();
      return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
    }).reduce((s,p) => s + Number(p.total||0), 0);
    return { deuda, vencidas, esteMes, total: purchaseInvoices.length };
  }, [purchaseInvoices]);

  // ── Deuda por proveedor ───────────────────────────────────────────────────
  const deudaPorProveedor = useMemo(() => {
    const map = {};
    purchaseInvoices
      .filter(p => p.status !== 'pagada')
      .forEach(p => {
        if (!map[p.proveedorId]) map[p.proveedorId] = { nombre:p.proveedorNombre, deuda:0, count:0 };
        map[p.proveedorId].deuda  += Number(p.saldoPendiente||0);
        map[p.proveedorId].count++;
      });
    return Object.values(map).sort((a,b) => b.deuda - a.deuda);
  }, [purchaseInvoices]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const lista = useMemo(() => {
    let items = [...purchaseInvoices].sort((a,b) => new Date(b.creadoEn)-new Date(a.creadoEn));
    if (filtro !== 'todos') items = items.filter(p => p.status === filtro);
    if (busq) items = items.filter(p =>
      p.proveedorNombre.toLowerCase().includes(busq.toLowerCase()) ||
      p.numero.toLowerCase().includes(busq.toLowerCase())
    );
    return items;
  }, [purchaseInvoices, filtro, busq]);

  // ── Line item helpers ──────────────────────────────────────────────────────
  const agregarLinea = () => {
    if (!lineForm.nombre || !lineForm.cantidad || !lineForm.precioUnit) return;
    const it = {
      productoId: lineForm.productoId || '',
      nombre:     lineForm.nombre,
      cantidad:   Number(lineForm.cantidad),
      unidad:     lineForm.unidad || 'u.',
      precioUnit: Number(lineForm.precioUnit),
      subtotal:   Number(lineForm.cantidad) * Number(lineForm.precioUnit),
    };
    setLineItems(prev => [...prev, it]);
    setLineForm({ productoId:'', nombre:'', cantidad:'', unidad:'', precioUnit:'' });
    // Auto-fill subtotal from line items total
    const newSub = [...lineItems, it].reduce((s,i) => s + i.subtotal, 0);
    setForm(f => ({ ...f, subtotal: newSub.toFixed(2) }));
  };

  const quitarLinea = (idx) => {
    const updated = lineItems.filter((_, i) => i !== idx);
    setLineItems(updated);
    const newSub = updated.reduce((s,i) => s + i.subtotal, 0);
    setForm(f => ({ ...f, subtotal: newSub.toFixed(2) }));
  };

  // ── Save new invoice ───────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.proveedorNombre || !form.numero || !form.fecha || !form.subtotal) {
      showMsg('Completá proveedor, número, fecha y subtotal'); return;
    }
    setSaving(true);
    const total = (Number(form.subtotal)||0) + (Number(form.ivaTotal)||0);
    const inv = {
      id:              crypto.randomUUID(),
      proveedorId:     form.proveedorId || form.proveedorNombre,
      proveedorNombre: form.proveedorNombre,
      numero:          form.numero,
      fecha:           form.fecha,
      fechaVenc:       form.fechaVenc || null,
      moneda:          form.moneda,
      subtotal:        Number(form.subtotal)||0,
      ivaTotal:        Number(form.ivaTotal)||0,
      total,
      saldoPendiente:  total,
      status:          'pendiente',
      recepcionId:     null,
      items:           lineItems,
      notas:           form.notas,
      creadoEn:        new Date().toISOString(),
    };
    // Optimistic
    setPurchaseInvoices(prev => [inv, ...prev]);
    setVista('lista');
    setForm(emptyForm);
    setLineItems([]);
    showMsg(`✓ Factura ${inv.numero} registrada`);

    // ── Auto-update unitCost for each line item that maps to a product ──────
    const now = new Date().toISOString();
    const costSource = `Factura ${inv.numero} · ${inv.proveedorNombre}`;
    const updatedProducts = [...products];
    const costUpdates = [];
    lineItems.forEach(it => {
      if (!it.productoId) return;
      const idx = updatedProducts.findIndex(p => p.id === it.productoId);
      if (idx < 0) return;
      updatedProducts[idx] = {
        ...updatedProducts[idx],
        unitCost:        it.precioUnit,
        costSource,
        costUpdatedAt:   now,
        updatedAt:       now,
      };
      costUpdates.push({
        uuid: it.productoId,
        unit_cost: it.precioUnit,
        cost_source: costSource,
        cost_updated_at: now,
        updated_at: now,
      });
    });
    if (costUpdates.length > 0) {
      setProducts(updatedProducts);
      // Persist cost updates to Supabase (non-blocking, per product)
      costUpdates.forEach(upd => {
        db.patch('products',
          { unit_cost: upd.unit_cost, cost_source: upd.cost_source,
            cost_updated_at: upd.cost_updated_at, updated_at: upd.updated_at },
          'uuid=eq.' + upd.uuid
        ).catch(e => console.warn('[ComprasTab] cost patch failed:', e?.message||e));
      });
    }

    // Persist invoice to Supabase
    db.insert('purchase_invoices', {
      id: inv.id, proveedor_id: inv.proveedorId, proveedor_nombre: inv.proveedorNombre,
      numero: inv.numero, fecha: inv.fecha, fecha_venc: inv.fechaVenc,
      moneda: inv.moneda, subtotal: inv.subtotal, iva_total: inv.ivaTotal,
      total: inv.total, saldo_pendiente: inv.saldoPendiente,
      status: inv.status, recepcion_id: null, items: inv.items,
      notas: inv.notas, creado_en: inv.creadoEn,
    }).catch(e => console.warn('[ComprasTab] insert failed:', e?.message||e))
      .finally(() => setSaving(false));
  };

  // ── Register a payment ────────────────────────────────────────────────────
  const registrarPago = (inv) => {
    const monto = Number(pagoMonto);
    if (!monto || monto <= 0) { showMsg('Ingresá un monto válido'); return; }
    const newSaldo  = Math.max(0, Number(inv.saldoPendiente) - monto);
    const newStatus = newSaldo <= 0.01 ? 'pagada' : 'pagada_parcial';
    const updated   = { ...inv, saldoPendiente: newSaldo, status: newStatus };
    setPurchaseInvoices(prev => prev.map(p => p.id === inv.id ? updated : p));
    setSelId(updated.id);
    setShowPago(false);
    setPagoMonto('');
    showMsg(`✓ Pago de ${fmt(monto, inv.moneda)} registrado`);
    db.patch('purchase_invoices',
      { saldo_pendiente: newSaldo, status: newStatus, updated_at: new Date().toISOString() },
      'id=eq.' + inv.id
    ).catch(e => console.warn('[ComprasTab] patch failed:', e?.message||e));
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const eliminar = async (id) => {
    const ok = await confirm({ title:'¿Eliminar esta factura?', variant:'danger' });
    if (!ok) return;
    setPurchaseInvoices(prev => prev.filter(p => p.id !== id));
    setVista('lista');
    db.del('purchase_invoices', { id }).catch(e => console.warn('[ComprasTab] del failed:', e?.message||e));
  };

  const F = ({label,req,children}) => (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>
        {label}{req&&<span style={{color:'#ef4444',marginLeft:2}}>*</span>}
      </label>
      {children}
    </div>
  );

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  if (vista === 'form') return (
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Nueva factura de compra</h2>
      </div>
      {msg&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 16px',marginBottom:16,color:'#dc2626',fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={{gridColumn:'1/-1'}}>
            <F label="Proveedor" req>
              <select value={form.proveedorId} onChange={e=>{
                const sup = suppliers.find(s=>s.id===e.target.value);
                setForm(f=>({...f, proveedorId:e.target.value, proveedorNombre:sup?.name||f.proveedorNombre}));
              }} style={{...inp,background:'#fff'}}>
                <option value="">— Seleccionar proveedor —</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.flag} {s.name}</option>)}
              </select>
              {!form.proveedorId&&<input value={form.proveedorNombre} onChange={e=>setForm(f=>({...f,proveedorNombre:e.target.value}))} placeholder="O escribir nombre libre..." style={{...inp,marginTop:6}}/>}
            </F>
          </div>
          <F label="Nro. de factura" req>
            <input value={form.numero} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} placeholder="Ej: A-001234" style={inp}/>
          </F>
          <F label="Moneda">
            <select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))} style={{...inp,background:'#fff'}}>
              {['USD','UYU','EUR'].map(m=><option key={m}>{m}</option>)}
            </select>
          </F>
          <F label="Fecha factura" req>
            <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={inp}/>
          </F>
          <F label="Fecha vencimiento pago">
            <input type="date" value={form.fechaVenc||''} onChange={e=>setForm(f=>({...f,fechaVenc:e.target.value||null}))} style={inp}/>
          </F>
          <F label="Subtotal (sin IVA)" req>
            <input type="number" step="0.01" value={form.subtotal} onChange={e=>setForm(f=>({...f,subtotal:e.target.value}))} placeholder="0.00" style={inp}/>
          </F>
          <F label="IVA">
            <input type="number" step="0.01" value={form.ivaTotal} onChange={e=>setForm(f=>({...f,ivaTotal:e.target.value}))} placeholder="0.00" style={inp}/>
          </F>
          <div style={{gridColumn:'1/-1'}}>
            <F label="Notas">
              <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}}/>
            </F>
          </div>
          {/* Line items */}
          <div style={{gridColumn:'1/-1'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>
              Detalle de productos <span style={{fontWeight:400,color:'#9ca3af'}}>(opcional — actualiza costos)</span>
            </div>
            {/* Add line form */}
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:6,marginBottom:8,alignItems:'center'}}>
              <select value={lineForm.productoId} onChange={e=>{
                const p = products.find(x=>x.id===e.target.value);
                setLineForm(f=>({...f, productoId:e.target.value, nombre:p?.name||p?.nombre||f.nombre, unidad:p?.unit||f.unidad, precioUnit:p?.unitCost||f.precioUnit}));
              }} style={{...inp,background:'#fff',fontSize:12}}>
                <option value="">— Producto del sistema —</option>
                {products.sort((a,b)=>(a.name||a.nombre||'').localeCompare(b.name||b.nombre||'')).map(p=>(
                  <option key={p.id} value={p.id}>{p.name||p.nombre}</option>
                ))}
              </select>
              <input placeholder="Nombre libre" value={lineForm.nombre} onChange={e=>setLineForm(f=>({...f,nombre:e.target.value}))} style={{...inp,fontSize:12}}/>
              <input type="number" placeholder="Cant." step="0.01" value={lineForm.cantidad} onChange={e=>setLineForm(f=>({...f,cantidad:e.target.value}))} style={{...inp,fontSize:12}}/>
              <input type="number" placeholder="Precio u." step="0.01" value={lineForm.precioUnit} onChange={e=>setLineForm(f=>({...f,precioUnit:e.target.value}))} style={{...inp,fontSize:12}}/>
              <button onClick={agregarLinea} style={{padding:'8px 12px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>+ Agregar</button>
            </div>
            {/* Line items list */}
            {lineItems.length > 0 && (
              <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:8}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#f9fafb'}}>
                    {['Producto','Cant.','Precio u.','Subtotal',''].map(h=>(
                      <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:10,textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {lineItems.map((it,i)=>(
                      <tr key={i} style={{borderTop:'1px solid #f3f4f6'}}>
                        <td style={{padding:'7px 10px',fontWeight:500}}>
                          {it.nombre}
                          {it.productoId && <span style={{fontSize:10,color:G,marginLeft:4}}>✓ vinculado</span>}
                        </td>
                        <td style={{padding:'7px 10px',color:'#6b7280'}}>{it.cantidad}</td>
                        <td style={{padding:'7px 10px',color:'#6b7280'}}>{fmt(it.precioUnit,form.moneda)}</td>
                        <td style={{padding:'7px 10px',fontWeight:700,color:G}}>{fmt(it.subtotal,form.moneda)}</td>
                        <td style={{padding:'7px 6px'}}>
                          <button onClick={()=>quitarLinea(i)} style={{padding:'2px 8px',background:'#fff',border:'1px solid #fecaca',borderRadius:4,cursor:'pointer',fontSize:10,color:'#dc2626'}}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lineItems.some(it=>it.productoId) && (
              <div style={{fontSize:11,color:'#6366f1',fontWeight:600,marginBottom:4}}>
                ⚡ Al guardar, se actualizará el costo unitario de {lineItems.filter(it=>it.productoId).length} producto(s)
              </div>
            )}
          </div>

          {/* Total preview */}
          {form.subtotal && (
            <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,color:'#166534'}}>Total a pagar</span>
              <span style={{fontFamily:'Playfair Display,serif',fontSize:22,fontWeight:500,color:G}}>
                {fmt((Number(form.subtotal)||0)+(Number(form.ivaTotal)||0), form.moneda)}
              </span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20,borderTop:'1px solid #f3f4f6',paddingTop:16}}>
          <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 24px',background:saving?'#9ca3af':G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
            {saving?'Guardando…':'Registrar factura'}
          </button>
        </div>
      </div>
    </section>
  );

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (vista === 'detalle' && sel) return (
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      {ConfirmDialog}
      <div style={{display:'flex',alignItems:'center',marginBottom:20}}>
        <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>
        <div style={{flex:1}}>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#1a1a1a',margin:0}}>{sel.proveedorNombre}</h2>
          <p style={{fontSize:12,color:'#888',margin:'2px 0 0'}}>Factura {sel.numero} · {fmtDate(sel.fecha)}</p>
        </div>
        <Pill status={sel.status}/>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {[
            {l:'Subtotal', v:fmt(sel.subtotal, sel.moneda)},
            {l:'IVA',      v:fmt(sel.ivaTotal, sel.moneda)},
            {l:'Total',    v:fmt(sel.total, sel.moneda), bold:true},
            {l:'Saldo pendiente', v:fmt(sel.saldoPendiente, sel.moneda), bold:true, color:sel.saldoPendiente>0?'#dc2626':G},
            {l:'Vencimiento', v:fmtDate(sel.fechaVenc)},
            {l:'Moneda', v:sel.moneda},
          ].map(r=>(
            <div key={r.l}>
              <div style={{fontSize:11,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{r.l}</div>
              <div style={{fontSize:15,fontWeight:r.bold?700:400,color:r.color||'#1a1a1a'}}>{r.v}</div>
            </div>
          ))}
          {sel.notas&&<div style={{gridColumn:'1/-1'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>Notas</div>
            <div style={{fontSize:13,color:'#444'}}>{sel.notas}</div>
          </div>}
        </div>
      </div>

      {/* Line items detail */}
      {sel.items && sel.items.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Detalle de productos</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
              {['Producto','Cant.','Precio u.','Subtotal'].map(h=>(
                <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sel.items.map((it,i)=>(
                <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'8px 12px',fontWeight:500}}>
                    {it.nombre}
                    {it.productoId && <span style={{fontSize:10,color:G,marginLeft:4}}>✓</span>}
                  </td>
                  <td style={{padding:'8px 12px',color:'#6b7280'}}>{it.cantidad}</td>
                  <td style={{padding:'8px 12px',color:'#6b7280'}}>{fmt(it.precioUnit,sel.moneda)}</td>
                  <td style={{padding:'8px 12px',fontWeight:700,color:G}}>{fmt(it.subtotal,sel.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pago modal inline */}
      {sel.status !== 'pagada' && (
        <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Registrar pago</div>
          {showPago ? (
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="number" step="0.01" placeholder={`Monto (${sel.moneda})`}
                value={pagoMonto} onChange={e=>setPagoMonto(e.target.value)}
                style={{...{padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box'}, width:200, flex:'none'}}/>
              <button onClick={()=>registrarPago(sel)} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:13}}>Confirmar</button>
              <button onClick={()=>{setShowPago(false);setPagoMonto('');}} style={{padding:'8px 12px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancelar</button>
            </div>
          ) : (
            <button onClick={()=>setShowPago(true)} style={{padding:'8px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
              Registrar pago
            </button>
          )}
        </div>
      )}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={()=>eliminar(sel.id)} style={{padding:'8px 18px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',color:'#dc2626',cursor:'pointer',fontSize:13}}>Eliminar</button>
      </div>
    </section>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <>{ConfirmDialog}
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Compras</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Facturas de proveedores y cuentas por pagar</p>
        </div>
        <button onClick={()=>setVista('form')} style={{padding:'9px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nueva factura</button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'#e2e2de',borderRadius:12,overflow:'hidden',marginBottom:20}}>
        {[
          {l:'Deuda total',     v:kpis.deuda>0?fmt(kpis.deuda):'—', danger:kpis.deuda>0},
          {l:'Facturas vencidas', v:kpis.vencidas, danger:kpis.vencidas>0},
          {l:'Comprado este mes', v:fmt(kpis.esteMes)},
          {l:'Total facturas',  v:kpis.total},
        ].map(k=>(
          <div key={k.l} style={{background:'#fff',padding:'16px 20px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{k.l}</div>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:26,fontWeight:400,color:k.danger&&(k.v!=='—'&&k.v!==0)?'#dc2626':'#1a1a1a'}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16,marginBottom:20}}>
        {/* Filters + table */}
        <div>
          <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <input placeholder="Buscar proveedor o nro..." value={busq} onChange={e=>setBusq(e.target.value)}
              style={{flex:1,minWidth:180,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
            <select value={filtro} onChange={e=>setFiltro(e.target.value)}
              style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagada_parcial">Pago parcial</option>
              <option value="vencida">Vencidas</option>
              <option value="pagada">Pagadas</option>
            </select>
          </div>

          {lista.length===0 ? (
            <div style={{textAlign:'center',padding:'48px 20px',color:'#888',background:'#f9fafb',borderRadius:10}}>
              {purchaseInvoices.length===0
                ? <><div style={{fontSize:36,marginBottom:12}}>🧾</div><p>Registrá tu primera factura de compra</p><button onClick={()=>setVista('form')} style={{marginTop:8,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nueva factura</button></>
                : <p>Sin resultados para esa búsqueda</p>}
            </div>
          ) : (
            <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                  {['Proveedor','Número','Fecha','Vencimiento','Total','Saldo','Estado','ETA llegada'].map(h=>(
                    <th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lista.slice(0,30).map((p,i)=>{
                    const overdue = p.status!=='pagada' && p.fechaVenc && new Date(p.fechaVenc+'T12:00:00')<new Date();
                    return(
                      <tr key={p.id} onClick={()=>{setSelId(p.id);setVista('detalle');}}
                        style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',background:i%2===0?'#fff':'#fafafa'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
                        <td style={{padding:'9px 12px',fontWeight:600}}>{p.proveedorNombre}</td>
                        <td style={{padding:'9px 12px',color:'#6b7280',fontFamily:'monospace',fontSize:12}}>{p.numero}</td>
                        <td style={{padding:'9px 12px',color:'#6b7280'}}>{fmtDate(p.fecha)}</td>
                        <td style={{padding:'9px 12px',color:overdue?'#dc2626':'#6b7280',fontWeight:overdue?700:400}}>{fmtDate(p.fechaVenc)}</td>
                        <td style={{padding:'9px 12px',fontWeight:700}}>{fmt(p.total,p.moneda)}</td>
                        <td style={{padding:'9px 12px',fontWeight:700,color:p.saldoPendiente>0?'#dc2626':G}}>{p.saldoPendiente>0?fmt(p.saldoPendiente,p.moneda):'—'}</td>
                        <td style={{padding:'9px 12px'}}><Pill status={p.status}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lista.length>30&&<div style={{padding:'8px 14px',textAlign:'center',color:'#888',fontSize:12,borderTop:'1px solid #f3f4f6',background:'#fafafa'}}>Mostrando 30 de {lista.length}</div>}
            </div>
          )}
        </div>

        {/* Deuda por proveedor sidebar */}
        {deudaPorProveedor.length>0&&(
          <div>
            <div style={{fontSize:10,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Deuda por proveedor</div>
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
              {deudaPorProveedor.slice(0,6).map((d,i)=>(
                <div key={d.nombre} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:i<Math.min(deudaPorProveedor.length,6)-1?'1px solid #f0f0ec':'none'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#1a1a1a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.nombre}</div>
                    <div style={{fontSize:10,color:'#9a9a98',marginTop:1}}>{d.count} factura{d.count>1?'s':''}</div>
                  </div>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#dc2626',flexShrink:0,marginLeft:8}}>{fmt(d.deuda)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section></>
  );
}

export default ComprasTab;
