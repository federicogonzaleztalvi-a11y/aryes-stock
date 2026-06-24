// ── PedidosPage — Portal B2B clientes con OTP ────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fmt } from '../lib/constants.js';
import EstadoCuentaPDF from '../components/EstadoCuentaPDF.jsx';
import EstadoCuentaPortal from '../components/EstadoCuentaPortal.jsx';
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


const G    = '#059669';
const SANS = "'DM Sans','Inter',system-ui,sans-serif";
// Escala de z-index definida — evita colisiones y números mágicos (200 vs 999)
const Z = { dropdown: 20, header: 30, fab: 40, overlay: 50 };
// Gris secundario accesible (≈4.6:1 sobre blanco) — reemplaza #a0a098/#b0b0a8 (fallan WCAG)
const GRAY = '#6b6b66';
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
  // 2. Hosts conocidos de Pazque → org por defecto
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

// Carrito persistente por cliente: se guarda en localStorage para que sobreviva
// a un refresh / cierre de pestaña y siga ahí hasta que el cliente compre.
// La clave incluye org + clienteId para que dos clientes en el mismo dispositivo
// (o el modo demo) no compartan carrito. Sólo guardamos cantidades por producto;
// los precios siempre se recalculan del catálogo fresco, así nunca quedan viejos.
function cartStorageKey(clienteId) { return `aryes-pedidos-cart::${ORG}::${clienteId || 'anon'}`; }
function loadCart(clienteId) {
  try {
    const c = JSON.parse(localStorage.getItem(cartStorageKey(clienteId)) || '{}');
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  } catch { return {}; }
}

const PAISES = [
  { code: 'UY', label: 'UY', prefix: '598', flag: '🇺🇾' },
  { code: 'AR', label: 'AR', prefix: '54',  flag: '🇦🇷' },
  { code: 'MX', label: 'MX', prefix: '52',  flag: '🇲🇽' },
  { code: 'CO', label: 'CO', prefix: '57',  flag: '🇨🇴' },
  { code: 'CL', label: 'CL', prefix: '56',  flag: '🇨🇱' },
  { code: 'PE', label: 'PE', prefix: '51',  flag: '🇵🇪' },
  { code: 'BR', label: 'BR', prefix: '55',  flag: '🇧🇷' },
  { code: 'EC', label: 'EC', prefix: '593', flag: '🇪🇨' },
  { code: 'PY', label: 'PY', prefix: '595', flag: '🇵🇾' },
  { code: 'CR', label: 'CR', prefix: '506', flag: '🇨🇷' },
  { code: 'PA', label: 'PA', prefix: '507', flag: '🇵🇦' },
  { code: 'DO', label: 'DO', prefix: '1',   flag: '🇩🇴' },
  { code: 'SV', label: 'SV', prefix: '503', flag: '🇸🇻' },
  { code: 'GT', label: 'GT', prefix: '502', flag: '🇬🇹' },
  { code: 'HN', label: 'HN', prefix: '504', flag: '🇭🇳' },
  { code: 'BO', label: 'BO', prefix: '591', flag: '🇧🇴' },
  { code: 'VE', label: 'VE', prefix: '58',  flag: '🇻🇪' },
  { code: 'NI', label: 'NI', prefix: '505', flag: '🇳🇮' },
];

function PhoneInput({ value, onChange, placeholder = '9X XXX XXX', style = {} }) {
  const [pais,   setPais]   = useState('UY');
  const [numero, setNumero] = useState('');
  const [focused, setFocused] = useState(false);
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
    <div style={{ display: 'flex', border: `1px solid ${focused ? G : '#e0e0d8'}`,
      boxShadow: focused ? `0 0 0 3px ${G}22` : 'none', borderRadius: 8,
      overflow: 'hidden', background: '#fafaf7', transition: 'border-color .15s, box-shadow .15s', ...style }}>
      <select value={pais} onChange={e => handlePais(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} aria-label="Código de país"
        style={{ border: 'none', background: 'transparent', padding: '9px 6px 9px 10px',
          fontSize: 16, fontFamily: SANS, color: '#1a1a18', cursor: 'pointer',
          outline: 'none', borderRight: '1px solid #e0e0d8', flexShrink: 0 }}>
        {PAISES.map(p => (
          <option key={p.code} value={p.code}>{p.flag} +{p.prefix}</option>
        ))}
      </select>
      <input type="tel" value={numero} onChange={e => handleChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', background: 'transparent',
          padding: '9px 12px', fontSize: 16, fontFamily: SANS,
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
  clock:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chevDown:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
};

// Íconos por industria (demo selector) — SVG en vez de emojis
const DEMO_ICONS = {
  horeca:       <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2"/><path d="M5 2v20"/><path d="M19 2v20"/><path d="M19 11c2 0 3-1.5 3-4s-1-5-3-5"/></svg>,
  bebidas:      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 8h14l-1.2 11a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8L5 8z"/><path d="M7 8l1-4h8l1 4"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  limpieza:     <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 11l4-7 3 2-3 6"/><path d="M5 21h10l1-7H6l-1 7z"/><line x1="9" y1="14" x2="9" y2="18"/><line x1="12" y1="14" x2="12" y2="18"/></svg>,
  construccion: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><rect x="9" y="13" width="6" height="8"/></svg>,
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
          <div style={{ fontSize: 13, color: '#6a6a68', lineHeight: 1.5 }}>
            Elegí una industria para ver cómo tus clientes<br/>van a hacer pedidos en tu plataforma
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(DEMO_DATASETS).map(([key, { label, desc }]) => (
            <button key={key} onClick={() => onSelect(key)}
              style={{
                background: '#fff', border: '1px solid #efefeb', borderRadius: 14,
                padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                transition: 'border-color .15s, box-shadow .15s', fontFamily: SANS,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#efefeb'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ marginBottom: 10, color: G, display: 'flex', justifyContent: 'center' }}>{DEMO_ICONS[key]}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#6a6a68' }}>{desc}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', color: '#6a6a68', fontSize: 13,
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
          <div style={{ fontSize: 13, color: '#6a6a68' }}>
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
              <div style={{ marginBottom: 8, fontSize: 12, color: '#6a6a68', letterSpacing: '0.1px' }}>
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
                  {Icon.check} Hola, {nombre}
                </div>
              )}
              {devCode && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                  padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  Dev - codigo: <strong style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</strong>
                </div>
              )}
              <label htmlFor="otp-code" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#5a5a58' }}>
                Codigo de 6 digitos
              </label>
              <input id="otp-code" type="text" inputMode="numeric" placeholder="000000" aria-label="Código de 6 dígitos"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()} autoFocus
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                style={{ width: '100%', padding: '12px', border: '1px solid #e0e0d8',
                  borderRadius: 10, fontSize: 28, fontFamily: 'monospace', fontWeight: 700,
                  textAlign: 'center', letterSpacing: 10, marginBottom: 16,
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
                  color: '#6a6a68', cursor: 'pointer', fontFamily: SANS,
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

// Descuento por volumen: devuelve el % de la mejor escala cuyo mínimo alcanza qty.
// Las escalas (item.volume_tiers = [{min,dto}]) vienen saneadas y ordenadas del API.
function volTierDto(item, qty) {
  const tiers = Array.isArray(item?.volume_tiers) ? item.volume_tiers : [];
  let dto = 0;
  for (const t of tiers) { if (qty >= t.min) dto = t.dto; }
  return dto;
}
// Primera escala (la de menor cantidad) — para mostrar un hint en la tarjeta.
function primerTier(item) {
  const tiers = Array.isArray(item?.volume_tiers) ? item.volume_tiers : [];
  return tiers.length ? tiers[0] : null;
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ item, qty, onAdd, onRemove, brandCfg, carrito, onOpen }) {
  const [imgErr, setImgErr] = useState(false);
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false); // feedback táctil (equiv. a hover en touch)
  const hasImg = item.imagen_url && !imgErr;
  const open = onOpen ? () => onOpen(item) : undefined;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const imgH = isMobile ? 120 : 160;
  // Variantes: el cliente elige cantidad por opción (color/sabor/...). El precio,
  // IVA y descuentos son del producto padre. La clave de carrito es "id::variantId".
  const variantOpts = item.precio > 0 && item.variants?.options?.length ? item.variants.options : null;

  return (
    <div style={{ background: '#fff', borderRadius: 14,
      border: `1px solid ${hov ? '#c8c8c0' : '#efefeb'}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      // Señales de "tocable" en mobile (no hay hover): (1) sombra de reposo →
      // la card se lee como superficie elevada; (2) press → se hunde al tocar.
      transform: open && pressed ? 'scale(.97)' : (hov && open ? 'translateY(-3px)' : 'none'),
      boxShadow: hov && open ? '0 8px 24px rgba(0,0,0,.10)' : '0 1px 3px rgba(0,0,0,.07)',
      transition: 'transform .14s, box-shadow .18s, border-color .15s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onPointerDown={() => open && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}>
      <div onClick={open} style={{ height: imgH, background: hasImg ? '#fff' : '#f4f4f0', padding: '12px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        cursor: open ? 'pointer' : 'default' }}>
        {hasImg
          ? <img src={item.imagen_url} alt={item.nombre} onError={() => setImgErr(true)}
              style={{ maxHeight: imgH - 1, maxWidth: '100%', objectFit: 'contain',
                transform: hov && open ? 'scale(1.06)' : 'none', transition: 'transform .25s' }} />
          : <div style={{ textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: G + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px', fontSize: 13, fontWeight: 700, color: G }}>
                {(item.marca || item.categoria || '?').slice(0, 2).toUpperCase()}
              </div>
              {item.marca && <div style={{ fontSize: 10, color: GRAY, fontWeight: 600, letterSpacing: .4 }}>{item.marca.toUpperCase()}</div>}
            </div>
        }
      </div>
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div onClick={open} style={{ fontSize: 11, color: GRAY, letterSpacing: .3,
          cursor: open ? 'pointer' : 'default' }}>{item.categoria}</div>
        <div onClick={open} style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3,
          color: hov && open ? G : '#1a1a18',
          textDecoration: hov && open ? 'underline' : 'none', textUnderlineOffset: 2,
          transition: 'color .15s', cursor: open ? 'pointer' : 'default' }}>
          {item.nombre}
        </div>
        {/* La descripción vive en la ficha de detalle (PDP). En la card sólo
            nombre + precio + acción — truncarla acá quedaba cortada a media palabra. */}
        <div onClick={open} style={{ flex: 1, cursor: open ? 'pointer' : 'default' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: G, marginTop: 4 }}>
          {item.precio > 0 ? fmt.currency(item.precio) : (
            <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, background: '#f0f0ec',
              padding: '2px 8px', borderRadius: 20, display: 'inline-block' }}>Consultar precio</span>
          )}
          {/* El precio mostrado es el del bulto entero (el importador normaliza
              precios por kilo/litro al tamaño del bulto). Por eso NO mostramos
              sufijos "/kg" o "/lt" — confundirían al cliente haciéndole creer
              que es precio por kilo. Sí mostramos unidades de venta reales (un, caja). */}
          {item.precio > 0 && item.unidad && !/^\/?\s*(kg|kgs|kilo|kilos|lt|lts|litro|litros|gr|grs|gramo|gramos|ml)\.?$/i.test(String(item.unidad).trim()) && <span style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
        </div>
        {item.precio > 0 && <IvaLine precio={item.precio} iva_rate={item.iva_rate} />}
        {item.precio > 0 && primerTier(item) && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#f0fdf4',
            border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 6px', alignSelf: 'flex-start',
            marginTop: 2 }}>
            {primerTier(item).min}+ unidades: −{primerTier(item).dto}%
          </div>
        )}
        {variantOpts ? (
          <VariantPicker item={item} options={variantOpts} carrito={carrito || {}} onAdd={onAdd} onRemove={onRemove} label={item.variants.label} />
        ) : qty > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <button onClick={() => onRemove(item)} aria-label={`Quitar una unidad de ${item.nombre}`} style={{
              width: 40, height: 40, border: `1.5px solid ${G}`, borderRadius: 8,
              background: '#fff', color: G, fontSize: 18, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
            }}>-</button>
            <input type="number" inputMode="numeric" min="0" value={qty} aria-label={`Cantidad de ${item.nombre}`} onChange={e=>{const v=parseInt(e.target.value,10);if(isNaN(v)||v<=0)onRemove(item);else{const d=v-qty;if(d>0)for(let i=0;i<d;i++)onAdd(item);else if(d<0)for(let i=0;i<-d;i++)onRemove(item);}}} onFocus={e=>e.target.select()} style={{flex:1,minWidth:0,height:40,boxSizing:'border-box',fontSize:16,fontWeight:700,color:'#1a1a18',textAlign:'center',border:'1px solid #e0e0d8',borderRadius:6,padding:'0',outline:'none',background:'#fafaf7'}}/>
            <button onClick={() => onAdd(item)} aria-label={`Agregar una unidad de ${item.nombre}`} style={{
              width: 40, height: 40, background: G, border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
            }}>+</button>
          </div>
        ) : (
          <button onClick={() => onAdd(item)} disabled={item.precio === 0} style={{
            marginTop: 4, padding: '11px 0',
            background: item.precio > 0 ? G : '#f0f0ec',
            color: item.precio > 0 ? '#fff' : GRAY,
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

// Grid de variantes: una fila por opción (swatch + nombre + stepper). El cliente
// arma un pedido mixto (ej: 3 rojos + 2 azules). Lee cantidades del carrito por
// clave "id::variantId" y delega add/remove al padre.
function VariantPicker({ item, options, carrito, onAdd, onRemove, label }) {
  const totalSel = options.reduce((s, o) => s + (carrito[`${item.id}::${o.id}`] || 0), 0);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, letterSpacing: .3, marginBottom: 5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ELEGÍ {String(label || 'VARIANTE').toUpperCase()}</span>
        {totalSel > 0 && <span style={{ color: G }}>{totalSel} en carrito</span>}
      </div>
      <div style={{ display: 'grid', gap: 4, maxHeight: 168, overflowY: 'auto', paddingRight: 2 }}>
        {options.map(o => {
          const q = carrito[`${item.id}::${o.id}`] || 0;
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 4px', borderRadius: 7, background: q > 0 ? G + '12' : '#fafaf7',
              border: `1px solid ${q > 0 ? G + '55' : '#eeeee8'}` }}>
              {o.color_hex && <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                background: o.color_hex, border: '1px solid rgba(0,0,0,.12)' }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: '#1a1a18',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
              {q > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => onRemove(item, o.id)} aria-label={`Quitar ${o.label}`} style={{
                    width: 24, height: 24, border: `1px solid ${G}`, borderRadius: 6, background: '#fff',
                    color: G, fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                  <span style={{ minWidth: 18, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>{q}</span>
                  <button onClick={() => onAdd(item, o.id)} aria-label={`Agregar ${o.label}`} style={{
                    width: 24, height: 24, border: 'none', borderRadius: 6, background: G,
                    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              ) : (
                <button onClick={() => onAdd(item, o.id)} aria-label={`Agregar ${o.label}`} style={{
                  flexShrink: 0, width: 24, height: 24, border: 'none', borderRadius: 6, background: G,
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Product Detail (PDP) ───────────────────────────────────────────────────────
// Página de detalle estilo Amazon/Shopify: el cliente hace clic en una card y entra
// a la ficha completa (imagen grande, descripción, ficha técnica y acción de compra).
// Se puede comprar desde acá — la PDP es donde más convierte. Reusa VariantPicker.
const SERIF = "Georgia,'Times New Roman',serif";
function FichaRow({ label, value, last }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '13px 0', borderBottom: last ? 'none' : '1px solid #eeeee8' }}>
      <span style={{ fontSize: 14, color: GRAY }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function ProductDetail({ item, carrito, onAdd, onRemove, onSetQty, brandCfg, isMobile, onBack }) {
  const [imgErr, setImgErr] = useState(false);
  const hasImg = item.imagen_url && !imgErr;
  const variantOpts = item.precio > 0 && item.variants?.options?.length ? item.variants.options : null;
  const qty = carrito[item.id] || 0;
  // Input de cantidad editable: mientras el cliente escribe usamos texto local,
  // y sólo al perder foco normalizamos contra el mínimo de pedido.
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  useEffect(() => { if (!editingQty) setQtyInput(qty > 0 ? String(qty) : ''); }, [qty, editingQty]);
  // Unidades reales de venta (un/caja) — NO sufijos kg/lt (ver nota en ProductCard).
  const showUnidad = item.precio > 0 && item.unidad && !/^\/?\s*(kg|kgs|kilo|kilos|lt|lts|litro|litros|gr|grs|gramo|gramos|ml)\.?$/i.test(String(item.unidad).trim());
  const tel = (brandCfg?.ownerPhone || '').replace(/[^0-9]/g, '');
  const waLink = tel ? `https://wa.me/${tel}?text=${encodeURIComponent('Hola, quiero consultar disponibilidad de: ' + item.nombre)}` : null;

  const imgBox = (
    <div style={{ background: '#fff', border: '1px solid #efefeb', borderRadius: 16,
      minHeight: isMobile ? 260 : 460, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24 }}>
      {hasImg
        ? <img src={item.imagen_url} alt={item.nombre} onError={() => setImgErr(true)}
            style={{ maxWidth: '100%', maxHeight: isMobile ? 240 : 420, objectFit: 'contain' }} />
        : <div style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 14, background: G + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px', fontSize: 22, fontWeight: 700, color: G }}>
              {(item.marca || item.categoria || '?').slice(0, 2).toUpperCase()}
            </div>
            {item.marca && <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, letterSpacing: .5 }}>{item.marca.toUpperCase()}</div>}
          </div>}
    </div>
  );

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 18px 60px' : '24px 24px 80px' }}>
      {/* Botón de volver — affordance clara para regresar al catálogo (patrón mobile Amazon/Shopify) */}
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: G, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        padding: '6px 10px 6px 0', marginBottom: isMobile ? 10 : 14, fontFamily: SANS }}>
        <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>{'\u2039'}</span> Volver al catálogo
      </button>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: GRAY, marginBottom: isMobile ? 16 : 28, display: 'flex',
        alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span onClick={onBack} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onBack(); }}
          style={{ cursor: 'pointer' }}>Inicio</span>
        <span style={{ color: '#d0d0c8' }}>/</span>
        <span onClick={onBack} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onBack(); }}
          style={{ cursor: 'pointer' }}>Catálogo</span>
        <span style={{ color: '#d0d0c8' }}>/</span>
        <span style={{ color: '#1a1a18' }}>{item.nombre}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 48, alignItems: 'start' }}>
        {imgBox}

        <div>
          {item.marca && <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, letterSpacing: 1.2, marginBottom: 10 }}>{item.marca.toUpperCase()}</div>}
          <h1 style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 34, fontWeight: 600, color: '#1a1a18', margin: '0 0 18px', lineHeight: 1.15 }}>
            {item.nombre}
          </h1>
          {item.descripcion && (
            <p style={{ fontSize: 15, color: '#4a4a46', lineHeight: 1.6, margin: '0 0 28px' }}>{item.descripcion}</p>
          )}

          {/* Ficha técnica — sólo filas con datos */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18', letterSpacing: 1, marginBottom: 4 }}>FICHA TÉCNICA</div>
          <div style={{ marginBottom: 28 }}>
            <FichaRow label="Formato" value={showUnidad ? item.unidad : (item.unidad && item.unidad !== 'un' ? item.unidad : null)} />
            <FichaRow label="Marca" value={item.marca || null} />
            <FichaRow label="Categoría" value={item.categoria || null} last />
          </div>

          {/* Acción de compra */}
          {item.precio > 0 && (
            <div style={{ fontSize: 24, fontWeight: 700, color: G, marginBottom: 4 }}>
              {fmt.currency(item.precio)}
              {showUnidad && <span style={{ fontSize: 13, color: GRAY, fontWeight: 400, marginLeft: 5 }}>/ {item.unidad}</span>}
            </div>
          )}
          {item.precio > 0 && <div style={{ marginBottom: 16 }}><IvaLine precio={item.precio} iva_rate={item.iva_rate} /></div>}

          {variantOpts ? (
            <div style={{ maxWidth: 420 }}>
              <VariantPicker item={item} options={variantOpts} carrito={carrito} onAdd={onAdd} onRemove={onRemove} label={item.variants.label} />
            </div>
          ) : item.precio > 0 ? (
            qty > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                <button onClick={() => onRemove(item)} aria-label={`Quitar una unidad de ${item.nombre}`} style={{
                  width: 48, height: 48, border: `1.5px solid ${G}`, borderRadius: 10, background: '#fff',
                  color: G, fontSize: 20, cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{'\u2212'}</button>
                <input type="text" inputMode="numeric" value={qtyInput}
                  aria-label={`Cantidad de ${item.nombre}`}
                  onFocus={() => setEditingQty(true)}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setQtyInput(v);
                    if (v !== '') onSetQty(item, undefined, parseInt(v, 10));
                  }}
                  onBlur={() => {
                    setEditingQty(false);
                    const n = parseInt(qtyInput, 10);
                    const min = item.min_order_qty || 1;
                    if (!n || n <= 0) onSetQty(item, undefined, 0);
                    else if (n < min) onSetQty(item, undefined, min);
                  }}
                  style={{ flex: 1, width: '100%', height: 48, textAlign: 'center', boxSizing: 'border-box',
                    fontSize: 18, fontWeight: 700, color: '#1a1a18', border: '1px solid #e0e0d8', borderRadius: 10,
                    background: '#fff', outline: 'none', fontFamily: SANS }} />
                <button onClick={() => onAdd(item)} aria-label={`Agregar una unidad de ${item.nombre}`} style={{
                  width: 48, height: 48, background: G, border: 'none', borderRadius: 10, color: '#fff',
                  fontSize: 20, cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
              </div>
            ) : (
              <button onClick={() => onAdd(item)} style={{
                width: '100%', maxWidth: 420, padding: '15px 0', background: G, color: '#fff', border: 'none',
                borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: SANS }}>
                {item.min_order_qty > 1 ? `Agregar (mín. ${item.min_order_qty})` : 'Agregar al carrito'}
              </button>
            )
          ) : (
            <div style={{ maxWidth: 420 }}>
              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer" style={{
                  display: 'block', textAlign: 'center', width: '100%', padding: '15px 0', background: '#1f2d24',
                  color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700,
                  fontFamily: SANS, textDecoration: 'none', boxSizing: 'border-box' }}>
                  Consultar disponibilidad
                </a>
              ) : (
                <div style={{ textAlign: 'center', width: '100%', padding: '15px 0', background: '#f0f0ec',
                  color: GRAY, borderRadius: 12, fontSize: 15, fontWeight: 700 }}>Consultar disponibilidad</div>
              )}
              <div style={{ textAlign: 'center', fontSize: 12, color: GRAY, marginTop: 10 }}>Te respondemos por WhatsApp</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Historial ─────────────────────────────────────────────────────────────────
function HistorialPedidos({ session, onReordenar }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expand,  setExpand]  = useState(null);
  const [dlId,    setDlId]    = useState(null);

  const descargarComprobante = async (pedidoId) => {
    if (!session?.token || session?.token === 'demo-token') return;
    setDlId(pedidoId);
    try {
      const r = await fetch(`${API}/api/pedido?action=comprobante&orderId=${encodeURIComponent(pedidoId)}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!r.ok) throw new Error('No se pudo generar el comprobante');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante-OC-${String(pedidoId).slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert('No se pudo descargar el comprobante. Intentá de nuevo.');
    } finally {
      setDlId(null);
    }
  };

  const EST = {
    pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fffbeb' },
    importada:  { label: 'Confirmado', color: '#059669', bg: '#f0fdf4' },
    confirmada: { label: 'Confirmado', color: '#059669', bg: '#f0fdf4' },
    preparada:  { label: 'Preparando', color: '#7c3aed', bg: '#f5f3ff' },
    en_ruta:    { label: 'En camino',  color: '#f97316', bg: '#fff7ed' },
    entregada:  { label: 'Entregado',  color: '#059669', bg: '#f0fdf4' },
    cancelada:  { label: 'Cancelado',  color: '#ef4444', bg: '#fef2f2' },
  };

  useEffect(() => {
    // MEDIO: sin token (o demo) cortábamos el effect sin apagar loading → el
    // historial quedaba en "Cargando..." para siempre. Apagar loading al salir.
    if (!session?.token || session?.token === 'demo-token') { setLoading(false); return; }
    fetch(`${API}/api/pedido?action=historial`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPedidos(d.pedidos || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#6a6a68', fontSize: 14 }}>
      Cargando historial...
    </div>
  );

  if (!pedidos.length) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>Sin pedidos aun</div>
      <div style={{ fontSize: 13, color: '#6a6a68' }}>Tus pedidos confirmados apareceran aca</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pedidos.map(p => {
        const est   = EST[p.estado] || EST.pendiente;
        const isExp = expand === p.id;
        const fecha = new Date(p.creado_en).toLocaleDateString('es', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        return (
          <div key={p.id} onClick={() => setExpand(isExp ? null : p.id)}
            style={{ background: '#fff', borderRadius: 14, border: '1px solid #efefeb',
              overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 3 }}>{fecha}</div>
                <div style={{ fontSize: 11, color: '#6a6a68' }}>
                  {Array.isArray(p.items) ? p.items.length : 0} producto{p.items?.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: G }}>{fmt.currency(p.total)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: est.color,
                  background: est.bg, padding: '2px 8px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                  {est.label}
                </span>
              </div>
              <div style={{ color: '#c0c0b8', display: 'flex', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>{Icon.chevDown}</div>
            </div>
            {isExp && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f5f5f0' }}>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(p.items || []).map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, padding: '6px 0', color: '#4a4a42',
                      borderBottom: i < p.items.length - 1 ? '1px solid #f5f5f0' : 'none' }}>
                      <span>{it.cantidad} x {it.nombre}</span>
                      <span style={{ fontWeight: 600, color: G }}>{fmt.currency(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); onReordenar(p); }} style={{
                    flex: 1, padding: '9px 0',
                    background: '#f0fdf4', color: G, border: '1px solid #bbf7d0',
                    borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                    fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {Icon.repeat} Repetir pedido
                  </button>
                  <button onClick={e => { e.stopPropagation(); descargarComprobante(p.id); }} disabled={dlId === p.id} style={{
                    flex: 1, padding: '9px 0',
                    background: '#fff', color: '#4a4a42', border: '1px solid #e0e0d8',
                    borderRadius: 9, cursor: dlId === p.id ? 'default' : 'pointer', fontWeight: 600, fontSize: 12,
                    fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: dlId === p.id ? 0.6 : 1,
                  }}>
                    {dlId === p.id ? 'Generando...' : 'Descargar PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────
function CartDrawer({ carrito, items, session, onClose, onConfirm, onAdd, onRemove, onRemoveLine, brandCfg, coBuy, recommended }) {
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState('');

  // La clave puede ser "id" (producto simple) o "id::variantId" (con variante).
  // Resolvemos el producto base y, si hay variante, anexamos su etiqueta al nombre
  // y guardamos variantId para el pedido. El precio/IVA/descuentos son del padre.
  const lineas = Object.entries(carrito)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const sep = key.indexOf('::');
      const baseId = sep === -1 ? key : key.slice(0, sep);
      const variantId = sep === -1 ? null : key.slice(sep + 2);
      const base = items.find(i => i.id === baseId);
      if (!base) return null;
      if (!variantId) return { key, item: base, qty, variantId: null };
      const opt = base.variants?.options?.find(o => o.id === variantId);
      const item = { ...base, nombre: opt ? `${base.nombre} — ${opt.label}` : base.nombre };
      return { key, item, qty, variantId, variantLabel: opt?.label || null, variantSku: opt?.sku || null };
    })
    .filter(Boolean);

  const lineasConCalc = lineas.map(({ key, item, qty, variantId, variantSku }) => {
    const ivaRate = item.iva_rate != null ? Number(item.iva_rate) : 0;
    // Descuento aplicable = el mayor entre el dto del item y la escala por volumen que
    // alcanza la cantidad pedida. El descuento por volumen premia comprar en bulto.
    const volDto = volTierDto(item, qty);
    const descPct = Math.max(item.descGlobal || 0, volDto);
    const precioConDto = descPct > 0 ? Math.round(item.precio * (1 - descPct / 100) * 100) / 100 : item.precio;
    const netoLinea = precioConDto * qty;
    const ivaLinea = netoLinea * (ivaRate / 100);
    return { key, item, qty, variantId, variantSku, ivaRate, descPct, volDto, precioConDto, netoLinea, ivaLinea };
  });
  const subtotalNeto = lineasConCalc.reduce((s, l) => s + l.netoLinea, 0);
  const ivaTotal = lineasConCalc.reduce((s, l) => s + l.ivaLinea, 0);
  const total = subtotalNeto + ivaTotal;

  // Cross-sell: productos que suelen pedirse JUNTO con lo que ya hay en el carrito.
  // Se arma desde la co-ocurrencia real de pedidos (coBuy). Si no alcanza para
  // llenar la tira, completa con los populares entre clientes similares
  // (recommended). Se excluyen los que ya están en el carrito y los que no se
  // pueden agregar de un toque (sin precio o con variantes).
  const sugeridos = useMemo(() => {
    if (lineas.length === 0) return [];
    const cartIds = new Set(lineas.map(l => l.item.id));
    const score = {};
    lineas.forEach(l => {
      (coBuy?.[l.item.id] || []).forEach((cid, idx) => {
        if (cartIds.has(cid)) return;
        score[cid] = (score[cid] || 0) + (6 - idx);
      });
    });
    const pickable = p => p && p.precio > 0 && !(p.variants?.options?.length);
    const out = Object.entries(score)
      .sort((a, b) => b[1] - a[1])
      .map(e => items.find(p => p.id === e[0]))
      .filter(pickable);
    if (out.length < 4 && Array.isArray(recommended)) {
      recommended.forEach(r => {
        if (out.length >= 4 || cartIds.has(r.id) || out.find(s => s.id === r.id)) return;
        const full = items.find(p => p.id === r.id);
        if (pickable(full)) out.push(full);
      });
    }
    return out.slice(0, 4);
  }, [lineas, coBuy, recommended, items]);

  // Mínimo de pedido (genérico por-org vía app_config brandcfg). 0 = sin mínimo.
  // Se mide sobre el subtotal neto (mercadería sin IVA), el criterio wholesale habitual.
  const minOrderAmount = Number(brandCfg?.minOrderAmount) || 0;
  const faltaParaMinimo = minOrderAmount > 0 ? Math.max(0, minOrderAmount - subtotalNeto) : 0;
  const cumpleMinimo = faltaParaMinimo <= 0;

  // A7: idempotencyKey ESTABLE por carrito. Antes se generaba con Date.now()+random
  // en cada click → un doble-tap o un retry de red creaba pedidos duplicados. Atada
  // a la identidad del carrito: mismo carrito = misma key (el server deduplica),
  // cambia el carrito = key nueva.
  const idempotencyKey = useMemo(
    () => `${session?.tel || 'anon'}-${crypto.randomUUID()}`,
    [carrito, session?.tel]
  );

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

    setLoading(true); setErr('');
    try {
      const r = await fetch(`${window.location.origin}/api/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
        body: JSON.stringify({
          org: ORG, clienteId: session.clienteId,
          clienteNombre: session.nombre, clienteTelefono: session.tel,
          items: lineasConCalc.map(l => ({
            productId: l.item.id, nombre: l.item.nombre, unidad: l.item.unidad,
            cantidad: l.qty, precioUnit: l.precioConDto, subtotal: l.netoLinea,
            ...(l.variantId ? { variantId: l.variantId, variantSku: l.variantSku || '' } : {}),
          })),
          total, notas,
          direccion_entrega: addresses.find(a => a.id === selectedAddress)?.direccion || null,
          idempotencyKey,
        }),
      });
      // Solo marcamos done → se muestra la pantalla de confirmación. El carrito se
      // limpia y el drawer se cierra recién cuando el usuario descarta esa pantalla
      // (onConfirm), no antes; si no, el drawer se desmontaba y la confirmación
      // nunca llegaba a verse.
      if (r.ok) { track('pedido_confirmado', { items: lineas.length, total }); setDone(true); }
      else { const d = await r.json().catch(() => ({})); setErr(d.error || 'No se pudo confirmar el pedido.'); }
    } catch { setErr('Error de conexión. Intentá de nuevo.'); }
    finally { setLoading(false); }
  };

  const pedidoRef = Math.random().toString(36).slice(2,8).toUpperCase();
  const fechaHoy  = new Date().toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: Z.overlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onConfirm}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', fontFamily: SANS, position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onConfirm} aria-label="Cerrar" style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 36, height: 36, borderRadius: '50%',
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', letterSpacing: .5, marginBottom: 10 }}>
            DETALLE DEL PEDIDO
          </div>
          {lineasConCalc.map(({ key, item, qty, descPct, precioConDto, netoLinea, ivaRate }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #f5f5f0', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2 }}>
                  {qty} × {fmt.currency(item.precio)}
                  {descPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{descPct}%</span>}
                  <span style={{ color: '#c0c0b8', marginLeft: 4 }}>IVA {ivaRate}%</span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
                {fmt.currency(netoLinea)}
              </div>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ background: '#f7f7f4', borderRadius: 10, padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>Subtotal neto</span>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currency(subtotalNeto)}</span>
            </div>
            {[...new Set(lineasConCalc.map(l => l.ivaRate))].sort((a,b)=>a-b).map(rate => {
              const ivaDeRate = lineasConCalc.filter(l => l.ivaRate === rate).reduce((s,l) => s + l.ivaLinea, 0);
              return (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>IVA {rate}%</span>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currency(ivaDeRate)}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #e8e8e0', paddingTop: 8, marginTop: 2,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>Total con IVA</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: G }}>{fmt.currency(total)}</span>
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
          <p style={{ fontSize: 12, color: '#6a6a68', textAlign: 'center', marginBottom: 14, lineHeight: 1.6 }}>
            Tu distribuidor recibio el pedido. Te avisamos cuando este confirmado.
          </p>
          <button onClick={onConfirm} style={{
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: Z.overlay }}
      onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.min(400, window.innerWidth), background: '#fff',
        display: 'flex', flexDirection: 'column', fontFamily: SANS }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0ede8',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18' }}>Tu pedido</div>
            <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>
              {lineas.length} producto{lineas.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar carrito" style={{ background: '#f4f4f0', border: 'none',
            borderRadius: 8, width: 40, height: 40, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a6a68' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {lineasConCalc.map(({ key, item, qty, variantId, ivaRate, descPct, precioConDto, netoLinea }) => (
            <div key={key} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span>{fmt.currency(item.precio)}{item.unidad ? ` / ${item.unidad}` : ''}</span>
                    {descPct > 0 && <span style={{ color: '#dc2626' }}>-{descPct}%</span>}
                    <span style={{ color: '#c0c0b8' }}>IVA {ivaRate}%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {descPct > 0 && (
                    <div style={{ fontSize: 11, color: '#b0b0a8', textDecoration: 'line-through' }}>
                      {fmt.currency(item.precio * qty)}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: G }}>
                    {fmt.currency(netoLinea)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e2dc', borderRadius: 8, overflow: 'hidden' }}>
                  <button onClick={() => onRemove && onRemove(item, variantId)} aria-label={`Quitar uno de ${item.nombre}`} style={{
                    width: 32, height: 32, border: 'none', background: '#f7f7f4', color: G,
                    fontSize: 18, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                  <span aria-live="polite" style={{ minWidth: 36, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1a1a18' }}>{qty}</span>
                  <button onClick={() => onAdd && onAdd(item, variantId)} aria-label={`Agregar uno de ${item.nombre}`} style={{
                    width: 32, height: 32, border: 'none', background: '#f7f7f4', color: G,
                    fontSize: 18, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <button onClick={() => onRemoveLine && onRemoveLine(item, variantId)} aria-label={`Eliminar ${item.nombre} del carrito`} style={{
                  background: 'none', border: 'none', color: '#b0b0a8', fontSize: 11,
                  cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 4, padding: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {sugeridos.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0ede8' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18' }}>
                Quienes pidieron esto también sumaron
              </div>
              <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 1, marginBottom: 10 }}>
                Completá tu pedido con lo que suele ir junto
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {sugeridos.map(p => (
                  <div key={p.id} style={{ flex: '0 0 134px', width: 134, border: '1px solid #ececec',
                    borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: '#fff' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18', lineHeight: 1.3,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', minHeight: 31 }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G }}>{fmt.currency(p.precio)}</div>
                    <button onClick={() => onAdd && onAdd(p)} aria-label={`Agregar ${p.nombre}`} style={{
                      marginTop: 'auto', padding: '7px 0', background: G, color: '#fff', border: 'none',
                      borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                      + Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {addresses.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6a6a68', marginBottom: 6 }}>Dirección de entrega</div>
              <select value={selectedAddress || ''} onChange={e => setSelectedAddress(Number(e.target.value))}
                aria-label="Dirección de entrega"
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8', borderRadius: 8,
                  fontSize: 16, fontFamily: SANS, background: '#fafaf7', outline: 'none' }}>
                {addresses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label}: {a.direccion}{a.ciudad ? ` — ${a.ciudad}` : ''}
                  </option>
                ))}
              </select>
              {addresses.find(a => a.id === selectedAddress)?.referencia && (
                <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 4, fontStyle: 'italic' }}>
                  {addresses.find(a => a.id === selectedAddress).referencia}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6a6a68', marginBottom: 6 }}>Notas del pedido</div>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: entregar antes del mediodia..." aria-label="Notas del pedido"
              onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
              onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
              rows={3} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8',
                borderRadius: 8, fontSize: 16, fontFamily: SANS, resize: 'none',
                boxSizing: 'border-box', outline: 'none', background: '#fafaf7' }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f0ede8' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>Subtotal neto</span>
              <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currency(subtotalNeto)}</span>
            </div>
            {[...new Set(lineasConCalc.map(l => l.ivaRate))].sort((a,b)=>a-b).map(rate => {
              const ivaRate = lineasConCalc.filter(l => l.ivaRate === rate).reduce((s,l) => s + l.ivaLinea, 0);
              return (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>IVA {rate}%</span>
                  <span style={{ fontSize: 12, color: '#6a6a68' }}>{fmt.currency(ivaRate)}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '0.5px solid #e8e8e0', paddingTop: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>Total con IVA</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: G }}>{fmt.currency(total)}</span>
            </div>
          </div>
          {err && (
            <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '9px 12px', marginBottom: 10, fontSize: 12, color: '#dc2626' }}>
              {err}
            </div>
          )}
          {minOrderAmount > 0 && !cumpleMinimo && lineas.length > 0 && (
            <div role="alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
              padding: '9px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
              Pedido mínimo de {fmt.currency(minOrderAmount)}. Te faltan {fmt.currency(faltaParaMinimo)} para confirmar.
            </div>
          )}
          <button onClick={confirmar} disabled={loading || lineas.length === 0 || !cumpleMinimo} style={{
            width: '100%', padding: '13px 0',
            background: loading || lineas.length === 0 || !cumpleMinimo ? '#c8c8c0' : G,
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
            fontWeight: 600, cursor: (loading || !cumpleMinimo) ? 'not-allowed' : 'pointer', fontFamily: SANS,
          }}>
            {loading ? 'Enviando...' : (!cumpleMinimo ? `Mínimo ${fmt.currency(minOrderAmount)}` : 'Confirmar pedido')}
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
  const [detalle,  setDetalle]  = useState(null); // producto abierto en la PDP (null = grilla)
  const [showEstadoCuenta, setShowEstadoCuenta] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [buyAgain, setBuyAgain] = useState([]);
  const [coBuy, setCoBuy] = useState({}); // productoId -> [ids que suele pedirse junto]
  const [items,    setItems]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [brandNombre, setBrandNombre] = useState('');
  const [brandCfg, setBrandCfg] = useState(null);
  const [portalBloqueado, setPortalBloqueado] = useState(null); // mensaje si el portal está deshabilitado
  const [horarioInfo, setHorarioInfo] = useState(null);
  const [catFil,   setCatFil]   = useState('Todos');
  const [busq,     setBusq]     = useState('');
  const [carrito,  setCarrito]  = useState(() => loadCart(loadSession()?.clienteId));
  const [showCart, setShowCart] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [ddOpen,   setDdOpen]   = useState(false);
  const [udOpen,   setUdOpen]   = useState(false);
  const [reorderMsg, setReorderMsg] = useState(''); // toast al reordenar (items no disponibles)
  const NAV_MAX = 10;

  useEffect(() => {
    if (!reorderMsg) return;
    const t = setTimeout(() => setReorderMsg(''), 4000);
    return () => clearTimeout(t);
  }, [reorderMsg]);

  const totalItems = Object.values(carrito).reduce((s, q) => s + q, 0);

  // ── Persistencia del carrito por cliente ──────────────────────────────────
  // Identidad del carrito: cliente logueado, o un slot propio por dataset demo.
  const cartCli = isPortalDemo ? `demo-${portalDemo}` : (session?.clienteId || null);
  const loadedCliRef = useRef(loadSession()?.clienteId || null);
  const skipPersistRef = useRef(false);
  // Al cambiar de identidad (login / logout / cambio de demo) cargamos el carrito
  // guardado de ESE cliente, sin pisar lo que ya tenía.
  useEffect(() => {
    if (loadedCliRef.current === cartCli) return;
    loadedCliRef.current = cartCli;
    skipPersistRef.current = true;   // evita que el efecto de guardado escriba el carrito viejo en la clave nueva
    setCarrito(loadCart(cartCli));
  }, [cartCli]);
  // Guardamos el carrito cada vez que cambia, bajo la clave del cliente actual.
  useEffect(() => {
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    try { localStorage.setItem(cartStorageKey(cartCli), JSON.stringify(carrito)); } catch { /* storage lleno / bloqueado */ }
  }, [carrito, cartCli]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

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
    })); // precio 0 = consultar precio, se muestra igual
    setItems(prods);
    const categories = ['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))];
    setCats(categories);
    setBrandNombre(ds.data.org.name);
  }, [portalDemo, isPortalDemo]);

  const loadCatalogo = useCallback(async (ses) => {
    if (!ses?.clienteId) return;
    setLoading(true);
    try {
      const r = await fetch(`${window.location.origin}/api/catalogo?org=${ORG}&cliente=${ses.clienteId}`,
        ses.token ? { headers: { Authorization: `Bearer ${ses.token}` } } : undefined);

      // Revalidación de sesión: si el server rechaza el token (expirado o revocado —
      // ej. el distribuidor dio de baja al cliente), no mostramos datos viejos:
      // limpiamos la sesión local y volvemos al login. (El TTL es de 7 días, así que
      // esto cubre sobre todo la revocación, no la expiración normal.)
      if (r.status === 401 && ses.token && ses.token !== 'demo-token') {
        localStorage.removeItem(SK);
        setSession(null); setItems([]); setCarrito({});
        return;
      }
      const d = await r.json();

      // Branding vive en portalCfg (catalogo.js carga app_config key=brandcfg ahí).
      // Antes se leía d.brandCfg (inexistente) con campo .nombre (es .name) → marca nunca cargaba.
      if (d.portalCfg) {
        setBrandCfg(d.portalCfg);
        if (d.portalCfg.name) setBrandNombre(d.portalCfg.name);
      }

      // Portal deshabilitado a nivel org (catálogo apagado) o para este cliente (portal_activo=false).
      if (d.portalDisabled) {
        setPortalBloqueado('El catálogo no está disponible en este momento. Contactá a tu proveedor.');
        setItems([]); setCats(['Todos']);
        return;
      }
      if (d.portalActivo === false) {
        setPortalBloqueado('Tu acceso al portal está temporalmente desactivado. Contactá a tu proveedor.');
        setItems([]); setCats(['Todos']);
        return;
      }
      setPortalBloqueado(null);

      if (d.items) {
        const prods = d.items;
        setItems(prods);
        setCats(['Todos', ...(d.categorias || [])]);
        if (d.horarioDesde || d.horarioHasta) setHorarioInfo({ desde: d.horarioDesde, hasta: d.horarioHasta });
        try { window.posthog?.identify(ses.clienteId, { nombre: ses.nombre, org: ORG }); } catch {}
        try { window.posthog?.capture('catalogo_visto', { org: ORG, productos: prods.length }); } catch {}
        if (Array.isArray(d.recommended)) setRecommended(d.recommended);
        if (Array.isArray(d.buyAgain)) setBuyAgain(d.buyAgain);
        if (d.coBuy && typeof d.coBuy === 'object') setCoBuy(d.coBuy);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Demo mode: inject fake buyAgain and recommended when demo products load
  useEffect(() => {
    if (!isPortalDemo || items.length === 0) return;
    var baItems = items.slice(0, 6).map(function(p) {
      return { id: p.id, nombre: p.nombre, precio: p.precio || 100, unidad: p.unidad || 'u.', categoria: p.categoria };
    });
    setBuyAgain(baItems);
    var recItems = items.slice(8, 12).map(function(p) {
      return { id: p.id, nombre: p.nombre, precio: p.precio || 100, unit: p.unidad || 'u.', reason: Math.ceil(2 + ((p.nombre||'').length % 3)) + ' clientes lo compran' };
    });
    setRecommended(recItems);
    // Demo: co-ocurrencia ficticia para que el cross-sell del carrito se vea
    var co = {};
    items.slice(0, 16).forEach(function(p, idx) {
      co[p.id] = items.slice(idx + 1, idx + 5).map(function(q) { return q.id; }).filter(Boolean);
    });
    setCoBuy(co);
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

  // Clave de carrito: producto simple -> "id". Con variante -> "id::variantId".
  // Retrocompatible: los productos sin variante siguen usando su id pelado.
  const cartKey = (item, variantId) => variantId ? `${item.id}::${variantId}` : item.id;
  const addItem = (item, variantId) => { track('producto_agregado', { producto: item.nombre, precio: item.precio, variante: variantId || null }); setCarrito(c => { const k = cartKey(item, variantId); const cur = c[k] || 0; const min = item.min_order_qty || 1; return { ...c, [k]: cur === 0 ? min : cur + 1 }; }); };
  const removeItem = (item, variantId) => setCarrito(c => {
    const k = cartKey(item, variantId);
    const q = (c[k] || 0) - 1;
    const min = item.min_order_qty || 1;
    if (q < min) { const n = { ...c }; delete n[k]; return n; }
    return { ...c, [k]: q };
  });
  const removeLine = (item, variantId) => setCarrito(c => { const n = { ...c }; delete n[cartKey(item, variantId)]; return n; });
  // Fija la cantidad exacta escrita por el cliente (input editable en la ficha del producto).
  const setItemQty = (item, variantId, val) => setCarrito(c => {
    const k = cartKey(item, variantId);
    const n = { ...c };
    if (!val || val <= 0) { delete n[k]; return n; }
    n[k] = Math.floor(val);
    return n;
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
        position: 'sticky', top: 0, zIndex: Z.header }} onClick={() => { setDdOpen(false); setUdOpen(false); }}>

        <div style={{ maxWidth: 1300, margin: '0 auto', padding: isMobile ? '6px 12px' : '0 24px',
          minHeight: 56, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 16,
          borderBottom: '0.5px solid #f0f0ec', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div onClick={() => { setVista('catalogo'); setCatFil('Todos'); setBusq(''); setDetalle(null); }}
            role="button" tabIndex={0} aria-label="Volver al catálogo"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setVista('catalogo'); setCatFil('Todos'); setBusq(''); setDetalle(null); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, cursor: 'pointer' }}>
            {brandCfg?.logoUrl ? (
              <img src={brandCfg.logoUrl} alt={brandNombre || 'Logo'}
                style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain', background: '#fff' }} />
            ) : (
              <div style={{ width: 28, height: 28, background: G, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon.logo}
              </div>
            )}
            {brandNombre && (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', whiteSpace: 'nowrap' }}>
                {brandNombre}
              </span>
            )}
          </div>
          {vista === 'catalogo' ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: isMobile ? '4px 0' : '0 16px', ...(isMobile ? { order: 10, flex: '1 1 100%' } : {}) }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 560 }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: GRAY }}>{Icon.search}</div>
                <input value={busq} onChange={e => { setBusq(e.target.value); if (detalle) setDetalle(null); }}
                  placeholder="Buscar producto o marca..." aria-label="Buscar producto o marca"
                  style={{ width: '100%', padding: '9px 16px 9px 36px',
                    border: '1.5px solid #e0e0d8', borderRadius: 28, fontSize: 16,
                    fontFamily: SANS, boxSizing: 'border-box', outline: 'none',
                    background: '#f7f7f4', color: '#1a1a18' }}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = '#e0e0d8'} />
              </div>
            </div>
          ) : <div style={{ flex: 1 }} />}
            <button onClick={() => totalItems > 0 && setShowCart(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
            borderRadius: 24, border: 'none', cursor: 'pointer',
            background: totalItems > 0 ? G : '#f0f0ec',
            color: totalItems > 0 ? '#fff' : '#6a6a68',
            fontFamily: SANS, fontSize: 13, fontWeight: 500, flexShrink: 0,
          }}>
            {Icon.cart}
            {totalItems > 0 ? `${totalItems} item${totalItems !== 1 ? 's' : ''}` : 'Carrito'}
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}
            onMouseEnter={() => !isMobile && setUdOpen(true)}
            onMouseLeave={() => !isMobile && setUdOpen(false)}>
            <button type="button" aria-label="Menú de usuario" aria-haspopup="menu" aria-expanded={udOpen}
              onClick={e => { e.stopPropagation(); setUdOpen(o => !o); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: 'transparent', border: 'none', fontFamily: SANS }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: G, flexShrink: 0, border: '1.5px solid #bbf7d0' }}>
                {effectiveSession?.nombre?.slice(0,1).toUpperCase()}
              </div>
              {!isMobile && <span style={{ fontSize: 13, color: '#1a1a18', fontWeight: 500 }}>
                {effectiveSession?.nombre}
              </span>}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6a6a68" strokeWidth="2.5" style={{ transform: udOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="udd" onClick={e => e.stopPropagation()} style={{ display: udOpen ? 'block' : 'none', position: 'absolute', right: 0, top: '100%',
              background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10,
              padding: '6px 0', minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,.1)', zIndex: Z.dropdown }}>
              <div style={{ padding: '8px 16px 6px', fontSize: 11, color: '#6a6a68', letterSpacing: .3 }}>
                {effectiveSession?.nombre}
              </div>
              <div style={{ borderTop: '0.5px solid #f0f0ec', margin: '4px 0' }} />
              <button onClick={() => { setUdOpen(false); setVista('historial'); setDetalle(null); }} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#3a3a32', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f7f7f4'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                {Icon.history} Mis pedidos
              </button>
              <button onClick={() => { if (!isPortalDemo) { setUdOpen(false); setShowEstadoCuenta(true); } }} style={{ ...(isPortalDemo ? {opacity:0.4,pointerEvents:'none'} : {}),
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#3a3a32', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f7f7f4'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                Estado de cuenta
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

        <nav aria-label="Categorías" style={{ maxWidth: 1300, margin: '0 auto', padding: '0 12px',
          display: 'flex', alignItems: 'center',
          height: 44, position: 'relative', overflowX: isMobile ? 'auto' : 'visible', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} onClick={e => e.stopPropagation()}>
          {buyAgain.length > 0 && (vista === 'catalogo' || vista === 'habituales') && (
            <button onClick={() => { setVista('habituales'); setDetalle(null); setDdOpen(false); }} style={{
              padding: '0 14px', height: 44, border: 'none', background: 'transparent',
              fontSize: 14, fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: vista === 'habituales' ? 500 : 400,
              color: vista === 'habituales' ? G : '#5a5a52',
              borderBottom: vista === 'habituales' ? `2px solid ${G}` : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Volver a comprar
            </button>
          )}
          {(vista === 'catalogo' || vista === 'habituales') && (isMobile ? cats : cats.slice(0, NAV_MAX)).map(cat => (
            <button key={cat} onClick={() => { setVista('catalogo'); setCatFil(cat); setDdOpen(false); setDetalle(null); }} style={{
              padding: '0 16px', height: 44, border: 'none', background: 'transparent',
              fontSize: 14, letterSpacing: '0.1px', fontFamily: SANS,
              fontWeight: (vista === 'catalogo' && catFil === cat) ? 500 : 400,
              color: (vista === 'catalogo' && catFil === cat) ? G : '#5a5a52',
              borderBottom: (vista === 'catalogo' && catFil === cat) ? `2px solid ${G}` : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {cat}
            </button>
          ))}
          {(vista === 'catalogo' || vista === 'habituales') && !isMobile && cats.length > NAV_MAX && (
            <div style={{ position: 'relative' }}
              onMouseEnter={() => setDdOpen(true)}
              onMouseLeave={() => setDdOpen(false)}>
              <button type="button" aria-haspopup="menu" aria-expanded={ddOpen}
                onClick={e => { e.stopPropagation(); setDdOpen(o => !o); }} style={{
                padding: '0 16px', height: 44, border: 'none', background: 'transparent',
                fontSize: 14, letterSpacing: '0.1px', cursor: 'pointer', fontFamily: SANS,
                display: 'flex', alignItems: 'center', gap: 4,
                color: ddOpen ? G : '#5a5a52',
                borderBottom: (vista === 'catalogo' && cats.slice(NAV_MAX).includes(catFil)) ? `2px solid ${G}` : '2px solid transparent',
                fontWeight: (vista === 'catalogo' && cats.slice(NAV_MAX).includes(catFil)) ? 500 : 400,
              }}>
                {(vista === 'catalogo' && cats.slice(NAV_MAX).includes(catFil)) ? catFil : 'Mas'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {ddOpen && (
                <div style={{ position: 'absolute', top: 44, left: 0, background: '#fff',
                  border: '0.5px solid #e0e0d8', borderRadius: 10, padding: '6px 0',
                  minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,.08)', zIndex: Z.dropdown }}>
                  {cats.slice(NAV_MAX).map(cat => (
                    <button key={cat} onClick={() => { setVista('catalogo'); setCatFil(cat); setDdOpen(false); setDetalle(null); }} style={{
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

        </nav>
      </header>

      {horarioInfo && (
        <div style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', padding:'6px 24px', fontSize:12, color:'#92400e', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {Icon.clock} <span>Horario de recepción: <strong>{horarioInfo.desde||'?'} – {horarioInfo.hasta||'?'}</strong></span>
        </div>
      )}
      {vista === 'catalogo' && detalle && (
        <ProductDetail item={detalle} carrito={carrito} onAdd={addItem} onRemove={removeItem} onSetQty={setItemQty}
          brandCfg={brandCfg} isMobile={isMobile} onBack={() => setDetalle(null)} />
      )}
      {vista === 'catalogo' && !detalle && (
        <main style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 60px' }}>
          <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Catálogo de productos{brandNombre ? ` — ${brandNombre}` : ''}
          </h1>
          {portalBloqueado ? (
            <div role="status" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 460, margin: '0 auto' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#92400e' }}>{Icon.clock}</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', margin: '0 0 6px' }}>Portal no disponible</p>
              <p style={{ fontSize: 13, color: '#6a6a68', margin: 0, lineHeight: 1.5 }}>{portalBloqueado}</p>
            </div>
          ) : loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="sk-shimmer" style={{ borderRadius: 14, height: 240, border: '1px solid #efefeb' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 420, margin: '0 auto' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f4f4f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: GRAY }}>
                {Icon.search}
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', margin: '0 0 6px' }}>
                {items.length === 0 ? 'No hay productos disponibles' : 'Sin resultados'}
              </p>
              <p style={{ fontSize: 13, color: GRAY, margin: 0, lineHeight: 1.5 }}>
                {items.length === 0 ? 'Volvé a intentar más tarde.' : `No encontramos nada para "${busq}".`}
              </p>
              {(busq || catFil !== 'Todos') && items.length > 0 && (
                <button onClick={() => { setBusq(''); setCatFil('Todos'); }} style={{
                  marginTop: 18, padding: '10px 20px', background: G, color: '#fff', border: 'none',
                  borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 14 }}>
                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
                {filtered.map(item => (
                  <ProductCard key={item.id} item={item} brandCfg={brandCfg} carrito={carrito}
                    qty={carrito[item.id] || 0} onAdd={addItem} onRemove={removeItem} onOpen={setDetalle} />
                ))}
              </div>
            </>
          )}
        </main>
      )}

      {vista === 'habituales' && (
        <main style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 60px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Volver a comprar</h2>
            </div>
            <p style={{ fontSize: 13, color: GRAY, margin: '4px 0 0' }}>
              Los productos que pedís habitualmente, listos para volver a pedir.
            </p>
          </div>
          {(() => {
            const habituales = buyAgain.map(b => items.find(i => i.id === b.id)).filter(Boolean);
            if (habituales.length === 0) return (
              <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 440, margin: '0 auto' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', margin: '0 0 6px' }}>Todavía no tenés productos para volver a comprar</p>
                <p style={{ fontSize: 13, color: GRAY, margin: 0, lineHeight: 1.5 }}>
                  Cuando hagas tu primer pedido, tus productos van a aparecer acá para repetirlos en un toque.
                </p>
              </div>
            );
            return (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
                {habituales.map(item => (
                  <ProductCard key={item.id} item={item} brandCfg={brandCfg} carrito={carrito}
                    qty={carrito[item.id] || 0} onAdd={addItem} onRemove={removeItem}
                    onOpen={(it) => { setVista('catalogo'); setDetalle(it); }} />
                ))}
              </div>
            );
          })()}
        </main>
      )}

      {vista === 'historial' && (
        <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 24px 60px' }}>
          <button onClick={() => { setVista('catalogo'); setCatFil('Todos'); setBusq(''); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            color: G, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS,
            padding: 0, marginBottom: 14 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Volver al catálogo
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a18', marginBottom: 16 }}>Mis pedidos</h1>
          <HistorialPedidos session={session} onReordenar={order => {
            // MEDIO: validar contra el catálogo ACTUAL. Un pedido viejo puede tener
            // productos discontinuados / sin stock; antes se metían igual al carrito
            // y fallaba recién al confirmar. Sólo agregamos los disponibles y avisamos.
            const nc = {};
            let omitidos = 0;
            (order.items || []).forEach(it => {
              const id = it.id || it.productId;
              const prod = id && items.find(p => p.id === id);
              if (prod && (prod.stock == null || prod.stock > 0)) nc[id] = it.cantidad || 1;
              else omitidos++;
            });
            if (Object.keys(nc).length === 0) {
              setReorderMsg('Ninguno de esos productos está disponible ahora.');
              return;
            }
            setCarrito(nc);
            setVista('catalogo');
            if (omitidos > 0) setReorderMsg(`${omitidos} producto${omitidos !== 1 ? 's' : ''} ya no está${omitidos !== 1 ? 'n' : ''} disponible${omitidos !== 1 ? 's' : ''} y no se agregó${omitidos !== 1 ? 'aron' : ''}.`);
            setTimeout(() => setShowCart(true), 200);
          }} />
        </main>
      )}

      {reorderMsg && (
        <div role="status" style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)',
          zIndex: Z.fab + 1, background: '#1a1a18', color: '#fff', padding: '11px 18px',
          borderRadius: 10, fontSize: 13, fontFamily: SANS, fontWeight: 500, maxWidth: 'calc(100% - 40px)',
          boxShadow: '0 6px 20px rgba(0,0,0,.25)', textAlign: 'center' }}>
          {reorderMsg}
        </div>
      )}

      {totalItems > 0 && !showCart && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: Z.fab }}>
          <button onClick={() => setShowCart(true)} aria-label={`Ver carrito, ${totalItems} ${totalItems !== 1 ? 'items' : 'item'}`} style={{
            background: G, color: '#fff', border: 'none', borderRadius: '50%',
            width: 52, height: 52, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(26,138,60,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            {Icon.cart}
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626',
              color: '#fff', borderRadius: '50%', minWidth: 22, height: 22, padding: '0 5px',
              border: '2px solid #fff', boxSizing: 'border-box',
              fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {totalItems}
            </span>
          </button>
        </div>
      )}

      {/* Estado de cuenta modal */}
      {showEstadoCuenta && (
        <EstadoCuentaPortal
          session={effectiveSession}
          brandCfg={brandCfg}
          onClose={() => setShowEstadoCuenta(false)}
        />
      )}

      {showCart && (
        <CartDrawer carrito={carrito} items={items} session={session} brandCfg={brandCfg}
          coBuy={coBuy} recommended={recommended}
          onAdd={addItem} onRemove={removeItem} onRemoveLine={removeLine}
          onClose={() => setShowCart(false)}
          onConfirm={() => { setCarrito({}); setShowCart(false); }} />
      )}
    </div>
  );
}
