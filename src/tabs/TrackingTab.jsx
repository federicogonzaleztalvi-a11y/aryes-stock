import { useState, useEffect } from 'react';
import { LS, SKEY, SB_URL } from '../lib/constants.js';

function TrackingTab({session}){
  const G="#3a7d1e";
  const user=session;
  const [rutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [ubicaciones,setUbicaciones]=useState({});
  const [tracking,setTracking]=useState(false);
  const [watchId,setWatchId]=useState(null);
  const [miPosicion,setMiPosicion]=useState(null);
  const [msg,setMsg]=useState("");
  const esRepartidor=user&&user.role==="operador";
  const activarTracking=()=>{
    if(!navigator.geolocation){setMsg("GPS no disponible en este dispositivo");return;}
    const id=navigator.geolocation.watchPosition(
      pos=>{
        const loc={lat:pos.coords.latitude,lng:pos.coords.longitude,ts:new Date().toISOString(),usuario:user?.username||"?"};
        setMiPosicion(loc);
        // Sync to Supabase
        const SURL="https://mrotnqybqvmvlexncvno.supabase.co";
        const SKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI";
        fetch(SURL+"/rest/v1/aryes_tracking",{method:"POST",headers:{"apikey":SKEY,"Authorization":"Bearer "+SKEY,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates"},body:JSON.stringify({id:user?.username||"repartidor",...loc})}).catch(()=>{});
      },
      ()=>setMsg("Error obteniendo GPS"),
      {enableHighAccuracy:true,maximumAge:10000,timeout:15000}
    );
    setWatchId(id);setTracking(true);
  };
  const detenerTracking=()=>{
    if(watchId!==null)navigator.geolocation.clearWatch(watchId);
    setWatchId(null);setTracking(false);setMiPosicion(null);
  };
  // Admin view: show all repartidores from Supabase
  const [posiciones,setPosiciones]=useState([]);
  useEffect(()=>{
    if(esRepartidor)return;
    const SURL="https://mrotnqybqvmvlexncvno.supabase.co";
    const SKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI";
    const fetchPos=()=>fetch(SURL+"/rest/v1/aryes_tracking?select=*",{headers:{"apikey":SKEY,"Authorization":"Bearer "+SKEY}}).then(r=>r.json()).then(d=>setPosiciones(Array.isArray(d)?d:[])).catch(()=>{});
    fetchPos();
    const iv=setInterval(fetchPos,15000);
    return()=>clearInterval(iv);
  },[esRepartidor]);
  if(esRepartidor)return(
    <section style={{padding:"28px 36px",maxWidth:600,margin:"0 auto",textAlign:"center"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 8px"}}>Mi ubicacion</h2>
      <p style={{fontSize:13,color:"#888",marginBottom:24}}>Activa el tracking para que admin pueda ver tu posicion en tiempo real</p>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      {miPosicion&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"14px 18px",marginBottom:16,fontSize:13,color:G}}>
        <div style={{fontWeight:700,marginBottom:4}}>Posicion actual</div>
        <div>Lat: {miPosicion.lat.toFixed(5)} · Lng: {miPosicion.lng.toFixed(5)}</div>
        <div style={{fontSize:11,color:"#888",marginTop:4}}>{new Date(miPosicion.ts).toLocaleTimeString("es-UY")}</div>
      </div>}
      <button onClick={tracking?detenerTracking:activarTracking} style={{padding:"14px 32px",background:tracking?"#dc2626":G,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:16}}>
        {tracking?"Detener tracking":"Activar tracking GPS"}
      </button>
    </section>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Tracking GPS</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Posicion en tiempo real de los repartidores</p>
      </div>
      {posiciones.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}>
        <div style={{fontSize:40,marginBottom:12}}>📍</div>
        <div>Ningun repartidor activo ahora</div>
        <div style={{fontSize:11,marginTop:6}}>Cuando un operador active el tracking, aparecera aqui. Se actualiza cada 15 seg.</div>
      </div>):(
        <div style={{display:"grid",gap:10}}>
          {posiciones.map(p=>(
            <div key={p.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:28}}>📍</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{p.usuario||p.id}</div>
                <div style={{fontSize:12,color:"#888"}}>Lat {Number(p.lat).toFixed(4)} · Lng {Number(p.lng).toFixed(4)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#888"}}>{p.ts?new Date(p.ts).toLocaleTimeString("es-UY"):"-"}</div>
                <button onClick={()=>window.open("https://maps.google.com/?q="+p.lat+","+p.lng,"_blank","noopener,noreferrer")} style={{marginTop:4,padding:"4px 10px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11}}>Ver en Maps</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


// Audit log helper - call from any component

export default TrackingTab;
