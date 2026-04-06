import { useState } from 'react';
import { fmt } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

function KPIsTab(){
  const { products: prods, movements: movs , ventas, lotes, rutas} = useApp();
  const G="#1a8a3c";
  const [periodo,setPeriodo]=useState("mes");
  const hoy=new Date();
  const diasAtras=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return d;};
  const pStart=periodo==="semana"?diasAtras(7):periodo==="mes"?diasAtras(30):diasAtras(90);
  const movsP=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=pStart);
  const ventasP=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=pStart&&v.estado!=="cancelada");
  const entradas=movsP.filter(m=>m.tipo==="entrada").reduce((a,m)=>a+Number(m.cantidad||0),0);
  const salidas=movsP.filter(m=>m.tipo==="salida"||m.tipo==="ajuste").reduce((a,m)=>a+Number(m.cantidad||0),0);
  const totalVentas=ventasP.reduce((a,v)=>a+Number(v.total||0),0);
  const costoVentas=ventasP.reduce((a,v)=>a+(v.items||[]).reduce((s,it)=>s+Number(it.cantidad||0)*Number(it.costoUnit||0),0),0);
  const margenBruto=totalVentas>0?((totalVentas-costoVentas)/totalVentas*100):0;
  const gananciaTotal=totalVentas-costoVentas;
  const stockCrit=prods.filter(p=>Number(p.stock||0)>0&&Number(p.stock||0)<=(p.rop||5)).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const diasVenc=(f)=>Math.ceil((new Date(f)-hoy)/(1000*60*60*24));
  const vencProx=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)>=0&&diasVenc(l.fechaVenc)<=30).length;
  const vencidos=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)<0).length;
  const entregasAll=rutas.flatMap(r=>r.entregas||[]);
  const entregasOk=entregasAll.filter(e=>e.estado==="entregado").length;
  const efectividad=entregasAll.length>0?Math.round(entregasOk/entregasAll.length*100):0;
  // Top productos por movimientos
  const prodMov={};
  movsP.forEach(m=>{const k=m.productoNombre||m.nombre||"?";prodMov[k]=(prodMov[k]||0)+Number(m.cantidad||0);});
  const topProds=Object.entries(prodMov).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // Ventas por estado
  const ventasEst={};
  ventas.forEach(v=>{ventasEst[v.estado||"?"]=(ventasEst[v.estado||"?"]||0)+1;});
  const CARD=({icon,label,value,sub,alert,color})=>(
    <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(alert?"#ef4444":"transparent")}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:28,fontWeight:800,color:color||"#1a1a1a"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{sub}</div>}
    </div>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>KPIs</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Indicadores clave del negocio</p></div>
        <div style={{display:"flex",gap:6}}>{["semana","mes","trimestre"].map(p=>(
          <button key={p} onClick={()=>setPeriodo(p)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===p?G:"#e5e7eb"),background:periodo===p?G:"#fff",color:periodo===p?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>
            {p==="semana"?"7 dias":p==="mes"?"30 dias":"90 dias"}</button>))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <CARD icon="💰" label={"Ventas ("+periodo+")"} value={ventasP.length} sub={"$"+totalVentas.toLocaleString("es-UY")} color={G} />
        {costoVentas>0&&<CARD icon="📈" label="Margen bruto" value={fmt.percent(margenBruto)} sub={"Ganancia: $"+gananciaTotal.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})} color={margenBruto>=15?"#1a8a3c":"#d97706"} />}
        <CARD icon="📦" label="Stock critico" value={stockCrit+sinStock} sub={stockCrit+" criticos · "+sinStock+" sin stock"} alert={sinStock>0||stockCrit>5} color={sinStock>0?"#dc2626":stockCrit>0?"#f59e0b":G} />
        <CARD icon="📅" label="Venc. proximos" value={vencProx} sub={vencidos+" ya vencidos"} alert={vencidos>0} color={vencidos>0?"#dc2626":"#f59e0b"} />
        <CARD icon="🚛" label="Efectividad entregas" value={efectividad+"%"} sub={entregasOk+"/"+entregasAll.length+" entregas"} color={efectividad>=90?G:efectividad>=70?"#f59e0b":"#dc2626"} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <CARD icon="📥" label="Entradas stock" value={entradas} sub={"en los ultimos "+periodo} color={G} />
        <CARD icon="📤" label="Salidas stock" value={salidas} sub={"en los ultimos "+periodo} color="#6b7280" />
        <CARD icon="🔄" label="Movimientos" value={movsP.length} sub={"total periodo"} color="#3b82f6" />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#1a1a1a",margin:"0 0 14px"}}>Top productos por movimiento</h3>
          {topProds.length===0?<div style={{color:"#888",fontSize:13}}>Sin movimientos en el periodo</div>:(
            topProds.map(([nombre,cant],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
                <span style={{width:22,height:22,borderRadius:"50%",background:G,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500}}>{nombre}</span>
                <span style={{fontSize:13,fontWeight:700,color:G}}>{cant}</span>
              </div>
            ))
          )}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#1a1a1a",margin:"0 0 14px"}}>Ventas por estado</h3>
          {Object.entries(ventasEst).length===0?<div style={{color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>📈</div>Sin ventas registradas<div style={{fontSize:12,marginTop:6,color:"#9a9a98"}}>Los KPIs se calculan automáticamente con cada venta</div></div>:(
            Object.entries(ventasEst).map(([est,cnt])=>{
              const colors={pendiente:"#f59e0b",confirmada:"#3b82f6",preparada:"#8b5cf6",entregada:G,cancelada:"#6b7280"};
              return(
                <div key={est} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:colors[est]||"#888",flexShrink:0}} />
                  <span style={{flex:1,fontSize:13,textTransform:"capitalize"}}>{est}</span>
                  <span style={{fontSize:13,fontWeight:700}}>{cnt}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* ── KPIs Operativos ─────────────────────────────────── */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#1a1a1a",margin:"0 0 16px"}}>KPIs operativos</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {(()=>{
            // Ventas del periodo
            const totalV=ventasP.length;
            const entregadas=ventasP.filter(v=>v.estado==="entregada").length;
            const canceladas=ventasP.filter(v=>v.estado==="cancelada").length;
            const tasaCierre=totalV>0?Math.round(entregadas/totalV*100):0;

            // Tiempo promedio de ciclo (pendiente → entregada) en horas
            const ciclos=ventasP.filter(v=>v.estado==="entregada"&&v.createdAt&&v.estado_log?.length>0).map(v=>{
              const entregadoEv=v.estado_log?.find(e=>e.estado==="entregada");
              if(!entregadoEv) return null;
              return (new Date(entregadoEv.ts)-new Date(v.createdAt))/3600000;
            }).filter(Boolean);
            const avgCiclo=ciclos.length>0?Math.round(ciclos.reduce((s,c)=>s+c,0)/ciclos.length):null;

            // Items promedio por venta
            const itemsXVenta=totalV>0?Math.round(ventasP.reduce((s,v)=>(s+(v.items||[]).length),0)/totalV*10)/10:0;

            // Rutas completadas
            const rutasTotal=rutas.length;
            const rutasComp=rutas.filter(r=>r.completada||r.estado==="completada").length;

            // Recepciones del periodo
            const movEntradas=movs.filter(m=>["in","recepcion","scanner_in"].includes(m.type)).length;

            return [
              {icon:"✅",label:"Tasa de cierre",value:tasaCierre+"%",sub:entregadas+" entregadas · "+canceladas+" canceladas",color:tasaCierre>=80?G:tasaCierre>=60?"#f59e0b":"#dc2626"},
              {icon:"⏱",label:"Ciclo promedio",value:avgCiclo?avgCiclo+"h":"—",sub:ciclos.length+" ventas con ciclo completo",color:avgCiclo&&avgCiclo<=24?G:"#f59e0b"},
              {icon:"📋",label:"Ítems / venta",value:itemsXVenta,sub:"promedio de líneas por orden",color:G},
              {icon:"🗺",label:"Rutas completadas",value:rutasComp+"/"+rutasTotal,sub:entregasOk+" entregas efectivas",color:efectividad>=90?G:efectividad>=70?"#f59e0b":"#dc2626"},
              {icon:"📥",label:"Recepciones",value:movEntradas,sub:"entradas de stock en el período",color:G},
              {icon:"💵",label:"Ticket promedio",value:"$"+(totalV>0?(totalVentas/totalV).toLocaleString("es-UY",{maximumFractionDigits:0}):"0"),sub:"por venta en el período",color:G},
            ].map((k,i)=>(
              <div key={i} style={{background:"#f9f9f7",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:22,fontWeight:800,color:k.color,marginBottom:2}}>{k.value}</div>
                <div style={{fontSize:11,color:"#9a9a98"}}>{k.sub}</div>
              </div>
            ));
          })()}
        </div>
      </div>
    </section>
  );
}

export default KPIsTab;
