import React from 'react';
import { T, Cap, Btn, totalLead } from '../lib/ui.jsx';

const Stars = ({value=3}) => (
  <span style={{fontSize:13,letterSpacing:1,color:'#f59e0b'}}>
    {[1,2,3,4,5].map(i=>i<=value?'★':'☆').join('')}
  </span>
);

function ProveedoresInline({suppliers,setSuppliers:_setSuppliers,products:_products,orders,setOrders:_setOrders,addMov:_addMov,session:_session,alerts:_alerts_prop,enriched,_tab,setModal,setEditSup,setViewSup,deleteSupplier}) {
  return (
          <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div>
                <Cap style={{color:T.green}}>Gestión</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Proveedores</h1>
              </div>
              <Btn onClick={()=>{setEditSup(null);setModal({type:"supplierForm"});}}>+ Nuevo proveedor</Btn>
            </div>

            {/* Supplier cards grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
              {suppliers.map(sup=>{
                const supProds=enriched.filter(p=>p.supplierId===sup.id);
                const _alerts=supProds.filter(p=>p.alert.level!=="ok");
                const criticals=supProds.filter(p=>p.alert.level==="order_now");
                const pending=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending");
                const totalSpent=orders.filter(o=>o.supplierId===sup.id&&o.status==="delivered").reduce((s,o)=>s+(+o.totalCost||0),0);
                const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
                const tfs=["preparation","customs","freight","warehouse"];
                return(
                  <div key={sup.id} style={{background:T.card,border:`1px solid ${criticals.length>0?T.dangerBd:T.border}`,borderRadius:8,overflow:"hidden",transition:"box-shadow .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.07)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

                    {/* Card header */}
                    <div style={{padding:"16px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{background:sup.color+"22",color:sup.color,fontFamily:T.sans,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3}}>{sup.flag}</span>
                          <span style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text}}>{sup.name}</span>
                        </div>
                        {sup.company&&<p style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.company}</p>}
                        {sup.contact&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:1}}>👤 {sup.contact}</p>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <Stars value={sup.rating||3}/>
                        <div style={{fontFamily:T.sans,fontSize:10,color:sup.active?T.ok:T.textXs,fontWeight:600,marginTop:4}}>{sup.active?"● Activo":"○ Inactivo"}</div>
                      </div>
                    </div>

                    {/* Lead time bar */}
                    <div style={{padding:"10px 18px",background:T.cardWarm,borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <Cap>Lead time</Cap>
                        <Cap style={{color:sup.color}}>{totalLead(sup)} días totales</Cap>
                      </div>
                      <div style={{display:"flex",gap:2,height:6,borderRadius:3,overflow:"hidden"}}>
                        {tfs.map((k,i)=><div key={k} style={{flex:sup.times[k]||0.1,background:tfCols[i],opacity:.75}}/>)}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border}}>
                      {[
                        {l:"Productos",v:supProds.length},
                        {l:"En tránsito",v:pending.length,c:pending.length>0?T.watch:T.textSm},
                        {l:"Comprado",v:`${sup.currency||"USD"} ${totalSpent.toFixed(0)}`},
                      ].map((s,i)=>(
                        <div key={i} style={{background:T.card,padding:"10px 12px",textAlign:"center"}}>
                          <Cap>{s.l}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:s.c||T.text,marginTop:3}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Alert strip */}
                    {criticals.length>0&&(
                      <div style={{padding:"8px 18px",background:T.dangerBg,borderTop:`1px solid ${T.dangerBd}`}}>
                        <p style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>
                          ● {criticals.length} producto{criticals.length>1?"s requieren":"requiere"} pedido inmediato: {criticals.map(p=>p.name).join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Commercial conditions summary */}
                    <div style={{padding:"10px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {sup.paymentTerms&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>💳 {sup.paymentTerms}d pago</span>}
                      {sup.minOrder>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>📦 Min. {sup.currency||"USD"} {sup.minOrder}</span>}
                      {sup.discount>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>🏷 {sup.discount}% dto.</span>}
                      {sup.email&&<a href={"mailto:"+sup.email} style={{fontFamily:T.sans,fontSize:11,color:T.green,textDecoration:"none"}}>✉ Email</a>}
                      {sup.whatsapp&&<a href={"https://wa.me/"+sup.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontFamily:T.sans,fontSize:11,color:"#16a34a",textDecoration:"none"}}>💬 WhatsApp</a>}
                    </div>

                    {/* Actions */}
                    <div style={{padding:"12px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                      <Btn small full onClick={()=>setViewSup(sup)}>Ver detalle</Btn>
                      <Btn small variant="ghost" onClick={()=>{setEditSup(sup);setModal({type:"supplierForm"});}}>Editar</Btn>
                      <Btn small variant="danger" onClick={()=>deleteSupplier(sup.id)}>×</Btn>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global lead time comparison table */}
            <div>
              <div style={{marginBottom:10}}><Cap>Comparativa de tiempos y condiciones</Cap></div>
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Proveedor","Prep.","Aduana","Flete","Depósito","Total","Moneda","Pago","Mín.","Dto.","Calif."].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {suppliers.map(sup=>(
                      <tr key={sup.id} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                        onMouseLeave={e=>e.currentTarget.style.background=T.card}
                        onClick={()=>setViewSup(sup)}>
                        <td style={{padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{background:sup.color+"22",color:sup.color,fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:2}}>{sup.flag}</span>
                            <span style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{sup.name}</span>
                          </div>
                        </td>
                        {["preparation","customs","freight","warehouse"].map(k=>(
                          <td key={k} style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,color:T.textMd,textAlign:"center"}}>{sup.times[k]}d</td>
                        ))}
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,fontWeight:700,color:sup.color,textAlign:"center"}}>{totalLead(sup)}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.currency||"USD"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.paymentTerms||"—"}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.minOrder>0?`${sup.minOrder}`:"—"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:sup.discount>0?T.ok:T.textSm,fontWeight:sup.discount>0?600:400}}>{sup.discount>0?`${sup.discount}%`:"—"}</td>
                        <td style={{padding:"10px 12px"}}><Stars value={sup.rating||3}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
}

export default ProveedoresInline;
