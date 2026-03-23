import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { LS, SKEY, SB_URL } from '../lib/constants.js';
import { T, Cap, Btn } from '../lib/ui.jsx';

function ImporterTab({onDone}){
  const { confirm, ConfirmDialog } = useConfirm();
  const [step,setStep]=useState("select");
  const [sel,setSel]=useState(()=>Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));
  const [fb,setFb]=useState("all");
  const [fs,setFs]=useState("all");
  const [search,setSearch]=useState("");
  const [progress,setProgress]=useState(0);
  const [result,setResult]=useState(null);
  const existingCount=LS.get("aryes6-products",[]).length;

  const brands=["all",...Object.keys(IMP_BRAND_COLORS)];
  const suppliers=["all","arg","ecu","eur"];

  const filtered=LOVABLE_CATALOG.filter(p=>{
    const mb=fb==="all"||p.brand===fb;
    const ms=fs==="all"||p.supplierId===fs;
    const mq=!search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mb&&ms&&mq;
  });

  const toggleSel=(id)=>setSel(prev=>({...prev,[id]:!prev[id]}));
  const selAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=true;});setSel(s);};
  const deselAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=false;});setSel(s);};
  const selAllCatalog=()=>setSel(Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));

  const selCount=Object.values(sel).filter(Boolean).length;
  const selProducts=LOVABLE_CATALOG.filter(p=>sel[p.id]);

  const doImport=async()=>{
    setStep("importing");
    const out=[];
    for(let i=0;i<selProducts.length;i++){
      setProgress(Math.round(((i+1)/selProducts.length)*100));
      await new Promise(r=>setTimeout(r,6));
      const p=selProducts[i];
      if(!p.name) continue; // FIX 8: skip items without name
      if(typeof p.stock==='number'&&p.stock<0) { p.stock=0; } // guard negative stock
      out.push({id:crypto.randomUUID(),name:p.name,description:p.description,unitCost:p.unitCost,unit:p.unit,stock:Math.max(0,p.stock||0),minStock:p.minStock||Math.max(5,Math.floor(p.stock/4)),supplierId:p.supplierId,brand:p.brand,category:p.category,dailyUsage:p.dailyUsage||0.5,createdAt:new Date().toISOString(),source:"lovable"});
    }
    // Snapshot for undo
    LS.set("aryes-last-import-snapshot", LS.get("aryes6-products",[]));
    LS.set("aryes6-products",out);
    setResult({total:out.length});
    setStep("done");
  };

  const pill=(active)=>({background:active?T.green:"#f0ece4",color:active?"#fff":T.textSm,border:"none",borderRadius:20,padding:"5px 13px",fontSize:12,cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap"});
  const byBrand=selProducts.reduce((a,p)=>{(a[p.brand]=a[p.brand]||[]).push(p);return a;},{});
  const bySup=selProducts.reduce((a,p)=>{a[p.supplierId]=(a[p.supplierId]||0)+1;return a;},{});

  if(step==="done")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:48,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:52,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.green,marginBottom:8}}>Inventario cargado</h2>
        <p style={{color:T.textSm,marginBottom:32}}>Los productos demo fueron eliminados y reemplazados por el catálogo real</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:32}}>
          {[{n:result.total,l:"productos cargados",c:T.green},{n:11,l:"marcas",c:"#e67e22"},{n:3,l:"proveedores",c:"#8e44ad"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,borderRadius:10,padding:"16px 24px",textAlign:"center",minWidth:120}}>
              <div style={{fontSize:32,fontWeight:700,color:s.c}}>{s.n}</div>
              <div style={{color:T.textSm,fontSize:13}}>{s.l}</div>
            </div>
          ))}
        </div>
        <Btn onClick={onDone}>Ir al inventario →</Btn>
      </div>
    </div>
  );

  if(step==="importing")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:64,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:44,marginBottom:20}}>⏳</div>
        <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginBottom:6}}>Cargando inventario...</h2>
        <p style={{color:T.textSm,marginBottom:28,fontSize:14}}>{progress}% — {Math.round(selProducts.length*progress/100)} de {selProducts.length} productos</p>
        <div style={{background:T.muted,borderRadius:20,height:8,maxWidth:360,margin:"0 auto"}}>
          <div style={{background:T.green,borderRadius:20,height:8,width:`${progress}%`,transition:"width .15s"}}/>
        </div>
      </div>
    </div>
  );

  if(step==="preview")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
        <div style={{display:"flex",gap:10}}><Btn secondary onClick={()=>setStep("select")}>← Volver</Btn><Btn onClick={doImport}>✓ Cargar {selProducts.length} productos</Btn></div>
      </div>
      <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"16px 20px"}}>
        <div style={{fontWeight:600,color:"#b45309",marginBottom:6}}>⚠ Se borrarán los productos demo</div>
        <div style={{fontSize:13,color:"#78350f"}}>El sistema tiene <strong>{existingCount}</strong> producto{existingCount!==1?"s":""} actualmente. Al confirmar, <strong>se eliminarán todos</strong> y se cargarán los {selProducts.length} productos seleccionados.</div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
          <div style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
            <div style={{fontSize:28,fontWeight:700,color:T.green}}>{selProducts.length}</div>
            <div style={{fontSize:12,color:T.textSm}}>a cargar</div>
          </div>
          {Object.entries(bySup).map(([s,c])=>(
            <div key={s} style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
              <div style={{fontSize:22,fontWeight:700,color:IMP_SUP_COLOR[s]}}>{c}</div>
              <div style={{fontSize:12,color:T.textSm}}>{IMP_SUP_LABEL[s]}</div>
            </div>
          ))}
        </div>
        <Cap style={{marginBottom:10}}>Desglose por marca</Cap>
        <div style={{maxHeight:320,overflow:"auto"}}>
          {Object.entries(byBrand).sort((a,b)=>b[1].length-a[1].length).map(([brand,prods])=>(
            <div key={brand} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:IMP_BRAND_COLORS[brand]||"#ccc",flexShrink:0}}/>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{brand}</span>
              <span style={{background:(IMP_BRAND_COLORS[brand]||"#888")+"18",color:IMP_BRAND_COLORS[brand]||"#888",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>{prods.length} productos</span>
              <span style={{fontSize:12,color:IMP_SUP_COLOR[prods[0].supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prods[0].supplierId]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const visByBrand={};
  filtered.forEach(p=>{visByBrand[p.brand]=(visByBrand[p.brand]||0)+1;});

  return(
    <>{ConfirmDialog}<div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar catálogo</h1></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {existingCount>0&&<span style={{fontSize:12,background:"#fff8e1",color:"#b45309",borderRadius:6,padding:"4px 10px"}}>⚠ {existingCount} productos actuales serán reemplazados</span>}
          <span style={{color:T.textSm,fontSize:13,fontWeight:600}}>{selCount} seleccionados</span>
          <Btn disabled={selCount===0} onClick={()=>setStep("preview")} style={{opacity:selCount===0?.4:1}}>Continuar →</Btn>
        </div>
      </div>
      <div style={{background:"#f0f7ed",borderRadius:10,padding:"14px 18px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",border:"1px solid #c8e0b8"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.green}}>Selección rápida:</span>
        <Btn onClick={selAllCatalog}>★ Todos los 249 productos</Btn>
        <Btn secondary onClick={selAll}>✓ Visibles ({filtered.length})</Btn>
        <Btn secondary onClick={deselAll}>✕ Deseleccionar visibles</Btn>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <input placeholder="🔍 Buscar por nombre, marca o categoría..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 14px",fontSize:13,background:T.cardWarm,width:"100%",marginBottom:12}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Marca:</span>
          {brands.map(b=>(
            <button key={b} onClick={()=>setFb(b)} style={pill(fb===b)}>
              {b==="all"?"Todas":b}{b!=="all"&&visByBrand[b]?` (${visByBrand[b]})`:""}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Proveedor:</span>
          {suppliers.map(s=>(
            <button key={s} onClick={()=>setFs(s)} style={pill(fs===s)}>
              {s==="all"?"Todos":IMP_SUP_LABEL[s]}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm}}>{filtered.length} productos · {selCount} seleccionados</span>
        </div>
        <div style={{maxHeight:480,overflow:"auto",display:"grid",gap:4}}>
          {filtered.map(prod=>{
            const isSel=!!sel[prod.id];
            return(
              <div key={prod.id} onClick={()=>toggleSel(prod.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",borderRadius:8,background:isSel?"#f0f7ed":T.cardWarm,border:`1px solid ${isSel?T.green+"40":"transparent"}`,cursor:"pointer",transition:"all .12s"}}>
                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{width:15,height:15,accentColor:T.green,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13,color:T.text}}>{prod.name}</span>
                    <span style={{background:(IMP_BRAND_COLORS[prod.brand]||"#888")+"18",color:IMP_BRAND_COLORS[prod.brand]||"#888",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{prod.brand}</span>
                    <span style={{fontSize:11,color:T.textXs}}>{prod.category}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{prod.unitCost>0?`$${prod.unitCost.toFixed(0)} / ${prod.unit}`:"—"}</div>
              {p.salePrice>0&&<span style={{fontSize:11,color:'#16a34a',marginLeft:8}}>Venta: $${p.salePrice.toFixed(2)} · <strong>${p.unitCost>0?Math.round((p.salePrice-p.unitCost)/p.salePrice*100):0}% margen</strong></span>}
                  <div style={{fontSize:11,color:IMP_SUP_COLOR[prod.supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prod.supplierId]}</div>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:T.textXs}}>Sin resultados</div>}
        </div>
      </div>
    </div></>
  );
}


const LoginScreen=({onLogin})=>{
  const G="#3a7d1e";
  const [em,setEm]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(!em||!pw){setErr("Ingresa email y contrasena");return;}
    setErr("");setBusy(true);
    try{
      const r=await fetch(SB_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SB_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:em,password:pw})});
      const d=await r.json();
      if(!r.ok||!d.access_token){setErr(d.msg||d.error_description||"Credenciales incorrectas");setBusy(false);return;}
      const m=d.user.user_metadata||{};
      onLogin({id:d.user.id,email:d.user.email,role:m.role||"vendedor",username:m.username||em.split("@")[0],nombre:m.nombre||"Usuario",access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in||3600});
    }catch(e){setErr("Error de conexion");}
    setBusy(false);
  };
  const inp={width:"100%",padding:"11px 14px",border:"2px solid #e5e7eb",borderRadius:8,fontSize:14,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  return(<div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f4f8,#e8f0e8)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",padding:16}}>
    <div style={{background:"#fff",borderRadius:20,padding:"44px 40px 40px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.12)"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <img src="/aryes-logo.png" alt="Aryes" style={{height:52,marginBottom:14,objectFit:"contain"}} onError={e=>e.target.style.display="none"} />
        <h1 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#111",margin:"0 0 6px",fontWeight:700}}>Importar catálogo</h1>
        <p style={{fontSize:13,color:"#888",margin:0}}>Sistema de gestion de inventario</p>
      </div>
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",marginBottom:18,color:"#dc2626",fontSize:13}}>{err}</div>}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,fontWeight:700,color:"#555",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Email</label>
        <input type="email" value={em} onChange={e=>setEm(e.target.value)} placeholder="usuario@empresa.com" autoComplete="email" style={inp} onKeyDown={e=>e.key==="Enter"&&document.getElementById("_pw").focus()} />
      </div>
      <div style={{marginBottom:24}}>
        <label style={{fontSize:11,fontWeight:700,color:"#555",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Contrasena</label>
        <input id="_pw" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()} />
      </div>
      <button onClick={submit} disabled={busy} style={{width:"100%",padding:"13px",background:busy?"#9ca3af":G,color:"#fff",border:"none",borderRadius:10,cursor:busy?"not-allowed":"pointer",fontWeight:700,fontSize:15}}>
        {busy?"Verificando...":"Ingresar"}
      </button>
    </div>
  </div>);
};

const UsersTab=({session})=>{
  const [users,setUsers]=useState(()=>LS.get('aryes-users',USERS));
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({username:'',password:'',name:'',role:'operador'});
  const [msg,setMsg]=useState('');

  const save=()=>{
    if(!form.username||!form.password||!form.name){setMsg('Completá todos los campos');return;}
    let updated;
    if(editing==='new'){
      if(users.find(u=>u.username===form.username)){setMsg('Ese usuario ya existe');return;}
      updated=[...users,{...form}];
    } else {
      updated=users.map(u=>u.username===editing?{...form}:u);
    }
    LS.set('aryes-users',updated); setUsers(updated); setEditing(null); setMsg('Guardado ✓');
    setTimeout(()=>setMsg(''),2000);
  };

  const del=async(username)=>{
    if(username===session.username){setMsg('No podés eliminarte a vos mismo');return;}
    const ok = await confirm({ title:`¿Eliminar usuario "${username}"?`, description:'Esta acción no se puede deshacer.', variant:'danger' });
    if(!ok) return;
    const updated=users.filter(u=>u.username!==username);
    LS.set('aryes-users',updated); setUsers(updated);
  };

  const startEdit=(u)=>{ setForm({...u}); setEditing(u.username); setMsg(''); };
  const startNew=()=>{ setForm({username:'',password:'',name:'',role:'operador'}); setEditing('new'); setMsg(''); };

  const roleLabel=r=>r==='admin'?'Administrador':r==='operador'?'Operador':'Vendedor (solo lectura)';
  const roleColor=r=>r==='admin'?'#3a7d1e':r==='operador'?'#2563eb':'#9a9a98';

  return(
    <div style={{padding:'32px 40px',maxWidth:700}}>
      <div style={{marginBottom:28,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Configuración</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Usuarios</h1>
        </div>
        <button onClick={startNew} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Agregar usuario</button>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {/* User list */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:editing?24:0}}>
        {users.map(u=>(
          <div key={u.username} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
                {u.role==='admin'?'👑':u.role==='operador'?'🔧':'👁'}
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'#1a1a18'}}>{u.name}</div>
                <div style={{fontSize:12,color:'#9a9a98',marginTop:2}}>@{u.username} · <span style={{color:roleColor(u.role),fontWeight:500}}>{roleLabel(u.role)}</span></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>startEdit(u)} style={{padding:'6px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
              {u.username!==session.username&&<button onClick={()=>del(u.username)} style={{padding:'6px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Eliminar</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/New form */}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginTop:16}}>
          <h3 style={{fontSize:16,fontWeight:600,margin:'0 0 18px',color:'#1a1a18'}}>{editing==='new'?'Nuevo usuario':'Editar usuario'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre completo</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre de usuario</label>
              <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} disabled={editing!=='new'}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:editing!=='new'?'#f5f5f3':'#fff'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Contraseña</label>
              <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Rol</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:'#fff'}}>
                <option value="admin">Administrador (acceso total)</option>
                <option value="operador">Operador (stock y pedidos)</option>
                <option value="vendedor">Vendedor (solo lectura)</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{marginTop:24,padding:'14px 16px',background:'#f0f7ec',borderRadius:10,fontSize:12,color:'#5a7a4a'}}>
        <strong>Roles:</strong> Administrador puede hacer todo incluyendo gestionar usuarios · Operador puede actualizar stock y pedidos · Vendedor solo puede consultar
      </div>
    </div>
  );
};


// ── Lotes Tab ────────────────────────────────────────────────────────────
const LotsTab=({products,session})=>{
  const [lots,setLots]=useState(()=>LS.get('aryes-lots',[]));
  const [filter,setFilter]=useState('all');
  const [editing,setEditing]=useState(null);
  const [selProd,setSelProd]=useState('');
  const [form,setForm]=useState({lotNumber:'',quantity:'',expiryDate:'',notes:''});
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';
  const today=new Date(); today.setHours(0,0,0,0);
  const daysTo=d=>Math.floor((new Date(d)-today)/86400000);
  const st=l=>!l.expiryDate?'ok':daysTo(l.expiryDate)<0?'expired':daysTo(l.expiryDate)<=30?'expiring':'ok';
  const stColor=s=>s==='expired'?'#dc2626':s==='expiring'?'#d97706':'#16a34a';
  const stBg=s=>s==='expired'?'#fef2f2':s==='expiring'?'#fffbeb':'#f0fdf4';
  const stLabel=s=>s==='expired'?'VENCIDO':s==='expiring'?'POR VENCER':'OK';
  const expired=lots.filter(l=>st(l)==='expired').length;
  const expiring=lots.filter(l=>st(l)==='expiring').length;
  const filtered=lots.filter(l=>filter==='all'?true:filter==='expiring'?st(l)!=='ok':st(l)==='expired');

  const save=()=>{
    if(!selProd||!form.lotNumber||!form.quantity){setMsg('Completá producto, lote y cantidad');return;}
    const prod=products.find(p=>String(p.id)===String(selProd));
    const lot={id:editing&&editing!=='new'?editing:'lot-'+Date.now(),productId:Number(selProd),productName:prod?.name||'',lotNumber:form.lotNumber,quantity:Number(form.quantity),expiryDate:form.expiryDate||null,entryDate:new Date().toISOString().split('T')[0],notes:form.notes};
    const updated=editing&&editing!=='new'?lots.map(l=>l.id===editing?lot:l):[...lots,lot];
    LS.set('aryes-lots',updated);setLots(updated);setEditing(null);setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');
    setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:860}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Control de calidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Lotes y Vencimientos</h1>
        </div>
        {canEdit&&<button onClick={()=>{setEditing('new');setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');}} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Registrar lote</button>}
      </div>
      {(expired>0||expiring>0)&&<div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {expired>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>🚨</span><div><div style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{expired} lote{expired>1?'s':''} vencido{expired>1?'s':''}</div><div style={{fontSize:11,color:'#9a9a98'}}>Revisar y dar de baja</div></div></div>}
        {expiring>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>⚠</span><div><div style={{fontSize:13,fontWeight:700,color:'#d97706'}}>{expiring} lote{expiring>1?'s':''} por vencer</div><div style={{fontSize:11,color:'#9a9a98'}}>Priorizar salida (FEFO)</div></div></div>}
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['all','Todos',lots.length],['expiring','Por vencer',expired+expiring],['expired','Vencidos',expired]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:'7px 14px',background:filter===v?'#1a1a18':'#f0f0ec',color:filter===v?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{l}{c>0&&' ('+c+')'}</button>
        ))}
      </div>
      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo lote':'Editar lote'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar...</option>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name}</option>)}
              </select>
            </div>
            {[['Nº de lote','lotNumber','text','Ej: LOT-2024-001'],['Cantidad','quantity','number','0'],['Fecha vencimiento','expiryDate','date',''],['Notas','notes','text','Opcional']].map(([label,key,type,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>{label}</label>
                <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}
      {filtered.length===0?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📦</div><div>{lots.length===0?'No hay lotes registrados':'Sin resultados en este filtro'}</div></div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.sort((a,b)=>(!a.expiryDate?1:!b.expiryDate?-1:new Date(a.expiryDate)-new Date(b.expiryDate))).map(l=>{
            const s=st(l),d=l.expiryDate?daysTo(l.expiryDate):null;
            return <div key={l.id} style={{background:'#fff',border:'1px solid '+stColor(s)+'40',borderLeft:'4px solid '+stColor(s),borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{l.productName}</span>
                  <span style={{fontSize:11,background:stBg(s),color:stColor(s),padding:'2px 8px',borderRadius:10,fontWeight:600}}>{stLabel(s)}</span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'#6a6a68',flexWrap:'wrap'}}>
                  <span>Lote: <strong>{l.lotNumber}</strong></span>
                  <span>Cant: <strong>{l.quantity}</strong></span>
                  {l.expiryDate&&<span style={{color:stColor(s)}}>Vence: <strong>{l.expiryDate} ({d<0?Math.abs(d)+' días vencido':d+' días'})</strong></span>}
                  {l.notes&&<span>{l.notes}</span>}
                </div>
              </div>
              {canEdit&&<div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setSelProd(String(l.productId));setForm({lotNumber:l.lotNumber,quantity:String(l.quantity),expiryDate:l.expiryDate||'',notes:l.notes||''});setEditing(l.id);}} style={{padding:'5px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
                <button onClick={async()=>{ const ok=await confirm({title:'¿Eliminar este lote?',variant:'danger'}); if(!ok)return; const u=lots.filter(x=>x.id!==l.id);LS.set('aryes-lots',u);setLots(u);}} style={{padding:'5px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
              </div>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

// ── Excel Importer Tab ───────────────────────────────────────────────────
const ExcelImportTab=({products,setProducts,session})=>{
  const [step,setStep]=useState('upload'); // upload | preview | done
  const [rows,setRows]=useState([]);
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);

  const parseCSV=(text)=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
    return lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/['"]/g,''));
      const obj={};
      headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return obj;
    }).filter(r=>r.nombre||r.name||r.producto);
  };

  const mapRow=(r)=>({
    name: r.nombre||r.name||r.producto||'',
    brand: r.marca||r.brand||'',
    category: r.categoria||r.category||'',
    supplierId: (r.proveedor||r.supplier||'arg').toLowerCase().includes('ecu')?'ecu':(r.proveedor||r.supplier||'').toLowerCase().includes('eur')?'eur':'arg',
    unit: r.unidad||r.unit||'kg',
    stock: Number(r.stock||r.cantidad||0)||0,
    unitCost: Number((r.costo||r.precio_costo||r.price||r['precio costo']||'0').replace(/[^\d.]/g,''))||0,
    barcode: r.barcode||r.codigo||r['código']||'',
    minStock: Number(r.min_stock||r.stock_minimo||5)||5,
    dailyUsage: Number(r.uso_diario||r.daily_usage||0.5)||0.5,
  });

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);
    const text=await file.text();
    const parsed=parseCSV(text).map(mapRow).filter(r=>r.name);
    setRows(parsed);
    setStep(parsed.length>0?'preview':'upload');
    if(parsed.length===0) setMsg('No se encontraron productos. Verificá que el archivo sea CSV con columnas: nombre, marca, categoria, stock, costo');
    setLoading(false);
  };

  const applyImport=()=>{
    const maxId=products.reduce((m,p)=>Math.max(m,p.id),0);
    const newProds=rows.map((r,i)=>({...r,id:maxId+i+1,history:[]}));
    const updated=[...products,...newProds];
    LS.set('aryes6-products',updated);
    setProducts(updated);
    // Sync to Supabase
    const dbRows=newProds.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplier_id:p.supplierId,unit:p.unit,stock:p.stock,unit_cost:p.unitCost,min_stock:p.minStock,daily_usage:p.dailyUsage,category:p.category,brand:p.brand,history:[]}));
    db.upsert('products',dbRows).catch(e=>console.warn('sync:',e));
    setStep('done');
    setMsg(newProds.length+' productos importados correctamente ✓');
  };

  const downloadTemplate=()=>{
    const csv='nombre,marca,categoria,proveedor,unidad,stock,costo,barcode\nChocolate Cobertura Leche 1kg,Selecta,Chocolates,arg,kg,0,336.07,\nPasta Pistacho 1.5kg,MEC3,Gelato,eur,kg,0,1250,';
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='template_productos.csv';a.click();
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Carga masiva</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Importar Excel / CSV</h1>
      </div>

      {step==='upload'&&(
        <div>
          <div style={{background:'#fff',border:'2px dashed #e2e2de',borderRadius:12,padding:40,textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:12}}>📂</div>
            <div style={{fontSize:15,fontWeight:600,color:'#3a3a38',marginBottom:8}}>Subí tu archivo CSV</div>
            <div style={{fontSize:13,color:'#9a9a98',marginBottom:20}}>Exportá desde Excel como CSV y subilo acá</div>
            <label style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',display:'inline-block'}}>
              Elegir archivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:'none'}}/>
            </label>
            {loading&&<div style={{marginTop:16,color:'#9a9a98',fontSize:13}}>Procesando...</div>}
          </div>
          <div style={{background:'#f0f7ec',borderRadius:10,padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>Columnas aceptadas en el CSV:</div>
            <div style={{fontSize:12,color:'#5a7a4a',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
              <span><strong>nombre</strong> — nombre del producto</span>
              <span><strong>marca</strong> — ej: Selecta, MEC3</span>
              <span><strong>categoria</strong> — ej: Chocolates</span>
              <span><strong>proveedor</strong> — arg / ecu / eur</span>
              <span><strong>unidad</strong> — kg / lt / u</span>
              <span><strong>stock</strong> — cantidad actual</span>
              <span><strong>costo</strong> — precio de costo</span>
              <span><strong>barcode</strong> — código de barras</span>
            </div>
          </div>
          <button onClick={downloadTemplate} style={{padding:'8px 16px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>⬇ Descargar template de ejemplo</button>
          {msg&&<div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',color:'#dc2626',borderRadius:8,fontSize:13}}>{msg}</div>}
        </div>
      )}

      {step==='preview'&&(
        <div>
          <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,color:'#3a7d1e',fontWeight:600}}>✓ {rows.length} productos detectados</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('upload')} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
              <button onClick={applyImport} style={{padding:'7px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Importar {rows.length} productos</button>
            </div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9f9f7'}}>
                {['Nombre','Marca','Categoría','Proveedor','Unidad','Stock','Costo'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6a6a68',fontSize:11,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0,20).map((r,i)=><tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 14px',color:'#1a1a18',fontWeight:500}}>{r.name}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.brand||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.category||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.supplierId}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unit}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.stock}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unitCost}</td>
                </tr>)}
                {rows.length>20&&<tr><td colSpan={7} style={{padding:'9px 14px',color:'#9a9a98',fontSize:12,textAlign:'center'}}>... y {rows.length-20} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step==='done'&&(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:56,marginBottom:16}}>✅</div>
          <div style={{fontSize:22,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>{msg}</div>
          <div style={{fontSize:14,color:'#9a9a98',marginBottom:32}}>Los productos ya están disponibles en el inventario</div>
          <button onClick={()=>{setStep('upload');setRows([]);setMsg('');}} style={{padding:'10px 24px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Importar otro archivo</button>
        </div>
      )}
    </div>
  );
};


// ── Generar PDF de Orden de Compra ───────────────────────────────────────
const generateOrderPDF = (order, suppliers, products) => {
  const sup = suppliers.find(s => s.id === order.supplierId) || {};
  const today = new Date().toLocaleDateString('es-UY');
  const orderNum = 'OC-' + Date.now().toString().slice(-6);

  const rows = (order.items || []).map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    const subtotal = (item.qty * (prod.unitCost || 0)).toFixed(2);
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:10px 12px">${prod.name || item.productName || ''}</td>
      <td style="padding:10px 12px;text-align:center">${item.qty} ${prod.unit || ''}</td>
      <td style="padding:10px 12px;text-align:right">$ ${(prod.unitCost || 0).toFixed(2)}</td>
      <td style="padding:10px 12px;text-align:right">$ ${subtotal}</td>
    </tr>`;
  }).join('');

  const total = (order.items || []).reduce((sum, item) => {
    const prod = products.find(p => p.id === item.productId) || {};
    return sum + item.qty * (prod.unitCost || 0);
  }, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orden de Compra ${orderNum}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a18; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #3a7d1e; padding-bottom: 24px; }
    .logo-area h1 { font-size: 28px; color: #3a7d1e; margin: 0 0 4px; font-weight: 700; }
    .logo-area p { color: #6a6a68; margin: 0; font-size: 13px; }
    .oc-info { text-align: right; }
    .oc-info .num { font-size: 22px; font-weight: 700; color: #1a1a18; }
    .oc-info .date { color: #6a6a68; font-size: 13px; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; color: #9a9a98; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    .sup-box { background: #f9f9f7; border: 1px solid #e2e2de; border-radius: 8px; padding: 16px 20px; }
    .sup-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .sup-detail { font-size: 13px; color: #6a6a68; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead { background: #f9f9f7; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6a6a68; text-transform: uppercase; letter-spacing: .07em; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(2) { text-align: right; }
    .total-row { background: #f0f7ec; }
    .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e2de; display: flex; justify-content: space-between; }
    .sign-box { text-align: center; }
    .sign-line { width: 180px; border-top: 1px solid #3a3a38; margin: 40px auto 8px; }
    .sign-label { font-size: 12px; color: #6a6a68; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-top: 16px; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>ARYES</h1>
      <p>Distribuidora de Insumos Gastronómicos</p>
      <p>Montevideo, Uruguay</p>
    </div>
    <div class="oc-info">
      <div class="num">Orden de Compra</div>
      <div class="num" style="color:#3a7d1e">${orderNum}</div>
      <div class="date">Fecha: ${today}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Proveedor</div>
    <div class="sup-box">
      <div class="sup-name">${sup.name || order.supplierId || ''}</div>
      ${sup.company ? `<div class="sup-detail">${sup.company}</div>` : ''}
      ${sup.contact ? `<div class="sup-detail">Contacto: ${sup.contact}</div>` : ''}
      ${sup.email ? `<div class="sup-detail">Email: ${sup.email}</div>` : ''}
      ${sup.phone ? `<div class="sup-detail">Tel: ${sup.phone}</div>` : ''}
      <div class="sup-detail" style="margin-top:6px">
        Plazo de pago: ${sup.paymentTerms || '30'} días · Moneda: ${sup.currency || 'USD'}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle de productos</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center">Cantidad</th>
          <th style="text-align:right">Precio unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;padding:14px 12px;font-weight:700">TOTAL ESTIMADO</td>
          <td style="text-align:right;padding:14px 12px;font-weight:700;color:#3a7d1e">$ ${total.toFixed(2)} ${sup.currency || 'USD'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${order.notes ? `<div class="notes">📝 <strong>Notas:</strong> ${order.notes}</div>` : ''}

  <div class="footer">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Solicitado por</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Autorizado por</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#9a9a98;align-self:flex-end">
      <div>Importar catálogo</div>
      <div>Generado el ${today}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('',"_blank","noopener,noreferrer");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
};

// ── Dashboard Charts Components ─────────────────────────────────────────
const MiniBar=({value,max,color='#3a7d1e'})=>{
  const pct=max>0?Math.min(100,Math.round(value/max*100)):0;
  return <div style={{width:'100%',height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden'}}>
    <div style={{width:pct+'%',height:'100%',background:color,borderRadius:3,transition:'width .3s'}}/>
  </div>;
};

const DashboardExtra=({products,suppliers,orders})=>{
  // Valor total inventario
  const totalValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
  const totalSaleValue = products.reduce((s,p)=>s+(p.stock||0)*(p.salePrice||p.unitCost||0),0);
  const totalMargin = totalSaleValue - totalValue;

  // Top 10 productos por valor en stock
  const byValue = [...products]
    .filter(p=>p.stock>0&&p.unitCost>0)
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost))
    .slice(0,10);
  const maxVal = byValue[0]?(byValue[0].stock*byValue[0].unitCost):1;

  // Rotación por marca
  const byBrand = {};
  products.forEach(p=>{
    if(!p.brand) return;
    if(!byBrand[p.brand]) byBrand[p.brand]={brand:p.brand,count:0,value:0,lowStock:0};
    byBrand[p.brand].count++;
    byBrand[p.brand].value += (p.stock||0)*(p.unitCost||0);
    if((p.stock||0)<(p.minStock||5)) byBrand[p.brand].lowStock++;
  });
  const brands = Object.values(byBrand).sort((a,b)=>b.value-a.value);
  const maxBrandVal = brands[0]?.value||1;

  // Proyección quiebres próximos 30 días
  const today = new Date();
  const breakRisk = products.filter(p=>{
    const daily = p.dailyUsage||0.5;
    const daysLeft = daily>0?(p.stock||0)/daily:999;
    return daysLeft<30 && daysLeft>0;
  }).sort((a,b)=>{
    const da=(a.dailyUsage||.5)>0?(a.stock||0)/(a.dailyUsage||.5):999;
    const db=(b.dailyUsage||.5)>0?(b.stock||0)/(b.dailyUsage||.5):999;
    return da-db;
  }).slice(0,8);

  // Stock por proveedor
  const bySupplier = {};
  products.forEach(p=>{
    const s = p.supplierId||'arg';
    if(!bySupplier[s]) bySupplier[s]={id:s,count:0,value:0};
    bySupplier[s].count++;
    bySupplier[s].value += (p.stock||0)*(p.unitCost||0);
  });

  const supNames = {arg:'Argentina',ecu:'Ecuador',eur:'Europa',other:'Otros'};
  const supColors = {arg:'#2563eb',ecu:'#16a34a',eur:'#7c3aed',other:'#9a9a98'};

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginTop:24}}>

      {/* Valor de inventario */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,gridColumn:'1/-1'}}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          {[
            {label:'Valor en stock (costo)',value:'$ '+totalValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#3a3a38',bg:'#f9f9f7'},
            {label:'Valor en stock (venta)',value:'$ '+totalSaleValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#2563eb',bg:'#eff6ff'},
            {label:'Margen potencial',value:'$ '+totalMargin.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#16a34a',bg:'#f0fdf4'},
            {label:'Productos en stock',value:products.filter(p=>p.stock>0).length+' / '+products.length,color:'#3a3a38',bg:'#f9f9f7'},
          ].map(({label,value,color,bg})=>(
            <div key={label} style={{flex:1,minWidth:180,background:bg,borderRadius:10,padding:'16px 20px'}}>
              <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{label}</div>
              <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos por valor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Top 10 por valor en stock</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {byValue.map((p,i)=>{
            const val = p.stock*p.unitCost;
            return <div key={p.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:12,color:'#3a3a38',fontWeight:500,flex:1,marginRight:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}. {p.name}</span>
                <span style={{fontSize:12,color:'#6a6a68',flexShrink:0}}>$ {val.toFixed(0)}</span>
              </div>
              <MiniBar value={val} max={maxVal} color={i<3?'#3a7d1e':'#b8d9a8'}/>
            </div>;
          })}
        </div>
      </div>

      {/* Rotación por marca */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Inventario por marca</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {brands.map(b=>(
            <div key={b.brand}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600}}>{b.brand}</span>
                <div style={{display:'flex',gap:12,fontSize:11,color:'#6a6a68'}}>
                  <span>{b.count} prod.</span>
                  {b.lowStock>0&&<span style={{color:'#dc2626',fontWeight:600}}>⚠ {b.lowStock} bajo mín.</span>}
                  <span style={{fontWeight:600,color:'#3a3a38'}}>$ {b.value.toFixed(0)}</span>
                </div>
              </div>
              <MiniBar value={b.value} max={maxBrandVal}/>
            </div>
          ))}
        </div>
      </div>

      {/* Proyección de quiebres */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Proyección quiebres — próx. 30 días</div>
        {breakRisk.length===0
          ?<div style={{textAlign:'center',padding:'24px 0',color:'#9a9a98',fontSize:13}}>✅ Sin riesgo de quiebre en 30 días</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {breakRisk.map(p=>{
              const daysLeft = (p.dailyUsage||.5)>0?(p.stock||0)/(p.dailyUsage||.5):999;
              const urgency = daysLeft<7?'#dc2626':daysLeft<15?'#d97706':'#2563eb';
              return <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#f9f9f7',borderRadius:8,borderLeft:'3px solid '+urgency}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#1a1a18'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'#9a9a98'}}>{p.brand} · stock: {p.stock} {p.unit}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:urgency}}>{Math.ceil(daysLeft)}d</div>
                  <div style={{fontSize:10,color:'#9a9a98'}}>restantes</div>
                </div>
              </div>;
            })}
          </div>
        }
      </div>

      {/* Stock por proveedor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Distribución por proveedor</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {Object.values(bySupplier).sort((a,b)=>b.value-a.value).map(s=>{
            const pct = totalValue>0?Math.round(s.value/totalValue*100):0;
            const sup = suppliers.find(x=>x.id===s.id)||{};
            return <div key={s.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:supColors[s.id]||'#9a9a98',display:'inline-block'}}/>
                  {sup.name||supNames[s.id]||s.id}
                </span>
                <div style={{fontSize:11,color:'#6a6a68',display:'flex',gap:12}}>
                  <span>{s.count} prod.</span>
                  <span style={{fontWeight:600}}>{pct}%</span>
                </div>
              </div>
              <MiniBar value={s.value} max={totalValue} color={supColors[s.id]||'#9a9a98'}/>
            </div>;
          })}
        </div>
      </div>

    </div>
  );
};



// ── Price History Tab ────────────────────────────────────────────────────
const PriceHistoryTab=({products,session})=>{
  const [priceHistory,setPriceHistory]=useState(()=>LS.get('aryes-price-history',[]));
  const [selProduct,setSelProduct]=useState('');
  const [search,setSearch]=useState('');

  const filtered = selProduct
    ? priceHistory.filter(h=>String(h.productId)===String(selProduct))
    : search
    ? priceHistory.filter(h=>h.productName.toLowerCase().includes(search.toLowerCase()))
    : priceHistory;

  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Group by product for summary view
  const byProduct = {};
  priceHistory.forEach(h=>{
    if(!byProduct[h.productId]) byProduct[h.productId]={name:h.productName,entries:[]};
    byProduct[h.productId].entries.push(h);
  });

  const productSummaries = Object.values(byProduct).map(p=>{
    const sorted = [...p.entries].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const latest = sorted[0];
    const prev = sorted[1];
    const change = prev ? ((latest.cost - prev.cost)/prev.cost*100).toFixed(1) : null;
    return {...p, latest, prev, change};
  }).sort((a,b)=>new Date(b.latest.date)-new Date(a.latest.date));

  return(
    <div style={{padding:'32px 40px',maxWidth:900}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Análisis de costos</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Historial de Precios</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Los cambios de costo se registran automáticamente cada vez que editás un producto.</p>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setSelProduct('');}} placeholder="Buscar producto..."
          style={{flex:1,minWidth:200,padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        <select value={selProduct} onChange={e=>{setSelProduct(e.target.value);setSearch('');}}
          style={{padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff',minWidth:220}}>
          <option value=''>Todos los productos</option>
          {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selProduct&&!search?(
        // Summary view
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Últimos cambios de precio</div>
          {productSummaries.length===0
            ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>Los cambios de precio aparecerán acá automáticamente</div></div>
            :<div style={{display:'flex',flexDirection:'column',gap:8}}>
              {productSummaries.slice(0,20).map((p,i)=>{
                const up = p.change!==null&&Number(p.change)>0;
                const down = p.change!==null&&Number(p.change)<0;
                return <div key={i} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a18',marginBottom:2}}>{p.name}</div>
                    <div style={{fontSize:11,color:'#9a9a98'}}>{p.latest.brand} · {new Date(p.latest.date).toLocaleDateString('es-UY')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>$ {p.latest.cost.toFixed(2)}</div>
                    {p.change!==null&&<div style={{fontSize:11,fontWeight:600,color:up?'#dc2626':down?'#16a34a':'#9a9a98'}}>
                      {up?'↑':'↓'} {Math.abs(p.change)}% {down?'(bajó)':'(subió)'}
                    </div>}
                  </div>
                </div>;
              })}
            </div>
          }
        </div>
      ):(
        // Detail view for specific product
        <div>
          {selProduct&&<div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#3a7d1e',fontWeight:600}}>
            {products.find(p=>String(p.id)===String(selProduct))?.name}
          </div>}
          {sorted.length===0
            ?<div style={{textAlign:'center',padding:'32px',color:'#9a9a98'}}>Sin registros</div>
            :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#f9f9f7'}}>
                  {['Fecha','Producto','Costo anterior','Costo nuevo','Variación','Registrado por'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sorted.map((h,i)=>{
                    const change = h.prevCost>0?((h.cost-h.prevCost)/h.prevCost*100).toFixed(1):null;
                    const up = change!==null&&Number(change)>0;
                    return <tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{new Date(h.date).toLocaleDateString('es-UY')}</td>
                      <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a18'}}>{h.productName}</td>
                      <td style={{padding:'10px 14px',color:'#9a9a98'}}>{h.prevCost>0?'$ '+h.prevCost.toFixed(2):'—'}</td>
                      <td style={{padding:'10px 14px',fontWeight:600,color:'#1a1a18'}}>$ {h.cost.toFixed(2)}</td>
                      <td style={{padding:'10px 14px'}}>
                        {change!==null?<span style={{color:up?'#dc2626':'#16a34a',fontWeight:600}}>{up?'↑ +':'↓ '}{change}%</span>:<span style={{color:'#9a9a98'}}>—</span>}
                      </td>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{h.user||'—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}
    </div>
  );
};



// ── Clients Tab ──────────────────────────────────────────────────────────
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
            const p=products.find(x=>x.id===pid||String(x.id)===String(pid));
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
                    <input type="checkbox" checked={(form.products||[]).includes(p.id)||(form.products||[]).includes(String(p.id))}
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
const MovementsTab=({products,setProducts,session})=>{
  const [movements,setMovements]=useState(()=>LS.get('aryes-movements',[]));
  const [form,setForm]=useState({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';

  const reasons={
    entrada:['compra','devolucion_cliente','ajuste_positivo','produccion'],
    salida:['venta','devolucion_proveedor','ajuste_negativo','merma','muestra']
  };
  const reasonLabel={
    compra:'Compra a proveedor',devolucion_cliente:'Devolución de cliente',
    ajuste_positivo:'Ajuste positivo',produccion:'Producción interna',
    venta:'Venta',devolucion_proveedor:'Devolución a proveedor',
    ajuste_negativo:'Ajuste negativo',merma:'Merma / vencimiento',muestra:'Muestra'
  };

  const filtered = movements
    .filter(m => filter==='all' ? true : m.type===filter)
    .filter(m => !search || m.productName.toLowerCase().includes(search.toLowerCase()) || (m.reference||'').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const save=async ()=>{
    if(!form.productId||!form.qty||Number(form.qty)<=0){setMsg('Completá producto y cantidad');return;}
    const prod=products.find(p=>p.id===Number(form.productId));
    if(!prod){setMsg('Producto no encontrado');return;}
    const qty=Number(form.qty);
    if(form.type==='salida'&&qty>(prod.stock||0)){setMsg('Stock insuficiente: disponible '+(prod.stock||0)+' '+(prod.unit||'')+' — solicitado '+qty);return;}
    const newStock=form.type==='entrada'?(prod.stock||0)+qty:(prod.stock||0)-qty;
    const mov={
      id:'mov-'+Date.now(),
      productId:prod.id,productName:prod.name,brand:prod.brand||'',
      type:form.type,qty,
      stockBefore:prod.stock||0,stockAfter:newStock,
      reason:form.reason,reference:form.reference,notes:form.notes,
      user:session.name||session.username||'',
      date:new Date().toISOString()
    };
    // Save movement
    const updatedMovs=[mov,...movements];
    LS.set('aryes-movements',updatedMovs);setMovements(updatedMovs);
    // Update product stock
    const updatedProds=products.map(p=>p.id===prod.id?{...p,stock:newStock}:p);
    const now=new Date().toISOString();
    await dbWriteWithRetry(()=>db.patch('products',{stock:newStock,updated_at:now},{id:prod.id}));
    setProducts(updatedProds);
    LS.set('aryes6-products',updatedProds);
    // Check low stock alert
    if(newStock<(prod.minStock||5)){
      const alreadySent=LS.get('aryes-alerts-sent',{});
      if(!alreadySent[prod.id]){
        sendLowStockAlert(prod,newStock);
        alreadySent[prod.id]=new Date().toISOString();
        LS.set('aryes-alerts-sent',alreadySent);
      }
    } else {
      // Reset alert flag when stock is restored
      const alreadySent=LS.get('aryes-alerts-sent',{});
      delete alreadySent[prod.id];
      LS.set('aryes-alerts-sent',alreadySent);
    }
    setForm({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
    setMsg((form.type==='entrada'?'✓ Entrada':'✓ Salida')+' registrada — stock actualizado');
    setTimeout(()=>setMsg(''),3000);
  };

  // Stats
  const today=new Date().toISOString().split('T')[0];
  const todayMovs=movements.filter(m=>m.date.startsWith(today));
  const entradas=movements.filter(m=>m.type==='entrada').reduce((s,m)=>s+m.qty,0);
  const salidas=movements.filter(m=>m.type==='salida').reduce((s,m)=>s+m.qty,0);

  return(
    <div style={{padding:'32px 40px',maxWidth:920}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Trazabilidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Movimientos de Stock</h1>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        {[
          {label:'Total movimientos',value:movements.length,color:'#3a3a38',bg:'#f9f9f7'},
          {label:'Entradas acumuladas',value:entradas,color:'#16a34a',bg:'#f0fdf4'},
          {label:'Salidas acumuladas',value:salidas,color:'#dc2626',bg:'#fef2f2'},
          {label:'Movimientos hoy',value:todayMovs.length,color:'#2563eb',bg:'#eff6ff'},
        ].map(({label,value,color,bg})=>(
          <div key={label} style={{flex:1,minWidth:140,background:bg,borderRadius:10,padding:'14px 18px'}}>
            <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>{label}</div>
            <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13,fontWeight:500}}>{msg}</div>}

      {/* Register movement form */}
      {canEdit&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a18',marginBottom:16}}>Registrar movimiento</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={form.productId} onChange={e=>setForm(f=>({...f,productId:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar producto...</option>
                {[...products].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>(
                  <option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name} (stock: {p.stock||0} {p.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Tipo</label>
              <div style={{display:'flex',gap:8}}>
                {['entrada','salida'].map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,type:t,reason:t==='entrada'?'compra':'venta'}))}
                    style={{flex:1,padding:'9px',border:'2px solid '+(form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#e2e2de'),borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                    background:form.type===t?(t==='entrada'?'#f0fdf4':'#fef2f2'):'#fff',
                    color:form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#6a6a68'}}>
                    {t==='entrada'?'↑ Entrada':'↓ Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Cantidad</label>
              <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} placeholder="0" min="0" step="0.01"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Motivo</label>
              <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                {(reasons[form.type]||[]).map(r=><option key={r} value={r}>{reasonLabel[r]}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Referencia (Factura / OC)</label>
              <input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="Ej: FC-001, OC-023"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Notas</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
          </div>
          {form.productId&&form.qty&&(
            <div style={{padding:'10px 14px',background:'#f9f9f7',borderRadius:8,fontSize:13,color:'#6a6a68',marginBottom:12}}>
              Stock actual: <strong>{products.find(p=>p.id===Number(form.productId))?.stock||0}</strong>
              {' → '}
              <strong style={{color:form.type==='entrada'?'#16a34a':'#dc2626'}}>
                {form.type==='entrada'
                  ?(products.find(p=>p.id===Number(form.productId))?.stock||0)+Number(form.qty||0)
                  :Math.max(0,(products.find(p=>p.id===Number(form.productId))?.stock||0)-Number(form.qty||0))
                }
              </strong>
              {' '}{products.find(p=>p.id===Number(form.productId))?.unit||''}
            </div>
          )}
          <button onClick={save} style={{padding:'10px 24px',background:form.type==='entrada'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {form.type==='entrada'?'↑ Registrar entrada':'↓ Registrar salida'}
          </button>
        </div>
      )}

      {/* Filters + list */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o referencia..."
          style={{flex:1,minWidth:200,padding:'8px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        {['all','entrada','salida'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'7px 14px',background:filter===f?'#1a1a18':'#f0f0ec',color:filter===f?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            {f==='all'?'Todos':f==='entrada'?'↑ Entradas':'↓ Salidas'}
          </button>
        ))}
        <button onClick={()=>{
          const csv=['Fecha,Producto,Marca,Tipo,Cantidad,Stock Antes,Stock Después,Motivo,Referencia,Usuario',
            ...filtered.map(m=>[new Date(m.date).toLocaleString('es-UY'),m.productName,m.brand,m.type,m.qty,m.stockBefore,m.stockAfter,m.reason,m.reference||'',m.user].join(','))
          ].join('\n');
          const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
          a.download='movimientos.csv';a.click();
        }} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          ⬇ Exportar CSV
        </button>
      </div>

      {filtered.length===0
        ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>No hay movimientos registrados todavía</div></div>
        :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9f9f7'}}>
              {['Fecha','Producto','Tipo','Cantidad','Stock','Motivo','Ref.','Usuario'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,50).map(m=>(
                <tr key={m.id} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 12px',color:'#9a9a98',whiteSpace:'nowrap'}}>{new Date(m.date).toLocaleDateString('es-UY')} {new Date(m.date).toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{padding:'9px 12px'}}><div style={{fontWeight:600,color:'#1a1a18'}}>{m.productName}</div><div style={{fontSize:11,color:'#9a9a98'}}>{m.brand}</div></td>
                  <td style={{padding:'9px 12px'}}><span style={{padding:'3px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:m.type==='entrada'?'#f0fdf4':'#fef2f2',color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'↑ Entrada':'↓ Salida'}</span></td>
                  <td style={{padding:'9px 12px',fontWeight:700,color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'+':'-'}{m.qty}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.stockBefore} → <strong>{m.stockAfter}</strong></td>
                  <td style={{padding:'9px 12px',color:'#6a6a68'}}>{reasonLabel[m.reason]||m.reason}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.reference||'—'}</td>
                  <td style={{padding:'9px 12px',color:'#9a9a98',fontSize:12}}>{m.user||'—'}</td>
                </tr>
              ))}
              {filtered.length>50&&<tr><td colSpan={8} style={{padding:'10px',textAlign:'center',color:'#9a9a98',fontSize:12}}>Mostrando 50 de {filtered.length} movimientos — exportá CSV para ver todos</td></tr>}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
};


// ── Email Alerts via EmailJS ─────────────────────────────────────────────
const sendLowStockAlert = async (product, currentStock) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: product.name,
          brand: product.brand || '',
          current_stock: currentStock,
          min_stock: product.minStock || 5,
          unit: product.unit || '',
          date: new Date().toLocaleDateString('es-UY'),
        }
      })
    });
  } catch(e) { console.warn('Email alert failed:', e); }
};

const sendDailyAlertSummary = async (lowStockProducts) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  if (lowStockProducts.length === 0) return;
  const productList = lowStockProducts.map(p =>
    p.name + ' (stock: ' + (p.stock||0) + ' ' + (p.unit||'') + ', mín: ' + (p.minStock||5) + ')'
  ).join(', ');
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: lowStockProducts.length + ' productos bajo stock mínimo',
          brand: 'Resumen diario de stock',
          current_stock: lowStockProducts.length,
          min_stock: 0,
          unit: 'productos',
          date: new Date().toLocaleDateString('es-UY'),
          extra: productList,
        }
      })
    });
  } catch(e) { console.warn('Daily summary failed:', e); }
};

// ── Email Config Tab ─────────────────────────────────────────────────────
const EmailConfigTab=({products,session})=>{
  const [cfg,setCfg]=useState(()=>LS.get('aryes-email-config',{serviceId:'',templateId:'',publicKey:'',toEmail:''}));
  const [msg,setMsg]=useState('');
  const [testing,setTesting]=useState(false);
  const canEdit=session.role==='admin';

  const save=()=>{
    LS.set('aryes-email-config',cfg);
    setMsg('Configuración guardada ✓');
    setTimeout(()=>setMsg(''),2500);
  };

  const test=async()=>{
    if(!cfg.serviceId||!cfg.templateId||!cfg.publicKey||!cfg.toEmail){setMsg('Completá todos los campos primero');return;}
    setTesting(true);
    const testProd={name:'Chocolate Cobertura Leche 1kg (TEST)',brand:'Selecta',stock:2,minStock:10,unit:'kg'};
    await sendLowStockAlert(testProd,2);
    setTesting(false);
    setMsg('Email de prueba enviado a '+cfg.toEmail+' ✓');
    setTimeout(()=>setMsg(''),4000);
  };

  const lowCount=products.filter(p=>(p.stock||0)<(p.minStock||5)).length;

  const sendSummary=async()=>{
    const low=products.filter(p=>(p.stock||0)<(p.minStock||5));
    await sendDailyAlertSummary(low);
    setMsg('Resumen enviado con '+low.length+' productos ✓');
    setTimeout(()=>setMsg(''),3000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:680}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Notificaciones</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Alertas por Email</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Recibí un email automático cuando el stock cae por debajo del mínimo.</p>
      </div>

      {/* Status summary */}
      <div style={{background:lowCount>0?'#fef2f2':'#f0f7ec',border:'1px solid '+(lowCount>0?'#fecaca':'#b8d9a8'),borderRadius:12,padding:'16px 20px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>{lowCount>0?'🚨':'✅'}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:lowCount>0?'#dc2626':'#16a34a'}}>
              {lowCount>0?lowCount+' productos bajo stock mínimo':'Todos los productos con stock suficiente'}
            </div>
            <div style={{fontSize:12,color:'#9a9a98'}}>Revisado ahora</div>
          </div>
        </div>
        {lowCount>0&&canEdit&&<button onClick={sendSummary}
          style={{padding:'8px 16px',background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Enviar resumen ahora
        </button>}
      </div>

      {/* Setup guide */}
      <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'16px 20px',marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:'#3a7d1e',marginBottom:8}}>Cómo configurar (gratis con EmailJS):</div>
        <ol style={{fontSize:12,color:'#5a7a4a',margin:0,paddingLeft:20,lineHeight:1.8}}>
          <li>Entrá a <strong>emailjs.com</strong> y creá una cuenta gratuita</li>
          <li>En "Email Services" conectá tu Gmail o email de la empresa</li>
          <li>En "Email Templates" creá una plantilla — usá estas variables: <code style={{background:'#fff',padding:'1px 4px',borderRadius:3}}>{'{{product_name}} {{current_stock}} {{min_stock}} {{unit}} {{date}}'}</code></li>
          <li>Copiá tu Service ID, Template ID y Public Key abajo</li>
        </ol>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {canEdit?(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {[
              {label:'Email destino',key:'toEmail',ph:'alertas@empresa.com',type:'email'},
              {label:'Service ID (EmailJS)',key:'serviceId',ph:'service_xxxxxxx',type:'text'},
              {label:'Template ID (EmailJS)',key:'templateId',ph:'template_xxxxxxx',type:'text'},
              {label:'Public Key (EmailJS)',key:'publicKey',ph:'xxxxxxxxxxxxxxxxxxxxxx',type:'text'},
            ].map(({label,key,ph,type})=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>{label}</label>
                <input type={type} value={cfg[key]||''} onChange={e=>setCfg(c=>({...c,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button onClick={save} style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
              <button onClick={test} disabled={testing} style={{padding:'10px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit',opacity:testing?.6:1}}>
                {testing?'Enviando...':'Enviar email de prueba'}
              </button>
            </div>
          </div>
        </div>
      ):<div style={{padding:'20px',background:'#f9f9f7',borderRadius:10,color:'#9a9a98',fontSize:13}}>Solo el administrador puede configurar las alertas.</div>}
    </div>
  );
};
export default ImporterTab;
