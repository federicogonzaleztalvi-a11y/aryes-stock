// src/pages/TrackingPage.jsx — Public client delivery tracking
// Route: /tracking?ruta=RUTA_ID&cliente=CLIENTE_ID&org=ORG_ID
// No auth required — exposes minimal safe data to the end client
// Auto-refreshes every 60s while pending

import { useState, useEffect, useCallback } from 'react';
import { SB_URL, SKEY } from '../lib/constants.js';

const G = '#059669';
const F = { sans: "'Inter',system-ui,sans-serif" };

const STATUS = {
  en_ruta:      { label: 'En camino',    emoji: '🚚', color: '#f59e0b', bg: '#fffbeb', desc: 'Tu repartidor está en camino.' },
  pendiente:    { label: 'En camino',    emoji: '🚚', color: '#f59e0b', bg: '#fffbeb', desc: 'Tu pedido está en ruta.' },
  entregado:    { label: 'Entregado',    emoji: '✅', color: G,         bg: '#f0fdf4', desc: 'Tu pedido fue entregado.' },
  no_entregado: { label: 'No entregado', emoji: '⚠️', color: '#dc2626', bg: '#fef2f2', desc: 'No pudimos completar la entrega.' },
};

export default function TrackingPage() {
  const params    = new URLSearchParams(window.location.search);
  const rutaId    = params.get('ruta');
  const clienteId = params.get('cliente');
  const orgId     = params.get('org') || 'aryes';

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [lastUpd,    setLastUpd]    = useState(null);
  const [rating,     setRating]     = useState(0);      // 1-5 stars
  const [ratingNote, setRatingNote] = useState('');
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!rutaId || !clienteId) {
      setError('Link de seguimiento invalido.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/rutas?id=eq.${rutaId}&org_id=eq.${orgId}&select=id,vehiculo,zona,dia,entregas&limit=1`,
        { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Accept: 'application/json' } }
      );
      if (!r.ok) throw new Error('fetch_failed');
      const rows = await r.json();
      const ruta = rows?.[0];
      if (!ruta) { setError('Ruta no encontrada.'); return; }

      const entrega = (ruta.entregas || []).find(e => e.clienteId === clienteId);
      if (!entrega) { setError('No encontramos tu entrega en esta ruta.'); return; }

      const myIdx     = ruta.entregas.findIndex(e => e.clienteId === clienteId);
      const aheadPend = ruta.entregas.slice(0, myIdx).filter(e => e.estado === 'pendiente').length;

      // ETA calculation
      let etaMins = null;
      if (entrega.estado === 'pendiente' && ruta.salidaEn && ruta.enRuta) {
        const salida = new Date(ruta.salidaEn);
        const minsPorParada = ruta.minsPorParada || 12;
        const elapsed = Math.floor((Date.now() - salida.getTime()) / 60000);
        etaMins = Math.max(0, (aheadPend + 1) * minsPorParada - elapsed);
      }


      // Cargar ubicación GPS del repartidor
      let lat = null, lng = null;
      try {
        const gpsRes = await fetch(
          `${SB_URL}/rest/v1/driver_locations?ruta_id=eq.${rutaId}&org_id=eq.${orgId}&limit=1&order=updated_at.desc`,
          { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Accept: 'application/json' } }
        );
        if (gpsRes.ok) {
          const gpsData = await gpsRes.json();
          if (gpsData?.[0]) { lat = gpsData[0].lat; lng = gpsData[0].lng; }
        }
      } catch {}
      setData({ entrega, ruta, aheadPend, etaMins, driverLat: lat, driverLng: lng });
      setLastUpd(new Date());
    } catch {
      if (!silent) setError('Error al cargar. Verifica tu conexion.');
    } finally {
      setLoading(false);
    }
  }, [rutaId, clienteId, orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (data?.entrega?.estado === 'pendiente') load(true);
    }, 60000);
    return () => clearInterval(id);
  }, [data, load]);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:F.sans }}>
      <div style={{ width:40, height:40, border:`3px solid ${G}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite', marginBottom:14 }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <p style={{ color:'#6a6a68', fontSize:14, margin:0 }}>Buscando tu entrega...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:F.sans }}>
      <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
      <p style={{ fontSize:15, color:'#dc2626', textAlign:'center', maxWidth:300, margin:0 }}>{error}</p>
    </div>
  );

  if (!data) return null;

  const { entrega, ruta, aheadPend, etaMins } = data;
  const cfg    = STATUS[entrega.estado] || STATUS.pendiente;
  const isPend = entrega.estado === 'pendiente';


  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', fontFamily:F.sans, paddingBottom:40 }}>

      {/* Header */}
      <div style={{ background:G, padding:'28px 20px 24px', color:'#fff', textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:8 }}>{cfg.emoji}</div>
        <div style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>{cfg.label}</div>
        <div style={{ fontSize:14, opacity:0.85 }}>{cfg.desc}</div>
      </div>

      <div style={{ padding:'20px 16px', maxWidth:480, margin:'0 auto' }}>

        {/* Main status card */}
        <div style={{ background:'#fff', borderRadius:16, padding:20, marginBottom:14, boxShadow:'0 2px 8px rgba(0,0,0,.06)', border:`2px solid ${cfg.color}30` }}>

          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: isPend ? 18 : 0 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
              {cfg.emoji}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#1a1a18', marginBottom:2 }}>{entrega.clienteNombre}</div>
              {entrega.ciudad && <div style={{ fontSize:13, color:'#6a6a68' }}>📍 {entrega.ciudad}</div>}
              {entrega.hora   && <div style={{ fontSize:13, color:cfg.color, fontWeight:600 }}>🕐 {entrega.hora}</div>}
            </div>
          </div>

          {isPend && (
            <>
              <div style={{ background:'#f9f9f7', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#9a9a98', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                  Posicion en la ruta
                </div>
                {aheadPend === 0 ? (
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#f59e0b', marginBottom: etaMins !== null ? 6 : 0 }}>
                      ¡Sos la proxima parada!
                    </div>
                    {etaMins !== null && (
                      <div style={{ fontSize:13, color:'#6a6a68' }}>
                        ⏱ ETA: {etaMins <= 2 ? '¡Llegando en pocos minutos!' : `~${etaMins} minutos`}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom: etaMins !== null ? 4 : 0 }}>
                      <span style={{ fontSize:32, fontWeight:800, color:G }}>{aheadPend}</span>
                      <span style={{ fontSize:14, color:'#6a6a68' }}>
                        {aheadPend === 1 ? 'parada antes que vos' : 'paradas antes que vos'}
                      </span>
                    </div>
                    {etaMins !== null && (
                      <div style={{ fontSize:13, color:'#6a6a68' }}>
                        ⏱ Tiempo estimado: ~{etaMins} minutos
                      </div>
                    )}
                  </div>
                )}
              </div>


            </>
          )}

          {entrega.estado === 'entregado' && (
            <div style={{ marginTop: 12 }}>
              {entrega.fotoEntrega && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9a9a98', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
                    Foto de entrega
                  </div>
                  <img
                    src={entrega.fotoEntrega}
                    alt="Foto de entrega"
                    style={{ width:'100%', maxWidth:280, borderRadius:10, border:'2px solid #bbf7d0', display:'block' }}
                  />
                </div>
              )}
              {entrega.notaEntrega && (
                <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#166534' }}>
                  📝 {entrega.notaEntrega}
                </div>
              )}
            </div>
          )}

          {/* Rating widget — solo cuando entregado y no calificado aún */}
          {entrega.estado === 'entregado' && !ratingDone && !entrega.rating && (
            <div style={{ background:'#f9f9f7', borderRadius:10, padding:'14px 16px', marginTop:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a18', marginBottom:10 }}>
                ¿Cómo fue tu entrega?
              </div>
              {/* Stars */}
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRating(s)}
                    style={{ fontSize:28, background:'none', border:'none', cursor:'pointer',
                             opacity: s <= rating ? 1 : 0.25, transition:'opacity .15s' }}>
                    ⭐
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <textarea
                    value={ratingNote}
                    onChange={e => setRatingNote(e.target.value)}
                    placeholder="Comentario opcional..."
                    rows={2}
                    style={{ width:'100%', boxSizing:'border-box', border:'1px solid #e2e2de',
                             borderRadius:8, padding:'8px 12px', fontSize:13, resize:'none',
                             fontFamily:'Inter,sans-serif', outline:'none', marginBottom:8 }}
                  />
                  <button onClick={saveRating} disabled={ratingSaving}
                    style={{ width:'100%', background:G, color:'#fff', border:'none',
                             borderRadius:8, padding:'10px', fontSize:13, fontWeight:700,
                             cursor: ratingSaving ? 'default' : 'pointer',
                             opacity: ratingSaving ? 0.6 : 1 }}>
                    {ratingSaving ? 'Guardando...' : 'Enviar calificación'}
                  </button>
                </>
              )}
            </div>
          )}
          {/* Rating already submitted */}
          {(ratingDone || entrega.rating > 0) && entrega.estado === 'entregado' && (
            <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 16px', marginTop:12,
                          textAlign:'center', fontSize:13, color:G, fontWeight:600 }}>
              ¡Gracias por tu calificación! {'⭐'.repeat(entrega.rating || rating)}
            </div>
          )}

          {entrega.estado === 'no_entregado' && entrega.notaEntrega && (
            <div style={{ background:'#fef2f2', borderRadius:8, padding:'10px 12px', marginTop:12, fontSize:13, color:'#991b1b' }}>
              Motivo: {entrega.notaEntrega}
            </div>
          )}
        </div>

        {/* Delivery details */}
        {(ruta.vehiculo || ruta.zona || entrega.horarioDesde || entrega.horarioHasta) && (
          <div style={{ background:'#fff', borderRadius:14, padding:16, marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9a9a98', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
              Informacion de entrega
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {ruta.vehiculo && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'#6a6a68' }}>Vehiculo</span>
                  <span style={{ fontWeight:600, color:'#1a1a18' }}>🚚 {ruta.vehiculo}</span>
                </div>
              )}
              {ruta.zona && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'#6a6a68' }}>Zona</span>
                  <span style={{ fontWeight:600, color:'#1a1a18' }}>{ruta.zona}</span>
                </div>
              )}
              {(entrega.horarioDesde || entrega.horarioHasta) && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'#6a6a68' }}>Horario estimado</span>
                  <span style={{ fontWeight:600, color:'#1a1a18' }}>
                    {entrega.horarioDesde || '?'} - {entrega.horarioHasta || '?'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:'center' }}>
          {isPend && (
            <p style={{ fontSize:12, color:'#9a9a98', margin:'0 0 10px' }}>
              Actualizacion automatica cada minuto
              {lastUpd && ` · ${lastUpd.toLocaleTimeString('es-UY', { hour:'2-digit', minute:'2-digit' })}`}
            </p>
          )}
          <button onClick={() => load(true)} style={{ background:'none', border:`1px solid ${G}`, color:G, borderRadius:20, padding:'6px 18px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Actualizar ahora
          </button>
        </div>

      </div>
    
      {/* ── Mapa GPS del repartidor ── */}
      {data?.driverLat && data?.driverLng && (
        <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#6b7280', padding: '6px 12px', background: '#f9fafb',
            borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>
            📍 Ubicación del repartidor (actualiza cada 60s)
          </div>
          <iframe
            title="Mapa repartidor"
            width="100%" height="220"
            style={{ border: 'none', display: 'block' }}
            src={`https://maps.google.com/maps?q=${data.driverLat},${data.driverLng}&z=15&output=embed`}
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
