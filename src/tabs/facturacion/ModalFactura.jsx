import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import ItemSearchRow from './ItemSearchRow.jsx';
import ItemsTable from './ItemsTable.jsx';
import { G, F, COND_PAGO, CFE_TIPOS, MONEDAS, today, addDays, fmtMoney } from './constants.js';
const fmt = { currency: fmtMoney };
import { Inp, Sel, Lbl } from './components.jsx';

function ModalFactura({ clientes, productos, prefill=null, onSave, onClose }) {
  const { brandCfg } = useApp();
  const prefCliente = prefill?.clienteId
    ? clientes.find(c=>c.id===prefill.clienteId) : null;

  const COND_DEFAULT = COND_PAGO.find(c=>c.value==='credito_30')||COND_PAGO[0];
  const condCliente = prefCliente
    ? COND_PAGO.find(c=>c.value===prefCliente.condPago)||COND_DEFAULT
    : COND_DEFAULT;

  const [tipo,       setTipo]       = useState('e-Factura');
  const [moneda,     setMoneda]     = useState(brandCfg?.moneda || 'UYU');
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
                {cli.limiteCredito && <span style={{ fontFamily:F.sans, fontSize:11, color:'#6a6a68' }}>Límite: {fmt.currency(cli.limiteCredito)}</span>}
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
              {[['Subtotal', fmt.currency(subtotal,moneda)],
                ['IVA total', fmt.currency(ivaTotal,moneda)],
                descuento>0 ? ['Descuento', `-${fmt.currency(descMonto,moneda)}`] : null,
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between',
                  fontFamily:F.sans, fontSize:12, color:'#6a6a68' }}>
                  <span>{l}</span><span style={{ fontFamily:F.mono }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid #1a1a18', paddingTop:8,
                display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:F.sans, fontSize:14, fontWeight:700 }}>TOTAL</span>
                <span style={{ fontFamily:F.serif, fontSize:22, color:G }}>{fmt.currency(total,moneda)}</span>
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
            {items.length} línea{items.length!==1?'s':''} · {fmt.currency(total,moneda)}
          </div>
          <div style={{ background:'#fffbeb', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e', lineHeight:1.5, borderLeft:'3px solid #f59e0b' }}>
            ⚠️ Este comprobante es un registro interno de Pazque. Para validez fiscal ante DGI, debe ser emitido a través de tu proveedor certificado (Uruware, Pymo, etc.).
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



export default ModalFactura;
