import { tfCols } from '../lib/constants.js';
import { T, ALERT_CFG, Cap, AlertPill, StockBar, Btn, fmtDate, totalLead, rop, eoq } from '../lib/ui.jsx';

function DashboardInline({products,suppliers,orders,movements,session,setTab,critN,alerts,enriched,setModal,tfCols}) {
  return (
          <div className="au" style={{display:"grid",gap:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <Cap style={{color:T.green}}>Panel general</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:42,fontWeight:500,color:T.text,marginTop:5,letterSpacing:"-.02em",lineHeight:1}}>
                  {new Date().toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long"})}
                </h1>
              </div>
              {critN>0&&(
                <div style={{background:T.dangerBg,border:`1px solid ${T.dangerBd}`,borderRadius:4,padding:"10px 16px",display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:T.danger,flexShrink:0,animation:"pulseDot 1.8s ease infinite"}}/>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.danger,fontWeight:700}}>{critN} PRODUCTO{critN>1?"S":""} REQUIERE{critN>1?"N":""} PEDIDO INMEDIATO</span>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
              {[{l:"Total productos",v:products.length},{l:"Pedir ya",v:alerts.filter(p=>p.alert.level==="order_now").length,c:T.danger},{l:"Pedir pronto",v:alerts.filter(p=>p.alert.level==="order_soon").length,c:T.warning},{l:"En tránsito",v:orders.filter(o=>o.status==="pending").length,c:T.green}].map((s,i)=>(
                <div key={i} style={{background:T.card,padding:"20px 24px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:48,fontWeight:400,color:s.c||T.text,lineHeight:1,marginTop:8}}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.length>0?(
              <div>
                <div style={{marginBottom:12}}><Cap>Acciones requeridas</Cap></div>
                <div style={{display:"grid",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                  {alerts.map(({id,name,stock,unit,sup,alert})=>{
                    const ropDate=new Date();ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                    return(
                      <div key={id} style={{background:T.card,padding:"15px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:180}}>
                          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>{name}</div>
                          <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>[{sup?.flag}] {sup?.name} · Lead: {totalLead(sup)}d · ROP: {alert.rop} {unit} · {alert.daily.toFixed(1)}/día</div>
                          <div style={{marginTop:8,width:160}}><StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/></div>
                        </div>
                        <AlertPill level={alert.level}/>
                        <div style={{textAlign:"right",minWidth:120}}>
                          <Cap>{alert.level==="order_now"?"Pedir":"Pedir antes del"}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:ALERT_CFG[alert.level].txt,marginTop:3}}>
                            {alert.level==="order_now"?"HOY":fmtDate(ropDate)}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:80}}>
                          <Cap>EOQ sugerido</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:3}}>{alert.eoq||"—"} {unit}</div>
                        </div>
                        <Btn small onClick={()=>setModal({type:"order",product:products.find(p=>p.id===id)})}>Generar pedido</Btn>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <div style={{background:T.okBg,border:`1px solid ${T.okBd}`,borderRadius:6,padding:"16px 20px"}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:500}}>✓ Todo el inventario está dentro de parámetros. No hay acciones requeridas.</p>
              </div>
            )}

            {/* Supplier overview */}
            <div>
              <div style={{marginBottom:12}}><Cap>Estado por proveedor</Cap></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                {suppliers.map(sup=>{
                  const prods=enriched.filter(p=>p.supplierId===sup.id);
                  const now=prods.filter(p=>p.alert.level==="order_now").length;
                  const soon=prods.filter(p=>p.alert.level==="order_soon").length;
                  const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending").length;
                  return(
                    <div key={sup.id} style={{background:T.card,padding:"18px 22px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <div><Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap><div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:T.text,marginTop:3}}>{prods.length} producto{prods.length!==1?"s":""}</div></div>
                        <div style={{textAlign:"right"}}><Cap>Lead total</Cap><div style={{fontFamily:T.serif,fontSize:22,color:T.text,marginTop:3}}>{totalLead(sup)}d</div></div>
                      </div>
                      <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginBottom:8}}>
                        {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {now>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>● {now} pedir ya</span>}
                        {soon>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.warning,fontWeight:600}}>● {soon} pedir pronto</span>}
                        {pend>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.watch,fontWeight:600}}>● {pend} en tránsito</span>}
                        {!now&&!soon&&!pend&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ Normal</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
}

export default DashboardInline;
