import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS } from '../lib/constants.js';

function PreciosTab(){
  const { products: prods, setProducts: setProds } = useApp();
  const G="#3a7d1e";
  const [listas,setListas]=useState(()=>LS.get("aryes-listas-precio",{
    A:{nombre:"Lista A - Mayorista",descuento:20,color:"#3b82f6"},
    B:{nombre:"Lista B - HORECA",descuento:10,color:"#8b5cf6"},
    C:{nombre:"Lista C - Minorista",descuento:0,color:"#f59e0b"}
  }));
  const [listaActiva,setListaActiva]=useState("A");
  const [busq,setBusq]=useState("");
  const [msg,setMsg]=useState("");
  const [editDesc,setEditDesc]=useState(false);
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const lista=listas[listaActiva];
  const calcPrecio=(precioBase,desc)=>Math.round(Number(precioBase||0)*(1-(Number(desc||0)/100)));
  const filtered=prods.filter(p=>{
    const n=(p.nombre||p.name||"").toLowerCase();
    return !busq||n.includes(busq.toLowerCase());
  });
  const guardarDescuento=(listaId,nuevo)=>{
    const upd={...listas,[listaId]:{...listas[listaId],descuento:Number(nuevo)}};
    setListas(upd);LS.set("aryes-listas-precio",upd);
    setEditDesc(false);setMsg("Lista actualizada");setTimeout(()=>setMsg(""),2000);
  };
  const setPrecioCustom=(prodId,listaId,precio)=>{
    const upd=prods.map(p=>{
      if(p.id!==prodId)return p;
      const precios={...(p.precios||{}),[listaId]:Number(precio)};
      return{...p,precios};
    });
    setProds(upd);
  };
  const exportarLista=()=>{
    const rows=[["Producto","Precio Base","Descuento "+lista.descuento+"%","Precio Final"],...filtered.map(p=>{
      const base=p.precio||p.price||0;
      const custom=p.precios&&p.precios[listaActiva];
      const final=custom||calcPrecio(base,lista.descuento);
      return[p.nombre||p.name||"","$"+base,lista.descuento+"%","$"+final];
    })];
    const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="lista-"+listaActiva+".csv";a.click();
    URL.revokeObjectURL(url);
  };
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Listas de Precios</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Precios diferenciados por tipo de cliente</p></div>
        <button onClick={exportarLista} style={{padding:"8px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Exportar lista CSV</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {Object.entries(listas).map(([id,l])=>(
          <button key={id} onClick={()=>{setListaActiva(id);setEditDesc(false);}} style={{padding:"10px 20px",borderRadius:10,border:"2px solid "+(listaActiva===id?l.color:"#e5e7eb"),background:listaActiva===id?l.color+"18":"#fff",color:listaActiva===id?l.color:"#666",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            {l.nombre}<span style={{marginLeft:8,fontSize:11,opacity:.8}}>-{l.descuento}%</span>
          </button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{lista.nombre}</div>
          <div style={{fontSize:12,color:"#888",marginTop:2}}>Descuento base sobre precio lista: <strong>{lista.descuento}%</strong></div>
        </div>
        {editDesc?(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="number" id="newDisc" defaultValue={lista.descuento} min="0" max="100" style={{...inp,width:70}} />
            <button onClick={()=>guardarDescuento(listaActiva,document.getElementById("newDisc").value)} style={{padding:"7px 14px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:700}}>Guardar</button>
            <button onClick={()=>setEditDesc(false)} style={{padding:"7px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:13}}>Cancelar</button>
          </div>
        ):(
          <button onClick={()=>setEditDesc(true)} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:13}}>Editar descuento</button>
        )}
      </div>
      <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto..." style={{...inp,marginBottom:12}} />
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
            {["Producto","Precio base","Desc. lista","Precio final","Precio custom",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
          </tr></thead>
          <tbody>{filtered.slice(0,50).map((p,i)=>{
            const base=Number(p.precio||p.price||0);
            const custom=p.precios&&p.precios[listaActiva]?Number(p.precios[listaActiva]):null;
            const final=custom||calcPrecio(base,lista.descuento);
            return(
              <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",fontWeight:500}}>{p.nombre||p.name}</td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>${base.toLocaleString("es-UY")}</td>
                <td style={{padding:"9px 14px",color:lista.color,fontWeight:600}}>-{lista.descuento}%</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:custom?lista.color:G}}>${final.toLocaleString("es-UY")}{custom&&<span style={{fontSize:10,color:lista.color,marginLeft:4}}>custom</span>}</td>
                <td style={{padding:"9px 14px"}}>
                  <input type="number" placeholder={"Auto: $"+calcPrecio(base,lista.descuento)} value={custom||""} onChange={e=>setPrecioCustom(p.id,listaActiva,e.target.value||0)} style={{...inp,width:100,fontSize:12}} />
                </td>
                <td style={{padding:"9px 14px"}}>
                  {custom&&<button onClick={()=>setPrecioCustom(p.id,listaActiva,0)} style={{padding:"3px 8px",background:"#fff",border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",fontSize:10,color:"#dc2626"}}>Reset</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin productos para mostrar</div>}
      </div>
    </section>
  );
}

export default PreciosTab;
