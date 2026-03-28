// src/pages/TrackingPage.jsx — Public client delivery tracking
// Route: /tracking?ruta=RUTA_ID&cliente=CLIENTE_ID&org=ORG_ID
// No auth required — exposes minimal safe data to the end client
// Auto-refreshes every 60s while pending

import { useState, useEffect, useCallback } from 'react';
import { SB_URL, SKEY } from '../lib/constants.js';

const G = '#3a7d1e';
const F = { sans: "'Inter',system-ui,sans-serif" };

const STATUS = {
  pendiente:    { label: 'En camino',    emoji: '🚚', color: '#f59e0b', bg: '#fffbeb', desc: 'Tu pedido está en ruta.' },
  entregado:    { label: 'Entregado',    emoji: '✅', color: G,         bg: '#f0fdf4', desc: 'Tu pedido fue entregado.' },
  no_entregado: { label: 'No entregado', emoji: '⚠️', color: '#dc2626', bg: '#fef2f2', desc: 'No pudimos completar la entrega.' },
};

export default function TrackingPage() {
  const params    = new URLSearchParams(window.location.search);
  const rutaId    = params.get('ruta');
  const clienteId = params.get('cliente');
  const orgId     = params.get('org') || 'aryes';

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [lastUpd, setLastUpd] = useState(null);

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

      setData({ entrega, ruta, aheadPend });
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

  const { entrega, ruta, aheadPend } = data;
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
                  <div style={{ fontSize:15, fontWeight:700, color:'#f59e0b' }}>
                    ¡Sos la proxima parada!
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                    <span style={{ fontSize:32, fontWeight:800, color:G }}>{aheadPend}</span>
                    <span style={{ fontSize:14, color:'#6a6a68' }}>
                      {aheadPend === 1 ? 'parada antes que vos' : 'paradas antes que vos'}
                    </span>
                  </div>
                )}
              </div>


            </>
          )}

          {entrega.estado === 'entregado' && entrega.notaEntrega && (
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 12px', marginTop:12, fontSize:13, color:'#166534' }}>
              📝 {entrega.notaEntrega}
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
    </div>
  );
}
