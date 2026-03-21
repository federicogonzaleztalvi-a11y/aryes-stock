import { useState } from 'react';
import { LS } from '../lib/constants.js';

function ConteoTab(){
  const G="#3a7d1e";
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [conteos,setConteos]=useState(()=>LS.get("aryes-conteos",[]));
  const [conteoActivo,setConteoActivo]=useState(null);
  const [itemIdx,setItemIdx]=useState(0);
  const [cantFisica,setCantFisica]=useState("");
  const [msg,setMsg]=useState("");
  const [vista,setVista]=useState("inicio");

  const iniciarConteo=()=>{
    const items=prods.map(p=>({id:p.id,nombre:p.nombre||p.name||"",stockSistema:Number(p.stock||0),unidad:p.unidad||p.unit||"u",cantFisica:null,diferencia:null}));
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
    let updProds=[...prods];
    conteoActivo.items.filter(it=>it.cantFisica!==null).forEach(it=>{
      const idx=updProds.findIndex(p=>String(p.id)===String(it.id));
      if(idx>-1)updProds[idx]={...updProds[idx],stock:it.cantFisica};
    });
    setProds(updProds);LS.set("aryes6-products",updProds);
    const finalConteo={...conteoActivo,completado:true,finalizadoEn:new Date().toISOString()};
    const upd=[finalConteo,...conteos];
    setConteos(upd);LS.set("aryes-conteos",upd);
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
            style={{fontSize:36,fontWeight:700,textAlign:"center",width:160,padding:"10px",border:"2px solid #3a7d1e",borderRadius:10,outline:"none",fontFamily:"inherit"}} />
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
            <div style={{fontSize:28,fontWeight:800,color:difs.length>0?"#ef4444":"#3a7d1e"}}>{difs.length}</div></div>
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
                <td style={{padding:"9px 14px",fontWeight:700,color:"#3a7d1e"}}>{it.cantFisica} {it.unidad}</td>
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
          <button onClick={iniciarConteo} style={{padding:"10px 24px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Iniciar conteo ({prods.length} productos)</button>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial de conteos</div>
          {conteos.length===0?(<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin conteos previos</div>):(
            conteos.slice(0,5).map((c,i)=>{
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
