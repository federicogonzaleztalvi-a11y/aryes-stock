import React from 'react';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useApp } from '../context/AppContext.tsx';
import { T, Btn, AlertPill, StockBar, Spark, totalLead , downloadCSV } from '../lib/ui.jsx';

export default function InventoryInline({setModal, setEditProd}) {
  const { products, enriched, deleteProduct } = useApp();
  const { confirm, ConfirmDialog } = useConfirm();
  const handleDelete = async (id) => {
    const ok = await confirm({ title: '¿Eliminar este producto?', description: 'Esta acción no se puede deshacer.', variant: 'danger' });
    if (ok) await deleteProduct(id);
  };
  return (
    <>
    {ConfirmDialog}
          <div className="au" style={{display:"grid",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>Inicio</span>
                  <span style={{color:T.textXs,fontSize:11}}>/</span>
                  <span style={{fontFamily:T.sans,fontSize:11,fontWeight:600,color:T.green}}>Inventario</span>
                </div>
                <h1 style={{fontFamily:T.serif,fontSize:38,fontWeight:500,color:T.text,marginTop:0,letterSpacing:"-.02em"}}>Inventario</h1>
              </div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={()=>setModal({type:"excel"})} variant="ghost">↑ Importar Excel</Btn>
                <Btn variant="ghost" onClick={()=>{
          const rows=(enriched||[]).map(p=>({
            Producto: p.name,
            Proveedor: p.sup?.name||'',
            Stock: p.stock,
            Unidad: p.unit||'',
            'Costo USD': p.unitCost||0,
            'Stock mínimo': p.minStock||0,
            ROP: p.alert?.rop||0,
            Estado: p.alert?.level||''
          }));
          downloadCSV(rows,'inventario.csv');
        }}>⬇ Exportar CSV</Btn>
          <Btn onClick={()=>{setEditProd(null);setModal({type:"product"});}}>+ Nuevo producto</Btn>
              </div>
            </div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:2}}>
                  {["Producto","Proveedor","Stock","ROP","Safety","EOQ","/día","Tendencia","Lead","Estado",""].map(h=><th key={h} style={{padding:"11px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap",background:T.muted}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {enriched.map((p,i)=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.cardWarm,transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.cardWarm}>
                      <td style={{padding:"11px 13px"}}><div style={{fontFamily:T.sans,fontSize:13,fontWeight:500,color:T.text,lineHeight:1.3}}>{p.name}</div><div style={{fontFamily:"monospace",fontSize:10,color:T.textXs,marginTop:2}}>{p.barcode||"—"}</div></td>
                      <td style={{padding:"11px 13px"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:4,background:T.muted,border:`1px solid ${T.border}`,borderRadius:4,padding:"2px 7px",fontFamily:T.sans,fontSize:11,color:T.textSm}}>
                          {p.sup?.flag&&<span style={{fontSize:12}}>{p.sup.flag==='AR'?'🇦🇷':p.sup.flag==='EC'?'🇪🇨':p.sup.flag==='EU'?'🇪🇺':p.sup.flag}</span>}
                          {p.sup?.name||'—'}
                        </span>
                      </td>
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
                          <Btn small variant="danger" onClick={()=>handleDelete(p.id)}>×</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
  </>
  );
}
