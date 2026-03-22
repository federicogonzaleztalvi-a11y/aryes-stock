import React from 'react';
import { T, Cap, Btn, AlertPill, StockBar, Spark, totalLead } from '../lib/ui.jsx';

export default function InventoryInline({products, enriched, setModal, setEditProd, setProducts}) {
  return (
          <div className="au" style={{display:"grid",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div><Cap style={{color:T.green}}>Stock</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Inventario</h1></div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={()=>setModal({type:"excel"})} variant="ghost">↑ Importar Excel</Btn>
                <Btn onClick={()=>{setEditProd(null);setModal({type:"product"});}}>+ Nuevo producto</Btn>
              </div>
            </div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                  {["Producto","Proveedor","Stock","ROP","Safety","EOQ","/día","Tendencia","Lead","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {enriched.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                      <td style={{padding:"11px 13px"}}><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontFamily:"monospace",fontSize:10,color:T.textXs}}>{p.barcode||"—"}</div></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{p.sup?.flag}] {p.sup?.name}</td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:p.stock<=(p.alert.rop||0)?T.danger:T.text}}>{p.stock} <span style={{fontWeight:400,color:T.textXs,fontSize:11}}>{p.unit}</span></div>
                        <div style={{marginTop:5,width:72}}><StockBar stock={p.stock} r={p.alert.rop} ss={p.alert.ss} max={Math.max(p.stock*1.6,p.alert.rop*2.5)}/></div>
                      </td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.textMd}}>{p.alert.rop>0?`${p.alert.rop} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.ss>0?`${p.alert.ss} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.eoq>0?`${p.alert.eoq} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.daily>0?`${p.alert.daily.toFixed(1)}`:"—"}</td>
                      <td style={{padding:"11px 13px"}}><Spark history={p.history} color={p.sup?.color||T.textXs}/></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{totalLead(p.sup)}d</td>
                      <td style={{padding:"11px 13px"}}><AlertPill level={p.alert.level}/></td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{display:"flex",gap:6}}>
                          <Btn small variant="ghost" onClick={()=>{setEditProd(products.find(x=>x.id===p.id));setModal({type:"product"});}}>Editar</Btn>
                          <Btn small onClick={()=>setModal({type:"order",product:products.find(x=>x.id===p.id)})}>Pedir</Btn>
                          <Btn small variant="danger" onClick={()=>setProducts(ps=>ps.filter(x=>x.id!==p.id))}>×</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
  );
}
