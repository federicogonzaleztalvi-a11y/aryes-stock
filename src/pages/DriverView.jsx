// src/pages/DriverView.jsx — Mobile driver view
// Route: /driver?ruta=RUTA_ID
// Purpose: dedicated mobile UI for delivery drivers
// - No sidebar, no PC layout
// - Shows today's stops in order
// - Confirm delivery with photo + note
// - Mark as not delivered with reason
// - WhatsApp notification to client
// - Works fully offline-capable (reads from Supabase directly)

import { useState, useEffect, useRef, useCallback } from 'react';
import { SB_URL, SKEY } from '../lib/constants.js';

const G   = '#1a8a3c';
const F   = { sans: "'Inter',system-ui,sans-serif" };
const SB_ANON = SKEY;

// ── Helpers ────────────────────────────────────────────────────────────────

function fotoABase64(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img    = new Image();
    img.onload   = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = URL.createObjectURL(file);
  });
}

function timeNow() {
  return new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DriverView() {
  const params  = new URLSearchParams(window.location.search);
  const rutaId  = params.get('ruta');
  const orgId   = params.get('org') || 'aryes';

  const [ruta,    setRuta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  // ── GPS tracking ─────────────────────────────────────────────────────────
  const [gpsActive,   setGpsActive]   = useState(false);
  const [gpsError,    setGpsError]    = useState('');
  const watchRef = useRef(null);

  // ── Firma digital ─────────────────────────────────────────────────────────
  const [firmaData,   setFirmaData]   = useState(null); // base64 PNG
  const [showFirma,   setShowFirma]   = useState(false);
  const canvasFirmaRef = useRef(null);
  const isDrawing = useRef(false);

  // Active confirmation panel: { idx, mode: 'entregado'|'no_entregado'|'nota' }
  const [panel,   setPanel]   = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ── Offline support ───────────────────────────────────────────────────────
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline  = () => { setIsOffline(false); syncPending(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // Cache ruta to localStorage whenever it changes
  useEffect(() => {
    if (ruta && rutaId) localStorage.setItem('driver-ruta-' + rutaId, JSON.stringify(ruta));
  }, [ruta, rutaId]);

  // Sync pending offline operations when back online
  const syncPending = async () => {
    const queue = JSON.parse(localStorage.getItem('driver-offline-queue') || '[]');
    if (!queue.length) return;
    const session = getSession();
    const token = session?.access_token || SB_ANON;
    for (const op of queue) {
      try {
        await fetch(op.url, { ...op.opts, headers: { ...op.opts.headers, apikey: SB_ANON, Authorization: 'Bearer ' + token } });
      } catch { break; } // stop on first failure, retry next time
    }
    localStorage.removeItem('driver-offline-queue');
  };

  // Queue an operation for offline sync
  const queueOffline = (url, opts) => {
    const queue = JSON.parse(localStorage.getItem('driver-offline-queue') || '[]');
    queue.push({ url, opts, ts: Date.now() });
    localStorage.setItem('driver-offline-queue', JSON.stringify(queue));
  };
  const [nota,    setNota]    = useState('');
  const [foto,    setFoto]    = useState(null); // base64
  const fotoRef = useRef(null);

  // ── Load ruta ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rutaId) { setError('No se especificó una ruta. Usá el link correcto.'); setLoading(false); return; }
    const session = getSession();
    const token   = session?.access_token || SB_ANON;

    fetch(`${SB_URL}/rest/v1/rutas?id=eq.${rutaId}&org_id=eq.${orgId}&limit=1`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (!data?.[0]) { setError('Ruta no encontrada.'); return; }
      const r = data[0];
      setRuta({
        ...r,
        entregas: (r.entregas || []).map(e => ({ ...e })),
      });
    })
    .catch(() => {
      // Offline fallback: try to load from localStorage cache
      const cached = localStorage.getItem('driver-ruta-' + rutaId);
      if (cached) {
        try {
          setRuta(JSON.parse(cached));
          showMsg('Modo offline — usando datos guardados', 'warn');
          return;
        } catch {}
      }
      setError('Error al cargar la ruta. Verificá tu conexión.');
    })
    .finally(() => setLoading(false));
  }, [rutaId, orgId]);


  // ── GPS: iniciar tracking automático ─────────────────────────────────────
  const iniciarGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('GPS no disponible en este dispositivo'); return; }
    setGpsActive(true);
    setGpsError('');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        // Guardar en Supabase (fire and forget)
        const session = getSession();
        const token = session?.access_token || SB_ANON;
        fetch(`${SB_URL}/rest/v1/driver_locations`, {
          method: 'POST',
          headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ ruta_id: rutaId, org_id: orgId, lat, lng, accuracy: Math.round(accuracy), updated_at: new Date().toISOString() }),
        }).catch(() => {});
      },
      (err) => { console.warn('[GPS]', err.message); },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
  }, [rutaId, orgId]);

  // ── Bluetooth/USB Barcode Scanner Support ──────────────────────────────
  // Most Bluetooth barcode scanners pair as HID keyboards and "type" the code
  // followed by Enter. We capture fast consecutive keystrokes as a scan.
  const [lastScan, setLastScan] = useState(null);
  useEffect(() => {
    let buffer = '';
    let timer = null;
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // don't capture form input
      if (e.key === 'Enter' && buffer.length >= 4) {
        // Buffer has a valid scan
        const code = buffer.trim();
        setLastScan(code);
        buffer = '';
        // Match scanned barcode to a product in the route's items
        if (ruta) {
          const match = ruta.entregas.find(ent => {
            // Check if any item in this stop matches the barcode
            return ent.items?.some(it => it.barcode === code || it.codigo === code || it.productId === code);
          });
          if (match && match.estado === 'pendiente') {
            const idx = ruta.entregas.indexOf(match);
            setPanel({ idx, mode: 'entregado' });
            showMsg('Escaneado: ' + (match.clienteNombre || code));
          } else if (match) {
            showMsg('Parada ya entregada: ' + match.clienteNombre, 'warn');
          } else {
            showMsg('Código escaneado: ' + code + ' (sin coincidencia en ruta)', 'warn');
          }
        }
        return;
      }
      if (e.key.length === 1) { // printable character
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ''; }, 80); // reset if no key in 80ms — human typing is 120-200ms, scanners are <50ms
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(timer); };
  }, [ruta]);

  // ── GPS: limpiar al desmontar ─────────────────────────────────────────────
  useEffect(() => {
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // ── Firma: dibujo en canvas táctil ────────────────────────────────────────
  const firmaStart = useCallback((e) => {
    isDrawing.current = true;
    const canvas = canvasFirmaRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }, []);

  const firmaMove = useCallback((e) => {
    if (!isDrawing.current) return;
    const canvas = canvasFirmaRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    e.preventDefault();
  }, []);

  const firmaEnd = useCallback(() => { isDrawing.current = false; }, []);

  const firmaLimpiar = useCallback(() => {
    const canvas = canvasFirmaRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setFirmaData(null);
  }, []);

  const firmaCapturar = useCallback(() => {
    const canvas = canvasFirmaRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }, []);

  // ── Save ruta to Supabase ─────────────────────────────────────────────────
  const saveRuta = async (updatedRuta) => {
    setSaving(true);
    // Always save to localStorage first (instant, works offline)
    localStorage.setItem('driver-ruta-' + updatedRuta.id, JSON.stringify(updatedRuta));

    const session = getSession();
    const token   = session?.access_token || SB_ANON;

    if (!navigator.onLine) {
      // Queue for sync when back online
      queueOffline(
        SB_URL + '/rest/v1/rutas?id=eq.' + updatedRuta.id,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ entregas: updatedRuta.entregas, updated_at: new Date().toISOString() }) }
      );
      setSaving(false);
      return;
    }

    try {
      const r = await fetch(`${SB_URL}/rest/v1/rutas?id=eq.${updatedRuta.id}`, {
        method:  'PATCH',
        headers: {
          apikey:          SB_ANON,
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
        body: JSON.stringify({
          entregas:   updatedRuta.entregas,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error('save failed');
    } catch {
      showMsg('⚠️ Error al guardar. Reintentando...', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── ETA calculation ──────────────────────────────────────────────────────
  // Estimates minutes to delivery for a stop based on departure time + avg per stop
  const calcETA = (idx) => {
    if (!ruta?.salidaEn) return null;
    const salida     = new Date(ruta.salidaEn);
    const minsPorParada = ruta.minsPorParada || 12; // default 12 min per stop
    const pendAntes  = ruta.entregas.slice(0, idx).filter(e => e.estado === 'pendiente').length;
    const elapsed    = Math.floor((Date.now() - salida.getTime()) / 60000);
    const etaMins    = Math.max(0, (pendAntes + 1) * minsPorParada - elapsed);
    return etaMins;
  };

  // ── Salir a entregar ─────────────────────────────────────────────────────
  const salirAEntregar = async () => {
    const updRuta = { ...ruta, salidaEn: new Date().toISOString(), enRuta: true };
    setRuta(updRuta);
    showMsg('🚀 ¡En ruta! El cliente puede ver tu progreso.');
    await saveRuta(updRuta);
    // Notificación proactiva: avisar al primer cliente pendiente
    const primerPendiente = updRuta.entregas.find(e => e.estado === 'pendiente');
    if (primerPendiente) {
      const tel = (primerPendiente.telefono || '').replace(/\D/g, '');
      if (tel) {
        const nombre = primerPendiente.clienteNombre.split(' ')[0];
        const eta = (updRuta.entregas.filter(e => e.estado === 'pendiente').indexOf(primerPendiente) + 1) * 12;
        const trackingUrl = window.location.origin + '/tracking?ruta=' + updRuta.id + '&cliente=' + primerPendiente.clienteId + '&org=' + orgId;
        const msg = 'Hola ' + nombre + ', nuestro repartidor acaba de salir a entregar. Estimamos llegar en ~' + eta + ' minutos. Seguí tu pedido: ' + trackingUrl + ' 🚚';
        setTimeout(() => {
          if (window.confirm('¿Avisar a ' + primerPendiente.clienteNombre + ' que saliste a entregar?')) {
            window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank');
          }
        }, 1500);
      }
    }
  };

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(''), 3500);
  };

  // ── Confirm delivery ──────────────────────────────────────────────────────
  const confirmar = async (idx) => {
    const e = ruta.entregas[idx];
    const updated = ruta.entregas.map((en, i) => i !== idx ? en : {
      ...en,
      estado:       'entregado',
      hora:         timeNow(),
      notaEntrega:  nota || '',
      fotoEntrega:  foto || '',
          firmaCliente: firmaCapturar(),
    });
    const updRuta = { ...ruta, entregas: updated };
    setRuta(updRuta);
    setPanel(null); setNota(''); setFoto(null);
    showMsg(`✅ Entregado a ${e.clienteNombre}`);
    await saveRuta(updRuta);
    // Auto-notify client via WhatsApp with tracking link
    autoNotificar(e, 'entregado');
  };

  // ── Mark not delivered ────────────────────────────────────────────────────
  const noEntregado = async (idx) => {
    const e = ruta.entregas[idx];
    const updated = ruta.entregas.map((en, i) => i !== idx ? en : {
      ...en,
      estado:      'no_entregado',
      hora:        timeNow(),
      notaEntrega: nota || 'Sin motivo',
    });
    const updRuta = { ...ruta, entregas: updated };
    setRuta(updRuta);
    setPanel(null); setNota(''); setFoto(null);
    showMsg(`⚠️ Marcado como no entregado`);
    await saveRuta(updRuta);
  };

  // ── Photo capture ─────────────────────────────────────────────────────────
  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fotoABase64(file);
    setFoto(b64);
  };

  // ── WhatsApp notification ─────────────────────────────────────────────────
  const notificar = (e, etaMins = null) => {
    const tel = (e.telefono || '').replace(/\D/g, '');
    if (!tel) { showMsg('⚠️ Este cliente no tiene teléfono', 'err'); return; }
    const trackingUrl = `${window.location.origin}/tracking?ruta=${rutaId}&cliente=${e.clienteId}&org=${orgId}`;
    const nombre = e.clienteNombre.split(' ')[0];
    const etaStr = etaMins !== null
      ? (etaMins <= 3 ? 'en pocos minutos' : `en aproximadamente ${etaMins} minutos`)
      : 'próximamente';
    const msg = `Hola ${nombre}, nuestro repartidor estará llegando a tu local *${etaStr}*. Seguí tu entrega en tiempo real: ${trackingUrl} 🚚`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const autoNotificar = (e, tipo) => {
    // Auto-open WhatsApp on delivery confirmation — driver just taps send
    const tel = (e.telefono || '').replace(/\D/g, '');
    if (!tel) return;
    const trackingUrl = `${window.location.origin}/tracking?ruta=${rutaId}&cliente=${e.clienteId}&org=${orgId}`;
    const nombre = e.clienteNombre.split(' ')[0];
    const msg = tipo === 'entregado'
      ? `Hola ${nombre}, tu pedido fue entregado exitosamente. Podés verlo acá: ${trackingUrl} ✅`
      : `Hola ${nombre}, no pudimos completar la entrega hoy. Nos pondremos en contacto. Ver detalles: ${trackingUrl}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${G}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: F.sans }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <p style={{ fontSize: 16, color: '#dc2626', textAlign: 'center' }}>{error}</p>
    </div>
  );

  if (!ruta) return null;

  const pendientes  = ruta.entregas.filter(e => e.estado === 'pendiente').length;
  const entregados  = ruta.entregas.filter(e => e.estado === 'entregado').length;
  const total       = ruta.entregas.length;
  const pct         = total > 0 ? Math.round((entregados / total) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: F.sans, paddingBottom: 32 }}>

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: msg.type === 'err' ? '#dc2626' : G,
          color: '#fff', padding: '10px 20px', borderRadius: 24,
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          whiteSpace: 'nowrap',
        }}>{msg.text}</div>
      )}

      {/* Header */}
      <div style={{ background: G, padding: '20px 20px 16px', color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 4 }}>
          {ruta.dia || 'Ruta de hoy'} · {ruta.vehiculo || 'Vehículo'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          {ruta.zona || 'Ruta sin nombre'}
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 8, height: 8, marginBottom: 8 }}>
          <div style={{ background: '#fff', borderRadius: 8, height: 8, width: `${pct}%`, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.9 }}>
          <span>✅ {entregados} entregados</span>
          <span>⏳ {pendientes} pendientes</span>
        </div>

        {/* Salir a entregar — activa modo en ruta */}
        {!ruta.enRuta && pendientes > 0 && (
          <button
            onClick={salirAEntregar}
            style={{ marginTop: 12, width: '100%', background: '#fff', color: G, border: 'none', borderRadius: 10, padding: '12px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
            🚀 Salir a entregar
          </button>
        )}
        {ruta.enRuta && ruta.salidaEn && (
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.8, textAlign: 'center' }}>
            🛰 {gpsActive ? <span style={{color:'#16a34a',fontSize:11,fontWeight:700}}>GPS activo</span> : <span style={{color:'#9ca3af',fontSize:11}}>GPS inactivo</span>}
              · 🕐 En ruta desde {new Date(ruta.salidaEn).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Stop cards */}
      <div style={{ padding: '16px 16px 0' }}>
        {ruta.entregas.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6a6a68', fontSize: 14 }}>
            Esta ruta no tiene paradas.
          </div>
        )}

        {ruta.entregas.map((e, idx) => {
          const isEntregado  = e.estado === 'entregado';
          const isNoEnt      = e.estado === 'no_entregado';
          const isPendiente  = e.estado === 'pendiente';
          const isActive     = panel?.idx === idx;

          return (
            <div key={e.clienteId + idx} style={{
              background: '#fff',
              borderRadius: 14,
              marginBottom: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              border: isActive ? `2px solid ${G}` : isEntregado ? '2px solid #bbf7d0' : isNoEnt ? '2px solid #fecaca' : '2px solid transparent',
              opacity: isEntregado ? 0.75 : 1,
            }}>

              {/* Stop header */}
              <div style={{ padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a18' }}>{e.clienteNombre}</div>
                    {e.ciudad && <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>📍 {e.ciudad}</div>}
                    {(e.horarioDesde || e.horarioHasta) && (
                      <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>
                        🕐 {e.horarioDesde || '?'} - {e.horarioHasta || '?'}
                      </div>
                    )}
                    {isPendiente && ruta.enRuta && (() => {
                      const eta = calcETA(idx);
                      if (eta === null) return null;
                      return (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
                          ⏱ ETA: {eta <= 2 ? '¡Llegando!' : `~${eta} min`}
                        </div>
                      );
                    })()}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    background: isEntregado ? '#f0fdf4' : isNoEnt ? '#fef2f2' : '#fffbeb',
                    color: isEntregado ? G : isNoEnt ? '#dc2626' : '#92400e',
                    whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0,
                  }}>
                    {isEntregado ? '✅ Entregado' : isNoEnt ? '❌ No entregado' : '⏳ Pendiente'}
                  </span>
                </div>

                {/* Delivered evidence summary */}
                {isEntregado && (e.hora || e.notaEntrega) && (
                  <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 6, background: '#f0fdf4', borderRadius: 8, padding: '6px 10px' }}>
                    {e.hora && <span>🕐 {e.hora}  </span>}
                    {e.notaEntrega && <span>📝 {e.notaEntrega}</span>}
                  </div>
                )}
                {isNoEnt && e.notaEntrega && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, background: '#fef2f2', borderRadius: 8, padding: '6px 10px' }}>
                    ⚠️ {e.notaEntrega}
                  </div>
                )}
              </div>

              {/* Action buttons — only for pending stops */}
              {isPendiente && !isActive && (
                <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
                  <button
                    onClick={() => { setPanel({ idx, mode: 'entregado' }); setNota(''); setFoto(null); }}
                    style={{ flex: 1, background: G, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    ✅ Confirmar entrega
                  </button>
                  <button
                    onClick={() => notificar(e, ruta.enRuta ? calcETA(idx) : null)}
                    style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 14px', fontSize: 18, cursor: 'pointer' }}>
                    💬
                  </button>
                  <button
                    onClick={() => { setPanel({ idx, mode: 'no_entregado' }); setNota(''); }}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    ❌
                  </button>
                </div>
              )}

              {/* Confirmation panel */}
              {isActive && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid #f0f0ec` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: panel.mode === 'no_entregado' ? '#dc2626' : G, margin: '12px 0 8px' }}>
                    {panel.mode === 'no_entregado' ? '❌ Motivo de no entrega' : '✅ Confirmar entrega'}
                  </div>

                  {/* Note input */}
                  <textarea
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder={panel.mode === 'no_entregado' ? 'Ej: Local cerrado, no había nadie...' : 'Nota opcional...'}
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #e2e2de', borderRadius: 8,
                      padding: '10px 12px', fontSize: 14, fontFamily: F.sans,
                      resize: 'none', outline: 'none',
                    }}
                  />

                  {/* Photo capture — only for delivery */}
                  {panel.mode === 'entregado' && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="file" accept="image/*" capture="environment"
                        ref={fotoRef} style={{ display: 'none' }}
                        onChange={handleFoto}
                      />
                      {foto ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={foto} alt="Foto" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `2px solid ${G}` }} />
                          <button
                            onClick={() => setFoto(null)}
                            style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fotoRef.current?.click()}
                          style={{ background: '#f9f9f7', border: '1px dashed #d0d0cc', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#6a6a68', cursor: 'pointer', width: '100%' }}>
                          📷 Tomar foto (opcional)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Firma digital — solo para entrega */}
                  {panel.mode === 'entregado' && (
                    <div style={{ marginTop: 8 }}>
                      {showFirma ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                            Firma del cliente
                          </div>
                          <canvas
                            ref={canvasFirmaRef}
                            width={280} height={120}
                            onMouseDown={firmaStart} onMouseMove={firmaMove} onMouseUp={firmaEnd}
                            onTouchStart={firmaStart} onTouchMove={firmaMove} onTouchEnd={firmaEnd}
                            style={{ border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff',
                              touchAction: 'none', width: '100%', display: 'block', cursor: 'crosshair' }}
                          />
                          <button onClick={firmaLimpiar}
                            style={{ marginTop: 4, background: 'none', border: 'none', color: '#9ca3af',
                              fontSize: 12, cursor: 'pointer', padding: 0 }}>
                            Limpiar firma
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setShowFirma(true)}
                          style={{ background: 'none', border: '1px dashed #d1d5db',
                            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                            fontSize: 12, color: '#6b7280', width: '100%' }}>
                          ✍️ Agregar firma digital (opcional)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Confirm / Cancel buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => { setPanel(null); setNota(''); setFoto(null); }}
                      style={{ flex: 1, background: '#f0f0ec', color: '#4a4a48', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button
                      onClick={() => panel.mode === 'no_entregado' ? noEntregado(idx) : confirmar(idx)}
                      disabled={saving}
                      style={{
                        flex: 2, border: 'none', borderRadius: 10, padding: '12px',
                        fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                        background: panel.mode === 'no_entregado' ? '#dc2626' : G,
                        color: '#fff', opacity: saving ? 0.6 : 1,
                      }}>
                      {saving ? 'Guardando...' : panel.mode === 'no_entregado' ? '❌ Confirmar no entrega' : '✅ Confirmar entrega'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* All delivered banner */}
      {total > 0 && pendientes === 0 && (
        <div style={{ margin: '8px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: G }}>¡Ruta completada!</div>
          <div style={{ fontSize: 13, color: '#6a6a68', marginTop: 4 }}>Todas las paradas fueron procesadas.</div>
        </div>
      )}

    </div>
  );
}
