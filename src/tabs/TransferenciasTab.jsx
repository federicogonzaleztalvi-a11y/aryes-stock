import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS, db, getOrgId } from '../lib/constants.js';

function TransferenciasTab(){
  const { products: prods, transfers, setTransfers, isDemoMode } = useApp();
  const G="#059669";
  const KUB="aryes-deposito-ubicaciones"; // mismo store que DepositoTab (mapa producto→bin)
  const [form,setForm]=useState({productoId:"",cantidad:"",origen:"",destino:"",notas:""});
  const [msg,setMsg]=useState("");
  const [showForm,setShowForm]=useState(false);
  // Mapa real de ubicaciones del depósito (no hardcode). Stock total NO cambia en
  // un movimiento interno: sólo se reubica el bin que ocupa el producto.
  const [ubicaciones,setUbicaciones]=useState(()=>LS.get(KUB,[]));

  // Fuente de verdad: Supabase deposit_locations (mismo store que DepositoTab).
  // LS = cache offline; en demo db.* es no-op y quedamos con LS.
  useEffect(()=>{
    if(isDemoMode)return;
    db.get('deposit_locations',`org_id=eq.${getOrgId()}`).then(rows=>{
      if(Array.isArray(rows)){
        const mapped=rows.map(r=>({id:r.bin_id,productoId:r.producto_id,asignado:r.asignado}));
        setUbicaciones(mapped); LS.set(KUB,mapped);
      }
    }).catch(()=>{});
  },[isDemoMode]);

  const selProd=prods.find(p=>p.id===form.productoId);
  // Bins reales: los ocupados según el mapa del depósito.
  const binIds=[...new Set(ubicaciones.map(u=>u.id))].sort((a,b)=>a.localeCompare(b));
  // Origen sugerido: bins donde HOY está el producto seleccionado.
  const binsDelProducto=form.productoId
    ? ubicaciones.filter(u=>u.productoId===form.productoId).map(u=>u.id)
    : [];
  const origenOpts=binsDelProducto.length?binsDelProducto:binIds;

  const guardarTransfer=()=>{
    if(!form.productoId||!form.cantidad||!form.origen||!form.destino){
      setMsg("Completa todos los campos requeridos");return;
    }
    if(form.origen===form.destino){setMsg("Origen y destino no pueden ser iguales");return;}
    if(Number(form.cantidad)<=0){setMsg("La cantidad debe ser mayor a 0");return;}
    const t={
      id:             crypto.randomUUID(),
      productoId:     form.productoId,
      productoNombre: selProd ? selProd.nombre||selProd.name : "",
      cantidad:       Number(form.cantidad),
      origen:         form.origen,
      destino:        form.destino,
      notas:          form.notas,
      fecha:          new Date().toLocaleDateString("es"),
      creadoEn:       new Date().toISOString(),
    };
    // Optimistic update — reactive LS.set handled by AppContext useEffect
    setTransfers(prev => [t, ...prev]);
    // Reubicar el bin del producto: liberar origen, ocupar destino. El stock TOTAL
    // no se toca — es un movimiento físico interno, no una entrada/salida.
    const ts=new Date().toISOString();
    const updUbs=ubicaciones
      .filter(u=>!(u.id===form.origen&&u.productoId===form.productoId))
      .filter(u=>u.id!==form.destino) // destino queda asignado al producto movido
      .concat([{id:form.destino,productoId:form.productoId,asignado:ts}]);
    setUbicaciones(updUbs);
    LS.set(KUB,updUbs);
    // Persist reubicación: liberar bin origen, ocupar bin destino (no toca stock)
    db.del('deposit_locations',{bin_id:form.origen})
      .catch(e=>console.warn('[TransferenciasTab] del origen:',e?.message||e));
    db.upsert('deposit_locations',{org_id:getOrgId(),bin_id:form.destino,producto_id:form.productoId,asignado:ts},'org_id,bin_id')
      .catch(e=>console.warn('[TransferenciasTab] upsert destino:',e?.message||e));
    // Persist to Supabase (non-blocking)
    db.insert('transfers', {
      id:              t.id,
      producto_id:     t.productoId,
      producto_nombre: t.productoNombre,
      cantidad:        t.cantidad,
      origen:          t.origen,
      destino:         t.destino,
      notas:           t.notas,
      fecha:           t.fecha,
      creado_en:       t.creadoEn,
    }).catch(e => console.warn('[TransferenciasTab] insert failed:', e?.message || e));
    setForm({productoId:"",cantidad:"",origen:"",destino:"",notas:""});
    setShowForm(false);
    setMsg("Transferencia registrada: "+t.productoNombre+" de "+t.origen+" a "+t.destino);
    setTimeout(()=>setMsg(""),4000);
  };

  const F=({label,children,req})=>(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:5}}>{label}{req&&<span style={{color:"#ef4444",marginLeft:2}}>*</span>}</label>
      {children}
    </div>
  );
  const inp={padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:7,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Transferencias Internas</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Mover productos entre ubicaciones del deposito</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:"10px 20px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>
          {showForm?"Cancelar":"+ Nueva transferencia"}</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {showForm&&(
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,.08)",marginBottom:24}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#1a1a1a",marginTop:0,marginBottom:16}}>Nueva transferencia</h3>
          {binIds.length===0&&(
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12.5,color:"#92400e"}}>
              Todavía no asignaste ubicaciones en el depósito. Andá a <strong>Depósito</strong> y asigná productos a sus posiciones para poder moverlos entre ellas.
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={{gridColumn:"1 / -1"}}>
              <F label="Producto" req>
                <select value={form.productoId} onChange={e=>setForm(f=>({...f,productoId:e.target.value}))} style={{...inp}}>
                  <option value="">Seleccionar producto...</option>
                  {prods.map(p=><option key={p.id} value={p.id}>{p.nombre||p.name} ({p.stock||0} {p.unidad||p.unit||"u"} disponibles)</option>)}
                </select>
              </F>
            </div>
            <F label="Cantidad" req>
              <input type="number" value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="0" min="1" style={{...inp}} />
            </F>
            <div/>
            <F label="Ubicacion origen" req>
              <select value={form.origen} onChange={e=>setForm(f=>({...f,origen:e.target.value}))} style={{...inp}}>
                <option value="">Seleccionar origen...</option>
                {origenOpts.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Ubicacion destino" req>
              <select value={form.destino} onChange={e=>setForm(f=>({...f,destino:e.target.value}))} style={{...inp}}>
                <option value="">Seleccionar destino...</option>
                {binIds.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <div style={{gridColumn:"1 / -1"}}>
              <F label="Notas">
                <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Motivo del movimiento..." style={{...inp}} />
              </F>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}>
            <button onClick={()=>{setShowForm(false);setForm({productoId:"",cantidad:"",origen:"",destino:"",notas:""}); }} style={{padding:"9px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={guardarTransfer} style={{padding:"9px 24px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Registrar transferencia</button>
          </div>
        </div>
      )}

      <div style={{fontSize:11,fontWeight:600,color:"#b0aca6",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12,marginTop:8}}>Historial</div>
      {transfers.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>📦</div>No hay transferencias registradas<div style={{fontSize:12,marginTop:6,color:"#9a9a98"}}>Las transferencias se crean cuando movés stock entre depósitos</div></div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb"}}>{["Fecha","Producto","Cantidad","Origen","Destino","Notas"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead>
            <tbody>{transfers.slice(0,20).map((t,i)=>(
              <tr key={t.id} style={{borderTop:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",color:"#888"}}>{t.fecha}</td>
                <td style={{padding:"9px 14px",fontWeight:600}}>{t.productoNombre}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:G}}>{t.cantidad}</td>
                <td style={{padding:"9px 14px"}}><span style={{background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{t.origen}</span></td>
                <td style={{padding:"9px 14px"}}><span style={{background:"#f0fdf4",color:G,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{t.destino}</span></td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>{t.notas||"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TransferenciasTab;
