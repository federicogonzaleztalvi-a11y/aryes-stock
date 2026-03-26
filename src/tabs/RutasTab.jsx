import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { db } from '../lib/constants.js';
import { useRole } from '../hooks/useRole.ts';

// ── Haversine distance (km) between two lat/lng points ────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Nearest-Neighbor greedy TSP ───────────────────────────────────────────
// Returns a reordered copy of `entregas` minimizing total distance.
// Entregas without coordinates go to the end (ungeocoded).
function nearestNeighborTSP(entregas, clientes) {
  // Attach coords from clients
  const withCoords = entregas.map(e => {
    const cli = clientes.find(c => c.id === e.clienteId);
    return { ...e, lat: cli?.lat ?? null, lng: cli?.lng ?? null };
  });

  const geocoded   = withCoords.filter(e => e.lat !== null && e.lng !== null);
  const ungeocoded = withCoords.filter(e => e.lat === null || e.lng === null);

  if (geocoded.length <= 1) return withCoords; // nothing to optimize

  const visited = new Array(geocoded.length).fill(false);
  const ordered = [];
  let current = 0;
  visited[0] = true;
  ordered.push(geocoded[0]);

  for (let step = 1; step < geocoded.length; step++) {
    let nearest = -1, minDist = Infinity;
    for (let j = 0; j < geocoded.length; j++) {
      if (visited[j]) continue;
      const d = haversine(
        geocoded[current].lat, geocoded[current].lng,
        geocoded[j].lat,       geocoded[j].lng
      );
      if (d < minDist) { minDist = d; nearest = j; }
    }
    visited[nearest] = true;
    ordered.push(geocoded[nearest]);
    current = nearest;
  }

  // Strip the synthetic lat/lng we attached (not part of entrega shape)
  const clean = e => { const {lat: _lat, lng: _lng, ...rest} = e; return rest; };
  return [...ordered.map(clean), ...ungeocoded.map(clean)];
}

// ── Nominatim geocoder (OpenStreetMap, free, no API key) ─────────────────
async function geocodeAddress(direccion, ciudad) {
  const q = [direccion, ciudad, 'Uruguay'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'AryesStock/1.0' } });
  const data = await res.json();
  if (data?.length > 0) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  return null;
}

function RutasTab(){
  const { clientes, setClientes, rutas, setRutas, setHasPendingSync } = useApp();
  const { isAdmin } = useRole();
  const G="#3a7d1e";
  const { confirm, ConfirmDialog } = useConfirm();
  const [vista,setVista]=useState("lista");
  const [rutaActiva,setRutaActiva]=useState(null);
  const [form,setForm]=useState({vehiculo:"",zona:"",dia:"",notas:""});
  const [msg,setMsg]=useState("");
  const [busqCli,setBusqCli]=useState("");
  const [optimizando, setOptimizando] = useState(false);
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  const ruta=rutas.find(r=>r.id===rutaActiva)||null;

  const crearRuta=()=>{
    if(!form.vehiculo||!form.zona){setMsg("Completa vehiculo y zona");return;}
    const nueva={id:crypto.randomUUID(),vehiculo:form.vehiculo,zona:form.zona,dia:form.dia,notas:form.notas,entregas:[],creadoEn:new Date().toISOString()};
    const upd=[nueva,...rutas];
    setRutas(upd);
    db.upsert('rutas',{
      id:nueva.id, vehiculo:nueva.vehiculo, zona:nueva.zona, dia:nueva.dia,
      notas:nueva.notas, entregas:nueva.entregas,
      creado_en:nueva.creadoEn, updated_at:nueva.creadoEn,
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
    setForm({vehiculo:"",zona:"",dia:"",notas:""});
    setMsg("Ruta creada");setTimeout(()=>setMsg(""),3000);
  };

  const eliminarRuta=async(id)=>{
    const ok = await confirm({ title:'¿Eliminar esta ruta?', variant:'danger' });
    if(!ok) return;
    const upd=rutas.filter(r=>r.id!==id);
    setRutas(upd);
    db.del('rutas',{id}).catch(e=>{ console.warn('[RutasTab] delete failed:',e?.message||e); setHasPendingSync(true); });
  };

  const agregarEntrega=(cli)=>{
    if(!ruta)return;
    if(ruta.entregas.find(e=>e.clienteId===cli.id)){setMsg("Ya esta en la ruta");return;}
    const e={clienteId:cli.id,clienteNombre:cli.nombre,ciudad:cli.ciudad||"",telefono:cli.telefono||"",estado:"pendiente",hora:"",nota:"",foto:""};
    const upd=rutas.map(r=>r.id===rutaActiva?{...r,entregas:[...r.entregas,e]}:r);
    setRutas(upd);
    const updRuta=upd.find(r=>r.id===rutaActiva);
    if(updRuta) db.upsert('rutas',{
      id:updRuta.id, vehiculo:updRuta.vehiculo, zona:updRuta.zona, dia:updRuta.dia,
      notas:updRuta.notas, entregas:updRuta.entregas,
      creado_en:updRuta.creadoEn, updated_at:new Date().toISOString(),
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
    setBusqCli("");
  };

  // ── Optimizar ruta: geocode + nearest-neighbor TSP ───────────────────────
  const optimizarRuta = async () => {
    if (!ruta || ruta.entregas.length < 2) {
      setMsg("Se necesitan al menos 2 entregas para optimizar"); return;
    }
    setOptimizando(true);
    setMsg("Geocodificando direcciones...");

    // Geocode any client without coords
    const clientesActualizados = [...clientes];
    for (const e of ruta.entregas) {
      const idx = clientesActualizados.findIndex(c => c.id === e.clienteId);
      if (idx < 0) continue;
      const cli = clientesActualizados[idx];
      if (cli.lat && cli.lng) continue; // already geocoded
      if (!cli.direccion && !cli.ciudad) continue; // no address to geocode
      try {
        const coords = await geocodeAddress(cli.direccion, cli.ciudad);
        if (coords) {
          const updCli = { ...cli, ...coords, geocodedAt: new Date().toISOString() };
          clientesActualizados[idx] = updCli;
          // Persist coords to Supabase (non-blocking)
          db.patch('clients',
            { lat: coords.lat, lng: coords.lng, geocoded_at: updCli.geocodedAt },
            'id=eq.' + cli.id
          ).catch(err => console.warn('[RutasTab] geocode patch failed:', err?.message||err));
        }
      } catch { /* non-blocking — geocoding failure is OK */ }
      await new Promise(r => setTimeout(r, 500)); // Nominatim rate limit: 1 req/s
    }
    setClientes(clientesActualizados);

    // Run TSP
    setMsg("Calculando ruta óptima...");
    const optimized = nearestNeighborTSP(ruta.entregas, clientesActualizados);
    const updRutas = rutas.map(r => r.id === rutaActiva ? { ...r, entregas: optimized } : r);
    setRutas(updRutas);
    const updRuta = updRutas.find(r => r.id === rutaActiva);
    if (updRuta) {
      db.upsert('rutas', {
        id: updRuta.id, vehiculo: updRuta.vehiculo, zona: updRuta.zona,
        dia: updRuta.dia, notas: updRuta.notas, entregas: updRuta.entregas,
        creado_en: updRuta.creadoEn, updated_at: new Date().toISOString(),
      }, 'id').catch(e => { console.warn('[RutasTab] upsert failed:', e?.message||e); setHasPendingSync(true); });
    }

    // Count how many have coords
    const conCoords = optimized.filter(e => clientesActualizados.find(c => c.id === e.clienteId)?.lat).length;
    const total = optimized.length;
    setOptimizando(false);
    setMsg(conCoords === total
      ? `✓ Ruta optimizada — ${total} paradas ordenadas por distancia mínima`
      : `✓ Optimizada parcialmente — ${conCoords}/${total} clientes geocodificados. Los restantes van al final.`
    );
    setTimeout(() => setMsg(""), 5000);
  };

  const marcarEntregado=(rutaId,clienteId)=>{
    const hora=new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"entregado",hora}:ev)}:r);
    setRutas(upd);
    const updRuta=upd.find(r=>r.id===rutaId);
    if(updRuta) db.upsert('rutas',{
      id:updRuta.id, vehiculo:updRuta.vehiculo, zona:updRuta.zona, dia:updRuta.dia,
      notas:updRuta.notas, entregas:updRuta.entregas,
      creado_en:updRuta.creadoEn, updated_at:new Date().toISOString(),
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
  };

  const marcarNoEntregado=(rutaId,clienteId)=>{
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"no_entregado",hora:new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})}:ev)}:r);
    setRutas(upd);
    const updRuta=upd.find(r=>r.id===rutaId);
    if(updRuta) db.upsert('rutas',{
      id:updRuta.id, vehiculo:updRuta.vehiculo, zona:updRuta.zona, dia:updRuta.dia,
      notas:updRuta.notas, entregas:updRuta.entregas,
      creado_en:updRuta.creadoEn, updated_at:new Date().toISOString(),
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
  };

  const revertirEntrega=(rutaId,clienteId)=>{
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"pendiente",hora:""}:ev)}:r);
    setRutas(upd);
    const updRuta=upd.find(r=>r.id===rutaId);
    if(updRuta) db.upsert('rutas',{
      id:updRuta.id, vehiculo:updRuta.vehiculo, zona:updRuta.zona, dia:updRuta.dia,
      notas:updRuta.notas, entregas:updRuta.entregas,
      creado_en:updRuta.creadoEn, updated_at:new Date().toISOString(),
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
  };

  const abrirMaps=(e)=>{
    const q=encodeURIComponent((e.ciudad||e.clienteNombre)+" Uruguay");
    window.open("https://maps.google.com/?q="+q,"_blank","noopener,noreferrer");
  };

  const exportarCSV=()=>{
    if(!ruta)return;
    const rows=[["Cliente","Ciudad","Estado","Hora","Nota"],...ruta.entregas.map(e=>[e.clienteNombre,e.ciudad,e.estado,e.hora,e.nota||""])];
    const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="ruta-"+ruta.vehiculo+".csv";a.click();
    URL.revokeObjectURL(url);
  };

  const clientesFiltrados=clientes.filter(c=>c.nombre&&c.nombre.toLowerCase().includes(busqCli.toLowerCase())).slice(0,6);
  const pendientes=ruta?ruta.entregas.filter(e=>e.estado==="pendiente").length:0;
  const entregados=ruta?ruta.entregas.filter(e=>e.estado==="entregado").length:0;

  // HISTORIAL VIEW
  if(vista==="historial"){
    const hist=rutas.flatMap(r=>r.entregas.filter(e=>e.estado==="entregado").map(e=>({...e,vehiculo:r.vehiculo,zona:r.zona})));
    const exportarHist=()=>{
      const rows=[["Vehiculo","Zona","Cliente","Ciudad","Hora","Nota"],...hist.map(h=>[h.vehiculo,h.zona,h.clienteNombre,h.ciudad||"",h.hora,h.nota||""])];
      const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
      const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download="historial-entregas.csv";a.click();
      URL.revokeObjectURL(url);
    };
    return(
      <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setVista("lista")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Historial de entregas</h2>
          <button onClick={exportarHist} style={{marginLeft:"auto",padding:"7px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700}}>Exportar CSV</button>
        </div>
        {hist.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin entregas registradas</div>):(
          <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {hist.map((h, _i) =>(
              <div key={_i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #f3f4f6",background:_i%2===0?"#fff":"#fafafa"}}>
                <span style={{fontSize:16}}>🚚</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{h.clienteNombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{h.vehiculo} · {h.zona} · {h.ciudad||""}</div>
                </div>
                <div style={{fontSize:12,color:G,fontWeight:700}}>{h.hora}</div>
                <span style={{background:"#f0fdf4",color:G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>Entregado</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // DETALLE VIEW
  if(vista==="detalle"&&ruta){
    return(
      <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setVista("lista");setRutaActiva(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>←</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:"Playfair Display,serif",fontSize:22,color:"#1a1a1a",margin:0}}>🚚 {ruta.vehiculo} — {ruta.zona}</h2>
            <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{ruta.dia||"Sin dia asignado"} · {ruta.entregas.length} paradas</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={optimizarRuta} disabled={optimizando||ruta.entregas.length<2}
              style={{padding:"7px 14px",background:optimizando?"#9ca3af":G,color:"#fff",
                      border:"none",borderRadius:8,cursor:optimizando?"not-allowed":"pointer",
                      fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:5}}>
              {optimizando?"⏳ Optimizando...":"🗺 Optimizar ruta"}
            </button>
            <button onClick={exportarCSV} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:12}}>CSV</button>
            <button onClick={()=>setVista("historial")} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:12}}>Historial</button>
          </div>
        </div>
        {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:G}}>{entregados}</div><div style={{fontSize:11,color:"#888"}}>Entregados</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#f59e0b"}}>{pendientes}</div><div style={{fontSize:11,color:"#888"}}>Pendientes</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#1a1a1a"}}>{ruta.entregas.length}</div><div style={{fontSize:11,color:"#888"}}>Total</div></div>
        </div>
        <div style={{background:"#fff",borderRadius:10,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
          <input value={busqCli} onChange={e=>setBusqCli(e.target.value)} placeholder="Buscar cliente para agregar..." style={{...inp,marginBottom:busqCli?8:0}} />
          {busqCli&&clientesFiltrados.map(c=>(
            <div key={c.id} onClick={()=>agregarEntrega(c)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,cursor:"pointer",background:"#f9fafb",marginBottom:4}}>
              <span style={{fontSize:14}}>👤</span>
              <div style={{flex:1,fontSize:13,fontWeight:600}}>{c.nombre}</div>
              <span style={{fontSize:11,color:"#888"}}>{c.ciudad||""}</span>
              <span style={{fontSize:12,color:G,fontWeight:700}}>+</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gap:8}}>
          {ruta.entregas.map((e, _i) =>{
            const isEntregado=e.estado==="entregado";
            const isNoEnt=e.estado==="no_entregado";
            return(
              <div key={e.clienteId} style={{background:isEntregado?"#f0fdf4":isNoEnt?"#fef2f2":"#fff",border:"1px solid "+(isEntregado?"#bbf7d0":isNoEnt?"#fecaca":"#e5e7eb"),borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:18,opacity:.7}}>📍</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{e.clienteNombre}</div>
                    <div style={{fontSize:12,color:"#888"}}>{e.ciudad||""}{e.hora?" · "+e.hora:""}</div>
                  </div>
                  <span style={{fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:700,background:isEntregado?"#f0fdf4":isNoEnt?"#fef2f2":"#fffbeb",color:isEntregado?G:isNoEnt?"#dc2626":"#92400e"}}>{e.estado==="pendiente"?"Pendiente":e.estado==="entregado"?"Entregado":"No entregado"}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {!isEntregado&&!isNoEnt&&(
                    <>
                      <button onClick={()=>marcarEntregado(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700}}>Entregado</button>
                      <button onClick={()=>marcarNoEntregado(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,cursor:"pointer",fontSize:12}}>No entregado</button>
                    </>
                  )}
                  {(isEntregado||isNoEnt)&&(
                    <button onClick={()=>revertirEntrega(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",color:"#374151",borderRadius:6,cursor:"pointer",fontSize:12}}>Revertir</button>
                  )}
                  <button onClick={()=>abrirMaps(e)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",color:"#374151",borderRadius:6,cursor:"pointer",fontSize:12}}>Maps</button>
                </div>
              </div>
            );
          })}
        </div>
        {ruta.entregas.length===0&&<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Buscá clientes arriba para agregar paradas</div>}
      </section>
    );
  }

  // LISTA VIEW (default)
  return(
    <>{ConfirmDialog}<section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Rutas de Reparto</h2>
          <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Planifica y gestiona las rutas de entrega</p>
        </div>
        <button onClick={()=>setVista("historial")} style={{padding:"8px 16px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:13}}>Ver historial</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      {isAdmin&&<div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:14}}>Nueva ruta</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Vehiculo</label>
          <input value={form.vehiculo} onChange={e=>setForm(f=>({...f,vehiculo:e.target.value}))} placeholder="Ej: Camion A" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Zona</label>
          <input value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))} placeholder="Ej: Montevideo Norte" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Dia</label>
          <input value={form.dia} onChange={e=>setForm(f=>({...f,dia:e.target.value}))} placeholder="Ej: Lunes" style={inp} /></div>
        </div>
        <button onClick={crearRuta} style={{padding:"9px 22px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Crear ruta</button>
      </div>}
      <div style={{display:"grid",gap:10}}>
        {rutas.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin rutas creadas</div>):(
          rutas.map(r=>{
            const pend=r.entregas.filter(e=>e.estado==="pendiente").length;
            const ent=r.entregas.filter(e=>e.estado==="entregado").length;
            return(
              <div key={r.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:22}}>🚚</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{r.vehiculo} — {r.zona}</div>
                  <div style={{fontSize:12,color:"#888"}}>{r.dia||"Sin dia"} · {ent}/{r.entregas.length} entregas</div>
                </div>
                {pend>0&&<span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{pend} pendientes</span>}
                <button onClick={()=>{setRutaActiva(r.id);setVista("detalle");}} style={{padding:"7px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Ver ruta</button>
                {isAdmin&&<button onClick={()=>eliminarRuta(r.id)} style={{padding:"7px 10px",background:"#fff",border:"1px solid #fecaca",color:"#dc2626",borderRadius:8,cursor:"pointer",fontSize:12}}>✗</button>}
              </div>
            );
          })
        )}
      </div>
    </section></>
  );
}

export default RutasTab;
