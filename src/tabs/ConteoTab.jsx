import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db , getOrgId } from '../lib/constants.js';

function ConteoTab(){
  const { products: prods, setProducts: setProds, conteos, setConteos, setHasPendingSync, addMov } = useApp();
  const G="#059669";
  const [conteoActivo,setConteoActivo]=useState(null);
  const [itemIdx,setItemIdx]=useState(0);
  const [cantFisica,setCantFisica]=useState("");
  const [msg,setMsg]=useState("");
  const [vista,setVista]=useState("inicio");
  const [zonaFiltro,setZonaFiltro]=useState("todas");
  const [zonas,setZonas]=useState([]);

  // Cargar zonas del depósito
  useState(()=>{
    const SB=import.meta.env.VITE_SUPABASE_URL;
    const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${SB}/rest/v1/deposit_zones?org_id=eq.${getOrgId()}&active=eq.true&order=orden.asc`,
      {headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}})
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setZonas(d); }).catch(()=>{});
  });

  const iniciarConteo=()=>{
    // Filtrar por zona si corresponde
    let prodsFiltrados=prods;
    if(zonaFiltro!=="todas"){
      const zona=zonas.find(z=>z.id===Number(zonaFiltro));
      if(zona?.categorias?.length){
        prodsFiltrados=prods.filter(p=>{
          const cat=(p.category||p.categoria||'').toUpperCase();
          return zona.categorias.some(c=>cat.includes(c.toUpperCase()));
        });
      }
    }
    const items=prodsFiltrados.map(p=>({id:p.id,nombre:p.nombre||p.name||"",stockSistema:Number(p.stock||0),unidad:p.unidad||p.unit||"u",cantFisica:null,diferencia:null}));
    const c={id:crypto.randomUUID(),fecha:new Date().toISOString().split("T")[0],items,completado:false,creadoEn:new Date().toISOString()};
    setConteoActivo(c);setItemIdx(0);setCantFisica("");setVista("conteo");
  };

  const registrarItem=()=>{
    if(cantFisica==="")return;
    const cant=Number(cantFisica);
    const upd={...conteoActivo};
    upd.items[itemIdx]={...upd.items[itemIdx],cantFisica:cant,diferencia:cant-upd.items[itemIdx].stockSistema};
    setConteoActivo(upd);
    if(itemIdx<upd.items.length-1){setItemIdx(itemIdx+1);setCantFisica("");}
    else{setVista("revision");}
  };

  const saltarItem=()=>{
    if(itemIdx<conteoActivo.items.length-1){setItemIdx(itemIdx+1);setCantFisica("");}
    else setVista("revision");
  };

  const confirmarConteo=()=>{
    // Update stock with physical count
    const updProds=[...prods];
    conteoActivo.items.filter(it=>it.cantFisica!==null).forEach(it=>{
      const idx=updProds.findIndex(p=>p.id===it.id);
      if(idx>-1)updProds[idx]={...updProds[idx],stock:it.cantFisica};
    });
    setProds(updProds);
    // Persist physical count to Supabase — patchWithLock uses stockSistema as lock
    // stockSistema was captured at count start — prevents overwriting concurrent changes
    const now = new Date().toISOString();
    const patches = conteoActivo.items
      .filter(it => it.cantFisica !== null && it.cantFisica !== undefined)
      .map(it => db.patchWithLock('products', { stock: it.cantFisica, updated_at: now }, 'uuid=eq.' + it.id, 'stock', it.stockSistema));
    Promise.allSettled(patches).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn('[Conteo] ' + failed + ' patchWithLock(s) failed — stock safe in AppContext');
        setHasPendingSync(true);
      }
    });
    const finalConteo={...conteoActivo,completado:true,finalizadoEn:new Date().toISOString()};
    // Register a stock movement for each product where the count changed the stock
    // diferencia > 0 → manual_in (more than system expected)
    // diferencia < 0 → manual_out (less than system expected)
    // diferencia === 0 → no movement (count confirmed, stock unchanged)
    conteoActivo.items
      .filter(it => it.cantFisica !== null && it.diferencia !== null && it.diferencia !== 0)
      .forEach(it => {
        const prod = updProds.find(p => p.id === it.id);
        if (!prod) return;
        const delta = Math.abs(Number(it.diferencia));
        addMov({
          type:        it.diferencia > 0 ? 'manual_in' : 'manual_out',
          productId:   prod.id,
          productName: prod.nombre || prod.name || it.nombre,
          qty:         delta,
          unit:        prod.unit || prod.unidad || it.unidad || 'u',
          stockAfter:  Number(it.cantFisica),
          supplierId:  '',
          supplierName:'',
          note:        `Conteo fisico ${finalConteo.fecha} — ajuste ${it.diferencia > 0 ? '+' : ''}${it.diferencia}`,
        });
      });
    const upd=[finalConteo,...conteos];
    setConteos(upd);
    // Persist conteo record to Supabase (non-blocking, stock already saved above)
    db.insert('conteos',{
      id:            finalConteo.id,
      fecha:         finalConteo.fecha,
      items:         finalConteo.items,
      completado:    true,
      creado_en:     finalConteo.creadoEn,
      finalizado_en: finalConteo.finalizadoEn||new Date().toISOString(),
    }).catch(e=>{
      console.warn('[ConteoTab] insert failed:',e?.message||e);
      setMsg('⚠ Conteo guardado localmente — no se sincronizó con el servidor. Stock actualizado correctamente.');
      setTimeout(()=>setMsg(''),7000);
    });
    setConteoActivo(null);setVista("inicio");
    setMsg("Conteo aplicado. Stock actualizado en "+conteoActivo.items.filter(it=>it.cantFisica!==null).length+" productos.");
    setTimeout(()=>setMsg(""),5000);
  };

  const pct=conteoActivo?Math.round(conteoActivo.items.filter(it=>it.cantFisica!==null).length/conteoActivo.items.length*100):0;

  if(vista==="conteo"&&conteoActivo){
    const item=conteoActivo.items[itemIdx];
    return(
      <section style={{padding:"28px 36px",maxWidth:600,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setVista("revision")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Conteo fisico</h2>
        </div>
        <div style={{background:"#e5e7eb",borderRadius:99,height:8,marginBottom:20,overflow:"hidden"}}>
          <div style={{width:pct+"%",background:G,height:"100%",borderRadius:99,transition:"width .3s"}} />
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:28,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>{itemIdx+1} de {conteoActivo.items.length}</div>
          <div style={{fontSize:26,fontWeight:800,color:"#1a1a1a",marginBottom:4}}>{item.nombre}</div>
          <div style={{fontSize:14,color:"#888",marginBottom:24}}>Sistema dice: <strong style={{color:G}}>{item.stockSistema} {item.unidad}</strong></div>
          <div style={{fontSize:13,color:"#666",marginBottom:8}}>Cantidad fisica contada:</div>
          <input type="number" value={cantFisica} onChange={e=>setCantFisica(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&registrarItem()}
            autoFocus min="0" placeholder="0"
            style={{fontSize:36,fontWeight:700,textAlign:"center",width:160,padding:"10px",border:"2px solid #059669",borderRadius:10,outline:"none",fontFamily:"inherit"}} />
          <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:20}}>
            <button onClick={saltarItem} style={{padding:"10px 24px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Saltar</button>
            <button onClick={registrarItem} disabled={cantFisica===""} style={{padding:"10px 32px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:15}}>Confirmar ✓</button>
          </div>
        </div>
      </section>
    );
  }

  if(vista==="revision"&&conteoActivo){
    const difs=conteoActivo.items.filter(it=>it.cantFisica!==null&&it.diferencia!==0);
    const contados=conteoActivo.items.filter(it=>it.cantFisica!==null).length;
    return(
      <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setVista("conteo")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Revision del conteo</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Contados</div>
            <div style={{fontSize:28,fontWeight:800,color:G}}>{contados}</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Con diferencia</div>
            <div style={{fontSize:28,fontWeight:800,color:difs.length>0?"#ef4444":"#059669"}}>{difs.length}</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Sin contar</div>
            <div style={{fontSize:28,fontWeight:800,color:"#6b7280"}}>{conteoActivo.items.length-contados}</div></div>
        </div>
        {difs.length>0&&(
          <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
            <div style={{padding:"10px 16px",background:"#fef2f2",borderBottom:"2px solid #fecaca",fontWeight:700,color:"#dc2626",fontSize:13}}>Diferencias encontradas</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:"#f9fafb"}}>{["Producto","Sistema","Fisico","Diferencia"].map(h=><th key={h} style={{padding:"8px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead>
              <tbody>{difs.map((it,i)=>(<tr key={it.id} style={{borderTop:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",fontWeight:500}}>{it.nombre}</td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>{it.stockSistema} {it.unidad}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:"#059669"}}>{it.cantFisica} {it.unidad}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:it.diferencia>0?"#059669":"#dc2626"}}>{it.diferencia>0?"+":""}{it.diferencia}</td>
              </tr>))}</tbody>
            </table>
          </div>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setVista("conteo")} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Seguir contando</button>
          <button onClick={confirmarConteo} style={{padding:"10px 28px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Aplicar conteo al stock</button>
        </div>
      </section>
    );
  }

  return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Conteo Ciclico</h2>
      <p style={{fontSize:12,color:"#888",margin:"0 0 24px"}}>Verificacion fisica del inventario vs sistema</p>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:700,color:"#1a1a1a",marginBottom:8}}>Nuevo conteo</div>
          <div style={{fontSize:13,color:"#888",marginBottom:16}}>Recorre producto por producto confirmando la cantidad fisica en el deposito</div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              Conteo cíclico — elegir zona
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[{id:"todas",nombre:"Todas las zonas"},...zonas].map(z=>(
                <button key={z.id} onClick={()=>setZonaFiltro(String(z.id))}
                  style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",
                    background:zonaFiltro===String(z.id)?G:"#f5f5f7",
                    color:zonaFiltro===String(z.id)?"#fff":"#4a4a48",
                    border:zonaFiltro===String(z.id)?"none":"1px solid #e0e0dc"}}>
                  {z.nombre}
                </button>
              ))}
            </div>
            {zonaFiltro!=="todas"&&zonas.find(z=>z.id===Number(zonaFiltro))?.categorias?.length>0&&(
              <div style={{fontSize:11,color:"#059669",marginTop:6}}>
                Categorías: {zonas.find(z=>z.id===Number(zonaFiltro)).categorias.join(", ")}
              </div>
            )}
          </div>
          <button onClick={iniciarConteo} style={{padding:"10px 24px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>
            Iniciar conteo {zonaFiltro==="todas"?`(${prods.length} productos)`:`— ${zonas.find(z=>z.id===Number(zonaFiltro))?.nombre||""}`}
          </button>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial de conteos</div>
          {conteos.length===0?(<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin conteos previos</div>):(
            conteos.slice(0,5).map((c,_i)=>{
              const difs=c.items?.filter(it=>it.cantFisica!==null&&it.diferencia!==0).length||0;
              return(<div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{c.fecha}</div><div style={{fontSize:11,color:"#888"}}>{c.items?.filter(it=>it.cantFisica!==null).length||0} contados</div></div>
                <span style={{background:difs>0?"#fef2f2":"#f0fdf4",color:difs>0?"#dc2626":G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{difs>0?difs+" difs":"OK"}</span>
              </div>);
            })
          )}
        </div>
      </div>
    </section>
  );
}

export default ConteoTab;
