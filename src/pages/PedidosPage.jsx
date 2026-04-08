// ── PedidosPage — Portal B2B clientes con OTP ────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RecommendedProducts from '../components/RecommendedProducts.jsx';
import { fmt } from '../lib/constants.js';
import IvaLine from '../components/IvaLine.jsx';
import { demoHoreca } from '../demo/demo-horeca.js';
import { demoBebidas } from '../demo/demo-bebidas.js';
import { demoLimpieza } from '../demo/demo-limpieza.js';
import { demoConstruccion } from '../demo/demo-construccion.js';

const DEMO_DATASETS = {
  horeca:       { data: demoHoreca,       label: 'HORECA',       emoji: '🍽️', desc: 'Restaurantes, hoteles y catering' },
  bebidas:      { data: demoBebidas,      label: 'Bebidas',      emoji: '🥤', desc: 'Mayorista de bebidas' },
  limpieza:     { data: demoLimpieza,     label: 'Limpieza',     emoji: '🧹', desc: 'Productos de limpieza' },
  construccion: { data: demoConstruccion, label: 'Construcción', emoji: '🏗️', desc: 'Materiales de construcción' },
};


const G    = '#1a8a3c';
const SANS = "'DM Sans','Inter',system-ui,sans-serif";
const API  = import.meta.env.VITE_API_BASE || '';
// Detectar org desde hostname (CNAME por cliente) o query param
const SB_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SB_URL_BASE  = import.meta.env.VITE_SUPABASE_URL;

async function resolveOrgFromDomain(host) {
  // Consultar la tabla domain_orgs en Supabase
  try {
    const r = await fetch(
      `${SB_URL_BASE}/rest/v1/domain_orgs?domain=eq.${encodeURIComponent(host)}&active=eq.true&select=org_id&limit=1`,
      { headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` } }
    );
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) return data[0].org_id;
  } catch(e) {
    console.warn('[CNAME] No se pudo resolver dominio:', e);
  }
  return null;
}

function getOrgFromContext() {
  // 1. Query param explícito — máxima prioridad
  const qp = new URLSearchParams(window.location.search).get('org');
  if (qp) return qp;
  // 2. Hosts conocidos de Aryes → org por defecto
  const host = window.location.hostname;
  if (host === 'localhost' || host.includes('vercel.app') || host.includes('aryes-stock')) return 'aryes';
  // 3. Dominio custom — se resuelve async via Supabase (ver useEffect abajo)
  return host; // retorna el host como placeholder, se reemplaza async
}

const ORG = getOrgFromContext();
const SK   = 'aryes-pedidos-session';

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SK) || 'null');
    if (!s?.expiresAt) return null;
    if (new Date(s.expiresAt) < new Date()) { localStorage.removeItem(SK); return null; }
    return s;
  } catch { return null; }
}
function saveSession(s) { localStorage.setItem(SK, JSON.stringify(s)); }

const PAISES = [
  { code: 'UY', label: 'UY', prefix: '598', flag: '🇺🇾' },
  { code: 'AR', label: 'AR', prefix: '54',  flag: '🇦🇷' },
  { code: 'CL', label: 'CL', prefix: '56',  flag: '🇨🇱' },
  { code: 'BR', label: 'BR', prefix: '55',  flag: '🇧🇷' },
  { code: 'CO', label: 'CO', prefix: '57',  flag: '🇨🇴' },
  { code: 'MX', label: 'MX', prefix: '52',  flag: '🇲🇽' },
  { code: 'PE', label: 'PE', prefix: '51',  flag: '🇵🇪' },
  { code: 'PY', label: 'PY', prefix: '595', flag: '🇵🇾' },
  { code: 'BO', label: 'BO', prefix: '591', flag: '🇧🇴' },
  { code: 'EC', label: 'EC', prefix: '593', flag: '🇪🇨' },
];

function PhoneInput({ value, onChange, placeholder = '9X XXX XXX', style = {} }) {
  const [pais,   setPais]   = useState('UY');
  const [numero, setNumero] = useState('');
  const selected = PAISES.find(p => p.code === pais) || PAISES[0];

  const handleChange = (num) => {
    setNumero(num);
    const clean = num.replace(/\D/g, '');
    onChange(clean ? `+${selected.prefix}${clean}` : '');
  };

  const handlePais = (code) => {
    setPais(code);
    const found = PAISES.find(p => p.code === code) || PAISES[0];
    const clean = numero.replace(/\D/g, '');
    onChange(clean ? `+${found.prefix}${clean}` : '');
  };

  return (
    <div style={{ display: 'flex', border: '1px solid #e0e0d8', borderRadius: 8,
      overflow: 'hidden', background: '#fafaf7', ...style }}>
      <select value={pais} onChange={e => handlePais(e.target.value)}
        style={{ border: 'none', background: 'transparent', padding: '9px 6px 9px 10px',
          fontSize: 13, fontFamily: SANS, color: '#1a1a18', cursor: 'pointer',
          outline: 'none', borderRight: '1px solid #e0e0d8', flexShrink: 0 }}>
        {PAISES.map(p => (
          <option key={p.code} value={p.code}>{p.flag} +{p.prefix}</option>
        ))}
      </select>
      <input type="tel" value={numero} onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', background: 'transparent',
          padding: '9px 12px', fontSize: 13, fontFamily: SANS,
          color: '#1a1a18', outline: 'none', minWidth: 0 }} />
    </div>
  );
}

const Icon = {
  cart:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.96 1.61h9.72a2 2 0 001.95-1.56L23 6H6"/></svg>,
  history: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  logo:    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  repeat:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
};


// ── Portal Demo Selector ──────────────────────────────────────────────────────
function PortalDemoSelector({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: G, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#fff', fontSize: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>
            Explorá el portal de pedidos
          </div>
          <div style={{ fontSize: 13, color: '#9a9a92', lineHeight: 1.5 }}>
            Elegí una industria para ver cómo tus clientes<br/>van a hacer pedidos en tu plataforma
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(DEMO_DATASETS).map(([key, { label, emoji, desc }]) => (
            <button key={key} onClick={() => onSelect(key)}
              style={{
                background: '#fff', border: '1px solid #efefeb', borderRadius: 14,
                padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                transition: 'border-color .15s, transform .1s', fontFamily: SANS,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#efefeb'; e.currentTarget.style.transform = 'scale(1)'; }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#9a9a92' }}>{desc}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', color: '#9a9a92', fontSize: 13,
              cursor: 'pointer', fontFamily: SANS, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            ← Volver
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginStep({ onLogin }) {
  const [tel,     setTel]     = useState('');
  const [code,    setCode]    = useState('');
  const [step,    setStep]    = useState('tel');
  const [nombre,  setNombre]  = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const sendOTP = async () => {
    if (!tel.trim()) { setErr('Ingresa tu numero de WhatsApp'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.replace(/\D/g,''), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Error al enviar el codigo'); return; }
      setNombre(d.clienteNombre || '');
      if (d._devMode && d.code) setDevCode(d.code);
      setStep('code');
    } catch { setErr('Error de conexion.'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!code.trim()) { setErr('Ingresa el codigo recibido'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.replace(/\D/g,''), code: code.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Codigo incorrecto'); return; }
      saveSession(d.session); onLogin(d.session);
    } catch { setErr('Error de conexion.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: G, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            {Icon.logo}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>
            Portal de pedidos
          </div>
          <div style={{ fontSize: 13, color: '#9a9a92' }}>
            {step === 'tel' ? 'Ingresa tu numero para recibir un codigo' : `Enviamos un codigo a ${tel}`}
          </div>
        </div>

        <div style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>
          {err && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
              {err}
            </div>
          )}

          {step === 'tel' ? (
            <>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#9a9a92', letterSpacing: '0.1px' }}>
                Numero de WhatsApp
              </div>
              <PhoneInput value={tel} onChange={setTel} placeholder="9X XXX XXX"
                style={{ marginBottom: 16 }} />
              <button onClick={sendOTP} disabled={loading} style={{
                width: '100%', padding: '11px 0', background: loading ? '#b0b0a8' : G,
                color: '#fff', border: 'none', borderRadius: 50, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: SANS,
                letterSpacing: '0.1px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}>
                {loading ? 'Enviando...' : (
                  <>
                    Enviar codigo
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
              <div style={{ position: 'relative', margin: '20px 0 4px', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '0.5px', background: '#e8e8e0' }}/>
                <span style={{ position: 'relative', background: '#f7f7f4', padding: '0 12px', fontSize: 11, color: '#b0b0a8' }}>o</span>
              </div>
              <button onClick={() => window.location.href='/pedidos?demo=true'}
                style={{
                  width: '100%', padding: '11px 0', background: 'transparent',
                  color: '#6a6a68', border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', fontFamily: SANS,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                Explorar catálogo de prueba
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              {nombre && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 14px',
                  marginBottom: 16, fontSize: 13, color: G, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 6 }}>
                  {Icon.check} Hola, {nombre.split(' ')[0]}
                </div>
              )}
              {devCode && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                  padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  Dev - codigo: <strong style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</strong>
                </div>
              )}
              <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#6a6a68' }}>
                Codigo de 4 digitos
              </div>
              <input type="text" inputMode="numeric" placeholder="0000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()} autoFocus
                style={{ width: '100%', padding: '12px', border: '1px solid #e0e0d8',
                  borderRadius: 10, fontSize: 28, fontFamily: 'monospace', fontWeight: 700,
                  textAlign: 'center', letterSpacing: 12, marginBottom: 16,
                  boxSizing: 'border-box', outline: 'none', background: '#fafaf7' }} />
              <button onClick={verifyOTP} disabled={loading} style={{
                width: '100%', padding: '11px 0', background: loading ? '#b0b0a8' : G,
                color: '#fff', border: 'none', borderRadius: 50, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: SANS, marginBottom: 10, letterSpacing: '0.1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? 'Verificando...' : (
                  <>
                    Ingresar
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
              <button onClick={() => { setStep('tel'); setCode(''); setErr(''); setDevCode(''); }}
                style={{ width: '100%', padding: '9px 0', background: 'transparent',
                  border: 'none', borderRadius: 50, fontSize: 13,
                  color: '#9a9a92', cursor: 'pointer', fontFamily: SANS,
                  textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Cambiar numero
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ item, qty, onAdd, onRemove }) {
  const [imgErr, setImgErr] = useState(false);
  const hasImg = item.imagen_url && !imgErr;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #efefeb',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'border-color .15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#c8c8c0'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#efefeb'}>
      <div style={{ height: 140, background: hasImg ? '#f8f8f5' : '#f4f4f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasImg
          ? <img src={item.imagen_url} alt={item.nombre} onError={() => setImgErr(true)}
              style={{ maxHeight: 110, maxWidth: '80%', objectFit: 'contain' }} />
          : <div style={{ textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: G + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px', fontSize: 13, fontWeight: 700, color: G }}>
                {(item.marca || item.categoria || '?').slice(0, 2).toUpperCase()}
              </div>
              {item.marca && <div style={{ fontSize: 9, color: '#b0b0a8', fontWeight: 600, letterSpacing: .4 }}>{item.marca.toUpperCase()}</div>}
            </div>
        }
      </div>
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, color: '#a0a098', letterSpacing: .3 }}>{item.categoria}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', lineHeight: 1.3, flex: 1 }}>
          {item.nombre}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G, marginTop: 4 }}>
          {item.precio > 0 ? fmt.currencyCompact(item.precio) : <span style={{ fontSize: 12, color: '#a0a098' }}>Consultar</span>}
          {item.precio > 0 && <span style={{ fontSize: 10, color: '#a0a098', fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {item.precio > 0 && <IvaLine precio={item.precio} iva_rate={item.iva_rate} />}
        {qty > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <button onClick={() => onRemove(item)} style={{
              width: 30, height: 30, border: `1.5px solid ${G}`, borderRadius: 8,
              background: '#fff', color: G, fontSize: 16, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>-</button>
            <input type="number" inputMode="numeric" min="0" value={qty} onChange={e=>{const v=parseInt(e.target.value,10);if(isNaN(v)||v<=0)onRemove(item);else{const d=v-qty;if(d>0)for(let i=0;i<d;i++)onAdd(item);else if(d<0)for(let i=0;i<-d;i++)onRemove(item);}}} onFocus={e=>e.target.select()} style={{width:48,fontSize:15,fontWeight:700,color:'#1a1a18',textAlign:'center',border:'1px solid #e0e0d8',borderRadius:6,padding:'2px 0',outline:'none',background:'#fafaf7'}}/>
            <button onClick={() => onAdd(item)} style={{
              width: 30, height: 30, background: G, border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>+</button>
          </div>
        ) : (
          <button onClick={() => onAdd(item)} disabled={item.precio === 0} style={{
            marginTop: 4, padding: '7px 0',
            background: item.precio > 0 ? G : '#f0f0ec',
            color: item.precio > 0 ? '#fff' : '#b0b0a8',
            border: 'none', borderRadius: 8, cursor: item.precio > 0 ? 'pointer' : 'not-allowed',
            fontSize: 12, fontWeight: 600, fontFamily: SANS,
          }}>
            {item.precio > 0 ? (item.min_order_qty > 1 ? ('+ Min. ' + item.min_order_qty) : '+ Agregar') : 'Sin precio'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Historial ─────────────────────────────────────────────────────────────────
function HistorialPedidos({ session, onReordenar }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expand,  setExpand]  = useState(null);

  const EST = {
    pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fffbeb' },
    importada:  { label: 'Confirmado', color: '#1a8a3c', bg: '#f0fdf4' },
    confirmada: { label: 'Confirmado', color: '#1a8a3c', bg: '#f0fdf4' },
    preparada:  { label: 'Preparando', color: '#7c3aed', bg: '#f5f3ff' },
    en_ruta:    { label: 'En camino',  color: '#f97316', bg: '#fff7ed' },
    entregada:  { label: 'Entregado',  color: '#1a8a3c', bg: '#f0fdf4' },
    cancelada:  { label: 'Cancelado',  color: '#ef4444', bg: '#fef2f2' },
  };

  useEffect(() => {
    if (!session?.token || session?.token === 'demo-token') return;
    fetch(`${API}/api/pedido?action=historial`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPedidos(d.pedidos || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#9a9a92', fontSize: 14 }}>
      Cargando historial...
    </div>
  );

  if (!pedidos.length) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>Sin pedidos aun</div>
      <div style={{ fontSize: 13, color: '#9a9a92' }}>Tus pedidos confirmados apareceran aca</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pedidos.map(p => {
        const est   = EST[p.estado] || EST.pendiente;
        const isExp = expand === p.id;
        const fecha = new Date(p.creado_en).toLocaleDateString('es-UY', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        return (
          <div key={p.id} onClick={() => setExpand(isExp ? null : p.id)}
            style={{ background: '#fff', borderRadius: 14, border: '1px solid #efefeb',
              overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 3 }}>{fecha}</div>
                <div style={{ fontSize: 11, color: '#9a9a92' }}>
                  {Array.isArray(p.items) ? p.items.length : 0} producto{p.items?.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: G }}>{fmt.currencyCompact(p.total)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: est.color,
                  background: est.bg, padding: '2px 8px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                  {est.label}
                </span>
              </div>
              <div style={{ color: '#c0c0b8', fontSize: 11 }}>{isExp ? '▲' : '▼'}</div>
            </div>
            {isExp && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f5f5f0' }}>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(p.items || []).map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, padding: '6px 0', color: '#4a4a42',
                      borderBottom: i < p.items.length - 1 ? '1px solid #f5f5f0' : 'none' }}>
                      <span>{it.cantidad} x {it.nombre}</span>
                      <span style={{ fontWeight: 600, color: G }}>{fmt.currencyCompact(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={e => { e.stopPropagation(); onReordenar(p); }} style={{
                  marginTop: 12, width: '100%', padding: '9px 0',
                  background: '#f0fdf4', color: G, border: '1px solid #bbf7d0',
                  borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {Icon.repeat} Repetir pedido
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────
function CartDrawer({ carrito, items, session, onClose, onConfirm }) {
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const lineas = Object.entries(carrito)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id), qty }))
    .filter(l => l.item);

  const lineasConCalc = lineas.map(({ item, qty }) => {
    const ivaRate = item.iva_rate !== undefined && item.iva_rate !== null ? Number(item.iva_rate) : 22;
    const descPct = item.descGlobal || 0;
    const precioConDto = descPct > 0 ? item.precio * (1 - descPct / 100) : item.precio;
    const netoLinea = precioConDto * qty;
    const ivaLinea = netoLinea * (ivaRate / 100);
    return { item, qty, ivaRate, descPct, precioConDto, netoLinea, ivaLinea };
  });
  const subtotalNeto = lineasConCalc.reduce((s, l) => s + l.netoLinea, 0);
  const ivaTotal = lineasConCalc.reduce((s, l) => s + l.ivaLinea, 0);
  const total = subtotalNeto + ivaTotal;

  // Direcciones de entrega del cliente
  const [addresses, setAddresses] = React.useState([]);
  const [selectedAddress, setSelectedAddress] = React.useState(null);

  React.useEffect(() => {
    if (!session?.clienteId) return;
    const SB = import.meta.env.VITE_SUPABASE_URL;
    const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${SB}/rest/v1/client_addresses?client_id=eq.${session?.clienteId || 'none'}&active=eq.true&order=created_at.asc`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) { setAddresses(data); setSelectedAddress(data[0].id); } })
      .catch(console.error);
  }, [session?.clienteId]);

  // Analytics helper — no-op si posthog no está cargado
  const track = (event, props = {}) => {
    try { window.posthog?.capture(event, { org: ORG, ...props }); } catch {}
  };

  const confirmar = async () => {
      // Demo mode — simulate confirmation without API call
      if (window.location.search.includes('demo=true')) {
        setDone(true);
        return;
      }

    setLoading(true);
    try {
      const r = await fetch(`${window.location.origin}/api/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
        body: JSON.stringify({
          org: ORG, clienteId: session.clienteId,
          clienteNombre: session.nombre, clienteTelefono: session.tel,
          items: lineas.map(l => ({
            productId: l.item.id, nombre: l.item.nombre, unidad: l.item.unidad,
            cantidad: l.qty, precioUnit: l.item.precio, subtotal: l.item.precio * l.qty,
          })),
          total, notas,
          direccion_entrega: addresses.find(a => a.id === selectedAddress)?.direccion || null,
          idempotencyKey: `${session.tel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      if (r.ok) { track('pedido_confirmado', { items: lineas.length, total }); setDone(true); onConfirm(); }
      else { const d = await r.json(); alert(d.error || 'Error'); }
    } catch { alert('Error de conexion'); }
    finally { setLoading(false); }
  };

  const pedidoRef = Math.random().toString(36).slice(2,8).toUpperCase();
  const fechaHoy  = new Date().toLocaleDateString('es-UY', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', fontFamily: SANS, position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,.25)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Encabezado remito */}
        <div style={{ background: G, padding: '24px 24px 20px', color: '#fff', borderRadius: '20px 20px 0 0', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Pedido confirmado</div>
              <div style={{ fontSize: 12, opacity: .8 }}>Ref. #{pedidoRef}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: .8 }}>
            <span>{session?.nombre || 'Cliente Demo'}</span>
            <span>{fechaHoy}</span>
          </div>
        </div>

        {/* Detalle de productos */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9a9a92', letterSpacing: .5, marginBottom: 10 }}>
            DETALLE DEL PEDIDO
          </div>
          {lineasConCalc.map(({ item, qty, descPct, precioConDto, netoLinea, ivaRate }) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #f5f5f0', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: '#9a9a92', marginTop: 2 }}>
                  {qty} × {fmt.currencyCompact(item.precio)}
                  {descPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{descPct}%</span>}
                  <span style={{ color: '#c0c0b8', marginLeft: 4 }}>IVA {ivaRate}%</span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
                {fmt.currencyCompact(netoLinea)}
              </div>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ background: '#f7f7f4', borderRadius: 10, padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#9a9a92' }}>Subtotal neto</span>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currencyCompact(subtotalNeto)}</span>
            </div>
            {[...new Set(lineasConCalc.map(l => l.ivaRate))].sort((a,b)=>a-b).map(rate => {
              const ivaDeRate = lineasConCalc.filter(l => l.ivaRate === rate).reduce((s,l) => s + l.ivaLinea, 0);
              return (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#9a9a92' }}>IVA {rate}%</span>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currencyCompact(ivaDeRate)}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #e8e8e0', paddingTop: 8, marginTop: 2,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>Total con IVA</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: G }}>{fmt.currencyCompact(total)}</span>
            </div>
          </div>
        </div>

        {/* Nota */}
        {notas && (
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{ background: '#fffbeb', borderRadius: 8, padding: '10px 14px',
              fontSize: 12, color: '#92400e' }}>
              Nota: {notas}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '0 24px 32px' }}>
          <p style={{ fontSize: 12, color: '#9a9a92', textAlign: 'center', marginBottom: 14, lineHeight: 1.6 }}>
            Tu distribuidor recibio el pedido. Te avisamos cuando este confirmado.
          </p>
          <button onClick={onClose} style={{
            width: '100%', padding: '12px 0', background: G, color: '#fff', border: 'none',
            borderRadius: 50, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Ver mas productos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999 }}
      onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.min(400, window.innerWidth), background: '#fff',
        display: 'flex', flexDirection: 'column', fontFamily: SANS }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0ede8',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18' }}>Tu pedido</div>
            <div style={{ fontSize: 12, color: '#9a9a92', marginTop: 2 }}>
              {lineas.length} producto{lineas.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f4f4f0', border: 'none',
            borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a6a68',
            fontSize: 18 }}>x</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {lineasConCalc.map(({ item, qty, ivaRate, descPct, precioConDto, netoLinea }) => (
            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: '#9a9a92', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span>{qty} x {fmt.currencyCompact(item.precio)}</span>
                    {descPct > 0 && <span style={{ color: '#dc2626' }}>-{descPct}%</span>}
                    <span style={{ color: '#c0c0b8' }}>IVA {ivaRate}%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {descPct > 0 && (
                    <div style={{ fontSize: 11, color: '#b0b0a8', textDecoration: 'line-through' }}>
                      {fmt.currencyCompact(item.precio * qty)}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: G }}>
                    {fmt.currencyCompact(netoLinea)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {addresses.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6a6a68', marginBottom: 6 }}>Dirección de entrega</div>
              <select value={selectedAddress || ''} onChange={e => setSelectedAddress(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8', borderRadius: 8,
                  fontSize: 13, fontFamily: SANS, background: '#fafaf7', outline: 'none' }}>
                {addresses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label}: {a.direccion}{a.ciudad ? ` — ${a.ciudad}` : ''}
                  </option>
                ))}
              </select>
              {addresses.find(a => a.id === selectedAddress)?.referencia && (
                <div style={{ fontSize: 11, color: '#9a9a92', marginTop: 4, fontStyle: 'italic' }}>
                  {addresses.find(a => a.id === selectedAddress).referencia}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6a6a68', marginBottom: 6 }}>Notas del pedido</div>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: entregar antes del mediodia..."
              rows={3} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8',
                borderRadius: 8, fontSize: 13, fontFamily: SANS, resize: 'none',
                boxSizing: 'border-box', outline: 'none', background: '#fafaf7' }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f0ede8' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#9a9a92' }}>Subtotal neto</span>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currencyCompact(subtotalNeto)}</span>
            </div>
            {[...new Set(lineasConCalc.map(l => l.ivaRate))].sort((a,b)=>a-b).map(rate => {
              const ivaRate = lineasConCalc.filter(l => l.ivaRate === rate).reduce((s,l) => s + l.ivaLinea, 0);
              return (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#9a9a92' }}>IVA {rate}%</span>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currencyCompact(ivaRate)}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '0.5px solid #e8e8e0', paddingTop: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>Total con IVA</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: G }}>{fmt.currencyCompact(total)}</span>
            </div>
          </div>
          <button onClick={confirmar} disabled={loading || lineas.length === 0} style={{
            width: '100%', padding: '13px 0',
            background: loading || lineas.length === 0 ? '#c8c8c0' : G,
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: SANS,
          }}>
            {loading ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagina principal ──────────────────────────────────────────────────────────
export default function PedidosPage() {
  const [portalDemo, setPortalDemo] = useState(null); // null | 'selecting' | dataset key
  const isPortalDemo = !!portalDemo && portalDemo !== 'selecting';
  const [session,  setSession]  = useState(() => loadSession());
  const [vista,    setVista]    = useState('catalogo');
  const [recommended, setRecommended] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [items,    setItems]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [brandNombre, setBrandNombre] = useState('');
  const [horarioInfo, setHorarioInfo] = useState(null);
  const [catFil,   setCatFil]   = useState('Todos');
  const [busq,     setBusq]     = useState('');
  const [carrito,  setCarrito]  = useState({});
  const [showCart, setShowCart] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [ddOpen,   setDdOpen]   = useState(false);
  const NAV_MAX = 10;

  const totalItems = Object.values(carrito).reduce((s, q) => s + q, 0);

  // Detect demo mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !portalDemo) setPortalDemo('selecting');
  }, []);

  // Load demo products when dataset selected
  useEffect(() => {
    if (!isPortalDemo) return;
    const ds = DEMO_DATASETS[portalDemo];
    if (!ds) return;
    const prods = ds.data.products.map(p => ({
      id: p.id, nombre: p.name, precio: p.price, categoria: p.category,
      unidad: p.unit || 'un', marca: p.brand || p.category,
      imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,
      stock: p.stock || 100,
    })).filter(p => p.precio > 0);
    setItems(prods);
    const categories = ['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))];
    setCats(categories);
    setBrandNombre(ds.data.org.name);
  }, [portalDemo, isPortalDemo]);

  const loadCatalogo = useCallback(async (ses) => {
    if (!ses?.clienteId) return;
    setLoading(true);
    try {
      const r = await fetch(`${window.location.origin}/api/catalogo?org=${ORG}&cliente=${ses.clienteId}`);
      const d = await r.json();
      if (d.items) {
        const prods = d.items.filter(i => i.precio > 0);
        setItems(prods);
        setCats(['Todos', ...(d.categorias || [])]);
        if (d.brandCfg?.nombre) setBrandNombre(d.brandCfg.nombre);
        if (d.horarioDesde || d.horarioHasta) setHorarioInfo({ desde: d.horarioDesde, hasta: d.horarioHasta });
        try { window.posthog?.identify(ses.clienteId, { nombre: ses.nombre, org: ORG }); } catch {}
        try { window.posthog?.capture('catalogo_visto', { org: ORG, productos: prods.length }); } catch {}
        if (Array.isArray(data.recommended)) setRecommended(data.recommended);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Demo mode: inject fake lastOrder and recommended when demo products load
  useEffect(() => {
    if (!isPortalDemo || items.length === 0) return;
    var fakeItems = items.slice(0, 5).map(function(p) {
      return { productId: p.id, nombre: p.nombre, qty: Math.ceil(2 + ((p.nombre||'').length % 4)), precio: p.precio || 100, unidad: p.unidad || 'u.' };
    });
    var fakeTotal = fakeItems.reduce(function(s, it) { return s + it.qty * it.precio; }, 0);
    setLastOrder({ items: fakeItems, total: fakeTotal });
    var recItems = items.slice(8, 12).map(function(p) {
      return { id: p.id, nombre: p.nombre, precio: p.precio || 100, unit: p.unidad || 'u.', reason: Math.ceil(2 + ((p.nombre||'').length % 3)) + ' clientes lo compran' };
    });
    setRecommended(recItems);
  }, [isPortalDemo, items]);

    useEffect(() => { if (session) loadCatalogo(session); }, [session, loadCatalogo]);

  const filtered = useMemo(() => items.filter(i => {
    const mCat = catFil === 'Todos' || i.categoria === catFil;
    const mQ   = !busq || i.nombre.toLowerCase().includes(busq.toLowerCase())
      || (i.marca || '').toLowerCase().includes(busq.toLowerCase());
    return mCat && mQ;
  }), [items, catFil, busq]);

  // Analytics — PedidosPage scope
  const track = (event, props = {}) => { try { window.posthog?.capture(event, { org: ORG, ...props }); } catch {} };

  const addItem = item => { track('producto_agregado', { producto: item.nombre, precio: item.precio }); setCarrito(c => { const cur = c[item.id] || 0; const min = item.min_order_qty || 1; return { ...c, [item.id]: cur === 0 ? min : cur + 1 }; }); };
  const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    const min = item.min_order_qty || 1;
    if (q < min) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });

  const logout = () => {
    if (isPortalDemo) { setPortalDemo(null); setItems([]); setCarrito({}); window.location.href = '/pedidos'; return; }

    localStorage.removeItem(SK);
    setSession(null); setItems([]); setCarrito({});
  };

  if (portalDemo === 'selecting') return <PortalDemoSelector onSelect={key => setPortalDemo(key)} />;

  // Demo mode: create a fake session so the catalog renders without null errors
  const effectiveSession = isPortalDemo ? {
    nombre: 'Cliente Demo',
    clienteId: 'demo-client',
    token: 'demo-token',
    tel: '099000000',
    org: 'demo',
  } : session;
  if (!session && !isPortalDemo) return <LoginStep onLogin={ses => setSession(ses)} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS }}>

      {isPortalDemo && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: SANS }}>
          <span style={{ fontSize: 12, color: '#92400e' }}>
            Estás viendo el catálogo de prueba de <strong>{DEMO_DATASETS[portalDemo]?.label}</strong>
          </span>
          <button onClick={() => setPortalDemo('selecting')}
            style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: SANS }}>
            Cambiar industria
          </button>
          <a href="/register"
            style={{ fontSize: 11, color: '#fff', background: G, border: 'none',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
              fontFamily: SANS, textDecoration: 'none' }}>
            Crear cuenta gratis
          </a>
        </div>
      )}
      <header style={{ background: '#fff', borderBottom: '0.5px solid #e8e8e0',
        position: 'sticky', top: 0, zIndex: 100 }} onClick={() => setDdOpen(false)}>

        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px',
          height: 66, display: 'flex', alignItems: 'center', gap: 16,
          borderBottom: '0.5px solid #f0f0ec' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, background: G, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icon.logo}
            </div>
            {brandNombre && (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', whiteSpace: 'nowrap' }}>
                {brandNombre}
              </span>
            )}
          </div>
          {vista === 'catalogo' ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 560 }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#a0a098' }}>{Icon.search}</div>
                <input value={busq} onChange={e => setBusq(e.target.value)}
                  placeholder="Buscar producto o marca..."
                  style={{ width: '100%', padding: '9px 16px 9px 36px',
                    border: '1.5px solid #e0e0d8', borderRadius: 28, fontSize: 13,
                    fontFamily: SANS, boxSizing: 'border-box', outline: 'none',
                    background: '#f7f7f4', color: '#1a1a18' }}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = '#e0e0d8'} />
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}
          {lastOrder && (
              <button onClick={function(){(lastOrder.items||[]).forEach(function(it){var id=it.productId||it.productoId||'';var qty=Number(it.qty||it.cantidad||1);for(var i=0;i<qty;i++) addItem(id);});setLastOrder(null);}} style={{ background: 'none', border: 'none', fontSize: 13, color: '#1a8a3c', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', padding: '6px 12px', borderRadius: 8, transition: 'background 0.15s', whiteSpace: 'nowrap' }} onMouseEnter={function(e){e.currentTarget.style.background='#f0fdf4';}} onMouseLeave={function(e){e.currentTarget.style.background='none';}}>
                Repetir pedido anterior
              </button>
            )}
            <button onClick={() => totalItems > 0 && setShowCart(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
            borderRadius: 24, border: 'none', cursor: 'pointer',
            background: totalItems > 0 ? G : '#f0f0ec',
            color: totalItems > 0 ? '#fff' : '#9a9a92',
            fontFamily: SANS, fontSize: 13, fontWeight: 500, flexShrink: 0,
          }}>
            {Icon.cart}
            {totalItems > 0 ? `${totalItems} item${totalItems !== 1 ? 's' : ''}` : 'Carrito'}
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}
            onMouseEnter={e => { const d = e.currentTarget.querySelector('.udd'); if(d) d.style.display='block'; }}
            onMouseLeave={e => { const d = e.currentTarget.querySelector('.udd'); if(d) d.style.display='none'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '6px 8px', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: G, flexShrink: 0, border: '1.5px solid #bbf7d0' }}>
                {effectiveSession?.nombre?.slice(0,1).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: '#1a1a18', fontWeight: 500 }}>
                {effectiveSession?.nombre?.split(' ')[0]}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9a9a92" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div className="udd" style={{ display: 'none', position: 'absolute', right: 0, top: '100%',
              background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10,
              padding: '6px 0', minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,.1)', zIndex: 300 }}>
              <div style={{ padding: '8px 16px 6px', fontSize: 11, color: '#9a9a92', letterSpacing: .3 }}>
                {effectiveSession?.nombre}
              </div>
              <div style={{ borderTop: '0.5px solid #f0f0ec', margin: '4px 0' }} />
              <button onClick={() => setVista('historial')} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#3a3a32', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f7f7f4'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                {Icon.history} Mis pedidos
              </button>
              <button onClick={logout} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#dc2626', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 44, position: 'relative' }} onClick={e => e.stopPropagation()}>
          {vista === 'catalogo' && cats.slice(0, NAV_MAX).map(cat => (
            <button key={cat} onClick={() => { setCatFil(cat); setDdOpen(false); }} style={{
              padding: '0 16px', height: 44, border: 'none', background: 'transparent',
              fontSize: 14, letterSpacing: '0.1px', fontFamily: SANS,
              fontWeight: catFil === cat ? 500 : 400,
              color: catFil === cat ? G : '#5a5a52',
              borderBottom: catFil === cat ? `2px solid ${G}` : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {cat}
            </button>
          ))}
          {vista === 'catalogo' && cats.length > NAV_MAX && (
            <div style={{ position: 'relative' }}
              onMouseEnter={() => setDdOpen(true)}
              onMouseLeave={() => setDdOpen(false)}>
              <button style={{
                padding: '0 16px', height: 44, border: 'none', background: 'transparent',
                fontSize: 14, letterSpacing: '0.1px', cursor: 'pointer', fontFamily: SANS,
                display: 'flex', alignItems: 'center', gap: 4,
                color: ddOpen ? G : '#5a5a52',
                borderBottom: cats.slice(NAV_MAX).includes(catFil) ? `2px solid ${G}` : '2px solid transparent',
                fontWeight: cats.slice(NAV_MAX).includes(catFil) ? 500 : 400,
              }}>
                {cats.slice(NAV_MAX).includes(catFil) ? catFil : 'Mas'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {ddOpen && (
                <div style={{ position: 'absolute', top: 44, left: 0, background: '#fff',
                  border: '0.5px solid #e0e0d8', borderRadius: 10, padding: '6px 0',
                  minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,.08)', zIndex: 200 }}>
                  {cats.slice(NAV_MAX).map(cat => (
                    <button key={cat} onClick={() => { setCatFil(cat); setDdOpen(false); }} style={{
                      display: 'block', width: '100%', padding: '8px 16px', border: 'none',
                      background: catFil === cat ? '#f0fdf4' : 'transparent',
                      fontSize: 13, color: catFil === cat ? G : '#3a3a32',
                      textAlign: 'left', cursor: 'pointer', fontFamily: SANS,
                      fontWeight: catFil === cat ? 500 : 400,
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </header>

      {horarioInfo && (
        <div style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', padding:'6px 24px', textAlign:'center', fontSize:12, color:'#92400e' }}>
          ⏰ Horario de recepción: <strong>{horarioInfo.desde||'?'} – {horarioInfo.hasta||'?'}</strong>
        </div>
      )}
      {vista === 'catalogo' && (
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 60px' }}>
          
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 14, height: 240, border: '1px solid #efefeb', opacity: 0.5 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#a0a098' }}>
              <p style={{ fontSize: 14 }}>{items.length === 0 ? 'No hay productos disponibles' : `Sin resultados para "${busq}"`}</p>
            </div>
          ) : (
            <>
                        {recommended.length > 0 && (
            <RecommendedProducts recommended={recommended} onAdd={addItem} onRemove={removeItem} carrito={carrito} />
          )}
<div style={{ fontSize: 11, color: '#a0a098', marginBottom: 14 }}>
                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
                {filtered.map(item => (
                  <ProductCard key={item.id} item={item}
                    qty={carrito[item.id] || 0} onAdd={addItem} onRemove={removeItem} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {vista === 'historial' && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 24px 60px' }}>
          <HistorialPedidos session={session} onReordenar={order => {
            const nc = {};
            (order.items || []).forEach(it => {
              const id = it.id || it.productId;
              if (id) nc[id] = it.cantidad || 1;
            });
            setCarrito(nc);
            setVista('catalogo');
            setTimeout(() => setShowCart(true), 200);
          }} />
        </div>
      )}

      {totalItems > 0 && !showCart && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200 }}>
          <button onClick={() => setShowCart(true)} style={{
            background: G, color: '#fff', border: 'none', borderRadius: '50%',
            width: 52, height: 52, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(26,138,60,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            {Icon.cart}
            <span style={{ position: 'absolute', top: -3, right: -3, background: '#dc2626',
              color: '#fff', borderRadius: '50%', width: 18, height: 18,
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {totalItems}
            </span>
          </button>
        </div>
      )}

      {showCart && (
        <CartDrawer carrito={carrito} items={items} session={session}
          onClose={() => setShowCart(false)}
          onConfirm={() => { setCarrito({}); setShowCart(false); }} />
      )}
    </div>
  );
}
