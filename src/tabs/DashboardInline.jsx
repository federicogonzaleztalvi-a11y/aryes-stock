import React from 'react';
import { T, ALERT_CFG, AlertPill, StockBar, Btn, fmtDate, totalLead } from '../lib/ui.jsx';
import SetupChecklist from '../components/SetupChecklist.jsx';

const F = {
  sans:  "'DM Sans','Inter',system-ui,sans-serif",
  serif: "'Playfair Display',Georgia,serif",
  mono:  "'DM Mono','Fira Code',monospace",
};

const fmtUSD  = n => n>=1000?`USD ${(n/1000).toFixed(1)}k`:`USD ${n.toFixed(0)}`;
const fmtMoney= (n,c='UYU')=>`${c==='UYU'?'$':c==='USD'?'US$':'€'} ${Number(n||0).toLocaleString('es-UY',{minimumFractionDigits:0,maximumFractionDigits:0})}`;


function Sparkline({ data=[], color=T.green, height=32, width=80 }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*width;
    const y = height - ((v-min)/range)*(height*0.8) - height*0.1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function KpiCard({ label, value, sub, accent=T.border, danger=false, warn=false, click, spark, sparkColor }) {
  return (
    <div onClick={click}
      style={{ background:T.card, padding:'18px 20px', borderTop:`3px solid ${accent}`,
        cursor:click?'pointer':'default', transition:'background .12s' }}
      onMouseEnter={e=>{if(click)e.currentTarget.style.background='#f6faf4';}}
      onMouseLeave={e=>{if(click)e.currentTarget.style.background=T.card;}}>
      <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
        textTransform:'uppercase', color:'#9a9a98', marginBottom:6 }}>{label}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div style={{ fontFamily:F.serif, fontSize:32, fontWeight:400, lineHeight:1,
          color: danger&&Number(String(value).replace(/\D/g,''))>0?'#dc2626':
                 warn&&Number(String(value).replace(/\D/g,''))>0?'#d97706':'#1a1a18' }}>{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor||accent||T.green} height={30} width={70}/>}
      </div>
      {sub && <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, action, actionLabel }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
        textTransform:'uppercase', color:'#9a9a98' }}>{title}</div>
      {action && <button onClick={action} style={{ background:'none', border:'none', cursor:'pointer',
        fontFamily:F.sans, fontSize:11, fontWeight:600, color:T.green, padding:0 }}>{actionLabel} →</button>}
    </div>
  );
}

function DashboardInline({products, suppliers, orders, movements, session, setTab, critN, alerts, enriched, setModal, tfCols}) {

  const today = new Date();

  // ── Stock metrics ──────────────────────────────────────────────────────────
  const orderNow   = alerts.filter(p=>p.alert.level==='order_now').length;
  const orderSoon  = alerts.filter(p=>p.alert.level==='order_soon').length;
  const pending    = orders.filter(o=>o.status==='pending');
  const stockValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
  const transitVal = pending.reduce((s,o)=>s+(+o.totalCost||0),0);
  const critCov    = products.filter(p=>(p.dailyUsage||0)>0&&p.stock>0&&(p.stock/(p.dailyUsage||0.001))<14).length;

  // ── Billing metrics (from localStorage) ──────────────────────────────────
  const cfes = React.useMemo(()=>{
    try{ return JSON.parse(localStorage.getItem('aryes-cfe')||'[]'); }catch{ return []; }
  },[]);
  const cobros = React.useMemo(()=>{
    try{ return JSON.parse(localStorage.getItem('aryes-cobros')||'[]'); }catch{ return []; }
  },[]);

  const deudaTotal = cfes
    .filter(f=>['emitida','cobrado_parcial'].includes(f.status))
    .reduce((s,f)=>s+(f.saldoPendiente||f.total||0),0);
  const vencidasN = cfes.filter(f=>['emitida','cobrado_parcial'].includes(f.status)&&f.fechaVenc&&
    Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0).length;
  const facMes = cfes.filter(f=>{
    const d=new Date(f.createdAt||f.fecha);
    return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear()&&
      ['emitida','aceptada','cobrada'].includes(f.status);
  }).reduce((s,f)=>s+f.total,0);

  // Monthly billing sparkline (last 6 months)
  const facSpark = React.useMemo(()=>{
    const months = [];
    for(let i=5;i>=0;i--){
      const d = new Date(); d.setMonth(d.getMonth()-i);
      months.push(cfes.filter(f=>{
        const fd=new Date(f.createdAt||f.fecha);
        return fd.getMonth()===d.getMonth()&&fd.getFullYear()===d.getFullYear()&&
          ['emitida','aceptada','cobrada'].includes(f.status);
      }).reduce((s,f)=>s+f.total,0));
    }
    return months;
  },[cfes]);

  // Top deudores
  const deudores = React.useMemo(()=>{
    const map={};
    cfes.filter(f=>['emitida','cobrado_parcial'].includes(f.status)&&(f.saldoPendiente||f.total)>0)
      .forEach(f=>{
        if(!map[f.clienteId]){ map[f.clienteId]={nombre:f.clienteNombre,deuda:0,vencidas:0}; }
        map[f.clienteId].deuda+=(f.saldoPendiente||f.total||0);
        if(f.fechaVenc&&Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0)
          map[f.clienteId].vencidas++;
      });
    return Object.values(map).sort((a,b)=>b.deuda-a.deuda).slice(0,5);
  },[cfes]);

  // ── Activity + arrivals ────────────────────────────────────────────────────
  const in30 = new Date(); in30.setDate(today.getDate()+30);
  const arrivingSoon = pending
    .filter(o=>o.expectedArrival&&new Date(o.expectedArrival)<=in30)
    .sort((a,b)=>new Date(a.expectedArrival)-new Date(b.expectedArrival))
    .slice(0,4);

  const recentIds = new Set(movements
    .filter(m=>(today-new Date(m.timestamp||m.date||0))<30*864e5)
    .map(m=>m.productId));
  const stagnant = products
    .filter(p=>p.stock>0&&!recentIds.has(p.id))
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost)).slice(0,4);

  const recentMovs = [...movements]
    .sort((a,b)=>new Date(b.timestamp||b.date||0)-new Date(a.timestamp||a.date||0))
    .slice(0,6);

  const MOV_ICONS={order_placed:'🛒',delivery:'📦',excel_in:'📊',excel_out:'📊',
    manual_in:'➕',manual_out:'➖',scanner_in:'⌨',adjustment:'⚖'};
  const MOV_LABELS={order_placed:'Pedido generado',delivery:'Mercadería recibida',
    excel_in:'Stock actualizado ↑',excel_out:'Stock actualizado ↓',
    manual_in:'Ingreso manual',manual_out:'Egreso manual',
    scanner_in:'Ingreso scanner',adjustment:'Ajuste de stock'};

  const timeAgo = ts=>{
    if(!ts)return'';
    const mins=Math.round((today-new Date(ts))/60000);
    if(mins<60)return`hace ${mins}m`;
    const hrs=Math.round(mins/60);
    if(hrs<24)return`hace ${hrs}h`;
    return`hace ${Math.round(hrs/24)}d`;
  };

  // ── Billing bar chart (last 6 months) ──────────────────────────────────────

  return (
    <div className="au" style={{display:'grid',gap:24,fontFamily:F.sans}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400&family=Playfair+Display:wght@400;500&display=swap"/>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
            <span style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98'}}>Inicio</span>
            <span style={{color:'#c8c8c4',fontSize:11}}>/</span>
            <span style={{fontFamily:F.sans,fontSize:11,fontWeight:600,color:T.green}}>Dashboard</span>
          </div>
          <h1 style={{fontFamily:F.serif,fontSize:36,fontWeight:400,color:'#1a1a18',
            margin:0,letterSpacing:'-.02em',lineHeight:1}}>
            {today.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
          </h1>
          <div style={{fontFamily:F.sans,fontSize:13,color:'#6a6a68',marginTop:4}}>
            Buenos días, {session?.name?.split(' ')[0]||session?.email?.split('@')[0]||'Admin'} 👋
          </div>
        </div>

      {/* ── Setup Progress Checklist ── */}
      <SetupChecklist products={products} setTab={setTab} />

      {critN>0&&(
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,
            padding:'10px 18px',display:'flex',gap:10,alignItems:'center',cursor:'pointer'}}
            onClick={()=>setTab('inventory')}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',flexShrink:0,
              animation:'pulseDot 1.8s ease infinite'}}/>
            <span style={{fontFamily:F.sans,fontSize:13,color:'#dc2626',fontWeight:700}}>
              {critN} producto{critN>1?'s':''} requiere{critN>1?'n':''} pedido urgente
            </span>
            <span style={{fontSize:11,color:'#dc2626'}}>Ver →</span>
          </div>
        )}
      </div>

      {/* ── KPI Row 1: Operaciones ────────────────────────────────── */}
      <div>
        <SectionHeader title="Operaciones" />
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,
          background:'#e2e2de',borderRadius:12,overflow:'hidden'}}>
          <KpiCard label="Capital en stock" value={fmtUSD(stockValue)}
            sub="Valor total del inventario" accent={T.green}/>
          <KpiCard label="Cobertura < 14d" value={critCov}
            sub={critCov>0?`productos con riesgo`:'Todo con cobertura OK'}
            accent={critCov>0?'#d97706':'#e2e2de'} warn={critCov>0}
            click={critCov>0?()=>setTab('inventory'):null}/>
          <KpiCard label="En tránsito" value={pending.length}
            sub={pending.length>0?`${fmtUSD(transitVal)} comprometido`:'Sin pedidos activos'}
            accent={pending.length>0?'#6366f1':'#e2e2de'}
            click={pending.length>0?()=>setTab('orders'):null}/>
          <KpiCard label="Requieren acción" value={orderNow+orderSoon}
            sub={orderNow>0?`${orderNow} urgente · ${orderSoon} pronto`:`${orderSoon} a preparar`}
            accent={(orderNow+orderSoon)>0?(orderNow>0?'#dc2626':'#d97706'):'#e2e2de'}
            danger={orderNow>0} warn={orderNow===0&&orderSoon>0}
            click={(orderNow+orderSoon)>0?()=>setTab('inventory'):null}/>
        </div>
      </div>

      {/* ── KPI Row 2: Financiero ─────────────────────────────────── */}
      <div>
        <SectionHeader title="Financiero" action={()=>setTab('facturacion')} actionLabel="Ver facturación"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,
          background:'#e2e2de',borderRadius:12,overflow:'hidden'}}>
          <KpiCard label="Facturado este mes" value={facMes>0?fmtMoney(facMes):'—'}
            sub={`${cfes.filter(f=>{const d=new Date(f.createdAt||f.fecha);return d.getMonth()===today.getMonth()}).length} CFEs emitidos`}
            accent={T.green} spark={facSpark} sparkColor={T.green}
            click={()=>setTab('facturacion')}/>
          <KpiCard label="Deuda total" value={deudaTotal>0?fmtMoney(deudaTotal):'—'}
            sub={`${deudores.length} clientes con saldo`}
            accent={deudaTotal>0?'#dc2626':'#e2e2de'} danger={deudaTotal>0}
            click={deudaTotal>0?()=>setTab('facturacion'):null}/>
          <KpiCard label="Facturas vencidas" value={vencidasN}
            sub="sin cobrar" accent={vencidasN>0?'#dc2626':'#e2e2de'} danger={vencidasN>0}
            click={vencidasN>0?()=>setTab('facturacion'):null}/>
          <KpiCard label="Cobros este mes"
            value={fmtMoney(cobros.filter(c=>{const d=new Date(c.fecha);return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();}).reduce((s,c)=>s+c.monto,0))}
            sub={`${cobros.filter(c=>{const d=new Date(c.fecha);return d.getMonth()===today.getMonth();}).length} cobros registrados`}
            accent={T.green} click={()=>setTab('facturacion')}/>
        </div>
      </div>

      {/* ── Main grid: alertas + deudores + llegadas ─────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>

        {/* LEFT: alertas de inventario */}
        <div>
          <SectionHeader title="Acciones requeridas" action={()=>setTab('inventory')} actionLabel="Ver inventario"/>
          {alerts.length>0?(
            <div style={{display:'grid',gap:1,background:'#e2e2de',borderRadius:10,overflow:'hidden'}}>
              {alerts.slice(0,6).map(({id,name,stock, _unit,sup,alert})=>{
                const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                return(
                  <div key={id} style={{background:'#fff',padding:'12px 16px',display:'flex',
                    alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontFamily:F.sans,fontSize:13,fontWeight:600,color:'#1a1a18'}}>{name}</div>
                      <div style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68',marginTop:2}}>
                        [{sup?.flag}] {sup?.name} · {alert.daily.toFixed(1)}/día
                      </div>
                      <div style={{marginTop:7,width:120}}>
                        <StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/>
                      </div>
                    </div>
                    <AlertPill level={alert.level}/>
                    <div style={{textAlign:'right',minWidth:80}}>
                      <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,letterSpacing:'0.1em',
                        textTransform:'uppercase',color:'#9a9a98',marginBottom:3}}>
                        {alert.level==='order_now'?'Pedir':'Antes del'}
                      </div>
                      <div style={{fontFamily:F.serif,fontSize:14,fontWeight:500,
                        color:ALERT_CFG[alert.level].txt}}>
                        {alert.level==='order_now'?'HOY':fmtDate(ropDate)}
                      </div>
                    </div>
                    <Btn small onClick={()=>setModal({type:'order',product:products.find(p=>p.id===id)})}>
                      Pedir
                    </Btn>
                  </div>
                );
              })}
              {alerts.length>6&&(
                <div style={{background:'#f9f9f7',padding:'9px 16px',cursor:'pointer'}}
                  onClick={()=>setTab('inventory')}>
                  <span style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68'}}>
                    Ver {alerts.length-6} alertas más →
                  </span>
                </div>
              )}
            </div>
          ):(
            <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,
              padding:'16px 20px',display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontSize:18}}>✓</span>
              <span style={{fontFamily:F.sans,fontSize:13,color:'#16a34a',fontWeight:500}}>
                Todo el inventario dentro de parámetros.
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: deudores + llegadas */}
        <div style={{display:'grid',gap:16,alignContent:'start'}}>

          {/* Deudores */}
          {deudores.length>0&&(
            <div>
              <SectionHeader title="Top deudores" action={()=>setTab('facturacion')} actionLabel="Ver todos"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {deudores.map((d,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'10px 14px',
                    borderBottom:i<deudores.length-1?'1px solid #f0f0ec':'none',
                    background:d.vencidas>0?'#fef9f9':'#fff'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,
                        color:'#1a1a18',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {d.nombre}
                      </div>
                      {d.vencidas>0&&(
                        <div style={{fontFamily:F.sans,fontSize:10,color:'#dc2626',marginTop:1,fontWeight:600}}>
                          ⚠ {d.vencidas} vencida{d.vencidas>1?'s':''}
                        </div>
                      )}
                    </div>
                    <div style={{fontFamily:F.serif,fontSize:15,color:'#dc2626',flexShrink:0,marginLeft:8}}>
                      {fmtMoney(d.deuda)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximas llegadas */}
          {arrivingSoon.length>0&&(
            <div>
              <SectionHeader title="Próximas llegadas" action={()=>setTab('orders')} actionLabel="Ver pedidos"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {arrivingSoon.map((o,i)=>{
                  const daysLeft=Math.ceil((new Date(o.expectedArrival)-today)/864e5);
                  return(
                    <div key={o.id} style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center',padding:'10px 14px',
                      borderBottom:i<arrivingSoon.length-1?'1px solid #f0f0ec':'none'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.productName}</div>
                        <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                          {o.qty} {o.unit} · {o.supplierName}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                        <div style={{fontFamily:F.sans,fontSize:12,fontWeight:700,
                          color:daysLeft<=3?'#d97706':T.green}}>
                          {daysLeft<=0?'Hoy':daysLeft===1?'Mañana':`${daysLeft}d`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: proveedores + actividad ──────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

        {/* Estado por proveedor */}
        <div>
          <SectionHeader title="Estado por proveedor"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,
            background:'#e2e2de',borderRadius:10,overflow:'hidden'}}>
            {suppliers.map(sup=>{
              const prods=enriched.filter(p=>p.supplierId===sup.id);
              const now=prods.filter(p=>p.alert.level==='order_now').length;
              const soon=prods.filter(p=>p.alert.level==='order_soon').length;
              const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==='pending').length;
              const supVal=prods.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
              return(
                <div key={sup.id} style={{background:'#fff',padding:'14px 16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div>
                      <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,letterSpacing:'0.1em',
                        textTransform:'uppercase',color:sup.color,marginBottom:2}}>
                        [{sup.flag}] {sup.name}
                      </div>
                      <div style={{fontFamily:F.serif,fontSize:20,fontWeight:400,color:'#1a1a18'}}>
                        {prods.length} prod.
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:F.sans,fontSize:11,fontWeight:600,color:'#1a1a18'}}>
                        {fmtUSD(supVal)}
                      </div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                        Lead {totalLead(sup)}d
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:2,height:3,borderRadius:2,overflow:'hidden',marginBottom:6}}>
                    {Object.values(sup.times).map((v,i)=>(
                      <div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.7}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {now>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#dc2626',fontWeight:700}}>⚡ {now} ya</span>}
                    {soon>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#d97706',fontWeight:600}}>● {soon} pronto</span>}
                    {pend>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#6366f1',fontWeight:600}}>📦 {pend} tránsito</span>}
                    {!now&&!soon&&!pend&&<span style={{fontFamily:F.sans,fontSize:11,color:'#16a34a',fontWeight:500}}>✓ Normal</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actividad reciente */}
        <div>
          <SectionHeader title="Actividad reciente" action={()=>setTab('movimientos')} actionLabel="Ver todo"/>
          {recentMovs.length>0?(
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
              {recentMovs.map((m,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                  borderBottom:i<recentMovs.length-1?'1px solid #f5f5f3':'none',
                  background:i%2===0?'#fff':'#fafaf8'}}>
                  <span style={{fontSize:14,flexShrink:0}}>{MOV_ICONS[m.type]||'•'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {m.productName||'—'}
                    </div>
                    <div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',marginTop:1}}>
                      {MOV_LABELS[m.type]||m.type}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    {m.qty>0&&<div style={{fontFamily:F.mono,fontSize:12,fontWeight:600,color:'#1a1a18'}}>
                      {m.qty} {m.unit||''}
                    </div>}
                    <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                      {timeAgo(m.timestamp||m.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{padding:'32px',textAlign:'center',color:'#9a9a98',
              fontFamily:F.sans,fontSize:13,background:'#f9f9f7',borderRadius:10}}>
              Sin actividad registrada aún
            </div>
          )}

          {/* Stock estancado */}
          {stagnant.length>0&&(
            <div style={{marginTop:12}}>
              <SectionHeader title="Sin movimiento (30d)"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {stagnant.map((p,i)=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'9px 14px',
                    borderBottom:i<stagnant.length-1?'1px solid #f5f5f3':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>{p.stock} {p.unit}</div>
                    </div>
                    <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,color:'#d97706',flexShrink:0}}>
                      {fmtUSD((p.stock||0)*(p.unitCost||0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardInline;
