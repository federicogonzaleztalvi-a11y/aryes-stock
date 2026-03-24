import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS } from '../lib/constants.js';

function DemandaTab(){
  const { products: prods, movements: movs } = useApp();
  const G="#3a7d1e";
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [periodo,setPeriodo]=useState(30);
    const pStart=new Date();pStart.setDate(pStart.getDate()-periodo);
  // Calcular rotacion y proyeccion por producto
  const analisis=prods.map(p=>{
    // Salidas del periodo (ventas + movimientos de salida)
    const salidaMovs=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=pStart&&(m.tipo==="salida"||m.tipo==="venta")&&(m.productoId===p.id||m.productoNombre===(p.nombre||p.name)));
    const salidaVentas=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=pStart&&v.estado!=="cancelada").flatMap(v=>v.items||[]).filter(it=>it.productoId===p.id||(it.nombre===(p.nombre||p.name)));
    const totalSalidas=salidaMovs.reduce((a,m)=>a+Number(m.cantidad||0),0)+salidaVentas.reduce((a,it)=>a+Number(it.cantidad||0),0);
    const salidaDiaria=totalSalidas/periodo;
    const stock=Number(p.stock||0);
    const diasStock=salidaDiaria>0?Math.floor(stock/salidaDiaria):null;
    const proyeccion30=Math.round(salidaDiaria*30);
    const rop=Number(p.rop||5);
    const alerta=diasStock!==null&&diasStock<=7?"urgente":diasStock!==null&&diasStock<=14?"proximo":stock<=rop?"critico":"ok";
    return{...p,totalSalidas,salidaDiaria,diasStock,proyeccion30,alerta};
  }).filter(p=>p.totalSalidas>0||Number(p.stock||0)<=Number(p.rop||5)).sort((a,b)=>{
    const ord={urgente:0,proximo:1,critico:2,ok:3};
    return(ord[a.alerta]||3)-(ord[b.alerta]||3);
  });
  const urgentes=analisis.filter(p=>p.alerta==="urgente").length;
  const proximos=analisis.filter(p=>p.alerta==="proximo").length;
  const ALERTA_STYLE={urgente:{bg:"#fef2f2",color:"#dc2626",label:"URGENTE"},proximo:{bg:"#fffbeb",color:"#92400e",label:"PROXIMO"},critico:{bg:"#fff7ed",color:"#c2410c",label:"CRITICO"},ok:{bg:"#f0fdf4",color:G,label:"OK"}};
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Demanda Predictiva</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Rotacion historica y proyeccion de reposicion</p></div>
        <div style={{display:"flex",gap:6}}>{[7,30,90].map(d=>(
          <button key={d} onClick={()=>setPeriodo(d)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===d?G:"#e5e7eb"),background:periodo===d?G:"#fff",color:periodo===d?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>{d} dias</button>
        ))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:urgentes>0?"#fef2f2":"#fff",border:"2px solid "+(urgentes>0?"#fecaca":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Agotan en 7 dias</div><div style={{fontSize:28,fontWeight:800,color:urgentes>0?"#dc2626":G}}>{urgentes}</div></div>
        <div style={{background:proximos>0?"#fffbeb":"#fff",border:"2px solid "+(proximos>0?"#fde68a":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Agotan en 14 dias</div><div style={{fontSize:28,fontWeight:800,color:proximos>0?"#92400e":"#6b7280"}}>{proximos}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",textAlign:"center",border:"2px solid transparent"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Productos analizados</div><div style={{fontSize:28,fontWeight:800,color:G}}>{analisis.length}</div></div>
      </div>
      {analisis.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>No hay suficientes movimientos para calcular prediccion.</div><div style={{fontSize:11,marginTop:6}}>Registra salidas de stock o ventas para ver el analisis.</div></div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
              {["Producto","Stock actual","Salidas/dia","Dias de stock","Proyeccion 30d","Alerta"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
            </tr></thead>
            <tbody>{analisis.slice(0,30).map((p,i)=>{
              const as=ALERTA_STYLE[p.alerta]||ALERTA_STYLE.ok;
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:p.alerta==="urgente"?"#fff8f8":i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{p.nombre||p.name}</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:Number(p.stock||0)===0?"#dc2626":"#1a1a1a"}}>{p.stock||0} {p.unidad||p.unit||"u"}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.salidaDiaria.toFixed(1)}/dia</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:p.diasStock!==null&&p.diasStock<=7?"#dc2626":p.diasStock!==null&&p.diasStock<=14?"#f59e0b":G}}>{p.diasStock!==null?p.diasStock+" dias":"Sin datos"}</td>
                  <td style={{padding:"10px 14px",color:"#374151"}}>{p.proyeccion30} {p.unidad||p.unit||"u"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:as.bg,color:as.color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>{as.label}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DemandaTab;
