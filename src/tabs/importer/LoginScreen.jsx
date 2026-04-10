import { useState } from 'react';
import { SB_URL } from '../../lib/constants.js';
import { SB_KEY } from './catalog-data.js';

const LoginScreen=({onLogin})=>{
  const G="#059669";
  const [em,setEm]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(!em||!pw){setErr("Ingresa email y contrasena");return;}
    setErr("");setBusy(true);
    try{
      const r=await fetch(SB_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SB_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:em,password:pw})});
      const d=await r.json();
      if(!r.ok||!d.access_token){setErr(d.msg||d.error_description||"Credenciales incorrectas");setBusy(false);return;}
      const m=d.user.user_metadata||{};
      onLogin({id:d.user.id,email:d.user.email,role:m.role||"admin",username:m.username||em.split("@")[0],nombre:m.nombre||"Usuario",orgId:m.org_id||"aryes",access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in||3600});
    }catch {setErr("Error de conexion");}
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

 

export { LoginScreen };
