import React, { useState, useEffect } from 'react';
import RolesManager from '../components/RolesManager.jsx';
import { TAX_BY_COUNTRY, getCountryOptions } from '../lib/taxConfig.js';
import UsersTab from './UsersTab.jsx';
import RolesTab from './config/RolesTab.jsx';
import { db, getOrgId, getAuthHeaders } from '../lib/constants.js';
import { T, Cap, Inp, Field } from '../lib/ui.jsx';
import ImageUpload from '../components/ImageUpload.jsx';

// ── Casilla de notificación de pedidos ───────────────────────────────────
// Edita organizations.order_notify_email: la casilla a la que llegan los mails
// de pedidos (del portal B2B y de la pestaña Ventas). PATCH directo vía RLS,
// igual que el resto de los ajustes de la org en este archivo.
function OrderNotifyEmailField({ orgId }) {
  const SB = import.meta.env.VITE_SUPABASE_URL;
  const [email, setEmail] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${SB}/rest/v1/organizations?id=eq.${encodeURIComponent(orgId)}&select=order_notify_email&limit=1`,
          { headers: getAuthHeaders() });
        const d = r.ok ? await r.json() : [];
        if (alive) setEmail(d?.[0]?.order_notify_email || '');
      } catch { /* deja vacío */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [orgId, SB]);

  const guardar = async () => {
    const val = email.trim();
    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { alert('Ingresá un email válido'); return; }
    setSaving(true); setSaved(false);
    try {
      await fetch(`${SB}/rest/v1/organizations?id=eq.${encodeURIComponent(orgId)}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ order_notify_email: val || null }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { alert('No se pudo guardar. Probá de nuevo.'); }
    setSaving(false);
  };

  return (
    <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px'}}>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Email de notificación de pedidos</div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2,marginBottom:10}}>A esta casilla llegan los pedidos (con la orden en PDF), tanto del portal B2B como de la pestaña Ventas.</div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input
          type="email"
          value={email}
          disabled={!loaded}
          onChange={e=>setEmail(e.target.value)}
          placeholder={loaded?'pedidos@tuempresa.com':'Cargando…'}
          style={{flex:1,padding:'8px 11px',borderRadius:6,border:'1px solid #e8e4de',fontSize:14,background:'#fafaf7',color:'#1a1a18'}}/>
        <button onClick={guardar} disabled={saving||!loaded}
          style={{padding:'8px 18px',background:'#059669',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:600,cursor:saving?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:saving?.6:1}}>
          {saving?'Guardando…':saved?'Guardado ✓':'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ── Control de inventario (self-service) ──────────────────────────────────
// Toggle "Controlo inventario" ON/OFF. Edita organizations.no_controla_stock vía
// api/stock-control.js, que además backfillea los productos existentes:
//   • OFF (no controla): productos en 0/null → 99999 (nunca bloquean pedidos)
//   • ON  (sí controla): productos en 99999  → 0     (para cargar stock real)
// Genérico multi-tenant. Reemplaza el SQL manual del flag por un click del admin.
function StockControlCard() {
  const [controla, setControla] = React.useState(null); // null=cargando
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/stock-control?action=status', { headers: getAuthHeaders() });
        const d = r.ok ? await r.json() : null;
        if (alive && d) setControla(d.controla === true);
      } catch { /* deja en cargando */ }
    })();
    return () => { alive = false; };
  }, []);

  const cambiar = async (nuevo) => {
    if (busy) return;
    // Confirmación solo al PRENDER el control: limpia los stocks altos a 0.
    if (nuevo === true && !window.confirm(
      'Vas a activar el control de inventario.\n\n' +
      'Los productos sin stock cargado quedarán en 0 y deberás cargar las cantidades reales. ' +
      'Los pedidos se bloquearán cuando un producto esté en 0.\n\n¿Continuar?'
    )) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/stock-control?action=set', {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ controla: nuevo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'No se pudo guardar');
      setControla(nuevo);
      setMsg(d.ajustados > 0 ? `Listo · ${d.ajustados} producto${d.ajustados === 1 ? '' : 's'} ajustado${d.ajustados === 1 ? '' : 's'}` : 'Guardado ✓');
      setTimeout(() => setMsg(''), 3500);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <div>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Controlo inventario</div>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2,maxWidth:520}}>
            Si está <b>activado</b>, Pazque descuenta stock y bloquea pedidos cuando un producto se agota (necesitás cargar las cantidades reales).
            Si está <b>desactivado</b>, los pedidos nunca se bloquean por falta de stock (ideal si todavía no cargaste tu inventario).
          </div>
        </div>
        <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:controla===null||busy?'default':'pointer',flexShrink:0,opacity:controla===null?.4:1}}>
          <input type="checkbox" checked={controla===true} disabled={controla===null||busy}
            onChange={e=>cambiar(e.target.checked)} style={{opacity:0,width:0,height:0}}/>
          <span style={{position:'absolute',inset:0,borderRadius:24,transition:'.2s',
            background:controla===true?'#059669':'#cfcdc7'}}/>
          <span style={{position:'absolute',top:3,left:controla===true?23:3,width:18,height:18,borderRadius:'50%',
            background:'#fff',transition:'.2s',boxShadow:'0 1px 2px rgba(0,0,0,.2)'}}/>
        </label>
      </div>
      {(err||msg)&&(
        <div style={{marginTop:10,fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:600,color:err?'#dc2626':'#059669'}}>
          {err||msg}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de integración con SimpliRoute (self-service) ─────────────────
// El distribuidor pega su API token de SimpliRoute. Pazque lo valida, lo guarda
// server-side (api/simpliroute) y registra el webhook de entregas. Una vez
// conectado, los pedidos preparados se envían solos como "visitas" y cuando el
// repartidor marca entregado vuelve el estado al portal del cliente. Sin código.
function SimpliRouteCard() {
  const [st, setSt] = React.useState(null);     // { connected, enabled, account }
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch('/api/simpliroute?action=status', { headers: getAuthHeaders() });
      const d = r.ok ? await r.json() : { connected: false };
      setSt(d);
    } catch { setSt({ connected: false }); }
    setLoading(false);
  }, []);
  React.useEffect(() => { cargar(); }, [cargar]);

  const conectar = async () => {
    if (!token.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/simpliroute?action=connect', {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'No se pudo conectar');
      setToken(''); setSt({ connected: true, enabled: d.enabled, account: d.account });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const toggle = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/simpliroute?action=toggle', {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled: !st.enabled }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error');
      setSt(s => ({ ...s, enabled: d.enabled }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const desconectar = async () => {
    if (!window.confirm('¿Desconectar SimpliRoute? Los pedidos dejarán de enviarse automáticamente.')) return;
    setBusy(true); setErr('');
    try {
      await fetch('/api/simpliroute?action=disconnect', { method: 'POST', headers: getAuthHeaders() });
      setSt({ connected: false });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const G = '#059669';
  return (
    <div style={{ border: '1px solid #e2e2de', borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🚚</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'DM Sans,Inter,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>SimpliRoute</div>
          <div style={{ fontFamily: 'DM Sans,Inter,sans-serif', fontSize: 12, color: '#6a6a68', marginTop: 2 }}>
            Enviá tus pedidos a ruta automáticamente y seguí la entrega en tiempo real.
          </div>
        </div>
        {st?.connected && (
          <span style={{ background: '#f0fdf4', color: G, fontSize: 11, fontWeight: 700, padding: '4px 11px',
            borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conectado</span>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#9a9a98', marginTop: 12 }}>Cargando…</div>
      ) : st?.connected ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0ec' }}>
          {st.account && <div style={{ fontSize: 12, color: '#6a6a68', marginBottom: 10 }}>Cuenta: <b>{st.account}</b></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#1a1a18', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!st.enabled} disabled={busy} onChange={toggle} />
            Enviar pedidos a SimpliRoute automáticamente al prepararlos
          </label>
          <button onClick={desconectar} disabled={busy} style={{ marginTop: 12, background: 'none', border: 'none',
            color: '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Desconectar
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0ec' }}>
          <div style={{ fontSize: 12, color: '#6a6a68', marginBottom: 8 }}>
            Pegá tu API token de SimpliRoute (lo encontrás en tu perfil → Información).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="API token"
              style={{ flex: 1, padding: '8px 11px', borderRadius: 6, border: '1px solid #e8e4de', fontSize: 13, background: '#fafaf7', color: '#1a1a18' }} />
            <button onClick={conectar} disabled={busy || !token.trim()}
              style={{ padding: '8px 18px', background: G, color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// ── Tarjeta de conexión de WhatsApp (Embedded Signup, self-service) ───────
// El distribuidor conecta su PROPIO número de WhatsApp con un click (flujo de
// Meta). Una vez conectado, los broadcasts y el código de acceso (OTP) salen de
// SU número, con su foto de perfil (white-label). Modelo: SimpliRouteCard.
//
// Necesita dos datos públicos de la app Meta de Pazque:
//   - App ID (hardcodeado como default, overridable por VITE_WA_APP_ID)
//   - config_id del Embedded Signup (VITE_WA_ES_CONFIG_ID) — lo crea Pazque en Meta.
// Si falta el config_id, la tarjeta degrada con gracia (botón deshabilitado).
const WA_APP_ID   = import.meta.env.VITE_WA_APP_ID || '1031176906086563';
const WA_ES_CONFIG_ID = import.meta.env.VITE_WA_ES_CONFIG_ID || '';

// Carga el SDK de Facebook una sola vez y lo inicializa con el App ID de Pazque.
let _fbSdkPromise = null;
function loadFbSdk() {
  if (_fbSdkPromise) return _fbSdkPromise;
  _fbSdkPromise = new Promise((resolve, reject) => {
    if (window.FB) { resolve(window.FB); return; }
    window.fbAsyncInit = function () {
      window.FB.init({ appId: WA_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('No se pudo cargar el conector de Meta.'));
    document.body.appendChild(s);
  });
  return _fbSdkPromise;
}

function WhatsAppCard() {
  const [st, setSt] = React.useState(null);   // { connected, number, name, template_status, otp_status }
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Datos que llegan por el evento de Embedded Signup (waba_id + phone_number_id).
  const signupRef = React.useRef(null);

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp-connect?action=status', { headers: getAuthHeaders() });
      const d = r.ok ? await r.json() : { connected: false };
      setSt(d);
    } catch { setSt({ connected: false }); }
    setLoading(false);
  }, []);
  React.useEffect(() => { cargar(); }, [cargar]);

  // Escucha el postMessage de Meta durante el Embedded Signup para capturar los IDs.
  React.useEffect(() => {
    const onMsg = (event) => {
      // Solo aceptamos mensajes que vengan de un origen de Facebook.
      let host = '';
      try { host = new URL(event.origin).hostname; } catch { return; }
      if (!host.endsWith('facebook.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          if (data.data.phone_number_id && data.data.waba_id) {
            signupRef.current = { phone_number_id: data.data.phone_number_id, waba_id: data.data.waba_id };
          }
        }
      } catch { /* mensajes ajenos al flujo */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const conectar = async () => {
    if (busy) return;
    setErr('');
    if (!WA_ES_CONFIG_ID) { setErr('La conexión todavía no está habilitada por Pazque.'); return; }
    setBusy(true);
    try {
      const FB = await loadFbSdk();
      signupRef.current = null;
      const response = await new Promise((resolve) => {
        FB.login(resolve, {
          config_id: WA_ES_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
        });
      });
      const code = response?.authResponse?.code;
      const ids = signupRef.current;
      if (!code || !ids) { setErr('Conexión cancelada. Probá de nuevo.'); setBusy(false); return; }

      const r = await fetch('/api/whatsapp-connect?action=connect', {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ code, waba_id: ids.waba_id, phone_number_id: ids.phone_number_id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'No se pudo conectar.');
      // Las plantillas se crean solas al conectar (turnkey); usamos el estado que vuelve.
      setSt({ connected: true, number: d.number, name: d.name, template_status: d.template_status || null, otp_status: d.otp_status || null });
    } catch (e) { setErr(e.message || 'No se pudo conectar.'); }
    setBusy(false);
  };

  const crearPlantilla = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/whatsapp-connect?action=create-template', {
        method: 'POST', headers: getAuthHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'No se pudo crear la plantilla.');
      setSt(s => ({ ...s, template_status: d.template_status, otp_status: d.otp_status }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const desconectar = async () => {
    if (!window.confirm('¿Desconectar WhatsApp? Los mensajes volverán a salir desde el número de Pazque.')) return;
    setBusy(true); setErr('');
    try {
      await fetch('/api/whatsapp-connect?action=disconnect', { method: 'POST', headers: getAuthHeaders() });
      setSt({ connected: false });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const G = '#16a34a';
  // Badge legible para el estado de una plantilla.
  const tplBadge = (status) => {
    if (status === 'APPROVED') return { t: 'Aprobada ✓', bg: '#f0fdf4', c: '#16a34a' };
    if (status === 'REJECTED') return { t: 'Rechazada', bg: '#fef2f2', c: '#dc2626' };
    if (status === 'PENDING')  return { t: 'En revisión ⏳', bg: '#fffbeb', c: '#d97706' };
    return { t: 'Sin crear', bg: '#f0f0ec', c: '#6a6a68' };
  };
  const bB = tplBadge(st?.template_status), bO = tplBadge(st?.otp_status);

  return (
    <div style={{ border: '1px solid #e2e2de', borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>📱</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'DM Sans,Inter,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>WhatsApp Business</div>
          <div style={{ fontFamily: 'DM Sans,Inter,sans-serif', fontSize: 12, color: '#6a6a68', marginTop: 2 }}>
            Conectá tu número para que los avisos y el código de acceso de tus clientes salgan desde tu propio WhatsApp.
          </div>
        </div>
        {st?.connected && (
          <span style={{ background: '#f0fdf4', color: G, fontSize: 11, fontWeight: 700, padding: '4px 11px',
            borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conectado</span>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#9a9a98', marginTop: 12 }}>Cargando…</div>
      ) : st?.connected ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0ec' }}>
          <div style={{ fontSize: 12, color: '#6a6a68', marginBottom: 12 }}>
            Número: <b>{st.number || '—'}</b>{st.name ? <> · {st.name}</> : null}
          </div>

          {/* Explicación: por qué hacen falta las plantillas (WhatsApp las exige) */}
          <div style={{ background: '#f7f6f3', border: '1px solid #e8e4de', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#6a6a68', lineHeight: 1.5 }}>
            WhatsApp exige <b>plantillas aprobadas</b> para poder enviar mensajes. Las creamos automáticamente al conectar tu número — Meta las revisa en unos minutos. Vas a poder enviar avisos y códigos de acceso recién cuando figuren <b>Aprobadas</b>.
          </div>

          {/* Estado de las plantillas (necesarias para que Meta deje enviar) */}
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: '#1a1a18' }}>Plantilla de avisos (broadcasts)</span>
              <span style={{ background: bB.bg, color: bB.c, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{bB.t}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: '#1a1a18' }}>Plantilla de código de acceso</span>
              <span style={{ background: bO.bg, color: bO.c, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{bO.t}</span>
            </div>
          </div>

          {(!st.template_status || !st.otp_status || st.template_status === 'REJECTED' || st.otp_status === 'REJECTED') && (
            <>
              <button onClick={crearPlantilla} disabled={busy}
                style={{ padding: '8px 18px', background: G, color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Creando…' : 'Reintentar plantillas'}
              </button>
              <div style={{ fontSize: 11.5, color: '#9a9a98', marginTop: 6 }}>
                Si alguna plantilla quedó sin crear o fue rechazada, tocá acá para volver a intentar.
              </div>
            </>
          )}
          {(st.template_status === 'PENDING' || st.otp_status === 'PENDING') && (
            <div style={{ fontSize: 11.5, color: '#9a9a98', marginTop: 8 }}>
              Meta revisa las plantillas (suele tardar unos minutos). Te avisamos acá cuando estén aprobadas.
            </div>
          )}

          <button onClick={desconectar} disabled={busy} style={{ display: 'block', marginTop: 12, background: 'none', border: 'none',
            color: '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Desconectar
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0ec' }}>
          {WA_ES_CONFIG_ID ? (
            <button onClick={conectar} disabled={busy}
              style={{ padding: '8px 18px', background: G, color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Conectando…' : 'Conectar WhatsApp'}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: '#9a9a98', fontStyle: 'italic' }}>
              La conexión de WhatsApp todavía no está habilitada por Pazque. Muy pronto.
            </div>
          )}
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// ── Panel de dominio CNAME ───────────────────────────────────────────────
// ── Gestión de zonas del depósito ────────────────────────────────────────
function ZonasDeposito({ orgId }) {
  const [zonas, setZonas] = React.useState([]);
  const [editZona, setEditZona] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const SB = import.meta.env.VITE_SUPABASE_URL;

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/deposit_zones?org_id=eq.${orgId}&active=eq.true&order=orden.asc`,
        { headers: getAuthHeaders() });
      const data = await r.json();
      setZonas(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  }, [orgId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!editZona?.nombre?.trim()) return;
    setSaving(true);
    try {
      const body = { org_id: orgId, nombre: editZona.nombre, orden: editZona.orden || 0, descripcion: editZona.descripcion || '', categorias: editZona.categorias || [] };
      if (editZona.id) {
        await fetch(`${SB}/rest/v1/deposit_zones?id=eq.${editZona.id}`, { method:'PATCH', headers:getAuthHeaders({Prefer:'return=minimal'}), body:JSON.stringify(body) });
      } else {
        await fetch(`${SB}/rest/v1/deposit_zones`, { method:'POST', headers:getAuthHeaders({Prefer:'return=minimal'}), body:JSON.stringify(body) });
      }
      setEditZona(null); setMsg('Zona guardada'); setTimeout(()=>setMsg(''),3000); await cargar();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const eliminar = async (id) => {
    await fetch(`${SB}/rest/v1/deposit_zones?id=eq.${id}`, { method:'PATCH', headers:getAuthHeaders({Prefer:'return=minimal'}), body:JSON.stringify({active:false}) });
    await cargar();
  };

  return (
    <div style={{display:'grid',gap:20,maxWidth:640}}>
      <div>
        <h3 style={{fontSize:16,fontWeight:600,margin:'0 0 6px'}}>Zonas del depósito</h3>
        <p style={{fontSize:13,color:'#666',margin:0}}>Definí las zonas físicas del depósito y asignales categorías de productos. Esto permite ordenar el picking por recorrido óptimo.</p>
      </div>
      {msg && <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#166534',fontWeight:600}}>{msg}</div>}
      <div style={{display:'grid',gap:8}}>
        {zonas.map(z => (
          <div key={z.id} style={{display:'flex',alignItems:'center',gap:12,background:'#f9f9f7',border:'1px solid #e5e5e0',borderRadius:8,padding:'12px 14px'}}>
            <div style={{width:32,height:32,background:'#059669',color:'#fff',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{z.orden}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{z.nombre}</div>
              {z.descripcion && <div style={{fontSize:11,color:'#9a9a98'}}>{z.descripcion}</div>}
              {z.categorias?.length > 0 && <div style={{fontSize:11,color:'#059669',marginTop:2}}>{z.categorias.join(', ')}</div>}
            </div>
            <button onClick={()=>setEditZona({...z})} style={{background:'none',border:'1px solid #e5e5e0',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'#4a4a48'}}>Editar</button>
            <button onClick={()=>eliminar(z.id)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:16,padding:'0 4px'}}>×</button>
          </div>
        ))}
        <button onClick={()=>setEditZona({nombre:'',orden:zonas.length+1,descripcion:'',categorias:[]})}
          style={{background:'none',border:'1px dashed #d0d0cc',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer',color:'#6a6a68'}}>
          + Nueva zona
        </button>
      </div>
      {editZona && (
        <div style={{background:'#f9f9f7',border:'1px solid #e5e5e0',borderRadius:10,padding:18,display:'grid',gap:12}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{editZona.id ? 'Editar zona' : 'Nueva zona'}</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>Nombre</div>
              <input value={editZona.nombre} onChange={e=>setEditZona(z=>({...z,nombre:e.target.value}))}
                placeholder="Zona A" style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>Orden</div>
              <input type="number" value={editZona.orden} onChange={e=>setEditZona(z=>({...z,orden:+e.target.value}))}
                style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Descripción</div>
            <input value={editZona.descripcion||''} onChange={e=>setEditZona(z=>({...z,descripcion:e.target.value}))}
              placeholder="Ej: Sector refrigerados, fondo izquierda..." style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Categorías de productos (separadas por coma)</div>
            <input value={(editZona.categorias||[]).join(', ')} onChange={e=>setEditZona(z=>({...z,categorias:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))}
              placeholder="CHOCOLATES, PASTELERÍA, ADITIVOS..." style={{width:'100%',border:'1px solid #e5e5e0',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={guardar} disabled={saving}
              style={{flex:1,background:'#059669',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>
              {saving?'Guardando...':'Guardar zona'}
            </button>
            <button onClick={()=>setEditZona(null)}
              style={{background:'#f0f0ec',color:'#4a4a48',border:'none',borderRadius:8,padding:'10px 16px',fontSize:13,cursor:'pointer'}}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DominioCNAMEPanel({ orgId }) {
  const [dominios, setDominios] = React.useState([]);
  const [nuevo, setNuevo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const SB = import.meta.env.VITE_SUPABASE_URL;

  const cargar = React.useCallback(async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/domain_orgs?org_id=eq.${orgId}&select=id,domain,active,created_at&order=created_at.desc`,
        { headers: getAuthHeaders() });
      const data = await r.json();
      setDominios(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  }, [orgId]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setSaving(true);
    try {
      await fetch(`${SB}/rest/v1/domain_orgs`, {
        method: 'POST',
        headers: getAuthHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ domain: nuevo.trim().toLowerCase(), org_id: orgId, active: true }),
      });
      setNuevo('');
      setMsg('Dominio registrado. Contactá a Pazque para activarlo en Vercel.');
      setTimeout(() => setMsg(''), 5000);
      await cargar();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{display:"grid",gap:12}}>
      {msg && <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#166534",fontWeight:600}}>{msg}</div>}
      <div>
        <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>Tus dominios registrados</div>
        {dominios.length === 0 ? (
          <div style={{fontSize:13,color:"#9a9a98",fontStyle:"italic"}}>Ningún dominio registrado todavía.</div>
        ) : (
          <div style={{display:"grid",gap:6}}>
            {dominios.map(d => (
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f9f9f7",border:"1px solid #e5e5e0",borderRadius:8,padding:"10px 14px"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a1a18",fontFamily:"monospace"}}>{d.domain}</div>
                  <div style={{fontSize:11,color:"#9a9a98",marginTop:2}}>{d.active ? "✓ Activo" : "⏳ Pendiente activación"}</div>
                </div>
                <span style={{fontSize:11,background:d.active?"#d1fae5":"#fef3c7",color:d.active?"#065f46":"#92400e",borderRadius:20,padding:"2px 10px",fontWeight:600}}>
                  {d.active ? "Activo" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          placeholder="pedidos.tuempresa.com"
          style={{flex:1,border:"1px solid #e5e5e0",borderRadius:8,padding:"10px 14px",fontSize:13,fontFamily:"monospace",outline:"none"}}
          onKeyDown={e => e.key === 'Enter' && agregar()}
        />
        <button
          onClick={agregar}
          disabled={saving || !nuevo.trim()}
          style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:saving?"default":"pointer",opacity:saving?0.6:1}}>
          {saving ? "Guardando..." : "Registrar"}
        </button>
      </div>
    </div>
  );
}

// Role-based access
import { useRole } from '../hooks/useRole.ts';

export default function ConfigInline({
  session,
  suppliers, setSuppliers,
  settingsTab, setSettingsTab,
  emailCfg, setEmailCfg,
  enriched, sendAlertEmail, EmailSettings,
  totalLead, tfCols,
  brandCfg={}, setBrandCfg,
  integrationsOnly=false
}) {
  const { isAdmin } = useRole();
  // ── Brand config state — top level, no IIFE ──────────────────────────────
  const [localBrand, setLocalBrand] = useState({
    name:       brandCfg.name       || '',
    logoUrl:    brandCfg.logoUrl    || '',
    color:      brandCfg.color      || '#059669',
    ownerPhone: brandCfg.ownerPhone || '',
    rut:        brandCfg.rut        || '',
    direccion:  brandCfg.direccion  || '',
    email:      brandCfg.email      || '',
    web:        brandCfg.web        || '',
  });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved,  setBrandSaved]  = useState(false);

  // Sync localBrand when parent brandCfg changes (e.g. after initial DB load)
  useEffect(() => {
    setLocalBrand({
      name:       brandCfg.name       || '',
      logoUrl:    brandCfg.logoUrl    || '',
      color:      brandCfg.color      || '#059669',
      ownerPhone: brandCfg.ownerPhone || '',
      rut:        brandCfg.rut        || '',
      direccion:  brandCfg.direccion  || '',
      email:      brandCfg.email      || '',
      web:        brandCfg.web        || '',
    });
  }, [brandCfg.name, brandCfg.logoUrl, brandCfg.color, brandCfg.rut]);

  const saveBrand = async () => {
    setBrandSaving(true);
    try {
      await db.upsert('app_config',
        { key: 'brandcfg', value: localBrand, org_id: getOrgId(), updated_at: new Date().toISOString() },
        'key,org_id'
      );
      setBrandCfg(localBrand);
      localStorage.setItem('aryes-brand', JSON.stringify({ ...localBrand, _org: getOrgId() }));
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 3000);
    } catch(e) {
      console.warn('[Stock] brand save failed', e);
    } finally {
      setBrandSaving(false);
    }
  };

  const inp2 = {
    padding: '8px 12px', border: '1px solid #e2e2de', borderRadius: 6,
    fontSize: 13, fontFamily: 'Inter,sans-serif', width: '100%', boxSizing: 'border-box',
  };

  return (
    <>
      <div className="au" style={{display:"grid",gap:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
          <div>
            <Cap style={{color:T.green}}>{integrationsOnly?"Conexiones":"Sistema"}</Cap>
            <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>{integrationsOnly?"Integraciones":"Configuración"}</h1>
          </div>
        </div>

        <div>
          {/* Sub-tab bar */}
          {!integrationsOnly && <div style={{display:"flex",gap:8,borderRadius:6,overflowX:"auto",marginBottom:24,scrollbarWidth:"none"}}>
            {[{id:"usuarios",l:"Usuarios"},{id:"roles",l:"Roles"},{id:"marca",l:"Marca"},{id:"facturacion_cfg",l:"Facturación DGI"},{id:"freight",l:"Flete"},{id:"email",l:"Emails"},{id:"integraciones",l:"Integraciones"},{id:"dominio",l:"Dominio"},{id:"zonas",l:"Zonas depósito"},{id:"portal",l:"Portal B2B"},{id:"datos",l:"Datos"},{id:"plan",l:"Plan"}].map(st=>(
              <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                style={{flex:"0 0 auto",padding:"10px 16px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.sans,fontSize:12,fontWeight:600,
                  background:settingsTab===st.id?T.green:"#fff",color:settingsTab===st.id?"#fff":T.textSm,borderRadius:6,border:settingsTab===st.id?"none":"1px solid "+T.border}}>
                {st.l}
              </button>
            ))}
          </div>}

          {/* ── USUARIOS ─────────────────────────────────────────────────── */}
          {settingsTab==="usuarios" && (
            <UsersTab session={session} brandCfg={brandCfg} />
          )}

          {settingsTab==="roles" && (
            <RolesManager brandCfg={brandCfg} setBrandCfg={setBrandCfg} />
          )}
          {settingsTab==="marca" && (
            <div style={{maxWidth:560}}>
              <p style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginBottom:20,lineHeight:1.6}}>
                Estos datos aparecen en el sidebar y reemplazan el logo por defecto.
                Se guardan en la base de datos y aplican a todos los usuarios al próximo login.
              </p>
              <div style={{display:'grid',gap:16}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Nombre de la empresa</label>
                  <input
                    value={localBrand.name}
                    onChange={e=>setLocalBrand(b=>({...b,name:e.target.value}))}
                    placeholder='Ej: Mi Distribuidora S.A.'
                    style={inp2}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Aparece debajo del logo en el sidebar</div>
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Logo de la empresa</label>
                  <ImageUpload
                    value={localBrand.logoUrl}
                    onChange={url=>setLocalBrand(b=>({...b,logoUrl:url}))}
                    orgId={getOrgId()}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Arrastrá o tocá para subir tu logo (JPG, PNG, WebP). Si está vacío se usa el logo por defecto.</div>
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Color principal</label>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <input type='color'
                      value={localBrand.color||'#059669'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{width:48,height:36,padding:2,border:'1px solid #e2e2de',borderRadius:6,cursor:'pointer'}}
                    />
                    <input
                      value={localBrand.color||'#059669'}
                      onChange={e=>setLocalBrand(b=>({...b,color:e.target.value}))}
                      style={{...inp2,width:120}}
                    />
                    <div style={{padding:'6px 14px',borderRadius:6,background:localBrand.color||'#059669',color:'#fff',fontSize:12,fontWeight:600}}>
                      Vista previa
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Teléfono para resumen WhatsApp</label>
                  <input
                    value={localBrand.ownerPhone||''}
                    onChange={e=>setLocalBrand(b=>({...b,ownerPhone:e.target.value}))}
                    placeholder='Ej: 59899123456 (con código de país)'
                    style={inp2}
                  />
                  <div style={{fontSize:11,color:'#9a9a98',marginTop:4}}>Tu número de WhatsApp. El resumen diario se enviará directo a este número desde el Dashboard.</div>
                </div>

                {/* Datos fiscales para documentos */}
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#166534',marginBottom:12}}>
                    📄 Datos para remitos y facturas
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>RUT de la empresa</label>
                      <input
                        value={localBrand.rut||''}
                        onChange={e=>setLocalBrand(b=>({...b,rut:e.target.value}))}
                        placeholder='Ej: 21234567890'
                        style={inp2}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Email de la empresa</label>
                      <input
                        value={localBrand.email||''}
                        onChange={e=>setLocalBrand(b=>({...b,email:e.target.value}))}
                        placeholder='contacto@empresa.com'
                        style={inp2}
                      />
                    </div>
                    <div style={{gridColumn:'1/-1'}}>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Dirección</label>
                      <input
                        value={localBrand.direccion||''}
                        onChange={e=>setLocalBrand(b=>({...b,direccion:e.target.value}))}
                        placeholder='Ej: Av. 18 de Julio 1234, Montevideo'
                        style={inp2}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Sitio web</label>
                      <input
                        value={localBrand.web||''}
                        onChange={e=>setLocalBrand(b=>({...b,web:e.target.value}))}
                        placeholder='www.empresa.com'
                        style={inp2}
                      />
                    </div>
                  </div>
                </div>

                <div style={{paddingTop:8,borderTop:'1px solid #e2e2de',display:'flex',alignItems:'center',gap:12}}>
                  
              {/* ── Impuesto sobre ventas (multi-país) ────────────────────── */}
              {(()=>{
                // TAX_PRESETS from taxConfig.js — 18 LATAM countries verified from official sources
                const TAX_PRESETS = Object.fromEntries(
                  Object.entries(TAX_BY_COUNTRY).map(([code, cfg]) => [code, {
                    name: cfg.taxName,
                    rates: cfg.rates.map(r => ({ v: r.value, l: r.label })),
                    default: cfg.defaultRate,
                  }])
                );
                const country=brandCfg.tax_country||'UY';
                const preset=TAX_PRESETS[country]||TAX_PRESETS.OTHER;
                const taxName=brandCfg.tax_name||preset.name;
                const taxRate=brandCfg.iva_default!=null?brandCfg.iva_default:preset.default;
                const isCustomRate=!preset.rates.some(r=>r.v===taxRate);
                return (
                  <div style={{marginTop:16,background:"#f9f9f7",borderRadius:10,padding:14,border:"1px solid #e2e2de"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1a1a18",marginBottom:10}}>Impuesto sobre ventas</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>País</label>
                        <select value={country} onChange={e=>{const c=e.target.value;const p=TAX_PRESETS[c]||TAX_PRESETS.OTHER;setBrandCfg(prev=>({...prev,tax_country:c,tax_name:p.name,iva_default:p.default}));}}
                          style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}}>
                          {getCountryOptions().map(c => (
                            <option key={c.code} value={c.code}>{c.name} ({c.taxName} {c.defaultRate}%)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>Nombre del impuesto</label>
                        <input value={taxName} onChange={e=>setBrandCfg(p=>({...p,tax_name:e.target.value}))}
                          style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}} placeholder="IVA, IGV, Sales Tax..."/>
                      </div>
                    </div>
                    <div style={{marginTop:10}}>
                      <label style={{fontSize:11,fontWeight:600,color:"#6a6a68",display:"block",marginBottom:3}}>Tasa por defecto</label>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <select value={isCustomRate?'custom':taxRate} onChange={e=>{const v=e.target.value;if(v!=='custom')setBrandCfg(p=>({...p,iva_default:+v}));}}
                          style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff"}}>
                          {preset.rates.map(r=><option key={r.v} value={r.v}>{taxName} {r.l}</option>)}
                          <option value="custom">Personalizado</option>
                        </select>
                        {isCustomRate&&<input type="number" min={0} max={99} step={0.5} value={taxRate} onChange={e=>setBrandCfg(p=>({...p,iva_default:+e.target.value}))}
                          style={{width:70,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e2de",fontSize:12,background:"#fff",textAlign:"center"}}/>}
                        {isCustomRate&&<span style={{fontSize:11,color:"#6a6a68"}}>%</span>}
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#9a9a98",marginTop:6}}>Se usa como valor por defecto al crear productos. Cada producto puede tener su propia tasa.</div>
                  </div>
                );
              })()}
              <button onClick={saveBrand} disabled={brandSaving}
                    style={{padding:'9px 24px',background:brandSaving?'#9ca3af':(localBrand.color||'#059669'),color:'#fff',border:'none',borderRadius:8,cursor:brandSaving?'not-allowed':'pointer',fontWeight:600,fontSize:13}}>
                    {brandSaving?'Guardando…':'Guardar marca'}
                  </button>
                  {brandSaved && <span style={{color:'#059669',fontSize:13,fontWeight:600}}>✓ Guardado</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── FLETE ─────────────────────────────────────────────────────── */}
          {settingsTab==="freight" && (
            <div style={{maxWidth:680}}>
              <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginBottom:16,lineHeight:1.6}}>
                Estos valores determinan el ROP (punto de pedido). Actualizalos cuando cambien las condiciones logísticas.
              </p>
              {suppliers.map(sup=>(
                <div key={sup.id} style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                  <div style={{padding:"12px 18px",background:T.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap>
                    <Cap>Total: {totalLead(sup)} días</Cap>
                  </div>
                  <div style={{padding:"14px 18px",background:T.card}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                      {[["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]].map(([k,l])=>(
                        <Field key={k} label={l}>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                            <Inp type="number" min="0" value={sup.times[k]}
                              onChange={e=>setSuppliers(ss=>ss.map(s=>s.id===sup.id?{...s,times:{...s.times,[k]:Math.max(0,+e.target.value)}}:s))}
                              style={{textAlign:"center"}}
                            />
                            <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
                          </div>
                        </Field>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginTop:12}}>
                      {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EMAIL ─────────────────────────────────────────────────────── */}
          {settingsTab==="email" && (
            <EmailSettings
              cfg={emailCfg}
              setCfg={setEmailCfg}
              enriched={enriched}
              onTestSend={()=>{}}
              onManualSend={(prods)=>sendAlertEmail(prods,emailCfg)}
            />
          )}

          {/* ── FACTURACIÓN DGI ───────────────────────────────────────────── */}
          {settingsTab==="facturacion_cfg" && (
            <div style={{maxWidth:580}}>
              <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'14px 18px',marginBottom:24,display:'flex',gap:10}}>
                <span style={{fontSize:20}}>🔗</span>
                <div>
                  <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,fontWeight:700,color:'#1e40af',marginBottom:2}}>Proveedor habilitado por DGI</div>
                  <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#3b82f6'}}>
                    Para emitir CFEs con validez legal, configurá tu proveedor habilitado. Soportamos UCFE (Uruware) y pymo.uy.
                    Los CFEs se envían automáticamente al guardar.
                  </div>
                </div>
              </div>
              <div style={{display:'grid',gap:16}}>
                {[{id:'ucfe',name:'UCFE (Uruware)',desc:'Proveedor de Saico. Si ya tenés contrato con Uruware podés conectarlo directamente.',logo:'🏢'},
                  {id:'pymo',name:'pymo.uy',desc:'Proveedor moderno con API REST documentada. Plan desde USD 8/mes + CFEs.',logo:'⚡'},
                  {id:'sicfe',name:'Sicfe',desc:'Más de 11.000 clientes en Uruguay. Integración vía API REST.',logo:'🔒'}
                ].map(p=>(
                  <div key={p.id} style={{border:'1.5px solid #e2e2de',borderRadius:10,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#059669'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e2de'}>
                    <span style={{fontSize:28}}>{p.logo}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:14,fontWeight:700,color:'#1a1a18'}}>{p.name}</div>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>{p.desc}</div>
                    </div>
                    <span style={{background:'#f0f0ec',color:'#6a6a68',fontFamily:'DM Sans,Inter,sans-serif',fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:20}}>Próximamente</span>
                  </div>
                ))}
                <div style={{background:'#f9f9f7',borderRadius:8,padding:'12px 16px',fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68'}}>
                  ¿Tenés contrato con otro proveedor habilitado por DGI? <span style={{color:'#059669',fontWeight:600,cursor:'pointer'}}>Contactanos →</span>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRACIONES ─────────────────────────────────────────────── */}
          {settingsTab==="zonas" && (
            <ZonasDeposito orgId={brandCfg?.orgId || getOrgId()} />
          )}
          {settingsTab==="portal" && (
            <div style={{maxWidth:560}}>
              <h3 style={{fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:600,margin:'0 0 6px'}}>Portal B2B</h3>
              <p style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#666',margin:'0 0 20px',lineHeight:1.6}}>
                Configurá el portal que ven tus clientes. Podés habilitar un catálogo de consulta o un portal completo con carrito de pedidos.
              </p>

              <div style={{display:'grid',gap:16}}>
                {/* Toggle: Catálogo público */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Catálogo público</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Tus clientes ven productos y precios sin hacer pedidos</div>
                  </div>
                  <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:'pointer'}}>
                    <input type="checkbox" checked={brandCfg?.portalCatalogo!==false} onChange={e=>{
                      const updated = {...(brandCfg||{}), portalCatalogo: e.target.checked};
                      setBrandCfg(updated);
                      db.upsert('app_config', {key:'brandcfg',value:updated,org_id:getOrgId()}, 'key,org_id');
                    }} style={{opacity:0,width:0,height:0}} />
                    <span style={{position:'absolute',inset:0,background:brandCfg?.portalCatalogo!==false?'#059669':'#ccc',borderRadius:12,transition:'.2s'}} />
                    <span style={{position:'absolute',top:2,left:brandCfg?.portalCatalogo!==false?22:2,width:20,height:20,background:'#fff',borderRadius:10,transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}} />
                  </label>
                </div>

                {/* Toggle: Portal de pedidos */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Portal de pedidos (carrito)</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Tus clientes pueden armar pedidos y enviarlos por WhatsApp</div>
                  </div>
                  <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:'pointer'}}>
                    <input type="checkbox" checked={brandCfg?.portalPedidos!==false} onChange={e=>{
                      const updated = {...(brandCfg||{}), portalPedidos: e.target.checked};
                      setBrandCfg(updated);
                      db.upsert('app_config', {key:'brandcfg',value:updated,org_id:getOrgId()}, 'key,org_id');
                    }} style={{opacity:0,width:0,height:0}} />
                    <span style={{position:'absolute',inset:0,background:brandCfg?.portalPedidos!==false?'#059669':'#ccc',borderRadius:12,transition:'.2s'}} />
                    <span style={{position:'absolute',top:2,left:brandCfg?.portalPedidos!==false?22:2,width:20,height:20,background:'#fff',borderRadius:10,transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}} />
                  </label>
                </div>

                {/* Pedido mínimo */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Pedido mínimo</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Monto mínimo (sin IVA) para que el cliente pueda confirmar. 0 = sin mínimo.</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                    <span style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#6a6a68'}}>$</span>
                    <input
                      key={'min'+(brandCfg?.minOrderAmount||0)}
                      type="number" min={0} step={1}
                      defaultValue={brandCfg?.minOrderAmount||0}
                      onBlur={e=>{
                        const v=Math.max(0,Number(e.target.value)||0);
                        const updated={...(brandCfg||{}),minOrderAmount:v};
                        setBrandCfg(updated);
                        db.upsert('app_config',{key:'brandcfg',value:updated,org_id:getOrgId()},'key,org_id');
                      }}
                      style={{width:120,padding:'8px 11px',borderRadius:6,border:'1px solid #e8e4de',fontSize:14,textAlign:'right',background:'#fafaf7',color:'#1a1a18'}}/>
                  </div>
                </div>

                {/* Email de notificación de pedidos */}
                <OrderNotifyEmailField orgId={brandCfg?.orgId||getOrgId()} />

                {/* Control de inventario (flag no_controla_stock, self-service) */}
                <StockControlCard />

                {/* Toggle: Recordatorio de carrito abandonado */}
                <div style={{background:'#fff',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#1a1a18'}}>Recordatorio de carrito abandonado</div>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>Si un cliente deja productos en el carrito sin confirmar, le mandamos un email (a las ~4h y ~24h). Solo a clientes con email cargado.</div>
                  </div>
                  <label style={{position:'relative',display:'inline-block',width:44,height:24,cursor:'pointer',flexShrink:0}}>
                    <input type="checkbox" checked={brandCfg?.abandonedCartEmails===true} onChange={e=>{
                      const updated = {...(brandCfg||{}), abandonedCartEmails: e.target.checked};
                      setBrandCfg(updated);
                      db.upsert('app_config', {key:'brandcfg',value:updated,org_id:getOrgId()}, 'key,org_id');
                    }} style={{opacity:0,width:0,height:0}} />
                    <span style={{position:'absolute',inset:0,background:brandCfg?.abandonedCartEmails===true?'#059669':'#ccc',borderRadius:12,transition:'.2s'}} />
                    <span style={{position:'absolute',top:2,left:brandCfg?.abandonedCartEmails===true?22:2,width:20,height:20,background:'#fff',borderRadius:10,transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}} />
                  </label>
                </div>

                {/* URL del portal */}
                <div style={{background:'#f7f6f3',border:'1px solid #e8e4de',borderRadius:10,padding:'16px 20px'}}>
                  <div style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:'#1a1a18',marginBottom:8}}>URL de tu portal</div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <code style={{flex:1,fontFamily:'monospace',fontSize:12,color:'#059669',background:'#fff',padding:'8px 12px',borderRadius:6,border:'1px solid #e8e4de',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {window.location.origin}/catalogo?org={brandCfg?.orgId||getOrgId()}
                    </code>
                    <button onClick={()=>{
                      const url=window.location.origin+'/catalogo?org='+(brandCfg?.orgId||getOrgId());
                      navigator.clipboard?.writeText(url);
                      alert('URL copiada al portapapeles');
                    }} style={{padding:'8px 14px',background:'#059669',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                      Copiar
                    </button>
                  </div>
                  <div style={{fontFamily:'Inter,sans-serif',fontSize:11,color:'#9a9a98',marginTop:8}}>Compartí este link con tus clientes por WhatsApp o email</div>
                </div>
              </div>
            </div>
          )}

          {settingsTab==="datos" && (
            <div>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Exportar datos</h3>
              <p style={{fontSize:13,color:'#6a6a68',marginBottom:16}}>Descargá todos los datos de tu organización en formato CSV. Incluye productos, clientes, ventas, facturas, cobros, rutas y más.</p>
              <button
                id="exportar-datos"
                onClick={async()=>{
                  const btn=document.getElementById('exportar-datos');
                  btn.textContent='Exportando...';btn.disabled=true;
                  try{
                    const SB=import.meta.env.VITE_SUPABASE_URL;
                    const h=getAuthHeaders({Accept:'application/json'});
                    const org=getOrgId();
                    const tables=['products','clients','suppliers','ventas','invoices','collections','orders','rutas','stock_movements','recepciones','devoluciones','lotes','price_lists','price_list_items','conteos'];
                    const results={};
                    for(const t of tables){
                      const r=await fetch(SB+'/rest/v1/'+t+'?org_id=eq.'+encodeURIComponent(org)+'&limit=10000',{headers:h});
                      if(r.ok){const d=await r.json();results[t]=d;}
                    }
                    const toCsv=(arr)=>{
                      if(!arr||!arr.length)return'';
                      const cols=Object.keys(arr[0]);
                      const header=cols.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',');
                      const rows=arr.map(row=>cols.map(c=>{const v=row[c];return'"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(','));
                      return header+'\n'+rows.join('\n');
                    };
                    let allContent='';
                    for(const[name,data]of Object.entries(results)){
                      if(data&&data.length){
                        const csv=toCsv(data);
                        allContent+='\n\n===== '+name.toUpperCase()+' ('+data.length+' registros) =====\n'+csv;
                      }
                    }
                    if(!allContent){btn.textContent='Sin datos para exportar';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},2000);return;}
                    const blob=new Blob([allContent],{type:'text/csv;charset=utf-8;'});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement('a');
                    a.href=url;a.download='pazque-export-'+new Date().toISOString().slice(0,10)+'.csv';
                    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                    btn.textContent='Descarga lista ✓';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},3000);
                  }catch(e){
                    console.error('Export error:',e);
                    btn.textContent='Error al exportar';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},3000);
                  }
                }}
                style={{padding:'10px 24px',background:'#059669',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer'}}
              >Exportar todos mis datos</button>
              <p style={{fontSize:11,color:'#9a9a98',marginTop:12}}>El archivo incluye todos tus datos en formato CSV. Podés abrirlo en Excel, Google Sheets o cualquier herramienta de análisis.</p>

              <div style={{marginTop:32,paddingTop:20,borderTop:'1px solid #e2e2de'}}>
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:4,color:'#dc2626'}}>Eliminar cuenta</h3>
                <p style={{fontSize:13,color:'#6a6a68',marginBottom:12}}>Si querés eliminar tu cuenta y todos tus datos, escribinos a contacto@pazque.com. Tus datos se eliminan de forma permanente en un plazo de 30 días.</p>
              </div>
            </div>
          )}
          {settingsTab==="plan" && (
            <div style={{maxWidth:500}}>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Tu plan</h3>
              <p style={{fontSize:13,color:'#6a6a68',marginBottom:20}}>Gestioná tu suscripción a Pazque.</p>
              <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:16,marginBottom:24}}>
                <div style={{fontSize:13,fontWeight:600,color:'#059669',marginBottom:4}}>Plan activo</div>
                <div style={{fontSize:24,fontWeight:700,color:'#1a1a18'}}>USD 149<span style={{fontSize:13,fontWeight:400,color:'#6a6a68'}}>/mes</span></div>
                <div style={{fontSize:12,color:'#6a6a68',marginTop:4}}>Precio de lanzamiento por 3 meses. Luego USD 299/mes.</div>
              </div>
              <div style={{paddingTop:16,borderTop:'1px solid #e2e2de'}}>
                <h4 style={{fontSize:14,fontWeight:600,color:'#dc2626',marginBottom:4}}>Cancelar suscripción</h4>
                <p style={{fontSize:13,color:'#6a6a68',marginBottom:12}}>Si cancelás, tu cuenta seguirá activa hasta el final del período pagado. Tus datos no se eliminan.</p>
                <button
                  onClick={async()=>{
                    if(!confirm('¿Estás seguro de que querés cancelar tu suscripción? Tu cuenta seguirá activa hasta el final del período pagado.')) return;
                    try{
                      const SB=import.meta.env.VITE_SUPABASE_URL;
                      const sess=JSON.parse(localStorage.getItem('aryes-session')||'null');
                      if(!sess?.orgId) return alert('Error: sesión no válida');
                      await fetch(SB+'/rest/v1/organizations?id=eq.'+encodeURIComponent(sess.orgId),{
                        method:'PATCH',
                        headers:getAuthHeaders({Prefer:'return=minimal'}),
                        body:JSON.stringify({subscription_status:'canceled',active:false}),
                      });
                      alert('Suscripción cancelada. Tu cuenta seguirá activa hasta el final del período pagado.');
                      window.location.reload();
                    }catch(e){alert('Error al cancelar. Contactá a contacto@pazque.com');}
                  }}
                  style={{padding:'8px 20px',background:'#fff',color:'#dc2626',border:'1px solid #fecaca',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer'}}
                >Cancelar suscripción</button>
              </div>
            </div>
          )}
          {settingsTab==="dominio" && (
            <div style={{display:"grid",gap:20,maxWidth:600}}>
              <div>
                <h3 style={{fontSize:16,fontWeight:600,margin:"0 0 6px"}}>Dominio personalizado</h3>
                <p style={{fontSize:13,color:"#666",margin:0}}>
                  Configurá un dominio propio para tu portal B2B. Tus clientes accederán desde <strong>pedidos.tuempresa.com</strong> en vez de aryes-stock.vercel.app.
                </p>
              </div>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#166534",marginBottom:8}}>Cómo configurarlo</div>
                <div style={{fontSize:12,color:"#166534",display:"grid",gap:6}}>
                  <div>1. En tu proveedor de DNS, creá un registro <strong>CNAME</strong></div>
                  <div style={{fontFamily:"monospace",background:"#dcfce7",padding:"6px 10px",borderRadius:4,fontSize:11}}>
                    pedidos.tuempresa.com → cname.vercel-dns.com
                  </div>
                  <div>2. Registrá el dominio acá abajo</div>
                  <div>3. Contactá a Pazque para activarlo en Vercel (tarda ~5 minutos)</div>
                </div>
              </div>
              <DominioCNAMEPanel orgId={brandCfg?.orgId || getOrgId()} />
            </div>
          )}
          {settingsTab==="integraciones" && (
            <div style={{maxWidth:600}}>
              <p style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,color:'#6a6a68',marginBottom:20,lineHeight:1.6}}>
                Conectá la plataforma con otros sistemas. Las integraciones se activan sin código — solo configurás las credenciales.
              </p>
              <WhatsAppCard />
              <SimpliRouteCard />
              <div style={{display:'grid',gap:10}}>
                {[
                  {icon:'🧾',name:'Facturación / ERP',desc:'Pasá tus pedidos a factura automáticamente en tu sistema (Saico, Mercado y otros).',status:'próximamente',color:'#6366f1'},
                ].map(i=>(
                  <div key={i.name} style={{border:'1px solid #e2e2de',borderRadius:10,padding:'14px 16px',
                    display:'flex',alignItems:'center',gap:14}}>
                    <span style={{fontSize:24,flexShrink:0}}>{i.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:13,fontWeight:700,color:'#1a1a18'}}>{i.name}</div>
                      <div style={{fontFamily:'DM Sans,Inter,sans-serif',fontSize:12,color:'#6a6a68',marginTop:2}}>{i.desc}</div>
                    </div>
                    <span style={{background:i.status==='disponible'?'#f0fdf4':i.status==='pronto'?'#fffbeb':'#eff6ff',
                      color:i.color,fontFamily:'DM Sans,Inter,sans-serif',fontSize:11,fontWeight:700,
                      padding:'4px 11px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                      {i.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
