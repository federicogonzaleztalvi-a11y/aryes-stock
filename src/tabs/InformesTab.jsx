import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS } from '../lib/constants.js';

function InformesTab(){
  const { products: prods, movements: movs } = useApp();
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [rutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [lotes]=useState(()=>LS.get("aryes-lots",[]));
  const [clientes]=useState(()=>LS.get("aryes-clients",[]));
    const [periodo,setPeriodo]=useState("mes");
  const [msg,setMsg]=useState("");
  const hoy=new Date();
  const diasAtras=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return d;};
  const periodoStart=periodo==="semana"?diasAtras(7):periodo==="mes"?diasAtras(30):diasAtras(90);
  const movsP=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=periodoStart);
  const ventasP=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=periodoStart);
  const diasVenc=(f)=>Math.ceil((new Date(f)-hoy)/(1000*60*60*24));
  const toCSV=(headers,rows)=>headers.join(",")+"\n"+rows.map(r=>r.map(c=>'"'+( c||"").toString().replace(/"/g,'""')+'"').join(",")).join("\n");
  const downloadCSV=(content,filename)=>{const blob=new Blob(["﻿"+content],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);setMsg("Descargando "+filename);setTimeout(()=>setMsg(""),3000);};
  const exportStock=()=>{const h=["Producto","Stock","Unidad","Precio","Stock Min","Proveedor","Estado"];const rows=prods.map(p=>[p.nombre||p.name||"",p.stock||0,p.unidad||p.unit||"u",p.precio||p.price||0,p.rop||5,p.proveedor||"",Number(p.stock||0)===0?"Sin stock":Number(p.stock||0)<=(p.rop||5)?"Critico":"OK"]);downloadCSV(toCSV(h,rows),"stock-"+hoy.toISOString().split("T")[0]+".csv");};
  const exportMovimientos=()=>{const h=["Fecha","Tipo","Producto","Cantidad","Notas"];const rows=movsP.map(m=>[m.timestamp?new Date(m.timestamp).toLocaleDateString("es-UY"):"",m.tipo||"",m.productoNombre||m.nombre||"",m.cantidad||0,m.notas||""]);downloadCSV(toCSV(h,rows),"movimientos-"+periodo+".csv");};
  const exportVentas=()=>{const h=["N Venta","Fecha","Cliente","Productos","Total","Estado"];const rows=ventasP.map(v=>[v.nroVenta||"",v.fecha||"",v.clienteNombre||"",v.items?.length||0,"$"+(v.total||0),v.estado||""]);downloadCSV(toCSV(h,rows),"ventas-"+periodo+".csv");};
  const exportLotes=()=>{const h=["Producto","Lote","Cantidad","Vencimiento","Dias","Estado"];const rows=lotes.map(l=>{const d=l.fechaVenc?diasVenc(l.fechaVenc):null;return[l.productoNombre||"",l.lote||"",l.cantidad||0,l.fechaVenc||"",d!==null?d:"",!l.fechaVenc?"Sin fecha":d<0?"VENCIDO":d<=7?"URGENTE":d<=30?"PROXIMO":"OK"];});downloadCSV(toCSV(h,rows),"lotes.csv");};
  const exportClientes=()=>{const h=["Nombre","Tipo","Ciudad","Telefono","Email"];const rows=clientes.map(c=>[c.nombre||"",c.tipo||"",c.ciudad||"",c.telefono||"",c.email||""]);downloadCSV(toCSV(h,rows),"clientes.csv");};
  const exportEntregas=()=>{const h=["Vehiculo","Zona","Dia","Cliente","Estado","Hora"];const rows=rutas.flatMap(r=>(r.entregas||[]).map(e=>[r.vehiculo||"",r.zona||"",r.dia||"",e.clienteNombre||"",e.estado||"",e.hora||""]));downloadCSV(toCSV(h,rows),"entregas.csv");};
  const imprimirRemito=(venta)=>{
    const emp=localStorage.getItem("aryes-empresa")||"Stock";
    const its=venta.items||[];
    const rows=its.map(it=>"<tr><td>"+it.nombre+"</td><td>"+it.cantidad+" "+it.unidad+"</td><td>$"+Number(it.precioUnit).toLocaleString("es-UY")+"</td><td>$"+Number(it.cantidad*it.precioUnit).toLocaleString("es-UY")+"</td></tr>").join("");
    const desc=Number(venta.descuento)>0?"<p style=\"text-align:right;color:#92400e\">Descuento "+venta.descuento+"%</p>":"";
    const html="<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Remito "+venta.nroVenta+"</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #3a7d1e;padding-bottom:16px;margin-bottom:24px;}.emp{font-size:22px;font-weight:700;color:#3a7d1e;}table{width:100%;border-collapse:collapse;margin:16px 0;}th{background:#3a7d1e;color:#fff;padding:9px;text-align:left;font-size:13px;}td{padding:8px 9px;border-bottom:1px solid #eee;font-size:13px;}.tot{text-align:right;font-size:18px;font-weight:700;color:#3a7d1e;margin-top:8px;}.ftr{margin-top:40px;border-top:1px solid #eee;padding-top:12px;font-size:11px;color:#aaa;text-align:center;}</style></head><body><div class='hdr'><div><div class='emp'>"+emp+"</div></div><div style='text-align:right'><b>REMITO "+venta.nroVenta+"</b><br>"+venta.fecha+"<br><span style='font-size:11px;padding:2px 8px;background:#f0fdf4;border-radius:4px;color:#3a7d1e;font-weight:700'>"+(venta.estado||"").toUpperCase()+"</span></div></div><p><b>Cliente:</b> "+venta.clienteNombre+"</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>"+rows+"</tbody></table>"+desc+"<div class='tot'>TOTAL: $"+Number(venta.total||0).toLocaleString("es-UY")+"</div><div class='ftr'>"+emp+" · "+new Date().toLocaleDateString("es-UY")+"</div><script>window.onload=function(){window.print();}<" + "/script></body></html>";
    const w=window.open("","_blank","noopener,noreferrer");if(w){w.document.write(html);w.document.close();}
  };
  const stockCritico=prods.filter(p=>Number(p.stock||0)<=Number(p.rop||5)&&Number(p.stock||0)>0).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const vencidosCount=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)<0).length;
  const proxCount=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)>=0&&diasVenc(l.fechaVenc)<=30).length;
  const totalVentasMes=ventasP.filter(v=>v.estado!=="cancelada").reduce((a,v)=>a+Number(v.total||0),0);
  const entregasTotal=rutas.flatMap(r=>r.entregas||[]).length;
  const entregasOk=rutas.flatMap(r=>r.entregas||[]).filter(e=>e.estado==="entregado").length;
  const BTN=({label,icon,onClick})=>(
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#fff",border:"2px solid #3a7d1e",borderRadius:10,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left",marginBottom:8}}>
      <span style={{fontSize:20}}>{icon}</span>
      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>{label}</div><div style={{fontSize:11,color:"#888"}}>Exportar CSV</div></div>
      <span style={{fontSize:16,color:"#3a7d1e"}}>&#8659;</span>
    </button>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Informes</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Reportes y exportacion de datos</p></div>
        <div style={{display:"flex",gap:6}}>{["semana","mes","trimestre"].map(p=>(
          <button key={p} onClick={()=>setPeriodo(p)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===p?"#3a7d1e":"#e5e7eb"),background:periodo===p?"#3a7d1e":"#fff",color:periodo===p?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>
            {p==="semana"?"7 dias":p==="mes"?"30 dias":"90 dias"}</button>))}</div></div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#3a7d1e",fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(stockCritico>0?"#ef4444":"transparent")}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Total productos</div>
          <div style={{fontSize:26,fontWeight:800,color:stockCritico>0?"#ef4444":"#3a7d1e"}}>{prods.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{stockCritico} criticos · {sinStock} sin stock</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Ventas periodo</div>
          <div style={{fontSize:26,fontWeight:800,color:"#3a7d1e"}}>{ventasP.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>${totalVentasMes.toLocaleString("es-UY")} facturado</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(vencidosCount>0?"#ef4444":"transparent")}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Lotes por vencer</div>
          <div style={{fontSize:26,fontWeight:800,color:vencidosCount>0?"#ef4444":"#f59e0b"}}>{proxCount}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{vencidosCount} ya vencidos</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Entregas</div>
          <div style={{fontSize:26,fontWeight:800,color:"#3a7d1e"}}>{entregasOk}/{entregasTotal}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{entregasTotal>0?Math.round(entregasOk/entregasTotal*100):0}% efectividad</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Exportar datos</h3>
          <BTN label="Stock completo" icon="📦" onClick={exportStock} />
          <BTN label={"Movimientos ("+periodo+")"} icon="🔄" onClick={exportMovimientos} />
          <BTN label={"Ventas ("+periodo+")"} icon="🧾" onClick={exportVentas} />
          <BTN label="Lotes y vencimientos" icon="📅" onClick={exportLotes} />
          <BTN label="Clientes" icon="👥" onClick={exportClientes} />
          <BTN label="Historial de entregas" icon="🚛" onClick={exportEntregas} />
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Imprimir remitos</h3>
          {ventas.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>No hay ordenes de venta aun</div>):(
          <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {ventas.slice(0,12).map((v,i)=>(
              <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#3a7d1e"}}>{v.nroVenta}</div>
                  <div style={{fontSize:11,color:"#666"}}>{v.clienteNombre} · {v.fecha}</div>
                </div>
                <div style={{fontWeight:700,fontSize:13}}>${Number(v.total||0).toLocaleString("es-UY")}</div>
                <button onClick={()=>imprimirRemito(v)} style={{padding:"5px 12px",background:"#3a7d1e",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>
                  Imprimir</button>
              </div>))}
            {ventas.length>12&&<div style={{padding:"8px 14px",fontSize:12,color:"#888",textAlign:"center"}}>...y {ventas.length-12} mas</div>}
          </div>)}
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"20px 0 12px"}}>Stock critico</h3>
          {prods.filter(p=>Number(p.stock||0)<=(p.rop||5)).length===0?(
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:16,fontSize:13,color:"#3a7d1e",textAlign:"center"}}>Todo el stock esta OK ✓</div>
          ):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {prods.filter(p=>Number(p.stock||0)<=(p.rop||5)).slice(0,8).map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid #f3f4f6",background:Number(p.stock||0)===0?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>{p.nombre||p.name}</span>
                  <span style={{fontWeight:800,fontSize:14,color:Number(p.stock||0)===0?"#dc2626":"#f59e0b"}}>{p.stock||0}</span>
                  <span style={{fontSize:11,color:"#888",marginLeft:4}}>{p.unidad||p.unit||"u"}</span>
                </div>))}
            </div>)}
        </div>
      </div>
    </section>
  );
}

export default InformesTab;
