// src/components/VozPedido.jsx — "Pedido por voz" del portal B2B (estilo Zapia).
// ============================================================================
// El cliente toca el micrófono y dicta su pedido en lenguaje natural
// ("mandame 2 cajas de tomate, 5 de cebolla y una de aceite"). Transcribimos en
// vivo con la Web Speech API (nativa, sin subir audio), mandamos el texto a
// /api/voz-pedido, que lo interpreta contra SU lista de precios, y mostramos una
// revisión editable antes de agregar todo al carrito.
//
// Degradación elegante: si el navegador no tiene reconocimiento de voz (o el
// usuario no da permiso de micrófono), cae a un modo "escribir el pedido" que
// usa el MISMO endpoint. Así funciona en todos lados.
//
// Contrato:
//   <VozPedido open token isMobile onClose onConfirm={(lineas)=>...} />
//   onConfirm recibe [{ productId, qty }] listo para agregar al carrito.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';

const G     = '#059669';
const G_DK  = '#047857';
const SANS  = "'DM Sans','Inter',system-ui,sans-serif";
const GRAY  = '#6b6b66';
const Z_OVERLAY = 60;

const money = n => '$' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-UY');

// Reconocimiento de voz nativo del navegador (Chrome/Android/Edge; iOS 14.5+).
const SpeechRec = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export default function VozPedido({ open, token, isMobile, onClose, onConfirm }) {
  // fase: 'listening' | 'processing' | 'review' | 'error'
  const [fase, setFase]       = useState('listening');
  const [interim, setInterim] = useState('');       // texto provisional (mientras habla)
  const [texto, setTexto]     = useState('');        // texto final acumulado / editable
  const [manual, setManual]   = useState(false);     // modo escribir (sin voz)
  const [result, setResult]   = useState(null);      // { lineas, sinPrecio, sinMatch }
  const [qtys, setQtys]       = useState({});         // productId -> cantidad (editable en revisión)
  const [errMsg, setErrMsg]   = useState('');

  const recRef      = useRef(null);
  const finalRef    = useRef('');     // acumulado de tramos finales
  const stoppedRef  = useRef(false);  // el usuario tocó "Listo" (no reiniciar)

  // ── Arranque / limpieza al abrir-cerrar ──────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    // reset
    setFase('listening'); setInterim(''); setTexto(''); setResult(null);
    setQtys({}); setErrMsg(''); finalRef.current = ''; stoppedRef.current = false;
    setManual(!SpeechRec);   // sin API de voz → directo a escribir

    if (SpeechRec) startListening();
    return () => stopRec();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopRec = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try { rec.onend = null; rec.onerror = null; rec.onresult = null; rec.stop(); } catch { /* ya parado */ }
      recRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRec) { setManual(true); return; }
    stoppedRef.current = false;
    let rec;
    try { rec = new SpeechRec(); } catch { setManual(true); return; }
    rec.lang = 'es-AR';          // rioplatense — acento más cercano a Uruguay
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimTxt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk + ' ';
        else interimTxt += chunk;
      }
      setInterim(interimTxt);
      setTexto((finalRef.current + interimTxt).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Permiso de micrófono denegado → modo escribir.
        setManual(true); setFase('listening'); stopRec();
      } else if (e.error === 'no-speech') {
        // silencio: dejamos que onend reinicie
      }
    };
    rec.onend = () => {
      // Chrome corta la sesión sola cada tanto: si el usuario no tocó "Listo",
      // reiniciamos para que la escucha se sienta continua.
      if (!stoppedRef.current && recRef.current) {
        try { rec.start(); } catch { /* no se pudo reanudar */ }
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch { setManual(true); }
  }, [stopRec]);

  // ── Enviar el texto al intérprete ─────────────────────────────────────────
  const procesar = useCallback(async (txt) => {
    const clean = (txt || '').trim();
    if (!clean) { setErrMsg('No entendí nada. Probá de nuevo o escribí el pedido.'); return; }
    setFase('processing');
    try {
      const r = await fetch(`${window.location.origin}/api/voz-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ texto: clean }),
      });
      if (r.status === 401) { setErrMsg('Tu sesión expiró. Cerrá y volvé a entrar.'); setFase('error'); return; }
      if (r.status === 503) { setErrMsg('El asistente no está disponible en este momento.'); setFase('error'); return; }
      if (!r.ok) { setErrMsg('No pudimos procesar el pedido. Intentá de nuevo.'); setFase('error'); return; }
      const d = await r.json();
      const lineas = Array.isArray(d.lineas) ? d.lineas : [];
      if (lineas.length === 0 && (d.sinMatch || []).length === 0 && (d.sinPrecio || []).length === 0) {
        setErrMsg('No reconocí productos de tu catálogo. Probá nombrándolos como aparecen en la lista.');
        setFase('error'); return;
      }
      const initQ = {};
      lineas.forEach(l => { initQ[l.productId] = l.qty; });
      setQtys(initQ);
      setResult({ lineas, sinPrecio: d.sinPrecio || [], sinMatch: d.sinMatch || [] });
      setFase('review');
    } catch {
      setErrMsg('Falló la conexión. Revisá tu internet e intentá de nuevo.');
      setFase('error');
    }
  }, [token]);

  const handleListo = () => {
    stoppedRef.current = true;
    stopRec();
    procesar(texto);
  };

  // ── Revisión: editar cantidades ───────────────────────────────────────────
  const setQ = (id, v) => setQtys(q => {
    const n = { ...q };
    const val = Math.max(0, Math.floor(Number(v) || 0));
    if (val <= 0) delete n[id]; else n[id] = val;
    return n;
  });

  const confirmar = () => {
    const lineas = (result?.lineas || [])
      .map(l => ({ productId: l.productId, qty: qtys[l.productId] || 0 }))
      .filter(l => l.qty > 0);
    if (lineas.length === 0) { onClose(); return; }
    onConfirm(lineas);
  };

  if (!open) return null;

  const totalRevision = (result?.lineas || [])
    .reduce((s, l) => s + (qtys[l.productId] || 0) * (l.precio || 0), 0);
  const nLineas = (result?.lineas || []).filter(l => (qtys[l.productId] || 0) > 0).length;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Pedido por voz"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_OVERLAY,
        background: 'rgba(20,22,20,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        fontFamily: SANS,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', width: '100%', maxWidth: 460,
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          boxShadow: '0 12px 48px rgba(0,0,0,.28)',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: isMobile ? 'vzUp .22s cubic-bezier(.2,.8,.2,1)' : 'vzIn .18s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 12px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#ecfdf5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MicIcon size={17} color={G} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141614' }}>Pedí por voz</div>
            <div style={{ fontSize: 12, color: GRAY }}>Deciles qué necesitás, lo armamos por vos</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>✕</button>
        </div>

        <div style={{ padding: '4px 18px 18px', overflowY: 'auto' }}>

          {/* ---------- ESCUCHANDO / ESCRIBIR ---------- */}
          {fase === 'listening' && (
            <>
              {!manual ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 0 8px' }}>
                  <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <span style={ring(0)} /><span style={ring(0.6)} /><span style={ring(1.2)} />
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: G,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 6px 18px rgba(5,150,105,.4)' }}>
                      <MicIcon size={26} color="#fff" />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: G, marginBottom: 12 }}>Escuchando…</div>

                  <div style={{
                    width: '100%', minHeight: 64, borderRadius: 12, background: '#f7f7f4',
                    border: '1px solid #eee', padding: '12px 14px', fontSize: 15, lineHeight: 1.5,
                    color: texto ? '#141614' : GRAY,
                  }}>
                    {texto || 'Ej.: "Mandame 2 cajas de tomate, 5 de cebolla y una de aceite"'}
                    {interim && <span style={{ color: GRAY }}> </span>}
                  </div>

                  <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 14 }}>
                    <button onClick={() => { stopRec(); setManual(true); }} style={btnGhost}>Escribir</button>
                    <button onClick={handleListo} disabled={!texto.trim()} style={btnPrimary(!texto.trim())}>Listo</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#141614' }}>Escribí tu pedido</label>
                  <textarea
                    autoFocus value={texto} onChange={e => setTexto(e.target.value)}
                    placeholder='Ej.: 2 cajas de tomate, 5 de cebolla, 1 aceite'
                    rows={4}
                    style={{ width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12,
                      border: '1.5px solid #e0e0d8', fontSize: 15, fontFamily: SANS, resize: 'vertical',
                      boxSizing: 'border-box', outline: 'none', color: '#141614', background: '#f7f7f4' }}
                    onFocus={e => e.target.style.borderColor = G}
                    onBlur={e => e.target.style.borderColor = '#e0e0d8'}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    {SpeechRec && (
                      <button onClick={() => { setManual(false); finalRef.current = texto ? texto + ' ' : ''; startListening(); }} style={btnGhost}>
                        <MicIcon size={14} color={G} /> Usar voz
                      </button>
                    )}
                    <button onClick={() => procesar(texto)} disabled={!texto.trim()} style={btnPrimary(!texto.trim())}>Armar pedido</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------- PROCESANDO ---------- */}
          {fase === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '34px 0' }}>
              <div style={{ width: 34, height: 34, border: `3px solid ${G}`, borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'vzSpin .8s linear infinite', marginBottom: 14 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#141614' }}>Armando tu pedido…</div>
              <div style={{ fontSize: 12.5, color: GRAY, marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
                Buscando cada producto en tu lista de precios
              </div>
            </div>
          )}

          {/* ---------- REVISIÓN ---------- */}
          {fase === 'review' && result && (
            <div>
              {result.lineas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                  {result.lineas.map(l => {
                    const q = qtys[l.productId] || 0;
                    return (
                      <div key={l.productId} style={{ display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12, background: '#f7f7f4',
                        opacity: q > 0 ? 1 : 0.5 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#141614', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nombre}</div>
                          <div style={{ fontSize: 12, color: GRAY }}>{money(l.precio)} / {l.unidad}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2,
                          background: '#fff', border: '1px solid #e0e0d8', borderRadius: 20, padding: 2 }}>
                          <button onClick={() => setQ(l.productId, q - 1)} aria-label="Menos" style={btnStep}>−</button>
                          <input value={q} onChange={e => setQ(l.productId, e.target.value)}
                            inputMode="numeric" aria-label={`Cantidad de ${l.nombre}`}
                            style={{ width: 34, textAlign: 'center', border: 'none', outline: 'none',
                              fontSize: 14, fontWeight: 600, fontFamily: SANS, color: '#141614', background: 'transparent' }} />
                          <button onClick={() => setQ(l.productId, q + 1)} aria-label="Más" style={btnStep}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {result.sinPrecio.length > 0 && (
                <div style={noteBox('#fffbeb', '#fde68a')}>
                  <b style={{ color: '#92400e' }}>Sin precio en tu lista:</b>{' '}
                  <span style={{ color: '#92400e' }}>{result.sinPrecio.map(p => p.nombre).join(', ')}</span>
                  <div style={{ fontSize: 11.5, color: '#a16207', marginTop: 2 }}>Consultalo con tu proveedor — no se agregan al carrito.</div>
                </div>
              )}

              {result.sinMatch.length > 0 && (
                <div style={noteBox('#f7f7f4', '#e5e5e0')}>
                  <b style={{ color: '#57534e' }}>No los encontré:</b>{' '}
                  <span style={{ color: '#57534e' }}>{result.sinMatch.join(', ')}</span>
                  <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>Buscalos a mano en el catálogo.</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                <button onClick={() => { setResult(null); setFase('listening'); setManual(!SpeechRec); finalRef.current=''; setTexto(''); setInterim(''); if (SpeechRec) startListening(); }} style={btnGhost}>
                  Repetir
                </button>
                <button onClick={confirmar} disabled={nLineas === 0} style={btnPrimary(nLineas === 0)}>
                  Agregar {nLineas > 0 ? `(${money(totalRevision)})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* ---------- ERROR ---------- */}
          {fase === 'error' && (
            <div style={{ padding: '24px 4px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>🤔</div>
              <div style={{ fontSize: 14, color: '#141614', marginBottom: 16 }}>{errMsg}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={btnGhost}>Cerrar</button>
                <button onClick={() => { setFase('listening'); setManual(true); }} style={btnPrimary(false)}>Escribir pedido</button>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes vzSpin { to { transform: rotate(360deg); } }
        @keyframes vzUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes vzIn { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes vzPulse { 0% { transform: scale(.6); opacity: .55; } 100% { transform: scale(1.5); opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Sub-piezas ───────────────────────────────────────────────────────────────
function MicIcon({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const ring = (delay) => ({
  position: 'absolute', width: 64, height: 64, borderRadius: '50%',
  background: 'rgba(5,150,105,.35)', animation: `vzPulse 1.8s ease-out ${delay}s infinite`,
});
const btnClose = {
  width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f0f0ec',
  color: GRAY, fontSize: 14, cursor: 'pointer', flexShrink: 0, fontFamily: SANS,
};
const btnStep = {
  width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent',
  color: G_DK, fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1, fontFamily: SANS,
};
const btnGhost = {
  flex: '0 0 auto', padding: '11px 16px', borderRadius: 12, border: '1.5px solid #e0e0d8',
  background: '#fff', color: '#141614', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: SANS, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnPrimary = (disabled) => ({
  flex: 1, padding: '11px 16px', borderRadius: 12, border: 'none',
  background: disabled ? '#cbd5cf' : G, color: '#fff', fontSize: 14, fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer', fontFamily: SANS,
});
const noteBox = (bg, border) => ({
  marginTop: 8, padding: '9px 12px', borderRadius: 10, background: bg,
  border: `1px solid ${border}`, fontSize: 12.5, lineHeight: 1.4,
});
