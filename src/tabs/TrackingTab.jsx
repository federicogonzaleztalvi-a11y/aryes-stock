// ── TrackingTab — GPS tracking en tiempo real (A-2) ────────────────────────
// Repartidor (operador): activa GPS → envía posición a Supabase cada 15s
//                        + guarda breadcrumb en aryes_tracking_history
// Admin: mapa Leaflet con todos los vehículos + breadcrumb del recorrido
//        + vinculación con ruta activa del repartidor
//
// Mapa: Leaflet.js cargado dinámicamente desde CDN (sin API key)
// Tiles: OpenStreetMap (gratuito, sin restricciones de uso)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp }  from '../context/AppContext.tsx';
import { SKEY, SB_URL, getOrgId } from '../lib/constants.js';

const G = '#059669';
const POLL_MS = 15_000;   // admin map refresh

// ── Leaflet loader (CDN, no npm) ─────────────────────────────────────────────
let leafletLoaded = false;
function loadLeaflet() {
  if (leafletLoaded || window.L) { leafletLoaded = true; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script    = document.createElement('script');
    script.src      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload   = () => { leafletLoaded = true; resolve(); };
    script.onerror  = reject;
    document.head.appendChild(script);
  });
}

// ── Colors per driver ────────────────────────────────────────────────────────
const COLORS = ['#059669','#2563eb','#d97706','#dc2626','#7c3aed','#059669'];
function colorFor(idx) { return COLORS[idx % COLORS.length]; }

// ── Map component (rendered once, updated imperatively) ──────────────────────
function TrackingMap({ posiciones, historiales, rutasByDriver }) {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});
  const pathsRef   = useRef({});

  useEffect(() => {
    loadLeaflet().then(() => {
      if (!mapRef.current || leafletMap.current) return;
      const L   = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      map.setView([-34.9011, -56.1645], 12);
      leafletMap.current = map;
    }).catch(() => {});
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !window.L) return;
    const L = window.L;

    posiciones.forEach((p, idx) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const color  = colorFor(idx);
      const nombre = p.usuario || p.id;
      const ruta   = rutasByDriver?.[p.id];
      const minAgo = p.ts ? Math.floor((Date.now() - new Date(p.ts)) / 60000) : null;
      const timeStr = minAgo !== null ? (minAgo === 0 ? 'ahora' : `hace ${minAgo} min`) : '';
      const pendientes = ruta ? ruta.entregas.filter(e => e.estado !== 'entregado').length : null;
      const popupHtml = `<div style="font-family:sans-serif;min-width:160px">
        <b style="color:${color}">${nombre}</b><br/>
        <span style="color:#666;font-size:12px">${timeStr}</span><br/>
        ${ruta ? `<span style="font-size:12px">🚚 ${ruta.vehiculo} — ${ruta.zona}</span><br/>
        <span style="font-size:12px;color:#888">${pendientes} parada${pendientes!==1?'s':''} pendiente${pendientes!==1?'s':''}</span>` : ''}
      </div>`;

      const initial = nombre[0]?.toUpperCase() || '?';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:${color};border:3px solid #fff;border-radius:50%;
          display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;
          box-shadow:0 2px 8px rgba(0,0,0,.3)">${initial}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      if (markersRef.current[p.id]) {
        markersRef.current[p.id].setLatLng([lat, lng]).setPopupContent(popupHtml);
      } else {
        markersRef.current[p.id] = L.marker([lat, lng], { icon }).addTo(map).bindPopup(popupHtml);
      }

      const hist = historiales?.[p.id] || [];
      if (hist.length > 1) {
        const points = hist.map(h => [Number(h.lat), Number(h.lng)]);
        if (pathsRef.current[p.id]) {
          pathsRef.current[p.id].setLatLngs(points);
        } else {
          pathsRef.current[p.id] = L.polyline(points, {
            color, weight: 3, opacity: 0.6, dashArray: '6 4',
          }).addTo(map);
        }
      }
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!posiciones.find(p => p.id === id)) {
        markersRef.current[id].remove(); delete markersRef.current[id];
        pathsRef.current[id]?.remove();  delete pathsRef.current[id];
      }
    });

    if (posiciones.length > 0) {
      const coords = posiciones
        .map(p => [Number(p.lat), Number(p.lng)])
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      if (coords.length === 1)      map.setView(coords[0], 14);
      else if (coords.length > 1)   map.fitBounds(coords, { padding: [40,40], maxZoom: 15 });
    }
  }, [posiciones, historiales, rutasByDriver]);

  return (
    <div ref={mapRef} style={{ width:'100%', height:420, borderRadius:12, overflow:'hidden',
      boxShadow:'0 1px 6px rgba(0,0,0,.1)', border:'1px solid #e5e7eb' }} />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function TrackingTab({ session }) {
  const { rutas } = useApp();
  const user         = session;
  const orgId        = getOrgId();
  const esRepartidor = user?.role === 'operador';

  const [tracking,     setTracking]     = useState(false);
  const [watchId,      setWatchId]      = useState(null);
  const [miPosicion,   setMiPosicion]   = useState(null);
  const [rutaActivaId, setRutaActivaId] = useState('');
  const [msg,          setMsg]          = useState('');

  const [posiciones,  setPosiciones]  = useState([]);
  const [historiales, setHistoriales] = useState({});
  const [lastUpdate,  setLastUpdate]  = useState(null);

  const pushToSupabase = useCallback((loc) => {
    const payload = {
      id:          user?.username || 'repartidor',
      org_id:      orgId,
      lat:         loc.lat,
      lng:         loc.lng,
      ts:          loc.ts,
      usuario:     user?.name || user?.username || '?',
      ruta_id:     rutaActivaId || null,
      velocidad:   loc.velocidad ?? null,
      precision_m: loc.precision_m ?? null,
    };
    fetch(SB_URL + '/rest/v1/aryes_tracking', {
      method: 'POST',
      headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    fetch(SB_URL + '/rest/v1/aryes_tracking_history', {
      method: 'POST',
      headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: undefined, driver_id: payload.id }),
    }).catch(() => {});
  }, [user, orgId, rutaActivaId]);

  const activarTracking = () => {
    if (!navigator.geolocation) { setMsg('GPS no disponible en este dispositivo'); return; }
    const id = navigator.geolocation.watchPosition(
      pos => {
        const loc = {
          lat:         pos.coords.latitude,
          lng:         pos.coords.longitude,
          ts:          new Date().toISOString(),
          velocidad:   pos.coords.speed   ? Math.round(pos.coords.speed   * 3.6 * 10) / 10 : null,
          precision_m: pos.coords.accuracy ?? null,
        };
        setMiPosicion(loc);
        pushToSupabase(loc);
      },
      () => setMsg('Error obteniendo GPS — verificá permisos del navegador'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    setWatchId(id); setTracking(true); setMsg('');
  };

  const detenerTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null); setTracking(false); setMiPosicion(null);
  };

  const fetchPosiciones = useCallback(async () => {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/aryes_tracking?select=*&order=ts.desc`,
        { headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY } }
      );
      const data = await r.json();
      if (!Array.isArray(data)) return;
      setPosiciones(data);
      setLastUpdate(new Date());

      const today = new Date().toISOString().slice(0, 10);
      const histPromises = data.map(p =>
        fetch(
          `${SB_URL}/rest/v1/aryes_tracking_history?driver_id=eq.${encodeURIComponent(p.id)}&ts=gte.${today}T00:00:00Z&order=ts.asc&limit=200`,
          { headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY } }
        ).then(r => r.json()).then(h => [p.id, Array.isArray(h) ? h : []])
      );
      const results = await Promise.allSettled(histPromises);
      const newHist = {};
      results.forEach(r => { if (r.status === 'fulfilled') newHist[r.value[0]] = r.value[1]; });
      setHistoriales(newHist);
    } catch {/* silent */}
  }, []);

  useEffect(() => {
    if (esRepartidor) return;
    fetchPosiciones();
    const iv = setInterval(fetchPosiciones, POLL_MS);
    return () => clearInterval(iv);
  }, [esRepartidor, fetchPosiciones]);

  const rutasByDriver = {};
  posiciones.forEach(p => {
    if (p.ruta_id) { const r = rutas.find(r => r.id === p.ruta_id); if (r) rutasByDriver[p.id] = r; }
  });

  // ── DRIVER VIEW ─────────────────────────────────────────────────────────────
  if (esRepartidor) return (
    <section style={{ padding:'28px 36px', maxWidth:600, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:'#1a1a1a', margin:'0 0 4px' }}>Mi ubicación GPS</h2>
        <p style={{ fontSize:12, color:'#888', margin:0 }}>Activá el tracking para que el admin vea tu posición en tiempo real</p>
      </div>
      {msg&&<div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 16px', marginBottom:16, color:'#dc2626', fontSize:13 }}>{msg}</div>}
      {!tracking&&(
        <div style={{ background:'#fff', borderRadius:10, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)', marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, display:'block', marginBottom:6 }}>Ruta de hoy (opcional)</label>
          <select value={rutaActivaId} onChange={e=>setRutaActivaId(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, fontFamily:'inherit', background:'#fff' }}>
            <option value="">Sin ruta asignada</option>
            {rutas.map(r=><option key={r.id} value={r.id}>🚚 {r.vehiculo} — {r.zona}</option>)}
          </select>
          <p style={{ fontSize:11, color:'#9ca3af', margin:'6px 0 0' }}>Al vincular tu ruta, el admin ve el progreso de entregas en el mapa</p>
        </div>
      )}
      {miPosicion&&(
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'14px 18px', marginBottom:16, fontSize:13, color:G }}>
          <div style={{ fontWeight:700, marginBottom:6, fontSize:14 }}>📍 Posición actual</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div><span style={{ color:'#9ca3af', fontSize:11 }}>LAT</span><br/><span style={{ fontFamily:'monospace' }}>{miPosicion.lat.toFixed(5)}</span></div>
            <div><span style={{ color:'#9ca3af', fontSize:11 }}>LNG</span><br/><span style={{ fontFamily:'monospace' }}>{miPosicion.lng.toFixed(5)}</span></div>
            {miPosicion.velocidad!==null&&<div><span style={{ color:'#9ca3af', fontSize:11 }}>VELOCIDAD</span><br/>{miPosicion.velocidad} km/h</div>}
            {miPosicion.precision_m!==null&&<div><span style={{ color:'#9ca3af', fontSize:11 }}>PRECISIÓN</span><br/>±{Math.round(miPosicion.precision_m)} m</div>}
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:8 }}>{new Date(miPosicion.ts).toLocaleTimeString('es-UY')} · sincronizado</div>
        </div>
      )}
      {tracking&&rutaActivaId&&(()=>{
        const ruta=rutas.find(r=>r.id===rutaActivaId);
        if(!ruta) return null;
        const total=ruta.entregas.length;
        const entregadas=ruta.entregas.filter(e=>e.estado==='entregado').length;
        const proxima=ruta.entregas.find(e=>e.estado==='pendiente');
        return(
          <div style={{ background:'#fff', borderRadius:10, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🚚 {ruta.vehiculo} — {ruta.zona}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ flex:1, background:'#f3f4f6', borderRadius:20, height:8 }}>
                <div style={{ width:`${total>0?(entregadas/total)*100:0}%`, background:G, borderRadius:20, height:'100%', transition:'width .4s' }} />
              </div>
              <span style={{ fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{entregadas}/{total}</span>
            </div>
            {proxima&&(
              <div style={{ fontSize:12, color:'#374151' }}>
                <span style={{ color:'#9ca3af' }}>Próxima: </span>
                <span style={{ fontWeight:600 }}>{proxima.clienteNombre}</span>
                {proxima.ciudad?` · ${proxima.ciudad}`:''}
                {(proxima.horarioDesde||proxima.horarioHasta)&&(
                  <span style={{ marginLeft:6, color:'#2563eb', fontSize:11, fontWeight:700, background:'#eff6ff', padding:'1px 6px', borderRadius:20 }}>
                    🕐 {proxima.horarioDesde||'?'}–{proxima.horarioHasta||'?'}
                  </span>
                )}
              </div>
            )}
            {!proxima&&entregadas===total&&<div style={{ fontSize:13, color:G, fontWeight:700 }}>✓ Todas las entregas completadas</div>}
          </div>
        );
      })()}
      <button onClick={tracking?detenerTracking:activarTracking}
        style={{ width:'100%', padding:'14px 32px', background:tracking?'#dc2626':G,
          color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:16,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {tracking?<><span style={{ fontSize:20 }}>⏹</span> Detener tracking</>:<><span style={{ fontSize:20 }}>▶</span> Activar tracking GPS</>}
      </button>
      {tracking&&<p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', margin:'8px 0 0' }}>Posición enviada cada 15 segundos</p>}
    </section>
  );

  // ── ADMIN VIEW ───────────────────────────────────────────────────────────────
  return (
    <section style={{ padding:'28px 36px', maxWidth:1000, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:'#1a1a1a', margin:'0 0 4px' }}>Tracking GPS en tiempo real</h2>
          <p style={{ fontSize:12, color:'#888', margin:0 }}>Posición de la flota · se actualiza cada 15 segundos</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <button onClick={fetchPosiciones}
            style={{ padding:'7px 16px', background:G, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
            ↻ Actualizar
          </button>
          {lastUpdate&&<div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>Última: {lastUpdate.toLocaleTimeString('es-UY')}</div>}
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <TrackingMap posiciones={posiciones} historiales={historiales} rutasByDriver={rutasByDriver} />
      </div>

      {posiciones.length===0?(
        <div style={{ background:'#f9fafb', borderRadius:12, padding:32, textAlign:'center', color:'#888', fontSize:13 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📍</div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Ningún repartidor activo</div>
          <div style={{ fontSize:11 }}>Cuando un operador active el tracking, aparecerá aquí con su posición en el mapa.</div>
        </div>
      ):(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {posiciones.map((p,idx)=>{
            const color=colorFor(idx);
            const nombre=p.usuario||p.id;
            const minAgo=p.ts?Math.floor((Date.now()-new Date(p.ts))/60000):null;
            const timeStr=minAgo!==null?(minAgo===0?'ahora mismo':`hace ${minAgo} min`):'—';
            const stale=minAgo!==null&&minAgo>5;
            const ruta=rutasByDriver[p.id];
            const breadcrumbCount=(historiales[p.id]||[]).length;
            const entregadas=ruta?ruta.entregas.filter(e=>e.estado==='entregado').length:null;
            const total=ruta?ruta.entregas.length:null;
            return(
              <div key={p.id} style={{ background:'#fff', borderRadius:10, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:`1px solid ${stale?'#fde68a':'#f3f4f6'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
                    {nombre[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{nombre}</div>
                    <div style={{ fontSize:11, color:stale?'#d97706':'#6b7280' }}>{stale?'⚠ ':'● '}{timeStr}</div>
                  </div>
                  <button onClick={()=>window.open(`https://maps.google.com/?q=${p.lat},${p.lng}`,'_blank','noopener,noreferrer')}
                    style={{ padding:'4px 10px', background:G, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, flexShrink:0 }}>
                    Maps
                  </button>
                </div>
                <div style={{ fontSize:11, fontFamily:'monospace', color:'#6b7280', marginBottom:8 }}>
                  {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                  {p.velocidad?<span style={{ marginLeft:8 }}>· {p.velocidad} km/h</span>:''}
                </div>
                {ruta&&(
                  <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', marginBottom:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>🚚 {ruta.vehiculo} — {ruta.zona}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, background:'#e5e7eb', borderRadius:20, height:6 }}>
                        <div style={{ width:`${total>0?(entregadas/total)*100:0}%`, background:color, borderRadius:20, height:'100%' }} />
                      </div>
                      <span style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>{entregadas}/{total} entregas</span>
                    </div>
                  </div>
                )}
                <div style={{ fontSize:11, color:'#9ca3af' }}>📍 {breadcrumbCount} punto{breadcrumbCount!==1?'s':''} de recorrido hoy</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TrackingTab;
