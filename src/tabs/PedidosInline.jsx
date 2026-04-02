// PedidosInline — Supplier order pipeline with ETA tracking
// MercadoLibre-style: shows exactly where each order is in the pipeline

import React from 'react';
import { fmt } from '../lib/constants.js';
import { downloadCSV } from '../lib/ui.jsx';
import { T, Cap, Btn, fmtDate, fmtShort } from '../lib/ui.jsx';

const G = '#1a8a3c';
const PHASES = [
  { key: 'preparation', label: 'Preparacion', icon: '📦', color: '#3b82f6' },
  { key: 'customs',     label: 'Aduana',      icon: '🛃', color: '#8b5cf6' },
  { key: 'freight',     label: 'Flete',        icon: '🚢', color: '#f59e0b' },
  { key: 'warehouse',   label: 'Deposito',     icon: '🏭', color: '#10b981' },
];

function diasRestantes(expectedArrival) {
  if (!expectedArrival) return null;
  return Math.ceil((new Date(expectedArrival) - Date.now()) / 86400000);
}

function currentPhase(order) {
  const bd = order.leadBreakdown || {};
  if (!order.orderedAt) return 0;
  const elapsed = (Date.now() - new Date(order.orderedAt)) / 86400000;
  let cum = 0;
  for (let i = 0; i < PHASES.length; i++) {
    cum += Number(bd[PHASES[i].key] || 0);
    if (elapsed < cum) return i;
  }
  return PHASES.length - 1;
}

function PipelineBar({ order, compact }) {
  const bd    = order.leadBreakdown || {};
  const phase = currentPhase(order);
  const total = PHASES.reduce((s, p) => s + Number(bd[p.key] || 0), 0);
  const dias  = diasRestantes(order.expectedArrival);
  const late  = dias !== null && dias < 0;

  if (compact) return (
    <div style={{ display: 'flex', gap: 2 }}>
      {PHASES.map((p, i) => (
        <div key={p.key} style={{
          width: Math.max(6, ((Number(bd[p.key]||0)/(total||1))*56)),
          height: 6, borderRadius: 2,
          background: i <= phase ? p.color : '#e5e7eb',
          opacity: i === phase ? 1 : i < phase ? 0.5 : 0.25,
        }}/>
      ))}
    </div>
  );

  return (
    <div style={{ background: '#f9f9f7', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', marginBottom: 12 }}>
        {PHASES.map((p, i) => {
          const done = i < phase, cur = i === phase;
          return (
            <div key={p.key} style={{ flex: Number(bd[p.key]||1), display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i > 0 && <div style={{ position:'absolute', left:0, top:11, right:'50%', height:2, background: done||cur ? p.color : '#e5e7eb' }}/>}
              {i < 3 && <div style={{ position:'absolute', left:'50%', top:11, right:0, height:2, background: done ? PHASES[i+1].color : '#e5e7eb' }}/>}
              <div style={{
                width:24, height:24, borderRadius:'50%', zIndex:1,
                background: done||cur ? p.color : '#e5e7eb',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color: done||cur ? '#fff' : '#9a9a98',
                boxShadow: cur ? `0 0 0 3px ${p.color}30` : 'none',
              }}>{done ? '✓' : p.icon}</div>
              <div style={{ marginTop:6, fontSize:9, fontWeight:cur?700:500, color:cur?p.color:'#9a9a98', textAlign:'center' }}>
                {p.label}
                <div style={{fontSize:9,opacity:.7}}>{Number(bd[p.key]||0)}d</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6a6a68' }}>
        <span>Fase actual: {PHASES[phase]?.label}</span>
        {dias !== null && (
          <span style={{ fontWeight:700, color: late?'#dc2626':dias<=7?'#d97706':G }}>
            {late ? `${Math.abs(dias)}d de atraso` : `${dias}d para llegada`}
          </span>
        )}
      </div>
    </div>
  );
}

function PedidosInline({ orders, getSup, markDelivered, setTab }) {
  const [expanded, setExpanded] = React.useState(null);
  const [filter,   setFilter]   = React.useState('pending');

  const pending   = (orders||[]).filter(o => o.status==='pending');
  const delivered = (orders||[]).filter(o => o.status==='delivered');
  const showing   = filter==='pending' ? pending : delivered;
  const late      = pending.filter(o => { const d=diasRestantes(o.expectedArrival); return d!==null&&d<0; });
  const urgent    = pending.filter(o => { const d=diasRestantes(o.expectedArrival); return d!==null&&d>=0&&d<=7; });

  return (
    <div className="au" style={{ display:'grid', gap:22 }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:T.serif, fontSize:40, fontWeight:500, color:T.text, marginTop:4, letterSpacing:'-.02em' }}>
            Pedidos a proveedores
          </h1>
        </div>
        <button onClick={() => {
          const rows=(orders||[]).map(o=>({ Producto:o.productName||'', Proveedor:o.supplierName||'', Cantidad:o.qty||0, Estado:o.status||'', 'Pedido el':o.orderedAt?.slice(0,10)||'', 'Llegada est.':o.expectedArrival?.slice(0,10)||'', 'Costo total':o.totalCost||0 }));
          downloadCSV(rows,'pedidos.csv');
        }} style={{ padding:'7px 16px', background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, color:T.textMd }}>
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { l:'En transito', v:pending.length,   c:'#3b82f6' },
          { l:'Proximos 7d', v:urgent.length,    c:'#d97706' },
          { l:'Con atraso',  v:late.length,       c:'#dc2626' },
          { l:'Recibidos',   v:delivered.length,  c:G },
        ].map(s=>(
          <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'14px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>{s.l}</div>
            <div style={{ fontSize:24, fontWeight:800, color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:1, background:T.border, borderRadius:8, overflow:'hidden', width:'fit-content' }}>
        {[['pending',`En transito (${pending.length})`],['delivered',`Recibidos (${delivered.length})`]].map(([key,label])=>(
          <button key={key} onClick={()=>setFilter(key)} style={{
            padding:'8px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background:filter===key?G:'#fff', color:filter===key?'#fff':T.textSm,
          }}>{label}</button>
        ))}
      </div>

      {/* List */}
      {showing.length===0 ? (
        <div style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:'48px 32px', textAlign:'center', background:T.card }}>
          <p style={{ fontFamily:T.sans, fontSize:13, color:T.textSm }}>
            {filter==='pending' ? 'Sin pedidos en transito.' : 'Sin pedidos recibidos aun.'}
          </p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {showing.map(o => {
            const isX   = expanded===o.id;
            const sup   = getSup(o.supplierId);
            const dias  = diasRestantes(o.expectedArrival);
            const isLate = dias!==null&&dias<0;
            const isSoon = dias!==null&&dias>=0&&dias<=7;
            const phase = currentPhase(o);
            return (
              <div key={o.id} style={{
                background:'#fff', borderRadius:12,
                border:`1px solid ${isLate?'#fecaca':isSoon?'#fde68a':T.border}`,
                overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.04)',
              }}>
                <div onClick={()=>setExpanded(isX?null:o.id)}
                  style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background:PHASES[phase]?.color+'20',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                  }}>{PHASES[phase]?.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'#1a1a18' }}>{o.productName}</span>
                      <span style={{ fontSize:11, color:'#9a9a98' }}>{o.qty} {o.unit}</span>
                      {isLate&&<span style={{ fontSize:10, fontWeight:700, background:'#fef2f2', color:'#dc2626', padding:'2px 6px', borderRadius:10 }}>ATRASADO</span>}
                      {isSoon&&!isLate&&<span style={{ fontSize:10, fontWeight:700, background:'#fffbeb', color:'#d97706', padding:'2px 6px', borderRadius:10 }}>PROXIMO</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:12, color:'#6a6a68' }}>{sup?.flag} {o.supplierName}</span>
                      <span style={{ fontSize:11, color:'#9a9a98' }}>Pedido: {fmtShort(o.orderedAt)}</span>
                      {o.leadBreakdown&&<PipelineBar order={o} compact/>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1a1a18', marginBottom:2 }}>
                      USD {fmt.int(o.totalCost||0)}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:isLate?'#dc2626':isSoon?'#d97706':G }}>
                      {o.status==='delivered'?'Recibido':
                       dias===null?fmtDate(o.expectedArrival):
                       isLate?`${Math.abs(dias)}d de atraso`:`${dias}d restantes`}
                    </div>
                  </div>
                  <span style={{ fontSize:18, color:'#9a9a98', flexShrink:0 }}>{isX?'▲':'▼'}</span>
                </div>

                {isX&&(
                  <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 18px', background:'#fafafa' }}>
                    <PipelineBar order={o}/>
                    <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                      {o.status==='pending'&&(
                        <Btn small variant="success" onClick={()=>{
                          sessionStorage.setItem('aryes-recepcion-from-order', JSON.stringify({
                            id: o.id, productId: o.productId, productName: o.productName,
                            supplierName: o.supplierName || '', qty: o.qty, unit: o.unit,
                            expectedArrival: o.expectedArrival || '',
                          }));
                          setTab('recepcion');
                        }}>
                          Recibir mercaderia
                        </Btn>
                      )}
                      <button onClick={()=>setTab('deposito')} style={{ padding:'7px 14px', background:G, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        Ir a picking
                      </button>
                      {(sup?.whatsapp||sup?.phone)&&(
                        <a href={`https://wa.me/${(sup.whatsapp||sup.phone).replace(/[^0-9]/g,'')}?text=${encodeURIComponent('Hola, consultamos el estado del pedido de '+o.productName+' ('+o.qty+' '+o.unit+'). Pueden confirmar la fecha de llegada estimada?')}`}
                          target="_blank" rel="noreferrer"
                          style={{ padding:'7px 14px', background:'#25D366', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                          Consultar proveedor
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PedidosInline;
