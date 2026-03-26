import React, { useState } from 'react';
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

// ── Nearest-Neighbor greedy TSP with time-window respect ─────────────────
// Returns a reordered copy of `entregas` minimizing total distance,
// while respecting horarioDesde/horarioHasta windows per stop.
//
// Algorithm:
//   1. Nearest-neighbor greedy ordering (distance-optimal)
//   2. Post-process: for each stop with a time window, check if the
//      estimated arrival (assuming 10 min/stop average) falls within it.
//      If not, find the earliest slot in the sequence that would work
//      and move the stop there. A stop with no window is never moved.
function nearestNeighborTSP(entregas, clientes) {
  const toMins = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const withCoords = entregas.map(e => {
    const cli = clientes.find(c => c.id === e.clienteId);
    return {
      ...e,
      lat: cli?.lat ?? null,
      lng: cli?.lng ?? null,
      winFrom: toMins(e.horarioDesde || cli?.horarioDesde),
      winTo:   toMins(e.horarioHasta || cli?.horarioHasta),
    };
  });

  const geocoded   = withCoords.filter(e => e.lat !== null && e.lng !== null);
  const ungeocoded = withCoords.filter(e => e.lat === null || e.lng === null);

  if (geocoded.length <= 1) {
    const clean = e => { const {lat:_l,lng:_g,winFrom:_f,winTo:_t,...rest}=e; return rest; };
    return [...withCoords.map(clean)];
  }

  // Phase 1: nearest-neighbor greedy
  const visited = new Array(geocoded.length).fill(false);
  const ordered = [];
  let current = 0;
  visited[0] = true;
  ordered.push(geocoded[0]);

  for (let step = 1; step < geocoded.length; step++) {
    let nearest = -1, minDist = Infinity;
    for (let j = 0; j < geocoded.length; j++) {
      if (visited[j]) continue;
      const d = haversine(geocoded[current].lat, geocoded[current].lng, geocoded[j].lat, geocoded[j].lng);
      if (d < minDist) { minDist = d; nearest = j; }
    }
    visited[nearest] = true;
    ordered.push(geocoded[nearest]);
    current = nearest;
  }

  // Phase 2: respect time windows
  // Assume route starts now, ~10 min between stops (rough estimate for UY urban)
  const MINS_PER_STOP = 10;
  const startMins = new Date().getHours() * 60 + new Date().getMinutes();

  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    if (stop.winFrom === null && stop.winTo === null) continue; // no window, skip

    const arrivalMins = startMins + i * MINS_PER_STOP;
    const tooEarly = stop.winFrom !== null && arrivalMins < stop.winFrom;
    const tooLate  = stop.winTo   !== null && arrivalMins > stop.winTo;

    if (!tooEarly && !tooLate) continue; // window OK

    // Find the earliest position j >= i where arrival is within window
    let bestPos = i; // keep in place if no better slot found
    for (let j = i; j < ordered.length; j++) {
      const arr = startMins + j * MINS_PER_STOP;
      const ok = (stop.winFrom === null || arr >= stop.winFrom) &&
                 (stop.winTo   === null || arr <= stop.winTo);
      if (ok) { bestPos = j; break; }
    }

    if (bestPos !== i) {
      // Move stop from i to bestPos
      ordered.splice(i, 1);
      ordered.splice(bestPos, 0, stop);
    }
  }

  const clean = e => { const {lat:_l,lng:_g,winFrom:_f,winTo:_t,...rest}=e; return rest; };
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
  // M-3: multi-vehicle distribution
  const [distOpen,   setDistOpen]   = useState(false);
  const [distRutas,  setDistRutas]  = useState([]);  // selected ruta IDs to include
  const [distResult, setDistResult] = useState(null); // { assignments: [{rutaId, entregas[]}] }
  const [distApplying, setDistApplying] = useState(false);
  // Evidence capture: { clienteId, nota, fotoBase64, firmaBase64 }
  const [evidencia, setEvidencia] = useState(null);
  const [firmaActiva, setFirmaActiva] = useState(false);
  const firmaRef = React.useRef(null);
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  const ruta=rutas.find(r=>r.id===rutaActiva)||null;

  const crearRuta=()=>{
    if(!form.vehiculo||!form.zona){setMsg("Completa vehiculo y zona");return;}
    const nueva={id:crypto.randomUUID(),vehiculo:form.vehiculo,zona:form.zona,dia:form.dia,notas:form.notas,entregas:[],creadoEn:new Date().toISOString(),capacidadKg:Number(form.capacidadKg)||0,capacidadBultos:Number(form.capacidadBultos)||0};
    const upd=[nueva,...rutas];
    setRutas(upd);
    db.upsert('rutas',{
      id:nueva.id, vehiculo:nueva.vehiculo, zona:nueva.zona, dia:nueva.dia,
      notas:nueva.notas, entregas:nueva.entregas,
      capacidad_kg:nueva.capacidadKg||0, capacidad_bultos:nueva.capacidadBultos||0,
      creado_en:nueva.creadoEn, updated_at:nueva.creadoEn,
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
    setForm({vehiculo:"",zona:"",dia:"",notas:"",capacidadKg:"",capacidadBultos:""});
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
    const e={clienteId:cli.id,clienteNombre:cli.nombre,ciudad:cli.ciudad||"",telefono:cli.telefono||"",estado:"pendiente",hora:"",nota:"",foto:"",horarioDesde:cli.horarioDesde||"",horarioHasta:cli.horarioHasta||"",pesoKg:0,bultos:0};
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

  const marcarEntregado=(rutaId,clienteId,nota='',fotoBase64='',firmaBase64='')=>{
    const hora=new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"entregado",hora,notaEntrega:nota||'',fotoEntrega:fotoBase64||'',firmaEntrega:firmaBase64||''}:ev)}:r);
    setRutas(upd);
    const updRuta=upd.find(r=>r.id===rutaId);
    if(updRuta) db.upsert('rutas',{
      id:updRuta.id, vehiculo:updRuta.vehiculo, zona:updRuta.zona, dia:updRuta.dia,
      notas:updRuta.notas, entregas:updRuta.entregas,
      creado_en:updRuta.creadoEn, updated_at:new Date().toISOString(),
    },'id').catch(e=>{ console.warn('[RutasTab] upsert failed:',e?.message||e); setHasPendingSync(true); });
  };

  // Called when user confirms delivery with optional evidence
  const confirmarEntrega = (rutaId, clienteId) => {
    const ev = evidencia;
    setEvidencia(null);
    marcarEntregado(rutaId, clienteId, ev?.nota || '', ev?.fotoBase64 || '', ev?.firmaBase64 || '');
  };

  // Convert a File object to base64 string
  const fotoABase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result);
    reader.onerror = () => rej(new Error('read error'));
    reader.readAsDataURL(file);
  });

  // ── Signature canvas helpers ───────────────────────────────────────────────
  const firmaStartDraw = (ev) => {
    const canvas = firmaRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const x = (ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left;
    const y = (ev.touches?.[0]?.clientY ?? ev.clientY) - rect.top;
    ctx.moveTo(x, y);
    canvas._drawing = true;
  };
  const firmaDrawMove = (ev) => {
    const canvas = firmaRef.current;
    if (!canvas || !canvas._drawing) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left;
    const y = (ev.touches?.[0]?.clientY ?? ev.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const firmaStopDraw = () => {
    const canvas = firmaRef.current;
    if (canvas) canvas._drawing = false;
  };
  const firmaLimpiar = () => {
    const canvas = firmaRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setEvidencia(ev => ({ ...ev, firmaBase64: '' }));
  };
  const firmaCapturar = () => {
    const canvas = firmaRef.current;
    if (!canvas) return;
    const b64 = canvas.toDataURL('image/png');
    setEvidencia(ev => ({ ...ev, firmaBase64: b64 }));
    setFirmaActiva(false);
  };

  // ── M-3: Multi-vehicle distribution — Round-Robin by proximity ──────────────
  // Distributes deliveries from selected routes across their vehicles,
  // minimizing total fleet distance using a greedy nearest-assignment approach.
  const calcularDistribucion = () => {
    const selectedRutas = rutas.filter(r => distRutas.includes(r.id));
    if (selectedRutas.length < 2) {
      setMsg("Selecciona al menos 2 rutas para distribuir"); return;
    }

    // Pool all pending deliveries from selected routes
    const pool = selectedRutas.flatMap(r =>
      r.entregas
        .filter(e => e.estado !== 'entregado')
        .map(e => {
          const cli = clientes.find(c => c.id === e.clienteId);
          return { ...e, lat: cli?.lat ?? null, lng: cli?.lng ?? null };
        })
    );

    if (pool.length === 0) {
      setMsg("No hay entregas pendientes en las rutas seleccionadas"); return;
    }

    const M = selectedRutas.length;
    const buckets = selectedRutas.map(r => ({
      rutaId: r.id, vehiculo: r.vehiculo, zona: r.zona, entregas: [],
      lastLat: null, lastLng: null,
      cargaKg: 0, cargaBultos: 0,
      capKg: r.capacidadKg || 0, capBultos: r.capacidadBultos || 0,
    }));

    const geocoded   = pool.filter(e => e.lat !== null && e.lng !== null);
    const ungeocoded = pool.filter(e => e.lat === null || e.lng === null);

    const remaining = [...geocoded];
    while (remaining.length > 0) {
      let bestStop = -1, bestBucket = -1, bestDist = Infinity;
      for (let si = 0; si < remaining.length; si++) {
        const stop = remaining[si];
        for (let bi = 0; bi < M; bi++) {
          const b = buckets[bi];
          // Check capacity constraints — skip if would overflow
          const newKg     = b.cargaKg     + (stop.pesoKg  || 0);
          const newBultos = b.cargaBultos + (stop.bultos   || 0);
          if (b.capKg     > 0 && newKg     > b.capKg)     continue;
          if (b.capBultos > 0 && newBultos > b.capBultos) continue;

          let dist;
          if (b.lastLat === null) {
            dist = b.entregas.length * 1000;
          } else {
            dist = haversine(b.lastLat, b.lastLng, stop.lat, stop.lng)
                   + b.entregas.length * 0.1;
          }
          if (dist < bestDist) { bestDist = dist; bestStop = si; bestBucket = bi; }
        }
        // If no bucket can fit this stop (all over capacity), assign to least loaded
        if (bestStop === -1) {
          bestStop = si;
          bestBucket = buckets.reduce((bi, b, i) => b.entregas.length < buckets[bi].entregas.length ? i : bi, 0);
        }
      }
      if (bestStop === -1) break; // safety
      const stop = remaining.splice(bestStop, 1)[0];
      buckets[bestBucket].entregas.push(stop);
      buckets[bestBucket].lastLat    = stop.lat;
      buckets[bestBucket].lastLng    = stop.lng;
      buckets[bestBucket].cargaKg    += stop.pesoKg  || 0;
      buckets[bestBucket].cargaBultos += stop.bultos || 0;
    }

    ungeocoded.forEach((stop, i) => {
      buckets[i % M].entregas.push(stop);
    });

    // Clean synthetic fields from result
    const clean = e => { const {lat:_l,lng:_g,...rest}=e; return rest; };
    const assignments = buckets.map(b => ({ ...b, entregas: b.entregas.map(clean) }));

    setDistResult({ assignments });
  };

  const aplicarDistribucion = async () => {
    if (!distResult) return;
    setDistApplying(true);
    const now = new Date().toISOString();
    const updRutas = rutas.map(r => {
      const assignment = distResult.assignments.find(a => a.rutaId === r.id);
      if (!assignment) return r;
      return { ...r, entregas: assignment.entregas, updatedAt: now };
    });
    setRutas(updRutas);
    // Persist each updated route
    await Promise.allSettled(
      distResult.assignments.map(a => {
        const ruta = updRutas.find(r => r.id === a.rutaId);
        if (!ruta) return Promise.resolve();
        return db.upsert('rutas', {
          id: ruta.id, vehiculo: ruta.vehiculo, zona: ruta.zona,
          dia: ruta.dia, notas: ruta.notas, entregas: ruta.entregas,
          capacidad_kg: ruta.capacidadKg||0, capacidad_bultos: ruta.capacidadBultos||0,
          creado_en: ruta.creadoEn, updated_at: now,
        }, 'id').catch(e => { console.warn('[RutasTab] multi-vehicle upsert failed:', e?.message||e); setHasPendingSync(true); });
      })
    );
    setDistResult(null);
    setDistRutas([]);
    setDistOpen(false);
    setDistApplying(false);
    setMsg(`✓ Distribución aplicada — ${distResult.assignments.length} rutas actualizadas`);
    setTimeout(() => setMsg(""), 5000);
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

  // Opens Google Maps with all pending deliveries as waypoints (full route navigation)
  const abrirRutaCompleta = () => {
    if (!ruta || ruta.entregas.length === 0) return;
    const pendientes = ruta.entregas.filter(e => e.estado !== "entregado");
    if (pendientes.length === 0) return;
    // Google Maps URL format: /dir/origin/waypoint1/waypoint2/.../destination
    // Use client name + city + Uruguay as search terms — works without geocoded coords
    const stops = pendientes.map(e =>
      encodeURIComponent([(e.clienteNombre||''), (e.ciudad||''), 'Uruguay'].filter(Boolean).join(', '))
    );
    if (stops.length === 1) {
      window.open("https://maps.google.com/?q=" + stops[0], "_blank", "noopener,noreferrer");
      return;
    }
    // First stop is origin, last is destination, rest are waypoints
    const origin      = stops[0];
    const destination = stops[stops.length - 1];
    const waypoints   = stops.slice(1, -1).join('/');
    const url = waypoints.length > 0
      ? `https://www.google.com/maps/dir/${origin}/${waypoints}/${destination}`
      : `https://www.google.com/maps/dir/${origin}/${destination}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
            {ruta.entregas.filter(e=>e.estado!=="entregado").length>0&&(
              <button onClick={abrirRutaCompleta}
                style={{padding:"7px 14px",background:"#3a7d1e",color:"#fff",border:"none",
                        borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,
                        display:"flex",alignItems:"center",gap:4}}>
                🗺 Navegar ruta completa
              </button>
            )}
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
                    <div style={{fontSize:12,color:"#888"}}>
                      {e.ciudad||""}{e.hora?" · "+e.hora:""}
                      {(e.horarioDesde||e.horarioHasta)&&(
                        <span style={{marginLeft:6,fontSize:11,fontWeight:700,color:"#2563eb",
                          background:"#eff6ff",border:"1px solid #bfdbfe",
                          padding:"1px 6px",borderRadius:20}}>
                          🕐 {e.horarioDesde||"?"} – {e.horarioHasta||"?"}
                        </span>
                      )}
                      {(e.pesoKg>0||e.bultos>0)&&(
                        <span style={{marginLeft:6,fontSize:11,color:"#6b7280"}}>
                          {e.pesoKg>0&&`${e.pesoKg}kg`}{e.pesoKg>0&&e.bultos>0&&" · "}{e.bultos>0&&`${e.bultos} bultos`}
                        </span>
                      )}
                    </div>
                    {/* Peso / bultos inline edit — only for pending stops */}
                    {e.estado==="pendiente"&&!isEntregado&&(
                      <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                        <label style={{fontSize:10,color:"#9ca3af"}}>kg:</label>
                        <input type="number" min="0" step="0.1"
                          defaultValue={e.pesoKg||""}
                          onBlur={ev=>{
                            const val=Number(ev.target.value)||0;
                            if(val===(e.pesoKg||0))return;
                            const upd=rutas.map(r=>r.id===ruta.id?{...r,entregas:r.entregas.map(x=>x.clienteId===e.clienteId?{...x,pesoKg:val}:x)}:r);
                            setRutas(upd);
                            db.upsert('rutas',{id:ruta.id,vehiculo:ruta.vehiculo,zona:ruta.zona,dia:ruta.dia,notas:ruta.notas,entregas:upd.find(r=>r.id===ruta.id).entregas,capacidad_kg:ruta.capacidadKg||0,capacidad_bultos:ruta.capacidadBultos||0,creado_en:ruta.creadoEn,updated_at:new Date().toISOString()},'id').catch(()=>setHasPendingSync(true));
                          }}
                          style={{width:60,padding:"2px 6px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit"}}/>
                        <label style={{fontSize:10,color:"#9ca3af"}}>bultos:</label>
                        <input type="number" min="0" step="1"
                          defaultValue={e.bultos||""}
                          onBlur={ev=>{
                            const val=Number(ev.target.value)||0;
                            if(val===(e.bultos||0))return;
                            const upd=rutas.map(r=>r.id===ruta.id?{...r,entregas:r.entregas.map(x=>x.clienteId===e.clienteId?{...x,bultos:val}:x)}:r);
                            setRutas(upd);
                            db.upsert('rutas',{id:ruta.id,vehiculo:ruta.vehiculo,zona:ruta.zona,dia:ruta.dia,notas:ruta.notas,entregas:upd.find(r=>r.id===ruta.id).entregas,capacidad_kg:ruta.capacidadKg||0,capacidad_bultos:ruta.capacidadBultos||0,creado_en:ruta.creadoEn,updated_at:new Date().toISOString()},'id').catch(()=>setHasPendingSync(true));
                          }}
                          style={{width:60,padding:"2px 6px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit"}}/>
                      </div>
                    )}
                        {isEntregado&&(e.notaEntrega||e.fotoEntrega||e.firmaEntrega)&&(
                          <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            {e.fotoEntrega&&(
                              <img src={e.fotoEntrega} alt="evidencia"
                                style={{width:56,height:42,objectFit:"cover",borderRadius:4,border:"1px solid #bbf7d0",cursor:"pointer"}}
                                onClick={()=>window.open(e.fotoEntrega,'_blank')}
                              />
                            )}
                            {e.firmaEntrega&&(
                              <img src={e.firmaEntrega} alt="firma"
                                style={{width:80,height:28,objectFit:"contain",borderRadius:4,
                                        border:"1px solid #bbf7d0",background:"#fafafa",cursor:"pointer"}}
                                onClick={()=>window.open(e.firmaEntrega,'_blank')}
                                title="Firma del receptor"
                              />
                            )}
                            {e.notaEntrega&&(
                              <span style={{fontSize:11,color:"#4b5563",fontStyle:"italic"}}>"{e.notaEntrega}"</span>
                            )}
                          </div>
                        )}
                  </div>
                  <span style={{fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:700,background:isEntregado?"#f0fdf4":isNoEnt?"#fef2f2":"#fffbeb",color:isEntregado?G:isNoEnt?"#dc2626":"#92400e"}}>{e.estado==="pendiente"?"Pendiente":e.estado==="entregado"?"Entregado":"No entregado"}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {!isEntregado&&!isNoEnt&&(
                    <>
                      {evidencia?.clienteId===e.clienteId ? (
                        // Evidence capture panel — inline
                        <div style={{width:"100%",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:12}}>
                          <div style={{fontSize:12,fontWeight:700,color:G,marginBottom:8}}>Confirmar entrega</div>
                          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                            <input
                              placeholder="Nota de entrega (opcional)"
                              value={evidencia.nota||""}
                              onChange={ev=>setEvidencia(e=>({...e,nota:ev.target.value}))}
                              style={{flex:1,minWidth:160,padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit"}}
                            />
                            <label style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}>
                              📷 {evidencia.fotoBase64?"Foto ✓":"Agregar foto"}
                              <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                                onChange={async ev=>{
                                  const file=ev.target.files?.[0];
                                  if(!file)return;
                                  const b64=await fotoABase64(file);
                                  setEvidencia(ev=>({...ev,fotoBase64:b64}));
                                }}
                              />
                            </label>
                          </div>
                          {evidencia.fotoBase64&&(
                            <img src={evidencia.fotoBase64} alt="evidencia"
                              style={{width:80,height:60,objectFit:"cover",borderRadius:6,border:"1px solid #bbf7d0",marginBottom:8,display:"block"}}/>
                          )}
                          {/* Signature capture */}
                          {!firmaActiva&&(
                            <button onClick={()=>setFirmaActiva(true)}
                              style={{padding:"5px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,
                                      cursor:"pointer",fontSize:12,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
                              ✍️ {evidencia.firmaBase64?"Firma ✓ (cambiar)":"Agregar firma del receptor"}
                            </button>
                          )}
                          {firmaActiva&&(
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:11,color:"#666",marginBottom:4}}>Firmar con el dedo o mouse:</div>
                              <canvas ref={firmaRef} width={280} height={90}
                                style={{border:"2px solid "+G,borderRadius:6,background:"#fafafa",touchAction:"none",display:"block"}}
                                onMouseDown={firmaStartDraw} onMouseMove={firmaDrawMove}
                                onMouseUp={firmaStopDraw} onMouseLeave={firmaStopDraw}
                                onTouchStart={firmaStartDraw} onTouchMove={firmaDrawMove} onTouchEnd={firmaStopDraw}
                              />
                              <div style={{display:"flex",gap:6,marginTop:4}}>
                                <button onClick={firmaCapturar}
                                  style={{padding:"4px 12px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>
                                  Guardar firma
                                </button>
                                <button onClick={firmaLimpiar}
                                  style={{padding:"4px 10px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:11}}>
                                  Limpiar
                                </button>
                                <button onClick={()=>setFirmaActiva(false)}
                                  style={{padding:"4px 10px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:11}}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                          {evidencia.firmaBase64&&!firmaActiva&&(
                            <img src={evidencia.firmaBase64} alt="firma"
                              style={{width:120,height:40,objectFit:"contain",borderRadius:4,
                                      border:"1px solid #bbf7d0",background:"#fafafa",marginBottom:6,display:"block"}}/>
                          )}
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>confirmarEntrega(ruta.id,e.clienteId)}
                              style={{padding:"6px 16px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12}}>
                              ✓ Confirmar
                            </button>
                            <button onClick={()=>setEvidencia(null)}
                              style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:12}}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={()=>setEvidencia({clienteId:e.clienteId,nota:"",fotoBase64:""})}
                            style={{padding:"6px 12px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12}}>
                            ✓ Entregado
                          </button>
                          <button onClick={()=>marcarNoEntregado(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #fecaca",borderRadius:6,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>
                            ✗ No entregado
                          </button>
                        </>
                      )}
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Vehiculo</label>
          <input value={form.vehiculo} onChange={e=>setForm(f=>({...f,vehiculo:e.target.value}))} placeholder="Ej: Camion A" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Zona</label>
          <input value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))} placeholder="Ej: Montevideo Norte" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Dia</label>
          <input value={form.dia} onChange={e=>setForm(f=>({...f,dia:e.target.value}))} placeholder="Ej: Lunes" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Cap. kg (0=∞)</label>
          <input type="number" min="0" value={form.capacidadKg} onChange={e=>setForm(f=>({...f,capacidadKg:e.target.value}))} placeholder="Ej: 500" style={inp}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Cap. bultos (0=∞)</label>
          <input type="number" min="0" value={form.capacidadBultos} onChange={e=>setForm(f=>({...f,capacidadBultos:e.target.value}))} placeholder="Ej: 50" style={inp}/></div>
        </div>
        <button onClick={crearRuta} style={{padding:"9px 22px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Crear ruta</button>
      </div>}
      <div style={{display:"grid",gap:10}}>
        {rutas.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin rutas creadas</div>):(
          rutas.map(r=>{
            const pend=r.entregas.filter(e=>e.estado==="pendiente").length;
            const ent=r.entregas.filter(e=>e.estado==="entregado").length;
            const cargaKg=r.entregas.reduce((s,e)=>s+(e.pesoKg||0),0);
            const cargaBultos=r.entregas.reduce((s,e)=>s+(e.bultos||0),0);
            const pctKg=r.capacidadKg>0?Math.min(100,Math.round(cargaKg/r.capacidadKg*100)):null;
            const pctBultos=r.capacidadBultos>0?Math.min(100,Math.round(cargaBultos/r.capacidadBultos*100)):null;
            const sobrecargado=(r.capacidadKg>0&&cargaKg>r.capacidadKg)||(r.capacidadBultos>0&&cargaBultos>r.capacidadBultos);
            return(
              <div key={r.id} style={{background:"#fff",borderRadius:10,boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:`1px solid ${sobrecargado?"#fecaca":"#f3f4f6"}`,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>🚚</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{r.vehiculo} — {r.zona}</div>
                  <div style={{fontSize:12,color:"#888"}}>{r.dia||"Sin dia"} · {ent}/{r.entregas.length} entregas</div>
                </div>
                {pend>0&&<span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{pend} pend.</span>}
                <button onClick={()=>{setRutaActiva(r.id);setVista("detalle");}} style={{padding:"7px 16px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700}}>Ver ruta</button>
                {isAdmin&&<button onClick={()=>eliminarRuta(r.id)} style={{padding:"7px 10px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",color:"#6b7280",fontSize:12}}>✕</button>}
                </div>
                {/* Load bar — only shown when capacity is configured */}
                {(pctKg!==null||pctBultos!==null)&&(
                  <div style={{padding:"8px 18px 12px",borderTop:"1px solid #f3f4f6",background:sobrecargado?"#fef2f2":"#fafafa"}}>
                    {sobrecargado&&<div style={{fontSize:11,fontWeight:700,color:"#dc2626",marginBottom:6}}>⚠ Vehículo sobrecargado</div>}
                    {pctKg!==null&&(
                      <div style={{marginBottom:pctBultos!==null?6:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7280",marginBottom:3}}>
                          <span>Peso</span>
                          <span style={{fontWeight:600,color:pctKg>=100?"#dc2626":pctKg>=80?"#d97706":G}}>{cargaKg} / {r.capacidadKg} kg ({pctKg}%)</span>
                        </div>
                        <div style={{background:"#e5e7eb",borderRadius:20,height:6}}>
                          <div style={{width:`${pctKg}%`,background:pctKg>=100?"#dc2626":pctKg>=80?"#d97706":G,borderRadius:20,height:"100%",transition:"width .3s"}}/>
                        </div>
                      </div>
                    )}
                    {pctBultos!==null&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7280",marginBottom:3}}>
                          <span>Bultos</span>
                          <span style={{fontWeight:600,color:pctBultos>=100?"#dc2626":pctBultos>=80?"#d97706":G}}>{cargaBultos} / {r.capacidadBultos} ({pctBultos}%)</span>
                        </div>
                        <div style={{background:"#e5e7eb",borderRadius:20,height:6}}>
                          <div style={{width:`${pctBultos}%`,background:pctBultos>=100?"#dc2626":pctBultos>=80?"#d97706":G,borderRadius:20,height:"100%",transition:"width .3s"}}/>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* ── M-3: Multi-vehicle distribution panel ──────────────────────────── */}
      {rutas.length >= 2 && (
        <div style={{marginTop:20,background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <button onClick={()=>{setDistOpen(o=>!o);setDistResult(null);}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
            <span style={{fontSize:16}}>🚛</span>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:500,color:"#1a1a1a",flex:1}}>
              Distribuir carga entre vehículos
            </span>
            <span style={{fontSize:11,color:"#9ca3af"}}>{distOpen?"▲":"▼"}</span>
          </button>
          {distOpen&&(
            <div style={{marginTop:16}}>
              <p style={{fontSize:12,color:"#6b7280",marginTop:0,marginBottom:12}}>
                Seleccioná las rutas a redistribuir. El sistema asigna las paradas pendientes entre los vehículos minimizando la distancia total de la flota.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {rutas.map(r=>{
                  const checked = distRutas.includes(r.id);
                  const pend = r.entregas.filter(e=>e.estado!=="entregado").length;
                  return(
                    <label key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                      background:checked?"#f0fdf4":"#f9fafb",border:`1px solid ${checked?G:"#e5e7eb"}`,
                      borderRadius:8,cursor:"pointer",fontSize:13}}>
                      <input type="checkbox" checked={checked}
                        onChange={()=>setDistRutas(prev=>checked?prev.filter(id=>id!==r.id):[...prev,r.id])}
                        style={{accentColor:G,width:15,height:15}}/>
                      <span style={{fontWeight:700,color:"#1a1a1a"}}>🚚 {r.vehiculo}</span>
                      <span style={{color:"#6b7280"}}>— {r.zona}</span>
                      <span style={{marginLeft:"auto",fontSize:11,color:pend>0?"#f59e0b":"#9ca3af",fontWeight:700}}>
                        {pend} parada{pend!==1?"s":""} pendiente{pend!==1?"s":""}
                      </span>
                    </label>
                  );
                })}
              </div>
              {!distResult&&(
                <button onClick={calcularDistribucion} disabled={distRutas.length<2}
                  style={{padding:"9px 22px",background:distRutas.length<2?"#9ca3af":G,color:"#fff",
                          border:"none",borderRadius:8,cursor:distRutas.length<2?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
                  Calcular distribución óptima
                </button>
              )}
              {distRutas.length<2&&<p style={{fontSize:11,color:"#9ca3af",margin:"6px 0 0"}}>Seleccioná al menos 2 rutas</p>}
              {distResult&&(
                <div style={{marginTop:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:G,marginBottom:10}}>Propuesta de distribución:</div>
                  {distResult.assignments.map(a=>(
                    <div key={a.rutaId} style={{background:"#f9fafb",borderRadius:8,padding:"12px 14px",marginBottom:8,border:"1px solid #e5e7eb"}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>🚚 {a.vehiculo} — {a.zona}</div>
                      {a.entregas.length===0?(
                        <div style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Sin paradas asignadas</div>
                      ):(
                        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                          {a.entregas.map((e,i)=>(
                            <span key={i} style={{fontSize:11,background:"#fff",border:"1px solid #e5e7eb",
                              borderRadius:20,padding:"2px 10px",color:"#374151"}}>
                              {i+1}. {e.clienteNombre}
                              {(e.horarioDesde||e.horarioHasta)&&<span style={{color:"#2563eb",marginLeft:3}}>🕐</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button onClick={aplicarDistribucion} disabled={distApplying}
                      style={{padding:"9px 22px",background:distApplying?"#9ca3af":G,color:"#fff",
                              border:"none",borderRadius:8,cursor:distApplying?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
                      {distApplying?"Aplicando…":"✓ Aplicar distribución"}
                    </button>
                    <button onClick={()=>setDistResult(null)}
                      style={{padding:"9px 18px",background:"#fff",border:"1px solid #e5e7eb",
                              borderRadius:8,cursor:"pointer",fontSize:13,color:"#374151"}}>
                      Recalcular
                    </button>
                  </div>
                  <p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0",fontStyle:"italic"}}>
                    Solo se redistribuyen las paradas pendientes. Las entregas ya realizadas no se mueven.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </section></>
  );
}

export default RutasTab;
