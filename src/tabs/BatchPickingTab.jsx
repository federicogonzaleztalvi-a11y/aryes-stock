import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS, fmt, getOrgId} from '../lib/constants.js';

function BatchPickingTab(){
  const { products: prods, setProducts: setProds } = useApp();
  const G="#059669";
  const { ventas } = useApp();
  const [selIds,setSelIds]=useState([]);
  const [picking,setPicking]=useState(null);
  const [recolectados,setRecolectados]=useState({});
  const [msg,setMsg]=useState("");
  const [zonas,setZonas]=useState([]);

  // Cargar zonas del depósito para ordenar picking
  useState(()=>{
    const SB=import.meta.env.VITE_SUPABASE_URL;
    const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${SB}/rest/v1/deposit_zones?org_id=eq.${getOrgId()}&active=eq.true&order=orden.asc`,
      {headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}})
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setZonas(d); }).catch(()=>{});
  });

  // Función para obtener zona de un ítem por su categoría
  const getZonaOrden=(item)=>{
    const prod=prods.find(p=>(p.nombre||p.name)===item.nombre);
    if(!prod||!zonas.length) return 999;
    const cat=(prod.category||prod.categoria||'').toUpperCase();
    const zona=zonas.find(z=>(z.categorias||[]).some(c=>cat.includes(c.toUpperCase())));
    return zona?.orden ?? 999;
  };

  const pendientes=ventas.filter(v=>["confirmada","preparada"].includes(v.estado));

  const toggleSel=(id)=>setSelIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const generarBatch=()=>{
    if(selIds.length===0)return;
    const selVentas=ventas.filter(v=>selIds.includes(v.id));
    // Consolidar items: agrupar por producto sumando cantidades
    const mapa={};
    selVentas.forEach(v=>{
      (v.items||[]).forEach(it=>{
        const key=it.productoId||it.nombre;
        if(!mapa[key])mapa[key]={nombre:it.nombre,unidad:it.unidad,cantTotal:0,pedidos:[]};
        mapa[key].cantTotal+=Number(it.cantidad);
        mapa[key].pedidos.push({nroVenta:v.nroVenta,clienteNombre:v.clienteNombre,cantidad:it.cantidad});
      });
    });
    const items=Object.entries(mapa).map(([k,v])=>({key:k,...v}));
    // Ordenar por zona del depósito para recorrido óptimo
    items.sort((a,b)=>{ const za=getZonaOrden(a); const zb=getZonaOrden(b); return za-zb; });
    const init={};items.forEach(it=>init[it.key]=false);
    setPicking({id:crypto.randomUUID(),ventas:selVentas,items,creadoEn:new Date().toISOString()});
    setRecolectados(init);
  };

  const toggleRecolectado=(key)=>setRecolectados(r=>({...r,[key]:!r[key]}));
  const todoRecolectado=picking&&Object.values(recolectados).every(Boolean);
  const pct=picking?Math.round(Object.values(recolectados).filter(Boolean).length/picking.items.length*100):0;

  const confirmarBatch=()=>{
    // Descontar stock
    const updProds=[...prods];
    picking.items.forEach(it=>{
      const idx=updProds.findIndex(p=>(p.nombre||p.name)===it.nombre);
      if(idx>-1){
        const nuevo=Math.max(0,Number(updProds[idx].stock||0)-it.cantTotal);
        updProds[idx]={...updProds[idx],stock:nuevo};
      }
    });
    setProds(updProds);

    // Ledger inmutable — RPC por cada ítem del batch
    const SB_B=import.meta.env.VITE_SUPABASE_URL;
    const KEY_B=import.meta.env.VITE_SUPABASE_ANON_KEY;
    picking.items.forEach(it=>{
      const prod=prods.find(p=>(p.nombre||p.name)===it.nombre);
      if(prod?.uuid&&it.cantTotal>0){
        fetch(`${SB_B}/rest/v1/rpc/stock_venta`,{
          method:'POST',
          headers:{apikey:KEY_B,Authorization:`Bearer ${KEY_B}`,'Content-Type':'application/json'},
          body:JSON.stringify({p_product_uuid:prod.uuid,p_qty:it.cantTotal,p_org_id:getOrgId(),p_ref:`batch-picking-${picking.id}`})
        }).catch(e=>console.warn('[BatchPickingTab] stock_venta RPC:',e));
      }
    });

    const n=picking.ventas.length;
    setPicking(null);setSelIds([]);
    setMsg("Batch completado. Stock descontado para "+n+" ordenes.");
    setTimeout(()=>setMsg(""),4000);
  };

  if(picking)return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>setPicking(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Batch Picking — {picking.ventas.length} ordenes</h2>
      </div>
      <div style={{background:"#e5e7eb",borderRadius:99,height:8,marginBottom:20,overflow:"hidden"}}>
        <div style={{width:pct+"%",background:G,height:"100%",borderRadius:99,transition:"width .3s"}} />
      </div>
      <div style={{fontSize:12,color:"#888",marginBottom:16}}>
        Ordenes: {picking.ventas.map(v=><span key={v.id} style={{background:"#f0fdf4",color:G,padding:"1px 8px",borderRadius:20,marginRight:4,fontSize:11,fontWeight:700}}>{v.nroVenta}</span>)}
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{padding:"10px 16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",fontSize:12,color:"#888",fontWeight:600,display:"grid",gridTemplateColumns:"1fr auto auto",gap:10}}>
          <span>PRODUCTO</span><span>TOTAL</span><span>ESTADO</span>
        </div>
        {picking.items.map(it=>(
          <div key={it.key} onClick={()=>toggleRecolectado(it.key)} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:10,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #f3f4f6",cursor:"pointer",background:recolectados[it.key]?"#f0fdf4":"#fff",transition:"background .15s"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>{it.nombre}</div>
              <div style={{fontSize:11,color:"#888"}}>{it.pedidos.map(p=>p.nroVenta+": "+p.cantidad).join(" · ")}</div>
            </div>
            <div style={{fontWeight:800,fontSize:16,color:G}}>{it.cantTotal} {it.unidad}</div>
            <div style={{width:28,height:28,borderRadius:"50%",background:recolectados[it.key]?"#059669":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,flexShrink:0}}>{recolectados[it.key]?"✓":""}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setPicking(null)} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarBatch} disabled={!todoRecolectado} style={{padding:"10px 28px",background:todoRecolectado?"#059669":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:todoRecolectado?"pointer":"not-allowed",fontWeight:700,fontSize:14}}>Confirmar y descontar stock</button>
      </div>
    </section>
  );

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Batch Picking</h2>
      <p style={{fontSize:12,color:"#888",margin:"0 0 20px"}}>Recolectar multiples ordenes en un solo recorrido del deposito</p>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{selIds.length>0?selIds.length+" ordenes seleccionadas":"Selecciona ordenes para hacer batch"}</div>
        <button onClick={generarBatch} disabled={selIds.length===0} style={{padding:"8px 20px",background:selIds.length>0?"#059669":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:selIds.length>0?"pointer":"not-allowed",fontWeight:700,fontSize:13}}>Generar batch →</button>
      </div>
      {pendientes.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>No hay órdenes pendientes de picking</div>):(
        <div style={{display:"grid",gap:8}}>
          {pendientes.map(v=>(
            <div key={v.id} onClick={()=>toggleSel(v.id)} style={{background:selIds.includes(v.id)?"#f0fdf4":"#fff",border:"2px solid "+(selIds.includes(v.id)?"#059669":"#e5e7eb"),borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
              <div style={{width:22,height:22,borderRadius:4,background:selIds.includes(v.id)?"#059669":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,flexShrink:0}}>{selIds.includes(v.id)?"✓":""}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:"#059669"}}>{v.nroVenta}</div><div style={{fontSize:12,color:"#666"}}>{v.clienteNombre} · {v.items?.length||0} productos</div></div>
              <div style={{fontWeight:700,fontSize:14}}>${fmt.int(v.total||0)}</div>
              <span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,textTransform:"capitalize"}}>{v.estado}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default BatchPickingTab;
