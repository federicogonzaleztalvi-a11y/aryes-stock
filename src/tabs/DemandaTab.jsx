import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';

function DemandaTab(){
  const { products: prods, movements: movs, ventas, suppliers } = useApp();
  const G="#1a8a3c";
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
    // Dynamic Reorder Point: cross with supplier lead time
    const sup = suppliers.find(function(s) { return s.id === p.supplierId; });
    const leadDays = Number(sup?.lead_time_days || sup?.leadTime || 7);
    const stockSeguridad = Math.ceil(salidaDiaria * 3); // 3 days safety stock
    const reorderPoint = Math.ceil(salidaDiaria * leadDays) + stockSeguridad;
    const diasParaPedir = diasStock !== null ? Math.max(0, diasStock - leadDays) : null;
    const alerta = diasStock !== null && diasStock <= leadDays ? "urgente" : diasStock !== null && diasStock <= (leadDays + 7) ? "proximo" : stock <= rop ? "critico" : "ok";
    return{...p,totalSalidas,salidaDiaria,diasStock,proyeccion30,alerta,leadDays,reorderPoint,diasParaPedir,supName:sup?.name||'—'};
  }).filter(p=>p.totalSalidas>0||Number(p.stock||0)<=Number(p.rop||5)).sort((a,b)=>{
    const ord={urgente:0,proximo:1,critico:2,ok:3};
    return(ord[a.alerta]||3)-(ord[b.alerta]||3);
  });
  const urgentes=analisis.filter(p=>p.alerta==="urgente").length;
  const proximos=analisis.filter(p=>p.alerta==="proximo").length;
  const ALERTA_STYLE={urgente:{bg:"#fef2f2",color:"#dc2626",label:"PEDIR YA"},proximo:{bg:"#fffbeb",color:"#92400e",label:"PEDIR PRONTO"},critico:{bg:"#fff7ed",color:"#c2410c",label:"CRITICO"},ok:{bg:"#f0fdf4",color:G,label:"OK"}};
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
        <div style={{background:urgentes>0?"#fef2f2":"#fff",border:"2px solid "+(urgentes>0?"#fecaca":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Pedir ya (stock menor a lead time)</div><div style={{fontSize:28,fontWeight:800,color:urgentes>0?"#dc2626":G}}>{urgentes}</div></div>
        <div style={{background:proximos>0?"#fffbeb":"#fff",border:"2px solid "+(proximos>0?"#fde68a":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Pedir pronto (menos de 7d margen)</div><div style={{fontSize:28,fontWeight:800,color:proximos>0?"#92400e":"#6b7280"}}>{proximos}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",textAlign:"center",border:"2px solid transparent"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Productos analizados</div><div style={{fontSize:28,fontWeight:800,color:G}}>{analisis.length}</div></div>
      </div>
      {analisis.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>No hay suficientes movimientos para calcular prediccion.</div><div style={{fontSize:11,marginTop:6}}>Registra salidas de stock o ventas para ver el analisis.</div></div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
              {["Producto","Proveedor","Stock actual","Salidas/dia","Dias stock","Lead time","Pedir en","Alerta"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
            </tr></thead>
            <tbody>{analisis.slice(0,30).map((p,i)=>{
              const as=ALERTA_STYLE[p.alerta]||ALERTA_STYLE.ok;
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:p.alerta==="urgente"?"#fff8f8":i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{p.nombre||p.name}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:"#6b7280"}}>{p.supName}</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:Number(p.stock||0)===0?"#dc2626":"#1a1a1a"}}>{p.stock||0} {p.unidad||p.unit||"u"}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.salidaDiaria.toFixed(1)}/dia</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:p.diasStock!==null&&p.diasStock<=p.leadDays?"#dc2626":p.diasStock!==null&&p.diasStock<=(p.leadDays+7)?"#f59e0b":G}}>{p.diasStock!==null?p.diasStock+"d":"—"}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.leadDays}d</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:p.diasParaPedir!==null&&p.diasParaPedir<=0?"#dc2626":p.diasParaPedir!==null&&p.diasParaPedir<=7?"#f59e0b":"#374151"}}>{p.diasParaPedir!==null?(p.diasParaPedir<=0?"HOY":p.diasParaPedir+"d"):"—"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:as.bg,color:as.color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>{as.label}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {/* ── Demand Sensing — Clientes a contactar ─────────────── */}
      {(()=>{
        // Calcular frecuencia de compra por cliente
        // Solo clientes con 2+ órdenes (necesario para calcular intervalo)
        const hoy = new Date();
        const clienteMap = {};
        ventas.filter(v=>v.estado!=="cancelada"&&v.creadoEn).forEach(v=>{
          const id = v.clienteId||v.clienteNombre||'?';
          if(!clienteMap[id]) clienteMap[id]={ nombre:v.clienteNombre||id, ordenes:[], tel:v.clienteTelefono||'', ultimoItem:(v.items||[])[0]?.nombre||'' };
          clienteMap[id].ordenes.push(new Date(v.creadoEn));
        });

        // Calcular ratio urgencia por cliente
        const sensing = Object.values(clienteMap)
          .filter(c=>c.ordenes.length>=2)
          .map(c=>{
            c.ordenes.sort((a,b)=>a-b);
            // Intervalo promedio entre compras (en días)
            let sumInterv=0;
            for(let i=1;i<c.ordenes.length;i++) sumInterv+=(c.ordenes[i]-c.ordenes[i-1])/86400000;
            const avgInterval = sumInterv/(c.ordenes.length-1);
            const ultimaCompra = c.ordenes[c.ordenes.length-1];
            const diasDesde = (hoy-ultimaCompra)/86400000;
            const ratio = diasDesde/avgInterval;
            return { ...c, avgInterval:Math.round(avgInterval), diasDesde:Math.round(diasDesde), ratio:Math.round(ratio*100)/100, ultimaCompra };
          })
          .filter(c=>c.ratio>=0.8) // Solo los que están cerca o pasaron su ventana
          .sort((a,b)=>b.ratio-a.ratio)
          .slice(0,8);

        if(sensing.length===0) return null;

        return (
          <div style={{marginTop:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <h3 style={{fontFamily:"Playfair Display,serif",fontSize:20,color:"#1a1a1a",margin:0}}>Clientes a contactar</h3>
              <span style={{background:"#fef3c7",color:"#92400e",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>Demand Sensing</span>
            </div>
            <p style={{fontSize:12,color:"#888",margin:"0 0 16px"}}>
              Basado en frecuencia histórica de compra. Ratio = días sin comprar / intervalo promedio. {">"} 1.0 = ya pasó su ventana.
            </p>
            <div style={{display:"grid",gap:10}}>
              {sensing.map((c,i)=>{
                const urgente=c.ratio>=1.2;
                const medio=c.ratio>=0.8&&c.ratio<1.2;
                const color=urgente?"#dc2626":medio?"#d97706":"#1a8a3c";
                const bg=urgente?"#fef2f2":medio?"#fffbeb":"#f0fdf4";
                const waMsg=`Hola ${c.nombre.split(' ')[0]}, ¿cómo andas? Te contactamos porque hace ${c.diasDesde} días que no te visitamos. ¿Necesitás reponer ${c.ultimoItem||'mercadería'}? 🚛`;
                return(
                  <div key={i} style={{background:"#fff",border:`1px solid ${urgente?"#fecaca":medio?"#fde68a":"#bbf7d0"}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:16}}>
                    <div style={{width:48,height:48,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:18,fontWeight:800,color}}>{c.ratio.toFixed(1)}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{c.nombre}</div>
                      <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>
                        Compra cada <strong>{c.avgInterval} días</strong> en promedio · Última hace <strong>{c.diasDesde} días</strong>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      <span style={{background:bg,color,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20}}>
                        {urgente?"🔴 Urgente":medio?"🟡 Pronto":"🟢 Cerca"}
                      </span>
                      {c.tel&&(
                        <a href={`https://wa.me/${c.tel.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer"
                          style={{background:"#25d366",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
                          📲 WA
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </section>
  );
}

export default DemandaTab;
