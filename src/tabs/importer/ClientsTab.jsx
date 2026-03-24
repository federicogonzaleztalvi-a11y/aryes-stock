import { useState } from 'react';
import { LS, db } from '../../lib/constants.js';

 
const ClientsTab=({products,session})=>{
  const [clients,setClients]=useState(()=>LS.get('aryes-clients',[]));
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({name:'',type:'panaderia',contact:'',phone:'',email:'',address:'',notes:'',products:[]});
  const [detail,setDetail]=useState(null);
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';

  const clientTypes={panaderia:'🥖 Panadería',heladeria:'🍦 Heladería',horeca:'🏨 HORECA',otro:'📦 Otro'};

  const save=()=>{
    if(!form.name){setMsg('El nombre es obligatorio');return;}
    const client={...form,id:editing&&editing!=='new'?editing:'cli-'+Date.now()};
    const updated=editing&&editing!=='new'?clients.map(c=>c.id===editing?client:c):[...clients,client];
    LS.set('aryes-clients',updated);setClients(updated);
    db.upsert('clients',[{id:client.id,name:client.name,type:client.type,contact:client.contact,phone:client.phone,email:client.email,address:client.address,notes:client.notes,products:client.products}]).catch(e=>console.warn(e));
    setEditing(null);setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  const del=async(id)=>{
    const ok = await confirm({ title:'¿Eliminar cliente?', description:'Esta acción no se puede deshacer.', variant:'danger' });
    if(!ok) return;
    const updated=clients.filter(c=>c.id!==id);
    LS.set('aryes-clients',updated);setClients(updated);
    if(detail?.id===id) setDetail(null);
  };

  const startEdit=(c)=>{setForm({...c,products:c.products||[]});setEditing(c.id);setDetail(null);};
  const startNew=()=>{setForm({name:'',type:'panaderia',contact:'',phone:'',email:'',address:'',notes:'',products:[]});setEditing('new');setDetail(null);};

  const toggleProduct=(prodId)=>{
    const current=form.products||[];
    const updated=current.includes(prodId)?current.filter(x=>x!==prodId):[...current,prodId];
    setForm(f=>({...f,products:updated}));
  };

  if(detail) return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <button onClick={()=>setDetail(null)} style={{background:'none',border:'none',fontSize:13,color:'#3a7d1e',cursor:'pointer',fontFamily:'inherit',marginBottom:20,display:'flex',alignItems:'center',gap:6}}>← Volver a clientes</button>
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:28,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:'#9a9a98',marginBottom:4}}>{clientTypes[detail.type]||detail.type}</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:500,margin:0}}>{detail.name}</h2>
          </div>
          {canEdit&&<div style={{display:'flex',gap:8}}>
            <button onClick={()=>startEdit(detail)} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
            <button onClick={()=>del(detail.id)} style={{padding:'7px 14px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Eliminar</button>
          </div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13}}>
          {detail.contact&&<div><span style={{color:'#9a9a98'}}>Contacto: </span><strong>{detail.contact}</strong></div>}
          {detail.phone&&<div><span style={{color:'#9a9a98'}}>Tel: </span><strong>{detail.phone}</strong></div>}
          {detail.email&&<div><span style={{color:'#9a9a98'}}>Email: </span><strong>{detail.email}</strong></div>}
          {detail.address&&<div><span style={{color:'#9a9a98'}}>Dirección: </span><strong>{detail.address}</strong></div>}
        </div>
        {detail.notes&&<div style={{marginTop:12,padding:'10px 14px',background:'#f9f9f7',borderRadius:8,fontSize:13,color:'#6a6a68'}}>{detail.notes}</div>}
      </div>
      {detail.products?.length>0&&<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:14}}>Productos que compra ({detail.products.length})</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {detail.products.map(pid=>{
            const p=products.find(x=>x.id===pid);
            if(!p) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f7"}}><div style={{textAlign:"center",fontFamily:"sans-serif"}}><div style={{fontSize:40,marginBottom:12}}>🌿</div><p style={{color:"#666",fontSize:14}}>Cargando...</p></div></div>);
            return <div key={pid} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'#f9f9f7',borderRadius:8,fontSize:13}}>
              <span style={{color:'#3a3a38',fontWeight:500}}>{p.name}</span>
              <span style={{color:'#9a9a98'}}>{p.brand} · {p.unit}</span>
            </div>;
          })}
        </div>
      </div>}
    </div>
  );

  return(
    <div style={{padding:'32px 40px',maxWidth:900}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Cartera comercial</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Clientes</h1>
        </div>
        {canEdit&&<button onClick={startNew} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Nuevo cliente</button>}
      </div>

      {/* Summary cards */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {Object.entries(clientTypes).map(([type,label])=>{
          const count=clients.filter(c=>c.type===type).length;
          return <div key={type} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'12px 18px',minWidth:120,flex:1}}>
            <div style={{fontSize:18,marginBottom:4}}>{label.split(' ')[0]}</div>
            <div style={{fontSize:20,fontWeight:700,color:'#1a1a18'}}>{count}</div>
            <div style={{fontSize:11,color:'#9a9a98'}}>{label.split(' ').slice(1).join(' ')}</div>
          </div>;
        })}
        <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 18px',minWidth:120,flex:1}}>
          <div style={{fontSize:18,marginBottom:4}}>👥</div>
          <div style={{fontSize:20,fontWeight:700,color:'#3a7d1e'}}>{clients.length}</div>
          <div style={{fontSize:11,color:'#9a9a98'}}>Total clientes</div>
        </div>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {/* Edit form */}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo cliente':'Editar cliente'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Nombre *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre del cliente"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Tipo</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                {Object.entries(clientTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Contacto</label>
              <input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} placeholder="Nombre del contacto"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Teléfono / WhatsApp</label>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+598 99 xxx xxx"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Email</label>
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@cliente.com"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Dirección</label>
              <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Dirección"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Notas</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones, frecuencia de pedido, etc."
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:8,textTransform:'uppercase'}}>Productos que compra</label>
              <div style={{maxHeight:200,overflowY:'auto',border:'1px solid #e2e2de',borderRadius:8,padding:8}}>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=>(
                  <label key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',cursor:'pointer',borderRadius:6,fontSize:13,':hover':{background:'#f0f0ec'}}}>
                    <input type="checkbox" checked={(form.products||[]).includes(p.id)}
                      onChange={()=>toggleProduct(p.id)} style={{accentColor:'#3a7d1e'}}/>
                    <span style={{color:'#3a3a38'}}>{p.name}</span>
                    <span style={{color:'#9a9a98',fontSize:11}}>{p.brand}</span>
                  </label>
                ))}
              </div>
              <div style={{fontSize:11,color:'#9a9a98',marginTop:6}}>{(form.products||[]).length} productos seleccionados</div>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Client list */}
      {clients.length===0&&!editing
        ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>👥</div><div>No hay clientes cargados todavía</div>{canEdit&&<div style={{fontSize:13,marginTop:6}}>Agregá tu primer cliente con el botón de arriba</div>}</div>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {clients.map(c=>(
            <div key={c.id} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:20,cursor:'pointer',transition:'box-shadow .15s'}}
              onClick={()=>setDetail(c)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:'#9a9a98',marginBottom:3}}>{clientTypes[c.type]||c.type}</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>{c.name}</div>
                </div>
                {canEdit&&<button onClick={e=>{e.stopPropagation();startEdit(c);}} style={{padding:'4px 10px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>}
              </div>
              {c.contact&&<div style={{fontSize:12,color:'#6a6a68',marginBottom:2}}>👤 {c.contact}</div>}
              {c.phone&&<div style={{fontSize:12,color:'#6a6a68',marginBottom:2}}>📞 {c.phone}</div>}
              {c.products?.length>0&&<div style={{fontSize:11,color:'#3a7d1e',marginTop:8,fontWeight:600}}>{c.products.length} productos asignados</div>}
              {c.notes&&<div style={{fontSize:11,color:'#9a9a98',marginTop:6,borderTop:'1px solid #f0f0ec',paddingTop:6}}>{c.notes.substring(0,80)}{c.notes.length>80?'...':''}</div>}
            </div>
          ))}
        </div>
      }
    </div>
  );
};



// ── Movements Tab ────────────────────────────────────────────────────────

export { ClientsTab };
