import { useState } from 'react';
import { LS } from '../lib/constants.js';

function InventarioTab(){
  const G="#3a7d1e";
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [busq,setBusq]=useState("");
  const [marca,setMarca]=useState("todas");
  const [soloStock,setSoloStock]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({});
  const [msg,setMsg]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const marcas=["todas",...new Set(prods.map(p=>p.marca||p.brand||"Sin marca").filter(Boolean))].slice(0,20);
  const filtered=prods.filter(p=>{
    const n=(p.nombre||p.name||"").toLowerCase();
    if(busq&&!n.includes(busq.toLowerCase()))return false;
    if(marca!=="todas"&&(p.marca||p.brand||"Sin marca")!==marca)return false;
    if(soloStock&&Number(p.stock||0)<=0)return false;
    return true;
  });
  const stockCrit=prods.filter(p=>Number(p.stock||0)>0&&Number(p.stock||0)<=(p.rop||5)).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const totalValor=prods.reduce((a,p)=>a+Number(p.stock||0)*Number(p.precio||p.price||0),0);
  const startEdit=(p)=>{setEditId(p.id);setForm({nombre:p.nombre||p.name||"",stock:p.stock||0,precio:p.precio||p.price||0,unidad:p.unidad||p.unit||"u",rop:p.rop||5,proveedor:p.proveedor||""});};
  const saveEdit=(id)=>{
    const upd=prods.map(p=>p.id===id?{...p,...form,nombre:form.nombre,name:form.nombre,precio:Number(form.precio),price:Number(form.precio),stock:Number(form.stock),rop:Number(form.rop)}:p);
    setProds(upd);LS.set("aryes6-products",upd);setEditId(null);setMsg("Guardado");setTimeout(()=>setMsg(""),2000);
  };
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Inventario</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>{prods.length} productos · {filtered.length} visibles</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {stockCrit>0&&<span style={{background:"#fffbeb",color:"#92400e",fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:20}}>{stockCrit} criticos</span>}
          {sinStock>0&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:20}}>{sinStock} sin stock</span>}
        </div>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Total productos</div><div style={{fontSize:28,fontWeight:800,color:G}}>{prods.length}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Valor en stock</div><div style={{fontSize:22,fontWeight:800,color:"#1a1a1a"}}>${totalValor.toLocaleString("es-UY")}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Sin stock / Critico</div><div style={{fontSize:28,fontWeight:800,color:sinStock>0?"#dc2626":stockCrit>0?"#f59e0b":G}}>{sinStock+stockCrit}</div></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto..." style={{...inp,flex:1,minWidth:200}} />
        <select value={marca} onChange={e=>setMarca(e.target.value)} style={{...inp,width:180}}>{marcas.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#374151",cursor:"pointer",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={soloStock} onChange={e=>setSoloStock(e.target.checked)} />Con stock
        </label>
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
            {["Producto","Marca","Stock","Precio","Pto.Reorden","Proveedor","Estado",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((p,i)=>{
              const st=Number(p.stock||0);
              const rop=Number(p.rop||5);
              const status=st===0?"sin-stock":st<=rop?"critico":"ok";
              const statusColors={ok:{bg:"#f0fdf4",color:G,label:"OK"},"sin-stock":{bg:"#fef2f2",color:"#dc2626",label:"Sin stock"},"critico":{bg:"#fffbeb",color:"#92400e",label:"Critico"}};
              const sc=statusColors[status];
              const isEdit=editId===p.id;
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:st===0?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{isEdit?<input style={{...inp,width:160}} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} />:(p.nombre||p.name)}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.marca||p.brand||"-"}</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:sc.color}}>{isEdit?<input type="number" style={{...inp,width:70}} value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} />:st}</td>
                  <td style={{padding:"10px 14px"}}>{isEdit?<input type="number" style={{...inp,width:90}} value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} />:"$"+(p.precio||p.price||0)}</td>
                  <td style={{padding:"10px 14px"}}>{isEdit?<input type="number" style={{...inp,width:60}} value={form.rop} onChange={e=>setForm(f=>({...f,rop:e.target.value}))} />:rop}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{isEdit?<input style={{...inp,width:120}} value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} />:(p.proveedor||"-")}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:sc.bg,color:sc.color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{sc.label}</span></td>
                  <td style={{padding:"10px 14px"}}>{isEdit?(<div style={{display:"flex",gap:4}}><button onClick={()=>saveEdit(p.id)} style={{padding:"4px 10px",background:G,color:"#fff",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700}}>Guardar</button><button onClick={()=>setEditId(null)} style={{padding:"4px 8px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,cursor:"pointer",fontSize:11}}>Cancelar</button></div>):(<button onClick={()=>startEdit(p)} style={{padding:"4px 10px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,cursor:"pointer",fontSize:11}}>Editar</button>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin resultados para esta busqueda</div>}
      </div>
    </section>
  );
}

export default InventarioTab;
