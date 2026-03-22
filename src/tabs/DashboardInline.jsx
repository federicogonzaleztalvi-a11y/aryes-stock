import { tfCols } from '../lib/constants.js';
import { T, ALERT_CFG, Cap, AlertPill, StockBar, Btn, fmtDate, totalLead } from '../lib/ui.jsx';

function DashboardInline({products,suppliers,orders,movements,session,setTab,critN,alerts,enriched,setModal,tfCols}) {

  // ── Derived metrics ───────────────────────────────────────────────────────
  const orderNow  = alerts.filter(p=>p.alert.level==='order_now').length;
  const orderSoon = alerts.filter(p=>p.alert.level==='order_soon').length;
  const pending   = orders.filter(o=>o.status==='pending');
  const inTransit = pending.length;

  // Capital inmovilizado
  const stockValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);

  // Cobertura promedio en días
  const withUsage = products.filter(p=>(p.dailyUsage||0)>0);
  const avgCoverage = withUsage.length>0
    ? Math.round(withUsage.reduce((s,p)=>s+(p.stock/(p.dailyUsage||0.001)),0)/withUsage.length)
    : null;

  // Valor en tránsito
  const transitValue = pending.reduce((s,o)=>s+(+o.totalCost||0),0);

  // Próximas llegadas (30 días)
  const today = new Date();
  const in30 = new Date(); in30.setDate(today.getDate()+30);
  const arrivingSoon = pending
    .filter(o=>o.expectedArrival&&new Date(o.expectedArrival)<=in30)
    .sort((a,b)=>new Date(a.expectedArrival)-new Date(b.expectedArrival))
    .slice(0,5);

  // Stock estancado — tiene stock pero sin movimiento en 30d
  const recentIds = new Set(
    movements
      .filter(m=>(today-new Date(m.timestamp||m.date||0))<30*864e5)
      .map(m=>m.productId)
  );
  const stagnant = products
    .filter(p=>p.stock>0&&!recentIds.has(p.id))
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost))
    .slice(0,5);

  // Actividad reciente
  const recentMovs = [...movements]
    .sort((a,b)=>new Date(b.timestamp||b.date||0)-new Date(a.timestamp||a.date||0))
    .slice(0,5);

  const MOV_LABELS = {
    order_placed:'Pedido generado',delivery:'Mercadería recibida',
    excel_in:'Stock actualizado ↑',excel_out:'Stock actualizado ↓',
    manual_in:'Ingreso manual',manual_out:'Egreso manual',
    scanner_in:'Ingreso scanner',adjustment:'Ajuste de stock',
  };

  const fmtUSD = n => n>=1000?`USD ${(n/1000).toFixed(1)}k`:`USD ${n.toFixed(0)}`;
  const fmtDays = n => n>=999?'∞':`${n}d`;

  const timeAgo = ts => {
    if(!ts) return '';
    const mins = Math.round((today-new Date(ts))/60000);
    if(mins<60) return `hace ${mins}m`;
    const hrs = Math.round(mins/60);
    if(hrs<24) return `hace ${hrs}h`;
    return `hace ${Math.round(hrs/24)}d`;
  };

  return (
    <div className="au" style={{display:'grid',gap:28}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>Inicio</span>
            <span style={{color:T.textXs,fontSize:11}}>/</span>
            <span style={{fontFamily:T.sans,fontSize:11,fontWeight:600,color:T.green}}>Dashboard</span>
          </div>
          <h1 style={{fontFamily:T.serif,fontSize:38,fontWeight:500,color:T.text,marginTop:0,letterSpacing:'-.02em',lineHeight:1}}>
            {new Date().toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
          </h1>
        </div>
        {critN>0&&(
          <div style={{background:T.dangerBg,border:`1px solid ${T.dangerBd}`,borderRadius:8,padding:'10px 16px',display:'flex',gap:8,alignItems:'center'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:T.danger,flexShrink:0,animation:'pulseDot 1.8s ease infinite'}}/>
            <span style={{fontFamily:T.sans,fontSize:12,color:T.danger,fontWeight:700}}>
              {critN} PRODUCTO{critN>1?'S':''} REQUIERE{critN>1?'N':''} PEDIDO INMEDIATO
            </span>
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:T.border,borderRadius:10,overflow:'hidden'}}>
        {[
          {
            label:'Capital en stock',
            value:fmtUSD(stockValue),
            sub:'Valor total del inventario',
            accent:T.green,
          },
          {
            label:'Cobertura promedio',
            value:avgCoverage!=null?fmtDays(avgCoverage):'—',
            sub:'Días de stock disponible',
            accent:avgCoverage!=null&&avgCoverage<14?T.warning:T.border,
            click:null,
          },
          {
            label:'En tránsito',
            value:inTransit,
            sub:inTransit>0?`${fmtUSD(transitValue)} comprometido`:'Sin pedidos activos',
            accent:inTransit>0?'#6366f1':T.border,
            click:inTransit>0?()=>setTab('orders'):null,
          },
          {
            label:'Requieren acción',
            value:orderNow+orderSoon,
            sub:orderNow>0?`${orderNow} urgente${orderNow>1?'s':''}, ${orderSoon} pronto`
               :orderSoon>0?`${orderSoon} pedir pronto`:'Todo en parámetros',
            accent:orderNow>0?T.danger:orderSoon>0?T.warning:T.border,
            click:(orderNow+orderSoon)>0?()=>setTab('inventory'):null,
          },
        ].map((k,i)=>(
          <div key={i} onClick={k.click}
            style={{background:T.card,padding:'20px 24px',cursor:k.click?'pointer':'default',
              borderTop:`3px solid ${k.accent}`,transition:'background .15s'}}
            onMouseEnter={e=>{if(k.click)e.currentTarget.style.background=T.muted;}}
            onMouseLeave={e=>{if(k.click)e.currentTarget.style.background=T.card;}}>
            <Cap>{k.label}</Cap>
            <div style={{fontFamily:T.serif,fontSize:36,fontWeight:400,color:T.text,lineHeight:1,marginTop:8}}>{k.value}</div>
            <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:5}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Alertas + Próximas llegadas ── */}
      <div style={{display:'grid',gridTemplateColumns:arrivingSoon.length>0?'1fr 300px':'1fr',gap:16}}>

        <div>
          <div style={{marginBottom:12}}><Cap>Acciones requeridas</Cap></div>
          {alerts.length>0?(
            <div style={{display:'grid',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
              {alerts.map(({id,name,stock,unit,sup,alert})=>{
                const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                return(
                  <div key={id} style={{background:T.card,padding:'13px 18px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{name}</div>
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>
                        [{sup?.flag}] {sup?.name} · Lead: {totalLead(sup)}d · {alert.daily.toFixed(1)}/día
                      </div>
                      <div style={{marginTop:7,width:130}}><StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/></div>
                    </div>
                    <AlertPill level={alert.level}/>
                    <div style={{textAlign:'right',minWidth:90}}>
                      <Cap>{alert.level==='order_now'?'Pedir':'Pedir antes del'}</Cap>
                      <div style={{fontFamily:T.serif,fontSize:15,fontWeight:500,color:ALERT_CFG[alert.level].txt,marginTop:3}}>
                        {alert.level==='order_now'?'HOY':fmtDate(ropDate)}
                      </div>
                    </div>
                    <div style={{textAlign:'right',minWidth:60}}>
                      <Cap>EOQ</Cap>
                      <div style={{fontFamily:T.serif,fontSize:15,fontWeight:500,color:T.text,marginTop:3}}>{alert.eoq||'—'} {unit}</div>
                    </div>
                    <Btn small onClick={()=>setModal({type:'order',product:products.find(p=>p.id===id)})}>Pedir</Btn>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{background:T.okBg,border:`1px solid ${T.okBd}`,borderRadius:8,padding:'16px 20px'}}>
              <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:500}}>✓ Todo el inventario está dentro de parámetros. No hay acciones requeridas.</p>
            </div>
          )}
        </div>

        {arrivingSoon.length>0&&(
          <div>
            <div style={{marginBottom:12}}><Cap>Próximas llegadas</Cap></div>
            <div style={{display:'grid',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
              {arrivingSoon.map(o=>{
                const daysLeft=Math.ceil((new Date(o.expectedArrival)-today)/864e5);
                return(
                  <div key={o.id} style={{background:T.card,padding:'11px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.productName}</div>
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:2}}>{o.qty} {o.unit} · {o.supplierName}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:700,color:daysLeft<=3?T.warning:T.green}}>
                        {daysLeft<=0?'Hoy':daysLeft===1?'Mañana':`${daysLeft}d`}
                      </div>
                      <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{new Date(o.expectedArrival).toLocaleDateString('es-UY',{day:'2-digit',month:'short'})}</div>
                    </div>
                  </div>
                );
              })}
              {pending.length>5&&(
                <div style={{background:T.muted,padding:'9px 16px',cursor:'pointer'}} onClick={()=>setTab('orders')}>
                  <span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>Ver {pending.length-5} más →</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Proveedores + Stock estancado ── */}
      <div style={{display:'grid',gridTemplateColumns:stagnant.length>0?'1fr 280px':'1fr',gap:16}}>

        <div>
          <div style={{marginBottom:12}}><Cap>Estado por proveedor</Cap></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
            {suppliers.map(sup=>{
              const prods=enriched.filter(p=>p.supplierId===sup.id);
              const now=prods.filter(p=>p.alert.level==='order_now').length;
              const soon=prods.filter(p=>p.alert.level==='order_soon').length;
              const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==='pending').length;
              const supVal=prods.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
              return(
                <div key={sup.id} style={{background:T.card,padding:'16px 20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap>
                      <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text,marginTop:2}}>{prods.length} productos</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <Cap>Stock</Cap>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text,marginTop:2}}>{fmtUSD(supVal)}</div>
                      <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs,marginTop:1}}>Lead: {totalLead(sup)}d</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:2,height:4,borderRadius:2,overflow:'hidden',marginBottom:8}}>
                    {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {now>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>● {now} pedir ya</span>}
                    {soon>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.warning,fontWeight:600}}>● {soon} pronto</span>}
                    {pend>0&&<span style={{fontFamily:T.sans,fontSize:11,color:'#6366f1',fontWeight:600}}>● {pend} en tránsito</span>}
                    {!now&&!soon&&!pend&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ Normal</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {stagnant.length>0&&(
          <div>
            <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <Cap>Sin movimiento (30d)</Cap>
              <span style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>capital inmovilizado</span>
            </div>
            <div style={{display:'grid',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
              {stagnant.map(p=>{
                const val=(p.stock||0)*(p.unitCost||0);
                return(
                  <div key={p.id} style={{background:T.card,padding:'11px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:2}}>{p.stock} {p.unit}</div>
                    </div>
                    <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.amber,flexShrink:0}}>{fmtUSD(val)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Actividad reciente ── */}
      {recentMovs.length>0&&(
        <div>
          <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <Cap>Actividad reciente</Cap>
            <span onClick={()=>setTab('movimientos')} style={{fontFamily:T.sans,fontSize:11,color:T.green,cursor:'pointer',fontWeight:600}}>Ver todo →</span>
          </div>
          <div style={{display:'grid',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
            {recentMovs.map((m,i)=>(
              <div key={i} style={{background:T.card,padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.textMd}}>{MOV_LABELS[m.type]||m.type}</span>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}> · {m.productName||'—'}</span>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
                  {m.qty>0&&<span style={{fontFamily:T.sans,fontSize:12,color:T.text,fontWeight:600}}>{m.qty} {m.unit||''}</span>}
                  <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>{timeAgo(m.timestamp||m.date)}</span>
                  {m.user&&<span style={{fontFamily:T.sans,fontSize:10,color:T.textXs,background:T.muted,padding:'2px 7px',borderRadius:4}}>{m.user.split('@')[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default DashboardInline;
