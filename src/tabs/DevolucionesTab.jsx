import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db } from '../lib/constants.js';

function DevolucionesTab(){
  const { products: prods, setProducts: setProds,
          devoluciones, setDevoluciones, ventas, setHasPendingSync } = useApp();
  const G="#3a7d1e";
  const [vista,setVista]=useState("lista");
  const [form,setForm]=useState({ventaId:"",clienteNombre:"",motivo:"",items:[],notas:""});
  const [msg,setMsg]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const _ventaSeleccionada=ventas.find(v=>v.id===form.ventaId)||null;
  const iniciarDevolucion=(venta)=>{
    setForm({ventaId:venta.id,clienteNombre:venta.clienteNombre,motivo:"",notas:"",
      items:(venta.items||[]).map(it=>({...it,cantDevolver:0,estado:"pendiente",inspeccion:""}))});
    setVista("nueva");
  };
  const confirmarDevolucion=()=>{
    const itemsDevueltos=form.items.filter(it=>Number(it.cantDevolver)>0);
    if(itemsDevueltos.length===0){setMsg("Ingresa al menos un item a devolver");return;}
    if(!form.motivo){setMsg("Ingresa el motivo de la devolucion");return;}
    // Reingresar stock de items aprobados
    const updProds=[...prods];
    // Capture stock BEFORE reingress — needed as lock value for patchWithLock
    const stockBefore={};
    itemsDevueltos.forEach(it=>{
      if(it.inspeccion==="aprobado"){
        const idx=updProds.findIndex(p=>p.id===it.productoId);
        if(idx>-1){
          stockBefore[updProds[idx].id]=Number(updProds[idx].stock||0);
          updProds[idx]={...updProds[idx],stock:Number(updProds[idx].stock||0)+Number(it.cantDevolver)};
        }
      }
    });
    setProds(updProds);
    // Persist approved stock increments to Supabase — patchWithLock prevents overwrites
    const now = new Date().toISOString();
    const stockWrites = itemsDevueltos
      .filter(it => it.inspeccion === 'aprobado')
      .map(it => {
        const p = updProds.find(x => x.id === it.productoId);
        if (!p || stockBefore[p.id] === undefined) return Promise.resolve();
        return db.patchWithLock('products', { stock: p.stock, updated_at: now }, 'uuid=eq.' + it.productoId, 'stock', stockBefore[p.id]);
      });
    Promise.allSettled(stockWrites).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn('[Devoluciones] ' + failed + ' patchWithLock(s) failed — stock safe in AppContext');
        setHasPendingSync(true);
      }
    });
    const dev={id:crypto.randomUUID(),nroDevolucion:"DEV-"+String(devoluciones.length+1).padStart(4,"0"),
      ventaId:form.ventaId,clienteNombre:form.clienteNombre,motivo:form.motivo,notas:form.notas,
      items:itemsDevueltos,estado:"procesada",fecha:new Date().toLocaleDateString("es-UY"),creadoEn:new Date().toISOString()};
    const upd=[dev,...devoluciones];
    setDevoluciones(upd);
    // Persist to Supabase devoluciones table (non-blocking)
    db.insert('devoluciones',{
      id:              dev.id,
      nro_devolucion:  dev.nroDevolucion,
      venta_id:        dev.ventaId||null,
      cliente_nombre:  dev.clienteNombre,
      motivo:          dev.motivo,
      notas:           dev.notas||'',
      items:           dev.items,
      estado:          dev.estado,
      fecha:           dev.fecha||null,
      creado_en:       dev.creadoEn,
    }).catch(e=>{
      console.warn('[DevolucionesTab] insert failed:',e?.message||e);
      setMsg('⚠ Devolucion guardada localmente — no se sincronizó con el servidor. Datos seguros.');
      setTimeout(()=>setMsg(''),6000);
    });
    setVista("lista");
    setMsg("Devolucion "+dev.nroDevolucion+" procesada. Stock actualizado para items aprobados.");
    setTimeout(()=>setMsg(""),5000);
  };
  const MOTIVOS=["Producto danado","Error en pedido","Producto vencido","Exceso de stock","Otro"];
  if(vista==="nueva")return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setVista("lista")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Nueva devolucion — {form.clienteNombre}</h2>
      </div>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Motivo</label>
          <select value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} style={inp}>
            <option value="">- Seleccionar motivo -</option>
            {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
          </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Notas adicionales</label>
          <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Descripcion del estado..." style={inp} /></div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>Items a devolver:</div>
        {form.items.map((it,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{it.nombre}</div><div style={{fontSize:11,color:"#888"}}>Pedido: {it.cantidad} {it.unidad}</div></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Cant. a devolver</label>
            <input type="number" min="0" max={it.cantidad} value={it.cantDevolver} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],cantDevolver:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,width:70}} /></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Inspeccion</label>
            <select value={it.inspeccion} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],inspeccion:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,fontSize:12,color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#374151"}}>
              <option value="">- Estado -</option>
              <option value="aprobado">Aprobado (vuelve al stock)</option>
              <option value="rechazado">Rechazado (baja por calidad)</option>
              <option value="pendiente">Pendiente revision</option>
            </select></div>
            <div style={{fontSize:11,padding:"4px 8px",borderRadius:6,background:it.inspeccion==="aprobado"?"#f0fdf4":it.inspeccion==="rechazado"?"#fef2f2":"#f9fafb",color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#888",textAlign:"center",marginTop:16}}>
              {it.inspeccion==="aprobado"?"Reingresa stock":it.inspeccion==="rechazado"?"Se da de baja":"Sin accion"}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setVista("lista")} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarDevolucion} style={{padding:"10px 28px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Procesar devolucion</button>
      </div>
    </section>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Devoluciones</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Gestiona devoluciones de clientes con inspeccion y reingreso al stock</p>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Iniciar devolucion desde venta</h3>
          {ventas.filter(v=>v.estado==="entregada").length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>No hay ventas entregadas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {ventas.filter(v=>v.estado==="entregada").slice(0,8).map((v,i)=>(
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:G}}>{v.nroVenta}</div>
                    <div style={{fontSize:11,color:"#666"}}>{v.clienteNombre} · {v.fecha}</div>
                  </div>
                  <button onClick={()=>iniciarDevolucion(v)} style={{padding:"5px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:12,color:"#374151"}}>Devolver</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Historial ({devoluciones.length})</h3>
          {devoluciones.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>Sin devoluciones registradas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {devoluciones.slice(0,8).map((d,i)=>(
                <div key={d.id} style={{padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>{d.nroDevolucion}</div>
                      <div style={{fontSize:11,color:"#666"}}>{d.clienteNombre} · {d.fecha}</div>
                    </div>
                    <span style={{background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{d.motivo}</span>
                  </div>
                  <div style={{fontSize:11,color:"#888",marginTop:4}}>{d.items.length} item(s) · {d.items.filter(it=>it.inspeccion==="aprobado").length} aprobados / {d.items.filter(it=>it.inspeccion==="rechazado").length} rechazados</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default DevolucionesTab;
