import { LS, tfCols } from '../lib/constants.js';
import { downloadCSV } from '../lib/ui.jsx';
import { T, Cap, AlertPill, Btn, fmtDate, fmtShort } from '../lib/ui.jsx';

function PedidosInline({products,setProducts,suppliers,orders,setOrders,addMov,movements,session,modal,setModal,plans,setPlans,savePlan,tab,getSup,markDelivered,setTab,tfCols}) {
  return (
          <div className="au" style={{display:"grid",gap:22}}>
            <div><Cap style={{color:T.green}}>Historial</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Pedidos</h1>
          <button onClick={()=>{
            const rows=(orders||[]).map(o=>({
              'N° Pedido': o.id?.slice(0,8)||'',
              Proveedor: o.supplierName||'',
              Producto: o.productName||'',
              Cantidad: o.qty||0,
              Unidad: o.unit||'',
              Estado: o.status||'',
              'Pedido el': o.orderedAt?.slice(0,10)||'',
              'Llegada est.': o.expectedArrival?.slice(0,10)||'',
              'Costo total': o.totalCost||0
            }));
            downloadCSV(rows,'pedidos.csv');
          }} style={{marginTop:8,padding:'7px 16px',background:'#fff',border:`1px solid ${T.border}`,borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,color:T.textMd,display:'inline-flex',alignItems:'center',gap:6}}>⬇ Exportar CSV</button></div>
            {!orders.length?(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"48px 32px",textAlign:"center",background:T.card}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm}}>Sin pedidos aún. Generá uno desde el panel o el inventario.</p>
              </div>
            ):(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Producto","Proveedor","Cantidad","Pedido","Llegada est.","Flete","Costo","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {orders.map(o=>{
                      const sup=getSup(o.supplierId);const pending=o.status==="pending";const bd=o.leadBreakdown;
                      return(
                        <tr key={o.id} style={{borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                          onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{o.productName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{sup?.flag}] {o.supplierName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>{o.qty} {o.unit}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{fmtShort(o.orderedAt)}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600,color:pending?T.watch:T.ok}}>{fmtDate(o.expectedArrival)}</td>
                          <td style={{padding:"11px 13px"}}>{bd&&<div style={{display:"flex",gap:1,height:6,width:72,borderRadius:2,overflow:"hidden"}}>{Object.values(bd).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.7}}/>)}</div>}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>USD {o.totalCost}</td>
                          <td style={{padding:"11px 13px"}}><AlertPill level={pending?"watch":"ok"}/></td>
                          <td style={{padding:"11px 13px"}}>{pending&&<Btn small variant="success" onClick={()=>markDelivered(o.id)}>✓ Recibido</Btn>}</td>
                        <td style={{padding:"8px 13px"}}><button onClick={(e)=>{e.stopPropagation();LS.set('aryes-picking-pendiente',[{productoNombre:o.productName,cantidad:o.qty,productoId:o.productId||''}]);setTab('deposito');}} style={{background:"#3a7d1e",color:"#fff",border:"none",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>Picking</button></td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
}

export default PedidosInline;
