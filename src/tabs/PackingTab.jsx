import { useApp } from '../context/AppContext.tsx';
import { useState } from 'react';
import { LS } from '../lib/constants.js';

function PackingTab(){
  const G="#1a8a3c";
  const { ventas } = useApp();
  const [packings,setPackings]=useState([]);
  const [sel,setSel]=useState(null);
  const [validados,setValidados]=useState({});
  const [bultos,setBultos]=useState(1);
  const [notas,setNotas]=useState("");
  const [msg,setMsg]=useState("");

  // Only ventas confirmadas/preparadas que no tienen packing aun
  const pendPacking=ventas.filter(v=>["confirmada","preparada"].includes(v.estado)&&!packings.find(p=>p.ventaId===v.id&&p.estado==="listo"));

  const iniciarPacking=(venta)=>{
    setSel(venta);
    const init={};
    (venta.items||[]).forEach(it=>init[it.productoId||it.nombre]={validado:false,cantReal:it.cantidad});
    setValidados(init);setBultos(1);setNotas("");
  };

  const toggleValidar=(key)=>setValidados(v=>({...v,[key]:{...v[key],validado:!v[key].validado}}));
  const todosValidados=sel&&Object.values(validados).every(v=>v.validado);

  const confirmarPacking=()=>{
    if(!todosValidados){setMsg("Debes validar todos los items antes de confirmar");return;}
    const pk={id:crypto.randomUUID(),ventaId:sel.id,nroVenta:sel.nroVenta,clienteNombre:sel.clienteNombre,
      items:sel.items,bultos,notas,estado:"listo",fecha:new Date().toLocaleDateString("es-UY"),creadoEn:new Date().toISOString()};
    const upd=[pk,...packings];
    setPackings(upd);
    setSel(null);
    setMsg("Packing "+sel.nroVenta+" confirmado. Listo para despacho.");
    setTimeout(()=>setMsg(""),4000);
  };

  if(sel)return(
    <section style={{padding:"28px 36px",maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Packing — {sel.nroVenta}</h2>
      </div>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{fontSize:13,color:"#888",marginBottom:12}}>Cliente: <strong style={{color:"#1a1a1a"}}>{sel.clienteNombre}</strong> · Fecha: {sel.fecha}</div>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>Validar items uno a uno:</div>
        {(sel.items||[]).map(it=>{
          const key=it.productoId||it.nombre;
          const v=validados[key];
          return(
            <div key={key} onClick={()=>toggleValidar(key)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:8,marginBottom:8,cursor:"pointer",background:v?.validado?"#f0fdf4":"#f9fafb",border:"2px solid "+(v?.validado?"#1a8a3c":"#e5e7eb"),transition:"all .15s"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:v?.validado?"#1a8a3c":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,flexShrink:0}}>{v?.validado?"✓":""}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>{it.nombre}</div>
                <div style={{fontSize:12,color:"#888"}}>{it.cantidad} {it.unidad}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:v?.validado?"#1a8a3c":"#9ca3af"}}>{v?.validado?"VALIDADO":"Tocar para validar"}</span>
            </div>
          );
        })}
        <div style={{display:"flex",gap:12,marginTop:14,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Numero de bultos</label>
            <input type="number" value={bultos} onChange={e=>setBultos(e.target.value)} min="1" style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:14,fontFamily:"inherit",width:80}} />
          </div>
          <div style={{flex:3}}>
            <label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Notas del packing</label>
            <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: frágil, cadena de frío..." style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}} />
          </div>
        </div>
      </div>
      <div style={{background:todosValidados?"#f0fdf4":"#f9fafb",border:"2px solid "+(todosValidados?"#1a8a3c":"#e5e7eb"),borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:todosValidados?"#1a8a3c":"#9ca3af",fontWeight:600,textAlign:"center"}}>
        {todosValidados?"✓ Todos los items validados — listo para confirmar":"Validá todos los items para habilitar la confirmacion"}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setSel(null)} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarPacking} disabled={!todosValidados} style={{padding:"10px 28px",background:todosValidados?"#1a8a3c":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:todosValidados?"pointer":"not-allowed",fontWeight:700,fontSize:14}}>Confirmar packing</button>
      </div>
    </section>
  );

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Packing / Preparacion</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Validar items antes del despacho — evita errores de entrega</p>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Ordenes para preparar ({pendPacking.length})</h3>
      {pendPacking.length===0?(<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:20,fontSize:13,color:G,textAlign:"center"}}>No hay ordenes pendientes de packing</div>):(
        <div style={{display:"grid",gap:10}}>
          {pendPacking.map(v=>(
            <div key={v.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:14}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:G}}>{v.nroVenta}</div><div style={{fontSize:12,color:"#666"}}>{v.clienteNombre} · {v.items?.length||0} productos · ${Number(v.total||0).toLocaleString("es-UY")}</div></div>
              <span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,textTransform:"capitalize"}}>{v.estado}</span>
              <button onClick={()=>iniciarPacking(v)} style={{padding:"8px 18px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Preparar</button>
            </div>
          ))}
        </div>
      )}
      {packings.length>0&&(
        <div style={{marginTop:24}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial de packings</h3>
          <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {packings.slice(0,8).map((pk,i)=>(
              <div key={pk.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:G}}>{pk.nroVenta}</div><div style={{fontSize:11,color:"#666"}}>{pk.clienteNombre} · {pk.fecha}</div></div>
                <div style={{fontSize:12,color:"#888"}}>{pk.bultos} bulto{pk.bultos>1?"s":""}</div>
                <span style={{background:"#f0fdf4",color:G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>Listo</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default PackingTab;
