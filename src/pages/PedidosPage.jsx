// ── PedidosPage — Portal B2B clientes con OTP ────────────────────────────────
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fmt, getOrgId } from '../lib/constants.js';
import { calcLinea, calcTotales } from '../lib/pricing.js';
import { calcularEntrega, formatFechaLargaCap, formatFechaCorta, minutosHastaCorte, formatCuentaRegresiva } from '../lib/delivery.js';
import useSwipeBack from '../hooks/useSwipeBack.js';
import EstadoCuentaPDF from '../components/EstadoCuentaPDF.jsx';
import EstadoCuentaPortal from '../components/EstadoCuentaPortal.jsx';
import IvaLine from '../components/IvaLine.jsx';
import VozPedido from '../components/VozPedido.jsx';
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
// Vidriera editorial (lenguaje Faire): crema cálida + serif de display + verde apagado.
// Se usa SÓLO en la vidriera (PortalHome), no en el resto del portal.
const CREAM      = '#f4efe6';                                            // lienzo cálido de la vidriera
const CREAM_TILE = '#fbf8f1';                                            // tiles/cards sobre la crema
const INK        = '#28271f';                                            // texto principal cálido (no negro puro)
const DISPLAY    = "'Playfair Display',Georgia,'Times New Roman',serif"; // titulares editoriales
const FOREST     = '#3f5344';                                            // verde apagado/bosque (acentos + botones)
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

// `let` (no const): para un dominio custom (ej. pedidos.aryes.com.uy) ORG arranca
// como el hostname (placeholder) y se reemplaza con el org real apenas resuelve
// domain_orgs. Todas las funciones de abajo leen la binding viva, así que al
// reasignar ORG ya queda corregido antes de pegarle al catálogo.
let ORG = getOrgFromContext();
// ¿ORG vino del hostname (dominio custom) en vez de ?org= o un host conocido?
// En ese caso todavía no es el org real: hay que resolverlo contra domain_orgs.
const ORG_NEEDS_RESOLUTION = ORG === window.location.hostname && ORG.includes('.');
const SK   = 'aryes-pedidos-session';

// Atribución de campaña: al entrar por un anuncio (?utm_source=meta&utm_campaign=..
// o ?fbclid=..), guardamos esos parámetros para adjuntarlos si el visitante deja
// sus datos como prospecto. Se persisten en sessionStorage porque la nav interna
// (pushState) puede limpiar el query string antes de que llene el formulario.
const ATTR_KEY = 'pazque-attr';
function captureAttribution() {
  try {
    const p = new URLSearchParams(window.location.search);
    const keys = ['utm_source','utm_medium','utm_campaign','fbclid','gclid'];
    const found = {};
    keys.forEach(k => { const v = p.get(k); if (v) found[k] = v.slice(0, 200); });
    // Solo la primera vez que llega con atribución — no pisar con una nav posterior.
    if (Object.keys(found).length && !sessionStorage.getItem(ATTR_KEY)) {
      found.referrer   = (document.referrer || '').slice(0, 200);
      found.landing_url = window.location.href.slice(0, 250);
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(found));
    }
  } catch { /* sessionStorage bloqueado → sin atribución, no rompe nada */ }
}
function getAttribution() {
  try { return JSON.parse(sessionStorage.getItem(ATTR_KEY) || '{}'); }
  catch { return {}; }
}
captureAttribution();

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

// ── "Mis listas" — plantillas de recompra por cliente ────────────────────────
// El cliente guarda su carrito armado como una lista con nombre ("Pedido semanal")
// y la vuelve a cargar en un toque. Patrón "Subscribe & Save" / listas de Amazon:
// convierte al portal en la herramienta de reposición del comprador, no un catálogo
// más. Se guarda en localStorage por org+cliente (sólo cantidades por producto; los
// precios se recalculan siempre del catálogo fresco). Genérico para toda distribuidora.
function listasStorageKey(clienteId) { return `aryes-pedidos-listas::${ORG}::${clienteId || 'anon'}`; }
function loadListas(clienteId) {
  try {
    const l = JSON.parse(localStorage.getItem(listasStorageKey(clienteId)) || '[]');
    return Array.isArray(l) ? l.filter(x => x && x.id && x.items && typeof x.items === 'object') : [];
  } catch { return []; }
}
function saveListas(clienteId, listas) {
  try { localStorage.setItem(listasStorageKey(clienteId), JSON.stringify(listas || [])); } catch { /* storage lleno / bloqueado */ }
}

// ── Sync del carrito con el servidor (cross-device) ──────────────────────────
// localStorage es la caché instantánea por-dispositivo; el servidor (por sesión)
// es la fuente de verdad compartida entre la compu y el cel del mismo cliente.
// La auth la maneja /api/cart validando el token (deriva org+cliente del server).
async function fetchServerCart(token) {
  try {
    const r = await fetch(`${API}/api/cart`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.items && typeof d.items === 'object' && !Array.isArray(d.items) ? d.items : null;
  } catch { return null; }
}
async function saveServerCart(token, items) {
  try {
    await fetch(`${API}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    });
  } catch { /* sin red → queda en localStorage hasta el próximo guardado */ }
}

// ── Analítica web propia (panel del admin) ───────────────────────────────────
// Manda TANDAS de eventos a /api/track (páginas vistas, productos vistos/
// agregados, pedidos, búsquedas, tiempo en pantalla). Batching a propósito:
// juntamos eventos y los despachamos cada pocos segundos o al cerrar la pestaña,
// para NO pegarle al servidor —ni a la factura de Supabase— en cada click.
// Best-effort total: si algo falla, se descarta en silencio. La analítica nunca
// debe romper ni frenar el portal.
const _SID_KEY = 'pazque-sid';
function _getSid() {
  try {
    let sid = localStorage.getItem(_SID_KEY);
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(_SID_KEY, sid); }
    return sid;
  } catch { return null; }
}
const _evtQueue = [];
let _flushTimer = null;
function _flushEvents(useBeacon) {
  if (!_evtQueue.length) return;
  const batch = _evtQueue.splice(0, 50);
  let token = null;
  try { token = JSON.parse(localStorage.getItem(SK) || 'null')?.token || null; } catch { /* noop */ }
  const payload = JSON.stringify({ org: ORG, session_id: _getSid(), events: batch });
  const url = `${API}/api/track`;
  try {
    // Al cerrar la pestaña usamos sendBeacon (no admite Authorization, así que ese
    // último envío queda como anónimo — aceptable). En vivo usamos fetch con token
    // para que el evento quede atribuido al cliente logueado.
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch { /* noop */ }
}
function trackWeb(event, props = {}, path = null) {
  try {
    // No registramos el modo demo (no es uso real de un cliente).
    if (typeof window !== 'undefined' && window.location.search.includes('demo=true')) return;
    _evtQueue.push({ event, props: props || {}, path, ts: Date.now() });
    if (_evtQueue.length >= 20) { _flushEvents(false); return; }
    if (!_flushTimer) _flushTimer = setTimeout(() => { _flushTimer = null; _flushEvents(false); }, 4000);
  } catch { /* noop */ }
}
if (typeof window !== 'undefined') {
  // Al ocultar o cerrar la pestaña, vaciar lo pendiente (incluye el tiempo en pantalla).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushEvents(true); });
  window.addEventListener('pagehide', () => _flushEvents(true));
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
  // Logo de la distribuidora para mostrarlo en el login (antes de loguearse no
  // tenemos brandCfg aún). /api/manifest ya resuelve el org por dominio/?org= y
  // devuelve el logo. Si es el fallback de Pazque, dejamos el ícono genérico.
  const [brandLogo, setBrandLogo] = useState(null);
  const [brandName, setBrandName] = useState('');
  // Captación de prospectos: ¿esta org tiene prendido el "Pedí acceso"? (flag por-org)
  const [captacion, setCaptacion] = useState(false);
  const [showLead,  setShowLead]  = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await fetch('/api/manifest').then(r => r.json());
        const src = m?.icons?.[0]?.src;
        if (!cancelled && src && !src.includes('pazque-logo')) setBrandLogo(src);
        // Nombre de marca para el banner de instalar app (si no es el fallback Pazque).
        if (!cancelled && m?.name && m.name !== 'Pazque') setBrandName(m.name);
      } catch { /* sin red → ícono genérico */ }
    })();
    (async () => {
      try {
        const c = await fetch(`${API}/api/lead?org=${encodeURIComponent(ORG)}`).then(r => r.json());
        if (!cancelled) setCaptacion(!!c?.activa);
      } catch { /* sin flag → CTA oculto */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const sendOTP = async () => {
    if (!tel.trim()) { setErr('Ingresá tu número de WhatsApp'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.replace(/\D/g,''), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || 'Error al enviar el código');
        // Callejón sin salida: el número no es de un cliente y la org tiene
        // captación activa → en vez de dejarlo afuera, le ofrecemos pedir acceso.
        if (r.status === 404 && captacion) setShowLead(true);
        return;
      }
      setNombre(d.clienteNombre || '');
      if (d._devMode && d.code) setDevCode(d.code);
      setStep('code');
    } catch { setErr('Error de conexión.'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!code.trim()) { setErr('Ingresá el código recibido'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.replace(/\D/g,''), code: code.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Código incorrecto'); return; }
      saveSession(d.session); onLogin(d.session);
    } catch { setErr('Error de conexión.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS,
      display: 'flex', flexDirection: 'column' }}>
      {/* Banner "Instalá la app" arriba del login: es lo primero que ve el cliente,
          así descubre que existe la app antes de ingresar. Se auto-oculta si ya
          está instalada o si la cerró. */}
      <InstallAppBanner brandNombre={brandName} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {brandLogo ? (
            <img src={brandLogo} alt="Logo"
              style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain',
                background: '#fff', margin: '0 auto 14px', display: 'block' }} />
          ) : (
            <div style={{ width: 48, height: 48, background: G, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              {Icon.logo}
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>
            Portal de pedidos
          </div>
          <div style={{ fontSize: 13, color: '#6a6a68' }}>
            {step === 'tel' ? 'Ingresá tu número para recibir un código' : `Enviamos un código a ${tel}`}
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
                Número de WhatsApp
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
                    Enviar código
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
              {/* Botón de demo: solo en el contexto genérico de Pazque (org 'aryes'),
                  para prospectos que evalúan la plataforma. En el portal de un cliente
                  real (Eric / futuros) se oculta — no debe verse "catálogo de prueba". */}
              {ORG === 'aryes' && (
                <>
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
              )}
              {/* Captación de prospectos (flag por-org): quien todavía no es cliente
                  puede pedir acceso dejando sus datos. Oculto si la org no lo activó. */}
              {captacion && (
                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6a6a68' }}>
                  ¿Todavía no sos cliente?{' '}
                  <button onClick={() => setShowLead(true)} style={{
                    background: 'none', border: 'none', padding: 0, color: G, fontWeight: 600,
                    cursor: 'pointer', fontFamily: SANS, fontSize: 13, textDecoration: 'underline',
                  }}>
                    Pedí acceso
                  </button>
                </div>
              )}
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
                  Dev - código: <strong style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</strong>
                </div>
              )}
              <label htmlFor="otp-code" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#5a5a58' }}>
                Código de 6 dígitos
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
                Cambiar número
              </button>
            </>
          )}
        </div>
        <PoweredByPazque style={{ paddingBottom: 0, marginTop: 24 }} />
      </div>
      </div>
      {showLead && <LeadForm brandName={brandName} onClose={() => setShowLead(false)} />}
    </div>
  );
}

// Formulario "Pedí acceso" — captación de prospectos (Camino B). Aparece como
// modal desde el login cuando la org tiene la captación activa (flag por-org).
// Adjunta la atribución de campaña (utm/fbclid) capturada al entrar por un anuncio,
// para que el distribuidor sepa de qué campaña vino el prospecto.
function LeadForm({ brandName, onClose }) {
  const [nombre,   setNombre]   = useState('');
  const [tel,      setTel]      = useState('');
  const [comercio, setComercio] = useState('');
  const [ciudad,   setCiudad]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false);

  const submit = async () => {
    if (!nombre.trim())              { setErr('Ingresá tu nombre'); return; }
    if (tel.replace(/\D/g,'').length < 8) { setErr('Ingresá un WhatsApp válido'); return; }
    if (!comercio.trim())            { setErr('Ingresá el nombre de tu comercio'); return; }
    if (!ciudad.trim())              { setErr('Ingresá tu ciudad'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org: ORG,
          nombre: nombre.trim(),
          tel: tel.replace(/\D/g,''),
          comercio: comercio.trim(),
          ciudad: ciudad.trim(),
          ...getAttribution(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'No pudimos enviar tus datos'); return; }
      setDone(true);
    } catch { setErr('Error de conexión.'); }
    finally { setLoading(false); }
  };

  const field = (label, value, onChange, props = {}) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 6, fontSize: 12, color: '#6a6a68' }}>{label}</div>
      {props.phone ? (
        <PhoneInput value={value} onChange={onChange} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={props.placeholder || ''}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e0e0d8',
            fontSize: 14, fontFamily: SANS, boxSizing: 'border-box', background: '#fff' }} />
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: Z.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#fff',
        borderRadius: 16, padding: 24, fontFamily: SANS, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 48, height: 48, background: '#f0fdf4', borderRadius: '50%', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: G }}>{Icon.check}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>¡Recibido!</div>
            <div style={{ fontSize: 13, color: '#6a6a68', marginBottom: 20 }}>
              {(brandName || 'El distribuidor')} te va a contactar por WhatsApp para darte acceso.
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '11px 0', background: G, color: '#fff',
              border: 'none', borderRadius: 50, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>
              Listo
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>Pedí acceso</div>
            <div style={{ fontSize: 13, color: '#6a6a68', marginBottom: 18 }}>
              Dejanos tus datos y {(brandName || 'el distribuidor')} te contacta para habilitarte.
            </div>
            {err && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>{err}</div>
            )}
            {field('Nombre', nombre, setNombre, { placeholder: 'Tu nombre' })}
            {field('WhatsApp', tel, setTel, { phone: true })}
            {field('Nombre del comercio', comercio, setComercio, { placeholder: 'Ej: Almacén Don José' })}
            {field('Ciudad', ciudad, setCiudad, { placeholder: 'Ej: Montevideo' })}
            <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '11px 0',
              background: loading ? '#b0b0a8' : G, color: '#fff', border: 'none', borderRadius: 50,
              fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: SANS, marginTop: 4 }}>
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '9px 0', background: 'transparent',
              border: 'none', fontSize: 13, color: '#6a6a68', cursor: 'pointer', fontFamily: SANS, marginTop: 4 }}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// "Powered by Pazque" — atribución sutil al pie (estilo Shopify/Stripe). Discreto,
// pero "Pazque" va en verde de marca (señal de link clickeable) + subrayado al hover,
// para que se entienda que lleva a pazque.com. Marketing pasivo: cada cliente que ve
// el portal de Eric descubre la plataforma. Genérico, no depende del org.
// SIEMPRE encendido con el plan actual (es publicidad de Pazque); el "quitar el badge"
// queda como upsell white-label a futuro, no como opción configurable hoy.
// El link lleva UTM con el org como campaña → cada visita queda ATRIBUIDA al portal
// que la originó (Federico mide qué distribuidor trae interesados en la plataforma).
function PoweredByPazque({ style }) {
  const href = `https://pazque.com/?utm_source=portal&utm_medium=powered_by&utm_campaign=${encodeURIComponent(ORG || 'portal')}`;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0 24px', ...style }}>
      <a href={href} target="_blank" rel="noopener noreferrer"
        onMouseEnter={e => { const s = e.currentTarget.querySelector('span'); if (s) s.style.textDecoration = 'underline'; }}
        onMouseLeave={e => { const s = e.currentTarget.querySelector('span'); if (s) s.style.textDecoration = 'none'; }}
        style={{ fontSize: 11, color: '#a0a098', textDecoration: 'none',
          fontFamily: SANS, letterSpacing: '0.2px',
          display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        Powered by <span style={{ fontWeight: 700, color: G, textUnderlineOffset: 2 }}>Pazque</span>
      </a>
    </div>
  );
}

// volTierDto / calcLinea / calcTotales: la matemática de precios vive en
// ../lib/pricing.js (módulo puro, testeado). Acá sólo se consume.
// Primera escala (la de menor cantidad) — para mostrar un hint en la tarjeta.
function primerTier(item) {
  const tiers = Array.isArray(item?.volume_tiers) ? item.volume_tiers : [];
  return tiers.length ? tiers[0] : null;
}

// Precio de referencia SIN descontar (para el "precio tachado"). En v2 el server
// manda precioBase sin descuento; en el modelo viejo no hay base separada, así que
// se usa item.precio (no hay descuento que mostrar).
function precioRefBase(item) {
  return item?.reglasV2 ? (Number(item.precioBase) || 0) : (Number(item?.precio) || 0);
}

// Descuento "siempre" a mostrar como precio original tachado − % → precio final.
// Sólo en v2 y sólo si el precio final quedó por debajo del original. Devuelve
// null cuando no hay descuento (el precio se muestra tal cual, sin tachado).
function dtoSiempre(item) {
  const precio = Number(item?.precio) || 0;
  if (!item?.reglasV2) return null;
  const base = Number(item.precioBase) || 0;
  const pct = Math.round(Number(item.descGlobal) || 0);
  return pct > 0 && base > precio ? { base, pct, precio } : null;
}

// Precio unitario resultante en un tramo por cantidad, calculado sobre el precio
// base REAL (el mismo que usa calcLinea). Así el tramo se muestra como un precio
// concreto ("desde N un.: $X c/u") en vez de un % suelto que, al lado de un precio
// que ya trae el dto "siempre", parecía un descuento apilado.
function precioTier(item, tier) {
  const base = precioRefBase(item);
  const pct = Number(tier?.dto) || 0;
  return pct > 0 ? Math.round(base * (1 - pct / 100) * 100) / 100 : base;
}

// Regla de caja cerrada como etiqueta informativa: precio distribuidor por unidad
// cuando se completan cajas. Devuelve { uxc, pct } o null. El precio por unidad se
// calcula con precioTier({ dto: pct }) sobre el precio base — igual que un tramo.
function boxRule(item) {
  const uxc = Number(item?.unidades_por_caja) || 0;
  const pct = Math.round(Number(item?.descuento_caja) || 0);
  return uxc > 0 && pct > 0 ? { uxc, pct } : null;
}

// Muestra el precio original tachado + un chip con el % de descuento, arriba del
// precio final. El cliente ve SIEMPRE el descuento explícito (precio original −
// dto = final) en vez de un precio ya rebajado sin contexto, que confundía.
function PrecioAntes({ base, pct, size = 12 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: size, color: GRAY, fontWeight: 500, textDecoration: 'line-through' }}>{fmt.currency(base)}</span>
      <span style={{ fontSize: size - 1, fontWeight: 700, color: '#dc2626', background: '#fef2f2',
        border: '1px solid #fecaca', borderRadius: 5, padding: '1px 5px', lineHeight: 1.5 }}>−{pct}%</span>
    </div>
  );
}

// ¿La "unidad" del producto es una unidad de venta real (un/caja) y no un sufijo
// de peso/volumen (kg/lt/...)? Los precios ya vienen normalizados al bulto, así que
// mostrar "/kg" confundiría. Sólo mostramos el sufijo cuando es unidad de venta.
function esUnidadVenta(unidad) {
  return !!unidad && !/^\/?\s*(kg|kgs|kilo|kilos|lt|lts|litro|litros|gr|grs|gramo|gramos|ml)\.?$/i.test(String(unidad).trim());
}

// Bloque de precio para una línea MIXTA (parte a precio de caja cerrada, parte
// suelta a precio de lista). En vez de un único precio/% —que sería un promedio que
// no es ninguna regla configurada— mostramos:
//   $<precio caja> −<%>                  ← hero: el precio que paga la MAYORÍA (comparable
//   ✓ N u a precio caja                    entre cards y es una regla real, no un promedio)
//   M u sueltas a $<precio lista>
//   Total · $<neto de la línea>
// Se usa igual en la card (variant='card') y en la ficha (variant='pdp').
function PrecioMixto({ calc, item, variant = 'card' }) {
  const trDist = calc.tramos.find(t => t.distribuidor);
  const trSuelto = calc.tramos.find(t => !t.distribuidor);
  if (!trDist || !trSuelto) return null;
  const uLbl = item.unidad || 'u';
  const showUnid = esUnidadVenta(item.unidad);
  const heroSize = variant === 'pdp' ? 24 : 16;
  const lblSize = variant === 'pdp' ? 13 : 11;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        <span style={{ fontSize: heroSize, fontWeight: 700, color: G }}>{fmt.currency(trDist.precioUnit)}</span>
        {showUnid && <span style={{ fontSize: lblSize - 1, color: GRAY, fontWeight: 400 }}>/ {item.unidad}</span>}
        {trDist.dtoPct > 0 && <span style={{ fontSize: lblSize - 1, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5, padding: '1px 5px' }}>{'\u2212'}{Math.round(trDist.dtoPct)}%</span>}
      </div>
      <div style={{ marginTop: variant === 'pdp' ? 6 : 0 }}><IvaLine precio={item.precio} iva_rate={item.iva_rate} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 3 }}>
        <div style={{ fontSize: lblSize, color: G, fontWeight: 600 }}>{'\u2713'} {trDist.unidades} {uLbl} a precio caja</div>
        <div style={{ fontSize: lblSize, color: GRAY }}>{trSuelto.unidades} {uLbl} sueltas a {fmt.currency(trSuelto.precioUnit)}</div>
        <div style={{ fontSize: lblSize, color: GRAY }}>Total {'\u00b7'} <span style={{ fontWeight: 700, color: '#1a1a18' }}>{fmt.currency(calc.netoLinea)}</span></div>
      </div>
    </>
  );
}

// ── Aviso de entrega (PDP) ────────────────────────────────────────────────────
// Criterio Amazon: la fecha estimada de entrega ("Llega el jueves 21") va debajo
// del precio, ANTES del checkout — no sólo en la confirmación. Suma la cuenta
// regresiva de corte ("Pedí en 3h 20m para el reparto de hoy"), palanca de urgencia.
// Genérico por-org: sale del motor `calcularEntrega` con brandCfg.reparto; si la org
// no usa reparto (modo 'off') no renderiza nada → cero cambios para quien no lo usa.
// Tickea cada 30s para mantener vivo el countdown sin recalcular todo el árbol.
function EntregaHint({ reparto, zona }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const entrega = calcularEntrega(reparto, zona, now);
  if (entrega.modo === 'off' || !entrega.fecha) return null;

  const esCliente = entrega.modo === 'cliente';
  const restanMin = minutosHastaCorte(reparto?.corte, now);
  const corteVigente = restanMin != null && restanMin > 0;    // el corte de hoy sigue abierto
  const urgente = corteVigente && restanMin <= 180;            // últimas 3h → tono de urgencia

  return (
    <div style={{ marginBottom: 16, maxWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9,
        padding: '10px 13px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <div style={{ fontSize: 13.5, color: '#166534', fontFamily: SANS, lineHeight: 1.35 }}>
          {esCliente ? 'Entregas desde el ' : 'Llega el '}
          <span style={{ fontWeight: 800, color: '#14532d' }}>{entrega.label}</span>
          {esCliente && <span style={{ color: '#3f6b4e' }}> {'\u00b7'} elegí el día en el checkout</span>}
        </div>
      </div>
      {corteVigente && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 2,
          fontSize: 12.5, fontWeight: 700, fontFamily: SANS, color: urgente ? '#b45309' : GRAY }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          Pedí en las próximas <span style={{ color: urgente ? '#b45309' : INK }}>{formatCuentaRegresiva(restanMin)}</span> para el próximo reparto
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ item, qty, onAdd, onRemove, brandCfg, carrito, onOpen, onPickVariants, social, entregaCorta }) {
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
  // Precio CONSCIENTE de la cantidad ya en el carrito: si la cantidad alcanza un
  // tramo por volumen, el precio grande pasa a ser el unitario CON el descuento
  // aplicado (y tacha el precio base), en vez de seguir mostrando el precio de
  // lista con el % al costado — que daba a entender que el dto no estaba aplicado.
  // CLAVE: sólo colapsamos a un precio/% único cuando la línea es UNIFORME (una
  // sola tarifa = una regla configurada). Si hay tramos mezclados (caja cerrada +
  // sueltas a precio pleno), el promedio NO es una regla configurada: mostrar ese
  // % (ej. -27%) confundía. En ese caso se muestra el precio de lista y el ahorro
  // real (caja) se ve como etiqueta y en el desglose del carrito.
  const calc = qty > 0 ? calcLinea(item, qty) : null;
  const mixed = !!(calc && calc.tramos && calc.tramos.length > 1);
  const precioEff = (calc && !mixed) ? calc.precioConDto : item.precio; // unitario efectivo (sólo si uniforme)
  const refBase = precioRefBase(item);                         // v2: precioBase; viejo: item.precio
  const pctEff = refBase > 0 && refBase > precioEff ? Math.round(100 * (1 - precioEff / refBase)) : 0;
  const mostrarDto = item.precio > 0 && pctEff > 0;            // hay precio base que tachar
  const tier = primerTier(item);                               // primera escala por cantidad (si hay)
  const box = boxRule(item);                                   // regla de caja cerrada (si hay)

  return (
    <div style={{ background: '#fff', borderRadius: 16,
      border: `1px solid ${hov ? '#e6e6e0' : '#f0f0ec'}`,
      // height:100% → en un riel (flex) o grilla que estira las celdas a la card
      // más alta, todas las cards quedan de igual altura y el botón "+ Agregar"
      // se alinea abajo (lo empuja el spacer flex:1 de adentro). Si el contenedor
      // no estira (altura auto), 100% resuelve a auto: no afecta esos casos.
      height: '100%',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      // Señales de "tocable" en mobile (no hay hover): (1) sombra de reposo →
      // la card se lee como superficie elevada; (2) press → se hunde al tocar.
      transform: open && pressed ? 'scale(.97)' : (hov && open ? 'translateY(-3px)' : 'none'),
      boxShadow: hov && open ? '0 12px 30px rgba(0,0,0,.12)' : '0 1px 3px rgba(0,0,0,.05)',
      transition: 'transform .16s, box-shadow .22s, border-color .18s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onPointerDown={() => open && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}>
      <div onClick={open} style={{ position: 'relative', height: imgH, background: hasImg ? '#fff' : CREAM_TILE, padding: hasImg ? '14px 16px' : '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        cursor: open ? 'pointer' : 'default' }}>
        {/* Prueba social (badge sobre la imagen). Sale de pedidos REALES: "Más
            pedido" (bestseller de la org) o "N clientes lo piden" (compradores
            distintos ≥3). Una sola señal por card, bestseller manda. */}
        {social && (social.best || social.c >= 3) && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 50, fontSize: 10, fontWeight: 700, fontFamily: SANS,
            letterSpacing: .2, boxShadow: '0 1px 4px rgba(0,0,0,.12)',
            ...(social.best
              ? { background: FOREST, color: '#fff' }
              : { background: '#fff', color: INK, border: '1px solid #e3e0d6' }) }}>
            {social.best ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>
                Más pedido
              </>
            ) : (
              `${social.c} clientes lo piden`
            )}
          </div>
        )}
        {hasImg
          ? <img src={item.imagen_url} alt={item.nombre} onError={() => setImgErr(true)}
              loading="lazy" decoding="async"
              style={{ maxHeight: imgH - 28, maxWidth: '100%', objectFit: 'contain',
                transform: hov && open ? 'scale(1.06)' : 'none', transition: 'transform .25s' }} />
          : <div style={{ textAlign: 'center', padding: '0 10px' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff',
                border: `1.5px solid ${FOREST}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px', fontSize: 15, fontWeight: 700, color: FOREST, fontFamily: SANS, letterSpacing: .3 }}>
                {(item.marca || item.categoria || item.nombre || '?').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>
                {item.marca || item.categoria || 'Producto'}
              </div>
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
        {/* Línea MIXTA (caja cerrada + sueltas): bloque "desde $X −Y% + desglose + total"
            (ver PrecioMixto). El hero es el precio de caja (lo que paga la mayoría), que
            es una regla real y comparable con las demás cards — nunca un promedio. */}
        {item.precio > 0 && mixed && calc ? (
          <PrecioMixto calc={calc} item={item} variant="card" />
        ) : (
          <>
            {mostrarDto && <div style={{ marginTop: 4 }}><PrecioAntes base={refBase} pct={pctEff} /></div>}
            <div style={{ fontSize: 16, fontWeight: 700, color: G, marginTop: mostrarDto ? 0 : 4 }}>
              {item.precio > 0 ? fmt.currency(precioEff) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, background: '#f0f0ec',
                  padding: '2px 8px', borderRadius: 20, display: 'inline-block' }}>Consultar precio</span>
              )}
              {/* El precio mostrado es el del bulto entero (el importador normaliza
                  precios por kilo/litro al tamaño del bulto). Por eso NO mostramos
                  sufijos "/kg" o "/lt" — confundirían al cliente. Sí unidades de venta. */}
              {item.precio > 0 && esUnidadVenta(item.unidad) && <span style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
            </div>
            {item.precio > 0 && <IvaLine precio={item.precio} iva_rate={item.iva_rate} />}
          </>
        )}
        {/* Entrega estimada compacta (criterio Amazon: "Llega mañana" en la card).
            Genérica por-org: sólo aparece si la org usa reparto (entregaCorta viene
            vacío en modo 'off'). Estática, sin countdown — ese vive en la PDP. */}
        {item.precio > 0 && entregaCorta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
            fontSize: 11, fontWeight: 700, color: '#166534', fontFamily: SANS }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Llega {entregaCorta}
          </div>
        )}
        {/* Etiquetas de reglas disponibles (caja / por cantidad): cada una muestra el
            PRECIO concreto de esa regla, no un % suelto. Se muestran sólo cuando su
            descuento SUPERA al que ya está aplicado al precio grande (pctEff): así
            no repetimos un beneficio ya reflejado ni ofrecemos uno igual o peor.
            No se muestran cuando la línea es mixta (ya se ve el desglose real). */}
        {item.precio > 0 && !mixed && box && box.pct > pctEff && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#f0fdf4',
            border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 6px', alignSelf: 'flex-start',
            marginTop: 2 }}>
            Caja de {box.uxc}: {fmt.currency(precioTier(item, { dto: box.pct }))} c/u <span style={{ fontWeight: 600, opacity: .8 }}>(−{box.pct}%)</span>
          </div>
        )}
        {item.precio > 0 && !mixed && tier && tier.dto > pctEff && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#f0fdf4',
            border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 6px', alignSelf: 'flex-start',
            marginTop: 2 }}>
            Desde {tier.min} un.: {fmt.currency(precioTier(item, tier))} c/u <span style={{ fontWeight: 600, opacity: .8 }}>(−{tier.dto}%)</span>
          </div>
        )}
        {variantOpts ? (
          /* En la card NO metemos la lista de variantes (estiraba el recuadro y
             rompía la grilla cuando eran muchas). Estilo Amazon: un botón
             compacto que muestra cuántas opciones hay (y cuántas van en el
             carrito) y abre la ficha, donde vive el selector completo. */
          <VariantCta item={item} options={variantOpts} carrito={carrito || {}} label={item.variants.label} isMobile={isMobile} onPick={() => (onPickVariants ? onPickVariants(item) : open?.())} />
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

// Botón compacto para la card cuando el producto tiene variantes. No lista las
// opciones (eso agrandaba la card y rompía la grilla si eran muchas): abre un
// "quick-add" (hoja/sheet estilo Shopify) por encima del catálogo, sin cambiar
// de página. La etiqueta se mantiene corta (sin "· N opciones", que se cortaba)
// y el número de opciones va en un badge. Mismo footprint que "+ Agregar".
function VariantCta({ item, options, carrito, label, isMobile, onPick }) {
  const totalSel = options.reduce((s, o) => s + (carrito[`${item.id}::${o.id}`] || 0), 0);
  // Etiqueta genérica estilo Shopify ("Choose options"): sirve para cualquier
  // tipo de variante (color/sabor/tamaño) y, junto al badge con el número, deja
  // claro que hay VARIAS opciones para elegir. "Color"/"Sabores" a secas no daba
  // esa pauta. En mobile se acorta a "Opciones" para que entre en la card angosta.
  const cta = isMobile ? 'Opciones' : 'Elegir opciones';
  return (
    /* Botón sobrio estilo Apple/Amazon: mismo footprint y verde que "+ Agregar",
       sin muestras de color apretadas adentro (quedaban recargadas). Los colores
       se ven grandes y ordenados DENTRO del selector, que es donde importan. */
    <button onClick={onPick} style={{
      marginTop: 4, padding: '11px 12px', background: G,
      color: '#fff', border: 'none', borderRadius: 8,
      cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {totalSel > 0 ? `${totalSel} en carrito` : cta}
      </span>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, lineHeight: 1,
        background: '#fff', color: G, borderRadius: 20, padding: '2px 6px' }}>{options.length}</span>
    </button>
  );
}

// Hoja "quick-add" (estilo Shopify/Amazon): se abre por ENCIMA del catálogo al
// tocar el botón de variantes de una card. El cliente elige cantidades por
// opción sin cambiar de página y vuelve a la grilla. Reusa VariantPicker.
function VariantSheet({ item, carrito, onAdd, onRemove, onClose, isMobile }) {
  if (!item) return null;
  const options = item.variants?.options || [];
  const totalSel = options.reduce((s, o) => s + (carrito[`${item.id}::${o.id}`] || 0), 0);
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={`Elegí ${item.variants?.label || 'variante'} de ${item.nombre}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', background: 'rgba(0,0,0,.4)', zIndex: Z.overlay,
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="pz-fade" style={{ background: '#fff',
        width: '100%', maxWidth: 460, height: isMobile ? '85dvh' : 'auto', maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        borderRadius: isMobile ? '16px 16px 0 0' : 16, boxShadow: '0 -4px 30px rgba(0,0,0,.18)', overflow: 'hidden' }}>
        {/* Encabezado: producto + precio + cerrar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f0f0ec' }}>
          {item.imagen_url && <img src={item.imagen_url} alt="" decoding="async" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'contain', background: '#fafaf7', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', lineHeight: 1.25 }}>{item.nombre}</div>
            {item.precio > 0 && (
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: G }}>{fmt.currency(item.precio)}</span>
                {(() => { const d = dtoSiempre(item); return d ? (<span style={{ fontSize: 11, color: GRAY, fontWeight: 500, textDecoration: 'line-through' }}>{fmt.currency(d.base)} <span style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none' }}>−{d.pct}%</span></span>) : null; })()}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ flexShrink: 0, width: 32, height: 32, border: 'none',
            background: '#f0f0ec', borderRadius: '50%', cursor: 'pointer', fontSize: 17, color: '#6a6a68', lineHeight: 1 }}>×</button>
        </div>
        {/* Lista de variantes (scroll dentro de la hoja). flex:1 + minHeight:0 =
            solo esta zona scrollea; encabezado y pie quedan fijos y la hoja se
            ajusta a la pantalla en vez de desbordar. */}
        <div style={{ flex: 1, minHeight: 0, padding: '4px 16px 8px', overflowY: 'auto' }}>
          <VariantPicker item={item} options={options} carrito={carrito} onAdd={onAdd} onRemove={onRemove} label={item.variants?.label} maxH="none" />
        </div>
        {/* Pie: total + Listo. En la PWA instalada de iOS el meta viewport no usa
            viewport-fit=cover, así que env(safe-area-inset-bottom) da 0 y "Listo"
            quedaba bajo el home indicator. Usamos un piso fijo (34px = safe area
            real de iOS) con max() para garantizar que siempre quede por encima. */}
        <div style={{ flexShrink: 0, padding: '12px 16px', paddingBottom: 'max(34px, calc(12px + env(safe-area-inset-bottom, 0px)))', borderTop: '1px solid #f0f0ec', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: '#6a6a68' }}>
            {totalSel > 0 ? <><strong style={{ color: '#1a1a18' }}>{totalSel}</strong> en el carrito</> : 'Elegí cantidades'}
          </div>
          <button onClick={onClose} style={{ padding: '11px 22px', background: G, color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// Grid de variantes: una fila por opción (swatch + nombre + stepper). El cliente
// arma un pedido mixto (ej: 3 rojos + 2 azules). Lee cantidades del carrito por
// clave "id::variantId" y delega add/remove al padre.
function VariantPicker({ item, options, carrito, onAdd, onRemove, label, maxH = 168 }) {
  const [q, setQ] = useState('');
  const totalSel = options.reduce((s, o) => s + (carrito[`${item.id}::${o.id}`] || 0), 0);
  const lbl = String(label || 'variante').toLowerCase();
  // Cuando hay una lista real de variantes (colores, sabores, tamaños) el buscador
  // deja saltar directo a la que se busca (patrón Amazon/Shopify) y hace que TODAS
  // las listas se vean igual. Solo se saltea con 2-5 opciones, donde es un toggle
  // y un buscador sobre tan pocas se vería tonto.
  const showSearch = options.length > 5;
  const term = q.trim().toLowerCase();
  const shown = term ? options.filter(o => String(o.label || '').toLowerCase().includes(term)) : options;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, letterSpacing: .3, marginBottom: 5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ELEGÍ {String(label || 'VARIANTE').toUpperCase()} · {options.length}</span>
        {totalSel > 0 && <span style={{ color: G }}>{totalSel} en carrito</span>}
      </div>
      {showSearch && (
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff', paddingBottom: 6, marginBottom: 2 }}>
          <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: GRAY, pointerEvents: 'none' }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar ${lbl}…`}
            aria-label={`Buscar ${lbl}`}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 28px', border: '1px solid #e0e0d8',
              borderRadius: 8, fontSize: 12, fontFamily: SANS, color: '#1a1a18', outline: 'none', background: '#fff' }} />
          {q && <button onClick={() => setQ('')} aria-label="Limpiar búsqueda" style={{ position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: GRAY }}>✕</button>}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 4, maxHeight: maxH === 'none' ? undefined : maxH, overflowY: maxH === 'none' ? 'visible' : 'auto', paddingRight: 2 }}>
        {shown.length === 0 && (
          <div style={{ padding: '14px 4px', textAlign: 'center', fontSize: 11, color: GRAY }}>Sin resultados para “{q}”</div>
        )}
        {shown.map(o => {
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

// ── Galería del PDP (multi-imagen + zoom) ──────────────────────────────────────
// Criterio Amazon: imagen grande con ZOOM (en desktop la lupa sigue al cursor;
// en celular se abre a pantalla completa con el pinch nativo). Si el producto tiene
// varias fotos, aparece una tira de miniaturas; con una sola, la tira no se muestra
// (nada de "galería de 1"). Acepta item.imagenes (array) y cae a [imagen_url].
function ProductGallery({ item, isMobile }) {
  const imgs = (Array.isArray(item.imagenes) && item.imagenes.length
    ? item.imagenes
    : [item.imagen_url]).filter(Boolean);
  const [active, setActive] = useState(0);
  const [imgErr, setImgErr] = useState({});
  const [zoom, setZoom] = useState(false);            // hover-zoom desktop
  const [pos, setPos] = useState({ x: 50, y: 50 });   // origen del zoom en %
  const [light, setLight] = useState(false);          // lightbox fullscreen
  useEffect(() => { setActive(0); }, [item.id]);

  const cur = imgs[active];
  const broken = imgErr[active];
  const hasImg = cur && !broken;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  const placeholder = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#fff',
        border: `2px solid ${FOREST}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px', fontSize: 26, fontWeight: 700, color: FOREST, fontFamily: SANS, letterSpacing: .5 }}>
        {(item.marca || item.categoria || item.nombre || '?').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: GRAY, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase' }}>
        {item.marca || item.categoria || 'Producto'}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Imagen principal */}
      <div
        onMouseEnter={() => { if (!isMobile && hasImg) setZoom(true); }}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={(!isMobile && hasImg) ? onMove : undefined}
        onClick={() => { if (hasImg) setLight(true); }}
        style={{ position: 'relative', background: '#fff', border: '1px solid #efefeb', borderRadius: 16,
          minHeight: isMobile ? 260 : 460, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, overflow: 'hidden', cursor: hasImg ? 'zoom-in' : 'default' }}>
        {hasImg
          ? <img src={cur} alt={item.nombre} onError={() => setImgErr(m => ({ ...m, [active]: true }))}
              decoding="async"
              style={{ maxWidth: '100%', maxHeight: isMobile ? 240 : 420, objectFit: 'contain' }} />
          : placeholder}
        {/* Pista de zoom (sólo si hay imagen) */}
        {hasImg && !zoom && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'inline-flex', alignItems: 'center',
            gap: 4, background: 'rgba(20,20,15,.62)', color: '#fff', fontSize: 11, fontWeight: 600,
            fontFamily: SANS, padding: '4px 8px', borderRadius: 50, pointerEvents: 'none' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>
            </svg>
            {isMobile ? 'Tocá para ampliar' : 'Pasá para hacer zoom'}
          </div>
        )}
      </div>

      {/* Zoom lateral estilo Amazon (sólo desktop): proyecta la zona ampliada en un
          panel al costado, sobre la columna de info — nunca agranda encima de sí misma. */}
      {!isMobile && zoom && hasImg && (
        <div style={{ position: 'absolute', top: 0, left: 'calc(100% + 48px)', width: '100%', height: 460,
          background: `#fff url(${cur}) no-repeat`, backgroundSize: '210%',
          backgroundPosition: `${pos.x}% ${pos.y}%`, border: '1px solid #efefeb', borderRadius: 16,
          boxShadow: '0 12px 44px rgba(0,0,0,.16)', zIndex: 5, pointerEvents: 'none' }} />
      )}

      {/* Miniaturas — sólo con más de una imagen */}
      {imgs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {imgs.map((src, i) => (
            <button key={i} onClick={() => setActive(i)} aria-label={`Ver imagen ${i + 1}`}
              style={{ width: 60, height: 60, borderRadius: 10, padding: 4, cursor: 'pointer', background: '#fff',
                border: i === active ? `2px solid ${G}` : '1px solid #e3e0d6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {imgErr[i]
                ? <span style={{ fontSize: 10, color: GRAY }}>{i + 1}</span>
                : <img src={src} alt="" onError={() => setImgErr(m => ({ ...m, [i]: true }))}
                    loading="lazy" decoding="async"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox fullscreen (desktop + mobile): tap/click para cerrar; pinch nativo.
          Fondo CLARO estilo Amazon (nunca negro) + miniaturas para cambiar de foto.
          Se renderiza vía portal a <body> para escapar del wrapper .pz-fade (transform),
          que de lo contrario atrapa el position:fixed y descentra la imagen en mobile. */}
      {light && hasImg && createPortal((
        <div onClick={() => setLight(false)}
          style={{ position: 'fixed', inset: 0, zIndex: (typeof Z !== 'undefined' && Z.modal) || 9999,
            background: 'rgba(250,250,248,.98)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 16,
            padding: isMobile ? 16 : 40, cursor: 'zoom-out', animation: 'pzFade .15s ease both' }}>
          <img src={cur} alt={item.nombre} onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: imgs.length > 1 ? '80%' : '100%', objectFit: 'contain',
              touchAction: 'pinch-zoom', cursor: 'default' }} />
          {imgs.length > 1 && (
            <div onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
              {imgs.map((src, i) => imgErr[i] ? null : (
                <button key={i} onClick={() => setActive(i)} aria-label={`Ver imagen ${i + 1}`}
                  style={{ width: 56, height: 56, borderRadius: 10, padding: 4, cursor: 'pointer', background: '#fff',
                    border: i === active ? `2px solid ${G}` : '1px solid #e3e0d6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setLight(false); }} aria-label="Cerrar"
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%',
              border: '1px solid #e3e0d6', background: '#fff', color: '#28271f', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              boxShadow: '0 2px 10px rgba(0,0,0,.12)' }}>×</button>
        </div>
      ), document.body)}
    </div>
  );
}

// ── Product Detail (PDP) ───────────────────────────────────────────────────────
// Página de detalle estilo Amazon/Shopify: el cliente hace clic en una card y entra
// a la ficha completa (imagen grande, descripción, ficha técnica y acción de compra).
// Se puede comprar desde acá — la PDP es donde más convierte. Reusa VariantPicker.
// Detalle de producto: usamos la MISMA tipografía sans del portal (DM Sans) en vez
// del serif Georgia que abarataba el look y rompía la consistencia con el resto.
const SERIF = SANS;
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
function ProductDetail({ item, carrito, onAdd, onRemove, onSetQty, brandCfg, isMobile, onBack,
                         items, coBuy, social, socialOn, onOpen, onPickVariants, demo, zona, entregaCorta }) {
  const variantOpts = item.precio > 0 && item.variants?.options?.length ? item.variants.options : null;
  const qty = carrito[item.id] || 0;
  // Precio grande CONSCIENTE de la cantidad ya en el carrito (igual que la card):
  // si la cantidad alcanza un tramo, el precio pasa a ser el unitario CON descuento
  // y se tacha el base. Sin cantidad, refleja el precio de lista (con dto "siempre").
  // CLAVE (igual que la card): sólo colapsamos a un precio/% único cuando la línea es
  // UNIFORME (una sola tarifa = una regla). Si hay tramos mezclados (caja cerrada +
  // sueltas a precio pleno), el promedio NO es una regla configurada y mostrar ese %
  // (ej. -27%) confunde: en ese caso mostramos el precio de lista y las reglas reales
  // (caja / tramo) como etiquetas informativas.
  const calcD = qty > 0 ? calcLinea(item, qty) : null;
  const mixedD = !!(calcD && calcD.tramos && calcD.tramos.length > 1);
  const precioEffD = (calcD && !mixedD) ? calcD.precioConDto : item.precio;
  const refBaseD = precioRefBase(item);
  const pctEffD = refBaseD > 0 && refBaseD > precioEffD ? Math.round(100 * (1 - precioEffD / refBaseD)) : 0;
  const dtoDetalle = item.precio > 0 && pctEffD > 0 ? { base: refBaseD, pct: pctEffD } : null;
  const boxD = boxRule(item);                                  // regla de caja cerrada (si hay)
  // Tramos por cantidad a mostrar: sólo los que SUPERAN el dto ya aplicado (pctEffD),
  // para no repetir un beneficio ya reflejado en el precio grande.
  const tiersD = (item.volume_tiers || []).filter(t => (Number(t.dto) || 0) > pctEffD);
  // Input de cantidad editable: mientras el cliente escribe usamos texto local,
  // y sólo al perder foco normalizamos contra el mínimo de pedido.
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  useEffect(() => { if (!editingQty) setQtyInput(qty > 0 ? String(qty) : ''); }, [qty, editingQty]);
  // Unidad de medida flexible (patrón "case pack" de Amazon Business / Faire): si el
  // producto tiene caja cerrada real (unidades_por_caja > 1), el cliente elige comprar
  // por Unidad o por Caja. El carrito SIEMPRE guarda unidades base (así el precio, el
  // descuento por caja y el checkout siguen igual); "Caja" sólo cambia el paso del
  // stepper a la unidad de bulto. Cero humo: no inventamos un nivel (pallet) que el
  // distribuidor no cargó — el bulto es el que él configuró.
  const uxcD = Number(item.unidades_por_caja) || 0;
  const canBox = !variantOpts && item.precio > 0 && uxcD > 1;
  const [unitMode, setUnitMode] = useState('unidad'); // 'unidad' | 'caja'
  useEffect(() => { setUnitMode('unidad'); }, [item.id]);
  const byBox = canBox && unitMode === 'caja';
  const stepQty = byBox ? uxcD : 1;
  // Unidades reales de venta (un/caja) — NO sufijos kg/lt (ver nota en ProductCard).
  const showUnidad = item.precio > 0 && item.unidad && !/^\/?\s*(kg|kgs|kilo|kilos|lt|lts|litro|litros|gr|grs|gramo|gramos|ml)\.?$/i.test(String(item.unidad).trim());
  const tel = (brandCfg?.ownerPhone || '').replace(/[^0-9]/g, '');
  const waLink = tel ? `https://wa.me/${tel}?text=${encodeURIComponent('Hola, quiero consultar disponibilidad de: ' + item.nombre)}` : null;

  // Criterio Amazon (mobile): la barra de compra fija NO está siempre. Aparece sólo
  // cuando el bloque de compra (precio + botón) NO está a la vista; si está visible,
  // la barra sería ruido y tapa contenido.
  //
  // Mecanismo: IntersectionObserver (estándar web moderno, lo que usan Amazon/Shopify).
  // El navegador nos avisa cuando el bloque entra/sale de pantalla — más eficiente que
  // recalcular en cada scroll. Hacemos un chequeo inicial con getBoundingClientRect
  // para fijar el estado de arranque correcto antes del primer evento del observer.
  const compraRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    if (!isMobile) { setShowStickyBar(false); return undefined; }
    const el = compraRef.current;
    if (!el) return undefined;

    // Estado inicial: ¿el bloque ya está fuera de pantalla al entrar a la ficha?
    const r0 = el.getBoundingClientRect();
    setShowStickyBar(r0.bottom < 72 || r0.top > window.innerHeight - 72);

    if (typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px' } // descuenta el alto de la barra para no solaparse
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isMobile, item.id]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 18px 100px' : '24px 24px 80px' }}>
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
        <ProductGallery item={item} isMobile={isMobile} />

        <div>
          {item.marca && <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, letterSpacing: 1.2, marginBottom: 10 }}>{item.marca.toUpperCase()}</div>}
          {/* Prueba social en el PDP (criterio Amazon: el "#1 más pedido" también va en la
              ficha, no sólo en la card). Mismo dato real y mismo gate que la grilla.
              `social` es el mapa completo (el rail "se compra junto con" necesita otras
              entradas); acá indexamos por el id de este producto. */}
          {(() => {
            const sB = socialOn ? (social && social[item.id]) : null;
            if (!sB || !(sB.best || sB.c >= 3)) return null;
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12,
                padding: '5px 11px', borderRadius: 50, fontSize: 12.5, fontWeight: 700, fontFamily: SANS,
                ...(sB.best
                  ? { background: FOREST, color: '#fff' }
                  : { background: '#fff', color: INK, border: '1px solid #e3e0d6' }) }}>
                {sB.best ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6L12 2z"/></svg>
                    Más pedido{sB.c >= 3 ? ` · ${sB.c} clientes lo piden` : ''}
                  </>
                ) : `${sB.c} clientes lo piden`}
              </div>
            );
          })()}
          <h1 style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 34, fontWeight: 600, color: '#1a1a18', margin: '0 0 18px', lineHeight: 1.15 }}>
            {item.nombre}
          </h1>
          {item.descripcion && (
            <p style={{ fontSize: 15, color: '#4a4a46', lineHeight: 1.6, margin: '0 0 28px' }}>{item.descripcion}</p>
          )}

          {/* Ficha técnica — sólo filas con datos reales (nada inventado).
              Se arma como lista y se marca la ÚLTIMA fila visible para el borde,
              así el separador nunca queda colgando cuando faltan campos. */}
          {(() => {
            const specs = [
              ['Formato',            showUnidad ? item.unidad : (item.unidad && item.unidad !== 'un' ? item.unidad : null)],
              ['Marca',              item.marca || null],
              ['Categoría',          item.categoria || null],
              ['Subcategoría',       item.subcategoria || null],
              ['Unidades por caja',  Number(item.unidades_por_caja) > 1 ? `${item.unidades_por_caja} un.` : null],
              ['Compra mínima',      Number(item.min_order_qty) > 1 ? `${item.min_order_qty} un.` : null],
              ['Código',             item.codigo || null],
            ].filter(r => r[1] != null && r[1] !== '');
            // Atributos flexibles por rubro (multi-rubro): el distribuidor los cargó a
            // mano (vino → "Graduación 12%", ferretería → "Material acero"). Se anexan a
            // la ficha; se descartan los que chocan con un campo fijo ya mostrado.
            const usados = new Set(specs.map(r => String(r[0]).trim().toLowerCase()));
            for (const a of (Array.isArray(item.atributos) ? item.atributos : [])) {
              const k = String(a?.k ?? '').trim(), v = String(a?.v ?? '').trim();
              if (!k || !v) continue;
              const kk = k.toLowerCase();
              if (usados.has(kk)) continue;
              usados.add(kk);
              specs.push([k, v]);
            }
            if (!specs.length) return null;
            return (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18', letterSpacing: 1, marginBottom: 4 }}>FICHA TÉCNICA</div>
                <div style={{ marginBottom: 28 }}>
                  {specs.map((r, i) => <FichaRow key={r[0]} label={r[0]} value={r[1]} last={i === specs.length - 1} />)}
                </div>
              </>
            );
          })()}

          {/* Acción de compra — el ref envuelve TODO el bloque (precio + botón) para que
              la barra fija (mobile) sepa cuándo salió de pantalla (criterio Amazon).
              Tiene que tener área real: un div de altura 0 no dispara IntersectionObserver. */}
          <div ref={compraRef}>
          {/* Línea MIXTA (parte a precio de caja, parte suelta): hero = precio de caja
              (lo que paga la mayoría de las unidades, regla configurada real y comparable
              entre productos — nunca un % promedio) + desglose REAL aplicado + total. */}
          {item.precio > 0 && mixedD && calcD ? (
            <div style={{ marginBottom: 16 }}>
              <PrecioMixto calc={calcD} item={item} variant="pdp" />
            </div>
          ) : (
            <>
              {item.precio > 0 && dtoDetalle && <div style={{ marginBottom: 2 }}><PrecioAntes base={dtoDetalle.base} pct={dtoDetalle.pct} size={14} /></div>}
              {item.precio > 0 && (
                <div style={{ fontSize: 24, fontWeight: 700, color: G, marginBottom: 4 }}>
                  {fmt.currency(precioEffD)}
                  {showUnidad && <span style={{ fontSize: 13, color: GRAY, fontWeight: 400, marginLeft: 5 }}>/ {item.unidad}</span>}
                </div>
              )}
              {item.precio > 0 && <div style={{ marginBottom: (boxD || tiersD.length) ? 10 : 16 }}><IvaLine precio={item.precio} iva_rate={item.iva_rate} /></div>}
            </>
          )}
          {/* Reglas disponibles (caja / por cantidad): cada una muestra el PRECIO
              concreto de esa regla (no un % suelto), y sólo si SUPERA el dto ya
              aplicado al precio grande — así no parece apilarse sobre el dto "siempre"
              ni se repite un beneficio ya reflejado. Ocultas cuando la línea es mixta
              (ya se muestra el desglose real). */}
          {item.precio > 0 && !mixedD && (boxD && boxD.pct > pctEffD || tiersD.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {boxD && boxD.pct > pctEffD && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#f0fdf4',
                  border: '1px solid #bbf7d0', borderRadius: 8, padding: '4px 10px' }}>
                  Caja de {boxD.uxc}: {fmt.currency(precioTier(item, { dto: boxD.pct }))} c/u <span style={{ fontWeight: 600, opacity: .8 }}>(−{boxD.pct}%)</span>
                </div>
              )}
              {tiersD.map((t, i) => (
                <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#f0fdf4',
                  border: '1px solid #bbf7d0', borderRadius: 8, padding: '4px 10px' }}>
                  Desde {t.min} un.: {fmt.currency(precioTier(item, t))} c/u <span style={{ fontWeight: 600, opacity: .8 }}>(−{t.dto}%)</span>
                </div>
              ))}
            </div>
          )}

          {/* Señal de stock (criterio Amazon: estado de disponibilidad debajo del precio).
              Genérica y OPT-IN: sólo si el distribuidor la activa (brandCfg.stockSignals) o en
              demo — así una org que no lleva inventario no muestra datos engañosos. La escasez
              usa el punto de reorden REAL del distribuidor (min_stock); nada inventado.
              Sentinel: available_stock ≥ 9999 = "En stock" sin número (workaround de setup). */}
          {(() => {
            const stockOn = demo || brandCfg?.stockSignals === true;
            if (!stockOn || !(item.precio > 0)) return null;
            const av = Number(item.available_stock);
            if (!Number.isFinite(av)) return null;
            const min = Number(item.min_stock) || 0;
            let label, dot, color, bg, border;
            if (av <= 0) {
              label = 'Sin stock — consultá reposición'; dot = '#b45309'; color = '#92400e'; bg = '#fffbeb'; border = '#fde68a';
            } else if (min > 0 && av <= min) {
              label = `¡Pocas unidades! Quedan ${av}`; dot = '#d97706'; color = '#b45309'; bg = '#fff7ed'; border = '#fed7aa';
            } else {
              label = 'En stock'; dot = '#059669'; color = '#047857'; bg = '#f0fdf4'; border = '#bbf7d0';
            }
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16,
                padding: '6px 12px', borderRadius: 50, background: bg, border: `1px solid ${border}`,
                fontSize: 13, fontWeight: 700, fontFamily: SANS, color }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                {label}
              </div>
            );
          })()}

          {/* Aviso de entrega + countdown de corte (criterio Amazon: fecha estimada
              antes del checkout). Sólo renderiza si la org usa reparto (modo ≠ off). */}
          {item.precio > 0 && <EntregaHint reparto={brandCfg?.reparto} zona={zona} />}

          {/* Unidad de medida flexible: selector Unidad / Caja de X (sólo si hay bulto real). */}
          {canBox && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a18', marginBottom: 6, fontFamily: SANS }}>Comprar por</div>
              <div style={{ display: 'inline-flex', background: '#f0f0ec', borderRadius: 10, padding: 3, gap: 3 }}>
                {[['unidad', item.unidad && esUnidadVenta(item.unidad) ? item.unidad.replace(/^\//, '').trim() || 'Unidad' : 'Unidad'], ['caja', `Caja de ${uxcD}`]].map(([mode, lbl]) => {
                  const on = unitMode === mode;
                  return (
                    <button key={mode} onClick={() => setUnitMode(mode)} aria-pressed={on} style={{
                      padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, fontFamily: SANS, textTransform: 'capitalize',
                      background: on ? '#fff' : 'transparent', color: on ? INK : GRAY,
                      boxShadow: on ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{lbl}</button>
                  );
                })}
              </div>
            </div>
          )}

          {variantOpts ? (
            <div style={{ maxWidth: 420 }}>
              <VariantPicker item={item} options={variantOpts} carrito={carrito} onAdd={onAdd} onRemove={onRemove} label={item.variants.label} maxH={300} />
            </div>
          ) : item.precio > 0 ? (
            qty > 0 ? (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                <button onClick={() => onSetQty(item, undefined, Math.max(0, qty - stepQty))} aria-label={byBox ? `Quitar una caja de ${item.nombre}` : `Quitar una unidad de ${item.nombre}`} style={{
                  width: 48, height: 48, border: `1.5px solid ${G}`, borderRadius: 10, background: '#fff',
                  color: G, fontSize: 20, cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{'\u2212'}</button>
                {byBox ? (
                  <div aria-label={`Cantidad de cajas de ${item.nombre}`} style={{
                    flex: 1, width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#1a1a18', border: '1px solid #e0e0d8', borderRadius: 10,
                    background: '#fff', fontFamily: SANS }}>
                    {Math.round(qty / uxcD)} {Math.round(qty / uxcD) === 1 ? 'caja' : 'cajas'}
                  </div>
                ) : (
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
                )}
                <button onClick={() => onSetQty(item, undefined, qty + stepQty)} aria-label={byBox ? `Agregar una caja de ${item.nombre}` : `Agregar una unidad de ${item.nombre}`} style={{
                  width: 48, height: 48, background: G, border: 'none', borderRadius: 10, color: '#fff',
                  fontSize: 20, cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
              </div>
              {byBox && (
                <div style={{ fontSize: 12, color: GRAY, marginTop: 8, fontFamily: SANS }}>
                  = {qty} {item.unidad && esUnidadVenta(item.unidad) ? item.unidad.replace(/^\//, '').trim() : 'unidades'}
                  {boxD && boxD.pct > 0 && <> {'\u00b7'} <span style={{ color: G, fontWeight: 700 }}>{fmt.currency(precioTier(item, { dto: boxD.pct }))} c/u ({'\u2212'}{boxD.pct}%)</span></>}
                </div>
              )}
              </>
            ) : (
              <>
              <button onClick={() => onSetQty(item, undefined, byBox ? uxcD : (item.min_order_qty > 1 ? item.min_order_qty : 1))} style={{
                width: '100%', maxWidth: 420, padding: '15px 0', background: G, color: '#fff', border: 'none',
                borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: SANS }}>
                {byBox ? `Agregar caja de ${uxcD}` : (item.min_order_qty > 1 ? `Agregar (mín. ${item.min_order_qty})` : 'Agregar al carrito')}
              </button>
              {byBox && boxD && boxD.pct > 0 && (
                <div style={{ fontSize: 12, color: GRAY, marginTop: 8, fontFamily: SANS }}>
                  {uxcD} {item.unidad && esUnidadVenta(item.unidad) ? item.unidad.replace(/^\//, '').trim() : 'unidades'} {'\u00b7'} <span style={{ color: G, fontWeight: 700 }}>{fmt.currency(precioTier(item, { dto: boxD.pct }))} c/u ({'\u2212'}{boxD.pct}%)</span>
                </div>
              )}
              </>
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
      </div>

      {/* "Se compra junto con" — cross-sell REAL: productos que aparecen en los mismos
          pedidos que éste (co-ocurrencia calculada server-side sobre pedidos reales de
          la cartera). Cero humo: si no hay co-ocurrencia suficiente, no se muestra nada.
          Es el patrón "Frequently bought together" de Amazon. */}
      {(() => {
        const ids = (coBuy && coBuy[item.id]) || [];
        if (!ids.length || !Array.isArray(items)) return null;
        const juntos = ids
          .map(id => items.find(p => p.id === id))
          .filter(p => p && p.id !== item.id)
          .slice(0, 8);
        if (!juntos.length) return null;
        return (
          <div style={{ marginTop: isMobile ? 32 : 48, borderTop: '1px solid #efefeb', paddingTop: isMobile ? 24 : 32 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 20 : 24, fontWeight: 600, color: '#1a1a18', margin: '0 0 4px' }}>
              Se compra junto con
            </h2>
            <p style={{ fontSize: 13, color: GRAY, margin: '0 0 18px' }}>
              Otros clientes suelen pedir esto en el mismo pedido.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
              {juntos.map(p => (
                <ProductCard key={p.id} item={p} brandCfg={brandCfg} carrito={carrito}
                  qty={carrito[p.id] || 0} onAdd={onAdd} onRemove={onRemove}
                  onOpen={onOpen} onPickVariants={onPickVariants}
                  social={socialOn ? social?.[p.id] : null} entregaCorta={entregaCorta} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Barra de compra fija (sólo celular): precio + Agregar quedan SIEMPRE visibles
          aunque el cliente baje a leer la descripción/ficha. Patrón mobile de ML/Amazon/
          Rappi — el botón nunca se pierde. En productos con variante se mantiene el
          selector inline (no entra en la barra). */}
      {isMobile && showStickyBar && (item.precio > 0 ? !variantOpts : true) && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: Z.fab,
          background: '#fff', borderTop: '1px solid #ececE6',
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 16px rgba(0,0,0,.06)', fontFamily: SANS,
          animation: 'pzFade .18s ease both' }}>
          {item.precio > 0 ? (
            <>
              <div style={{ flexShrink: 0, lineHeight: 1.1 }}>
                {mixedD && calcD ? (() => {
                  // Línea mixta: en la barra fija (poco espacio) mostramos el precio de caja
                  // — lo que paga la mayoría de las unidades — con "desde", nunca el promedio.
                  const trDist = calcD.tramos.find(t => t.distribuidor);
                  return trDist ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: G }}>{fmt.currency(trDist.precioUnit)}</span>
                      {trDist.dtoPct > 0 && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>{'\u2212'}{Math.round(trDist.dtoPct)}%</span>}
                    </div>
                  ) : null;
                })() : (
                  <>
                    {dtoDetalle && <div style={{ fontSize: 11, color: GRAY, fontWeight: 500, textDecoration: 'line-through' }}>{fmt.currency(dtoDetalle.base)} <span style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none' }}>−{dtoDetalle.pct}%</span></div>}
                    <div style={{ fontSize: 18, fontWeight: 700, color: G }}>
                      {fmt.currency(precioEffD)}
                      {showUnidad && <span style={{ fontSize: 11, color: GRAY, fontWeight: 400, marginLeft: 3 }}>/ {item.unidad}</span>}
                    </div>
                  </>
                )}
              </div>
              {qty > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button onClick={() => onSetQty(item, undefined, Math.max(0, qty - stepQty))} aria-label={byBox ? `Quitar una caja de ${item.nombre}` : `Quitar una unidad de ${item.nombre}`} style={{
                    width: 44, height: 44, border: `1.5px solid ${G}`, borderRadius: 10, background: '#fff',
                    color: G, fontSize: 20, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{'\u2212'}</button>
                  <div style={{ minWidth: 38, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1a1a18' }}>{byBox ? `${Math.round(qty / uxcD)}\u00d7` : qty}</div>
                  <button onClick={() => onSetQty(item, undefined, qty + stepQty)} aria-label={byBox ? `Agregar una caja de ${item.nombre}` : `Agregar una unidad de ${item.nombre}`} style={{
                    width: 44, height: 44, background: G, border: 'none', borderRadius: 10, color: '#fff',
                    fontSize: 20, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                </div>
              ) : (
                <button onClick={() => onSetQty(item, undefined, byBox ? uxcD : (item.min_order_qty > 1 ? item.min_order_qty : 1))} style={{
                  marginLeft: 'auto', flex: 1, maxWidth: 240, padding: '14px 0', background: G, color: '#fff',
                  border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: SANS }}>
                  {byBox ? `Agregar caja de ${uxcD}` : (item.min_order_qty > 1 ? `Agregar (mín. ${item.min_order_qty})` : 'Agregar')}
                </button>
              )}
            </>
          ) : (
            waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" style={{
                flex: 1, textAlign: 'center', padding: '14px 0', background: '#1f2d24', color: '#fff',
                borderRadius: 12, fontSize: 15, fontWeight: 700, fontFamily: SANS, textDecoration: 'none' }}>
                Consultar disponibilidad
              </a>
            ) : (
              <div style={{ flex: 1, textAlign: 'center', padding: '14px 0', background: '#f0f0ec',
                color: GRAY, borderRadius: 12, fontSize: 15, fontWeight: 700 }}>Consultar disponibilidad</div>
            )
          )}
        </div>
      )}
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
    importado:  { label: 'Confirmado', color: '#059669', bg: '#f0fdf4' },
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

  // Skeleton que CALCA la fila de pedido real (fecha + Nº OC + total + badge de
  // estado). Al llegar los pedidos encajan en el mismo molde → sin "salto" de
  // layout, mismo criterio que la grilla del catálogo.
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #efefeb',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="sk-shimmer" style={{ height: 12, width: 110, borderRadius: 4 }} />
            <div className="sk-shimmer" style={{ height: 9,  width: 70,  borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
            <div className="sk-shimmer" style={{ height: 15, width: 80, borderRadius: 4 }} />
            <div className="sk-shimmer" style={{ height: 14, width: 64, borderRadius: 20 }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (!pedidos.length) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>Sin pedidos aún</div>
      <div style={{ fontSize: 13, color: '#6a6a68' }}>Tus pedidos confirmados aparecerán acá</div>
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
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Nº de orden = mismo OC del comprobante PDF. Le da al cliente una
                    referencia para nombrar el pedido al distribuidor (WhatsApp/tel). */}
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9a9a94', letterSpacing: .4,
                  fontFamily: SANS, marginBottom: 2 }}>
                  OC-{String(p.id).slice(0, 8).toUpperCase()}
                </div>
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
                {/* Seguimiento del pedido — Recibido -> Preparando -> En camino -> Entregado.
                    El estado lo avanza el distribuidor desde su panel (y en el futuro
                    SimpliRoute marca 'Entregado' solo). Si esta cancelado, no se muestra. */}
                {p.estado === 'cancelada' ? (
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: '#ef4444',
                    background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
                    Este pedido fue cancelado.
                  </div>
                ) : (() => {
                  const PASOS = ['Recibido', 'Preparando', 'En camino', 'Entregado'];
                  const IDX = { pendiente: 0, importada: 0, importado: 0, confirmada: 0, preparada: 1, en_ruta: 2, entregada: 3 };
                  const cur = IDX[p.estado] != null ? IDX[p.estado] : 0;
                  return (
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start' }}>
                      {PASOS.map((paso, i) => {
                        const done = i <= cur;
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            {i > 0 && (
                              <div style={{ position: 'absolute', top: 9, right: '50%', width: '100%', height: 2,
                                background: i <= cur ? G : '#e5e5e0' }} />
                            )}
                            <div style={{ width: 20, height: 20, borderRadius: '50%', zIndex: 1,
                              background: done ? G : '#fff', border: '2px solid ' + (done ? G : '#d8d8d2'),
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span style={{ fontSize: 10, marginTop: 5, fontWeight: i === cur ? 700 : 500,
                              color: done ? '#1a1a18' : '#9a9a98', textAlign: 'center' }}>{paso}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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
function CartDrawer({ carrito, items, session, onClose, onConfirm, onAdd, onAddSugerido, onRemove, onRemoveLine, onGuardarLista, brandCfg, brandNombre, coBuy, recommended }) {
  const [notas,   setNotas]   = useState('');
  // "Guardar como lista": el cliente nombra el carrito armado para repetirlo luego.
  const [guardarOpen, setGuardarOpen] = useState(false);
  const [listaNombre, setListaNombre] = useState('');
  const [listaOk,     setListaOk]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState('');
  // Vista previa de la orden (antes de confirmar) + acciones post-confirmación
  // (descargar PDF / enviar por mail). lastOrderId es el id real devuelto por el
  // endpoint, necesario para pedir el comprobante; en demo queda null.
  const [showPreview, setShowPreview] = useState(false);
  // Detalle de productos en la confirmación: colapsable (patrón Shopify/Amazon).
  // Con listas largas el detalle empuja el total y la nota fuera de la vista; se
  // colapsa por defecto y se abre para verificar. null = todavía no decidido por
  // el usuario, así respeta el default según la cantidad de líneas.
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [emailOpen,   setEmailOpen]   = useState(false);
  const [emailAddr,   setEmailAddr]   = useState('');
  const [emailing,    setEmailing]    = useState(false);
  const [accionMsg,   setAccionMsg]   = useState('');
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true');

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
    const c = calcLinea(item, qty);
    // descPct es solo el descuento por unidad SUELTA (Siempre/cantidad). Cuando hay
    // caja cerrada, las unidades de caja pagan menos, así que el ahorro real de la
    // línea es mayor. descEfectivoPct = ahorro real vs el precio de lista mostrado.
    // Referencia para el % de ahorro y el precio tachado. En v2 el precio de lista
    // REAL es precioBase (sin descontar); item.precio ya trae el dto "siempre"
    // adentro, así que usarlo escondía ese ahorro (mostraba 0%). En el camino viejo
    // no hay base separada confiable, así que se mantiene item.precio como referencia.
    const refUnit = item.reglasV2 ? (Number(item.precioBase) || 0) : (Number(item.precio) || 0);
    const descEfectivoPct = refUnit > 0 ? Math.max(0, Math.round(100 * (1 - c.netoLinea / (refUnit * qty)))) : 0;
    // Unidades que efectivamente pagan precio distribuidor (completan cajas).
    const unidEnCaja = c.cajaUnid > 0 ? Math.floor(qty / c.cajaUnid) * c.cajaUnid : 0;
    return { key, item, qty, variantId, variantSku, ...c, descEfectivoPct, unidEnCaja, precioRef: refUnit };
  });
  const { subtotalNeto, ivaTotal, total } = calcTotales(lineasConCalc);

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

  // Envío sin cargo con barra de progreso (patrón Amazon "Add $X to qualify for FREE
  // shipping"): incentiva subir el ticket. Genérico por-org (brandCfg.freeShipThreshold),
  // 0 = desactivado. Se mide sobre el subtotal neto (mismo criterio que el mínimo).
  const freeShipThreshold = Number(brandCfg?.freeShipThreshold) || 0;
  const faltaEnvioGratis = freeShipThreshold > 0 ? Math.max(0, freeShipThreshold - subtotalNeto) : 0;
  const tieneEnvioGratis = freeShipThreshold > 0 && faltaEnvioGratis <= 0;
  const pctEnvioGratis = freeShipThreshold > 0 ? Math.min(100, Math.round((subtotalNeto / freeShipThreshold) * 100)) : 0;

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

  // ── Fecha de entrega ────────────────────────────────────────────────────────
  // El motor decide según la config POR-ORG (brandCfg.reparto):
  //   off     → no se muestra nada (default; cero cambios para quien no lo use).
  //   zona    → estimada read-only según la zona/ruta del cliente (caso Eric).
  //   cliente → el cliente elige entre los días hábiles (distri que entrega a pedido).
  const entrega = React.useMemo(
    () => calcularEntrega(brandCfg?.reparto, session?.zona, new Date()),
    [brandCfg?.reparto, session?.zona]
  );
  // En modo 'cliente' el cliente elige; guardamos el ISO (YYYY-MM-DD) elegido.
  // Arranca en la primera opción para que nunca viaje vacío.
  const isoDia = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  const [fechaElegida, setFechaElegida] = React.useState('');
  React.useEffect(() => {
    if (entrega.modo === 'cliente' && entrega.opciones.length && !fechaElegida) {
      setFechaElegida(isoDia(entrega.opciones[0]));
    }
  }, [entrega.modo, entrega.opciones, fechaElegida]);
  // Fecha efectiva que viaja en el pedido: la elegida (cliente) o la estimada (zona).
  const fechaEntregaISO = entrega.modo === 'cliente'
    ? fechaElegida
    : (entrega.fecha ? isoDia(entrega.fecha) : '');
  // Etiqueta linda ("Jueves 21 de agosto") de la fecha efectiva, para la pantalla
  // de confirmación. Parseamos el ISO con partes LOCALES (no new Date(iso), que es UTC).
  const entregaLabel = fechaEntregaISO
    ? formatFechaLargaCap(new Date(
        Number(fechaEntregaISO.slice(0, 4)),
        Number(fechaEntregaISO.slice(5, 7)) - 1,
        Number(fechaEntregaISO.slice(8, 10))
      ))
    : '';

  React.useEffect(() => {
    if (!session?.token) return;
    // Se lee por el server (service role) y no directo desde el browser: la tabla
    // client_addresses tiene RLS y la anon key devolvía [] en silencio → el
    // selector de sucursal nunca aparecía aunque el cliente tuviera sucursales.
    fetch(`${API}/api/client-addresses`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(data => { const a = data?.addresses; if (Array.isArray(a) && a.length > 0) { setAddresses(a); setSelectedAddress(a[0].id); } })
      .catch(console.error);
  }, [session?.token]);

  // Analytics helper — manda al panel propio (api/track) + posthog si está cargado
  const track = (event, props = {}) => {
    trackWeb(event, props);
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
            // Desglose por tramo (caja cerrada): el PDF/mail lo muestra en filas
            // separadas en vez de un % promedio. Solo cuando hay más de un tramo;
            // no afecta el stock (una sola línea por producto para la reserva).
            ...(l.tramos && l.tramos.length > 1 ? { tramos: l.tramos.map(t => ({
              unidades: t.unidades, precioUnit: t.precioUnit, distribuidor: !!t.distribuidor,
            })) } : {}),
            ...(l.variantId ? { variantId: l.variantId, variantSku: l.variantSku || '' } : {}),
          })),
          total, notas,
          direccion_entrega: addresses.find(a => a.id === selectedAddress)?.direccion || null,
          fecha_entrega_estimada: fechaEntregaISO || null,
          idempotencyKey,
        }),
      });
      // Solo marcamos done → se muestra la pantalla de confirmación. El carrito se
      // limpia y el drawer se cierra recién cuando el usuario descarta esa pantalla
      // (onConfirm), no antes; si no, el drawer se desmontaba y la confirmación
      // nunca llegaba a verse.
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        setLastOrderId(d.orderId || null);
        track('pedido_confirmado', { items: lineas.length, total });
        setShowPreview(false);
        setDone(true);
      }
      else { const d = await r.json().catch(() => ({})); setErr(d.error || 'No se pudo confirmar el pedido.'); }
    } catch { setErr('Error de conexión. Intentá de nuevo.'); }
    finally { setLoading(false); }
  };

  // Descarga el PDF de la orden ANTES de confirmar (desde la vista previa).
  const descargarPreviewPDF = async () => {
    if (isDemo) { setAccionMsg('La descarga está disponible en tu cuenta real.'); return; }
    setDownloading(true); setAccionMsg('');
    try {
      const r = await fetch(`${window.location.origin}/api/pedido?action=preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          items: lineasConCalc.map(l => ({
            productId: l.item.id, nombre: l.item.nombre, unidad: l.item.unidad,
            cantidad: l.qty, precioUnit: l.precioConDto, subtotal: l.netoLinea,
            ...(l.tramos && l.tramos.length > 1 ? { tramos: l.tramos.map(t => ({
              unidades: t.unidades, precioUnit: t.precioUnit, distribuidor: !!t.distribuidor,
            })) } : {}),
          })),
          notas, total,
        }),
      });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'orden-vista-previa.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setAccionMsg('No se pudo descargar el PDF. Intentá de nuevo.'); }
    finally { setDownloading(false); }
  };

  // Descarga el comprobante en PDF del pedido recién confirmado (id real).
  const descargarPDF = async () => {
    if (!lastOrderId || isDemo) return;
    setDownloading(true); setAccionMsg('');
    try {
      const r = await fetch(`${window.location.origin}/api/pedido?action=comprobante&orderId=${lastOrderId}`,
        { headers: { Authorization: `Bearer ${session.token}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `comprobante-OC-${String(lastOrderId).slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setAccionMsg('No se pudo descargar el PDF. Intentá de nuevo.'); }
    finally { setDownloading(false); }
  };

  // Envía el comprobante por mail a la casilla que elige el cliente.
  const enviarPorMail = async () => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const dest = emailAddr.trim();
    if (!EMAIL_RE.test(dest)) { setAccionMsg('Ingresá un email válido.'); return; }
    if (!lastOrderId || isDemo) { setAccionMsg('Disponible al confirmar un pedido real.'); return; }
    setEmailing(true); setAccionMsg('');
    try {
      const r = await fetch(`${window.location.origin}/api/pedido?action=email-comprobante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ orderId: lastOrderId, to: dest }),
      });
      if (r.ok) { setAccionMsg('✓ Comprobante enviado a ' + dest); setEmailOpen(false); }
      else { const d = await r.json().catch(() => ({})); setAccionMsg(d.error || 'No se pudo enviar el email.'); }
    } catch { setAccionMsg('Error de conexión. Intentá de nuevo.'); }
    finally { setEmailing(false); }
  };

  // Ref del pedido = el MISMO identificador que usa el PDF/comprobante (OC-XXXXXXXX
  // derivado del orderId real del server). Antes era un random que no coincidía con
  // el del comprobante, lo que confundía al cliente. En demo no hay orderId real.
  const pedidoRef = lastOrderId ? `OC-${String(lastOrderId).slice(0, 8).toUpperCase()}` : 'DEMO';
  const fechaHoy  = new Date().toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  // ── Vista previa de la orden (antes de confirmar) ────────────────────────────
  // Muestra el detalle TAL COMO sale en el PDF: cabecera, cliente, líneas con
  // cantidad/precio/descuento, totales y notas. Desde acá se confirma o se vuelve.
  if (showPreview && !done) {
    const direccionSel = addresses.find(a => a.id === selectedAddress);
    // Con pocas líneas se muestra el detalle abierto; con muchas arranca colapsado
    // para que total + nota + confirmar queden a la vista sin scroll (Shopify).
    const detalleVisible = detalleAbierto === null ? lineasConCalc.length <= 4 : detalleAbierto;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: Z.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={() => setShowPreview(false)}>
        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: SANS, position: 'relative' }}
          onClick={e => e.stopPropagation()}>
          {/* Cuerpo scrolleable: todo el documento. El footer con "Confirmar
              pedido" queda fijo abajo (patrón Amazon: la acción primaria siempre
              visible, sin obligar a scrollear hasta el final para confirmar). */}
          <div style={{ overflowY: 'auto', flexShrink: 1 }}>
          {/* Cabecera documento */}
          <div style={{ padding: '24px 24px 18px', borderBottom: `2px solid ${G}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a18' }}>{brandNombre || 'Orden de compra'}</div>
                <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>Vista previa de la orden</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#6a6a68' }}>Fecha</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18' }}>{fechaHoy}</div>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div style={{ padding: '16px 24px 4px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5, marginBottom: 6 }}>CLIENTE</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>{session?.nombre || 'Cliente'}</div>
            {session?.tel && <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>Tel: {session.tel}</div>}
          </div>

          {/* Entregar en — se elige acá, en la confirmación (patrón Amazon: la
              dirección es un paso del checkout, no del carrito). Con espacio de
              sobra, se ve grande y clara con pin + referencia. */}
          {addresses.length > 0 && (
            <div style={{ padding: '12px 24px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5 }}>ENTREGAR EN</span>
              </div>
              {addresses.length === 1 ? (
                <div style={{ fontSize: 13, color: '#4a4a48' }}>
                  <strong style={{ color: '#1a1a18' }}>{addresses[0].label}</strong>
                  {' — '}{addresses[0].direccion}{addresses[0].ciudad ? `, ${addresses[0].ciudad}` : ''}
                </div>
              ) : (
                <select value={selectedAddress || ''} onChange={e => setSelectedAddress(Number(e.target.value))}
                  aria-label="Sucursal de entrega"
                  onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                  onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 8,
                    fontSize: 16, fontFamily: SANS, color: '#1a1a18', background: '#fff', outline: 'none' }}>
                  {addresses.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.direccion}{a.ciudad ? `, ${a.ciudad}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {direccionSel?.referencia && (
                <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 6, fontStyle: 'italic' }}>
                  {direccionSel.referencia}
                </div>
              )}
            </div>
          )}

          {/* Fecha de entrega — patrón Amazon "Arriving Thursday". En B2B el día lo
              suele mandar la ruta/zona (read-only), pero algunas distribuidoras
              dejan elegir. El motor (lib/delivery) resuelve ambos casos por-org;
              si el modo es 'off' no se renderiza nada. */}
          {entrega.modo === 'zona' && entrega.fecha && (
            <div style={{ padding: '12px 24px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5 }}>ENTREGA ESTIMADA</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>
                {entrega.label}
              </div>
              {entrega.sub && (
                <div style={{ fontSize: 11.5, color: '#6a6a68', marginTop: 2 }}>{entrega.sub}</div>
              )}
            </div>
          )}
          {entrega.modo === 'cliente' && entrega.opciones.length > 0 && (
            <div style={{ padding: '12px 24px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5 }}>¿CUÁNDO LO RECIBÍS?</span>
              </div>
              <select value={fechaElegida} onChange={e => setFechaElegida(e.target.value)}
                aria-label="Día de entrega"
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 8,
                  fontSize: 16, fontFamily: SANS, color: '#1a1a18', background: '#fff', outline: 'none' }}>
                {entrega.opciones.map(d => (
                  <option key={isoDia(d)} value={isoDia(d)}>{formatFechaLargaCap(d)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Detalle — colapsable (Shopify): el header es un botón que abre/cierra
              la lista. Total + nota + confirmar quedan siempre cerca, sin scroll. */}
          <div style={{ padding: '12px 24px' }}>
            <button type="button" onClick={() => setDetalleAbierto(v => !(v === null ? lineasConCalc.length <= 4 : v))}
              aria-expanded={detalleVisible}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, fontWeight: 600, color: '#6a6a68', letterSpacing: .5, marginBottom: 8,
                borderBottom: '1px solid #ececec', paddingBottom: 6, fontFamily: SANS }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>PRODUCTO{lineasConCalc.length > 1 ? `S · ${lineasConCalc.length}` : ''}</span>
                <span style={{ fontSize: 10, transform: detalleVisible ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: G }}>▾</span>
              </span>
              <span>{detalleVisible ? 'SUBTOTAL' : 'Ver detalle'}</span>
            </button>
            {detalleVisible && lineasConCalc.map(({ key, item, qty, variantId, descEfectivoPct, precioConDto, netoLinea, ivaRate, tramos }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid #f5f5f0', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2 }}>
                    {qty} {item.unidad || ''}
                    {(!tramos || tramos.length <= 1) && <> × {fmt.currency(precioConDto)}</>}
                    {(!tramos || tramos.length <= 1) && descEfectivoPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{descEfectivoPct}%</span>}
                    <span style={{ color: '#c0c0b8', marginLeft: 4 }}>IVA {ivaRate}%</span>
                  </div>
                  {/* Desglose por tramo (caja cerrada): mismas filas que el carrito y el
                      PDF, en vez de un único % promedio que mezcla caja y sueltas. */}
                  {tramos && tramos.length > 1 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {tramos.map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: t.distribuidor ? G : '#6a6a68', fontWeight: t.distribuidor ? 600 : 400 }}>
                          {t.distribuidor ? '✓ ' : '• '}{t.unidades} {item.unidad || 'u'} × {fmt.currency(t.precioUnit)}
                          {t.dtoPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{Math.round(t.dtoPct)}%</span>}
                          {t.distribuidor && <span style={{ marginLeft: 4 }}>(precio distribuidor)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{fmt.currency(netoLinea)}</div>
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
              {[...new Set(lineasConCalc.map(l => l.ivaRate))].sort((a, b) => a - b).map(rate => {
                const ivaDeRate = lineasConCalc.filter(l => l.ivaRate === rate).reduce((s, l) => s + l.ivaLinea, 0);
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

          {/* Nota del pedido — editable acá, en la confirmación (se movió del
              carrito para no recargarlo). Siempre visible para que el cliente
              pueda agregar indicaciones antes de confirmar. */}
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: .5, marginBottom: 6 }}>NOTA DEL PEDIDO</div>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: entregar antes del mediodía, coordinar por WhatsApp…" aria-label="Nota del pedido"
              onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
              onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
              rows={2} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8',
                borderRadius: 8, fontSize: 16, fontFamily: SANS, resize: 'none',
                boxSizing: 'border-box', outline: 'none', background: '#fafaf7' }} />
          </div>

          {/* PDF: acción secundaria, queda en el cuerpo scrolleable */}
          {!isDemo && (
            <div style={{ padding: '4px 24px 24px' }}>
              <button onClick={descargarPreviewPDF} disabled={downloading} style={{
                width: '100%', padding: '11px 0', background: '#fff', color: '#1a1a18',
                border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13, fontWeight: 600,
                cursor: downloading ? 'wait' : 'pointer', fontFamily: SANS,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {downloading ? 'Generando…' : 'Descargar PDF'}
              </button>
            </div>
          )}
          </div>{/* fin cuerpo scrolleable */}

          {/* Footer fijo: "Confirmar pedido" siempre visible, sin scroll (Amazon). */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #ececec', background: '#fff',
            borderRadius: '0 0 20px 20px',
            padding: '12px 24px max(20px, calc(12px + env(safe-area-inset-bottom, 0px)))' }}>
            {err && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '9px 12px', marginBottom: 10, fontSize: 12, color: '#dc2626' }}>{err}</div>
            )}
            {accionMsg && (
              <div style={{ marginBottom: 10, fontSize: 12, textAlign: 'center',
                color: accionMsg.startsWith('✓') ? G : '#dc2626' }}>
                {accionMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPreview(false)} style={{
                flex: '0 0 auto', padding: '12px 18px', background: '#fff', color: '#1a1a18',
                border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: SANS }}>
                ← Editar
              </button>
              <button onClick={confirmar} disabled={loading || lineas.length === 0 || !cumpleMinimo} style={{
                flex: 1, padding: '12px 0',
                background: loading || lineas.length === 0 || !cumpleMinimo ? '#c8c8c0' : G,
                color: '#fff', border: 'none', borderRadius: 50, fontSize: 14, fontWeight: 600,
                cursor: (loading || !cumpleMinimo) ? 'not-allowed' : 'pointer', fontFamily: SANS }}>
                {loading ? 'Enviando…' : 'Confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Fecha de entrega (si la org usa reparto) — banda tipo "Arriving Thursday" */}
        {entregaLabel && (
          <div style={{ padding: '14px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4',
              border: '1px solid #bbf7d0', borderRadius: 10, padding: '11px 14px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#166534', letterSpacing: .4 }}>
                  {entrega.modo === 'cliente' ? 'FECHA DE ENTREGA' : 'ENTREGA ESTIMADA'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#14532d', marginTop: 1 }}>{entregaLabel}</div>
              </div>
            </div>
          </div>
        )}

        {/* Detalle de productos */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', letterSpacing: .5, marginBottom: 10 }}>
            DETALLE DEL PEDIDO
          </div>
          {lineasConCalc.map(({ key, item, qty, descEfectivoPct, precioConDto, precioRef, netoLinea, ivaRate }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #f5f5f0', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2 }}>
                  {qty} × {fmt.currency(precioConDto)}
                  {descEfectivoPct > 0 && <span style={{ color: '#b0b0a8', marginLeft: 4, textDecoration: 'line-through' }}>{fmt.currency(precioRef)}</span>}
                  {descEfectivoPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{descEfectivoPct}%</span>}
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

          {/* Descargar PDF / Enviar por mail — sólo con pedido real (id devuelto) */}
          {lastOrderId && !isDemo && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={descargarPDF} disabled={downloading} style={{
                  flex: 1, padding: '11px 0', background: '#fff', color: '#1a1a18',
                  border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13, fontWeight: 600,
                  cursor: downloading ? 'wait' : 'pointer', fontFamily: SANS,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {downloading ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button onClick={() => { setEmailOpen(o => !o); setAccionMsg(''); }} style={{
                  flex: 1, padding: '11px 0', background: '#fff', color: '#1a1a18',
                  border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: SANS,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Enviar por mail
                </button>
              </div>
              {emailOpen && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <input type="email" inputMode="email" value={emailAddr}
                    onChange={e => setEmailAddr(e.target.value)} placeholder="tucorreo@ejemplo.com"
                    aria-label="Email para enviar el comprobante"
                    onKeyDown={e => { if (e.key === 'Enter') enviarPorMail(); }}
                    onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                    onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 10,
                      fontSize: 16, fontFamily: SANS, outline: 'none', background: '#fafaf7' }} />
                  <button onClick={enviarPorMail} disabled={emailing} style={{
                    padding: '10px 18px', background: G, color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: emailing ? 'wait' : 'pointer', fontFamily: SANS, whiteSpace: 'nowrap' }}>
                    {emailing ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              )}
              {accionMsg && (
                <div style={{ marginTop: 10, fontSize: 12, textAlign: 'center',
                  color: accionMsg.startsWith('✓') ? G : '#dc2626' }}>
                  {accionMsg}
                </div>
              )}
            </div>
          )}

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: Z.overlay,
      animation: 'pzCartFade .2s ease both' }}
      onClick={onClose}>
      {/* El panel entra deslizándose desde la derecha en vez de aparecer de golpe. */}
      <style>{'@keyframes pzCartFade{from{opacity:0}to{opacity:1}}@keyframes pzCartSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}'}</style>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.min(400, window.innerWidth), background: '#fff',
        display: 'flex', flexDirection: 'column', fontFamily: SANS,
        animation: 'pzCartSlide .26s cubic-bezier(.32,.72,0,1) both' }}
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
          {/* Sugeridos — arriba de todo: se ven apenas se abre el carrito, sin
              scrollear. Antes estaban fijos sobre el total y le robaban lugar a las
              notas; ahora viven en el flujo natural del scroll, al tope. */}
          {sugeridos.length > 0 && (
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0ede8' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>
                Quienes pidieron esto también sumaron
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {sugeridos.map(p => (
                  <div key={p.id} style={{ flex: '0 0 116px', width: 116, border: '1px solid #ececec',
                    borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, background: '#fff' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a18', lineHeight: 1.25,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', minHeight: 27 }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: G }}>{fmt.currency(p.precio)}</div>
                    <button onClick={() => onAddSugerido && onAddSugerido(p)} aria-label={`Agregar ${p.nombre}`} style={{
                      marginTop: 'auto', padding: '6px 0', background: G, color: '#fff', border: 'none',
                      borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                      + Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lineasConCalc.map(({ key, item, qty, variantId, ivaRate, descEfectivoPct, unidEnCaja, precioConDto, precioRef, netoLinea, faltanParaCaja, ahorroSiCompleta, tramos }) => (
            <div key={key} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6a6a68', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    {/* Unitario EFECTIVO (precioConDto), no item.precio: item.precio es el
                        precio "de siempre" (dto chico adentro); si además aplica un tramo
                        mayor, el unitario real es más bajo. Mostrar item.precio + "-X%"
                        del tramo parecía un descuento apilado. Referencia tachada al lado. */}
                    {(!tramos || tramos.length <= 1) && descEfectivoPct > 0 && <span style={{ color: '#b0b0a8', textDecoration: 'line-through' }}>{fmt.currency(precioRef)}</span>}
                    <span>{fmt.currency((!tramos || tramos.length <= 1) ? precioConDto : item.precio)}{item.unidad ? ` / ${item.unidad}` : ''}</span>
                    {(!tramos || tramos.length <= 1) && descEfectivoPct > 0 && <span style={{ color: '#dc2626' }}>-{descEfectivoPct}%</span>}
                    <span style={{ color: '#c0c0b8' }}>IVA {ivaRate}%</span>
                  </div>
                  {/* Desglose por tramo: cuando parte de la cantidad lleva un descuento
                      y otra parte otro (ej. caja cerrada + sueltas), se muestran
                      separados en vez de un único % promedio que no le sirve a nadie. */}
                  {tramos && tramos.length > 1 ? (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {tramos.map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: t.distribuidor ? G : '#6a6a68', fontWeight: t.distribuidor ? 600 : 400 }}>
                          {t.distribuidor ? '✓ ' : '• '}{t.unidades} {item.unidad || 'u'} × {fmt.currency(t.precioUnit)}
                          {t.dtoPct > 0 && <span style={{ color: '#dc2626', marginLeft: 4 }}>-{Math.round(t.dtoPct)}%</span>}
                          {t.distribuidor && <span style={{ marginLeft: 4 }}>(precio distribuidor)</span>}
                        </div>
                      ))}
                    </div>
                  ) : unidEnCaja > 0 && (
                    <div style={{ fontSize: 11, color: G, fontWeight: 600, marginTop: 3 }}>
                      ✓ {unidEnCaja} {item.unidad || 'u'} a precio distribuidor (caja cerrada)
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {descEfectivoPct > 0 && (
                    <div style={{ fontSize: 11, color: '#b0b0a8', textDecoration: 'line-through' }}>
                      {fmt.currency(precioRef * qty)}
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
              {/* Empujón para completar caja — va acá, en el carrito, donde el
                  cliente ajusta cantidades (no en la confirmación, que es solo
                  para confirmar). Patrón Amazon: el upsell vive al comprar. */}
              {faltanParaCaja > 0 && (
                <button type="button" onClick={() => { for (let n = 0; n < faltanParaCaja; n++) onAdd && onAdd(item, variantId); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                    marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                    padding: '7px 10px', fontSize: 11.5, color: '#166534', cursor: 'pointer', fontWeight: 500 }}>
                  <span>📦</span>
                  <span>Agregá {faltanParaCaja} más y completás la caja — ahorrás {fmt.currency(ahorroSiCompleta)}</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f0ede8' }}>
          {/* Checkout en 2 pasos (patrón Amazon/Shopify): el carrito solo revisa
              productos + total y lleva a la pantalla de confirmación. La sucursal
              y la nota se eligen ALLÍ, no acá — así el footer no queda recargado
              mezclando "revisar carrito" con "confirmar pedido". */}
          {/* Barra de envío sin cargo (patrón Amazon): mensaje + progreso hacia el umbral.
              Verde lleno cuando ya calificó. Sólo si el distribuidor cargó un umbral y hay
              mercadería en el carrito. */}
          {freeShipThreshold > 0 && lineas.length > 0 && (
            <div style={{ marginBottom: 14, background: tieneEnvioGratis ? '#f0fdf4' : '#fafaf7',
              border: `1px solid ${tieneEnvioGratis ? '#bbf7d0' : '#ececE4'}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tieneEnvioGratis ? '#059669' : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: tieneEnvioGratis ? '#047857' : '#3a3a32', lineHeight: 1.35 }}>
                  {tieneEnvioGratis
                    ? '¡Tenés envío sin cargo! 🎉'
                    : <>Te faltan <span style={{ fontWeight: 700, color: '#1a1a18' }}>{fmt.currency(faltaEnvioGratis)}</span> para el envío sin cargo</>}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 50, background: '#e8e8e0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctEnvioGratis}%`, borderRadius: 50,
                  background: G, transition: 'width .35s ease' }} />
              </div>
            </div>
          )}
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
          {/* Guardar el carrito como lista de recompra (patrón "Subscribe & Save").
              Acción secundaria: no compite con "Continuar", pero deja al cliente
              armar su pedido habitual una vez y repetirlo en un toque. */}
          {onGuardarLista && lineas.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {!guardarOpen ? (
                <button onClick={() => { setGuardarOpen(true); setListaOk(''); }} style={{
                  width: '100%', padding: '10px 0', background: '#fff', color: '#3a3a32',
                  border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                  </svg>
                  Guardar como lista
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={listaNombre} onChange={e => setListaNombre(e.target.value)} maxLength={40}
                    placeholder="Ej: Pedido semanal" aria-label="Nombre de la lista" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && onGuardarLista(listaNombre)) { setGuardarOpen(false); setListaNombre(''); setListaOk('✓ Lista guardada'); } }}
                    onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}22`; }}
                    onBlur={e => { e.target.style.borderColor = '#e0e0d8'; e.target.style.boxShadow = 'none'; }}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 10,
                      fontSize: 16, fontFamily: SANS, outline: 'none', background: '#fafaf7' }} />
                  <button onClick={() => { if (onGuardarLista(listaNombre)) { setGuardarOpen(false); setListaNombre(''); setListaOk('✓ Lista guardada'); } }} style={{
                    padding: '10px 16px', background: G, color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap' }}>
                    Guardar
                  </button>
                </div>
              )}
              {listaOk && <div style={{ marginTop: 8, fontSize: 12, textAlign: 'center', color: G }}>{listaOk}</div>}
            </div>
          )}
          {/* CTA único: lleva a la pantalla de confirmación (donde se elige sucursal
              y nota). Antes había "Previsualizar" + "Confirmar" juntos, lo que
              recargaba el footer y permitía confirmar sin pasar por la sucursal. */}
          <button onClick={() => { setErr(''); setShowPreview(true); }}
            disabled={lineas.length === 0 || !cumpleMinimo} style={{
            width: '100%', padding: '13px 0',
            background: lineas.length === 0 || !cumpleMinimo ? '#c8c8c0' : G,
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: (lineas.length === 0 || !cumpleMinimo) ? 'not-allowed' : 'pointer', fontFamily: SANS,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {!cumpleMinimo ? `Mínimo ${fmt.currency(minOrderAmount)}` : (<>Continuar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg></>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Banner "Instalar app" (PWA) ───────────────────────────────────────────────
// Invita al cliente a instalar el portal como app en su cel. Genérico por-org:
// muestra la marca de la distribuidora. En Android/Chrome dispara el instalador
// nativo; en iPhone (Safari no expone API de instalación) abre las instrucciones
// de "Compartir → Agregar a inicio". Se auto-oculta si ya está instalada o si el
// cliente lo cierra (no vuelve a molestar).
function InstallAppBanner({ brandNombre }) {
  const [deferred, setDeferred]   = useState(null); // evento beforeinstallprompt (Android)
  const [iosHelp,  setIosHelp]    = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pazque-install-dismissed') === '1'; } catch { return false; }
  });

  // ¿Ya corre instalada (standalone)? → no mostrar nada.
  const isStandalone = typeof window !== 'undefined' &&
    ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  // iOS Safari no dispara beforeinstallprompt: la instalación es manual.
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setDismissed(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const cerrar = () => {
    setDismissed(true);
    try { localStorage.setItem('pazque-install-dismissed', '1'); } catch { /* storage bloqueado */ }
  };
  const instalar = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* el usuario canceló */ }
      setDeferred(null);
      cerrar();
    } else if (isIOS) {
      setIosHelp(true);
    }
  };

  // Ocultar si ya está instalada o si el cliente cerró el aviso.
  if (isStandalone || dismissed) return null;

  // ¿Hay forma de instalar acá mismo? Android (deferred) o iPhone (manual).
  const puedeInstalar = !!deferred || isIOS;
  const marca = brandNombre ? `de ${brandNombre}` : 'de pedidos';

  // Caso desktop (no se puede instalar acá): no mostramos nada. Igual que Amazon/
  // Shopify, la web no anuncia la app — el banner de instalar aparece solo en el
  // celular, que es donde realmente se puede instalar.
  if (!puedeInstalar) return null;

  return (
    <>
      <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: SANS }}>
        <span style={{ fontSize: 13, color: '#166534', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>📲</span> Instalá la app {marca} en tu celular
        </span>
        <button onClick={instalar} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: G,
          border: 'none', borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontFamily: SANS, flexShrink: 0 }}>
          Instalar
        </button>
        <button onClick={cerrar} aria-label="Cerrar" style={{ fontSize: 18, lineHeight: 1, color: '#6a6a68',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
          ×
        </button>
      </div>

      {iosHelp && (
        <div onClick={() => setIosHelp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: Z.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: SANS }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px 16px 0 0',
            padding: '24px 22px 32px', width: '100%', maxWidth: 460, boxShadow: '0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a18', marginBottom: 14 }}>
              Instalar la app en tu iPhone
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#3a3a32', lineHeight: 1.9 }}>
              <li>Tocá el botón <strong>Compartir</strong> <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2">
                  <path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"/></svg>
              </span> (abajo, en la barra de Safari)</li>
              <li>Deslizá y elegí <strong>"Agregar a inicio"</strong></li>
              <li>Tocá <strong>"Agregar"</strong> arriba a la derecha</li>
            </ol>
            <button onClick={() => setIosHelp(false)} style={{ marginTop: 22, width: '100%', padding: '12px 0',
              background: G, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: SANS }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Vidriera / Home del portal ────────────────────────────────────────────────
// Pantalla de inicio ANTES del listado plano (patrón Amazon/Faire/PedidosYa): el
// cliente entra a una vidriera con secciones — hero promocionable, categorías,
// "volver a comprar", "recomendado" con prueba social y tiles por categoría. El
// grid completo queda debajo como "Todo el catálogo". Genérica por-org: los
// banners salen de brandCfg.banners si el distribuidor los configuró; si no, se
// arman defaults inteligentes a partir de su propio catálogo (nunca hardcodea Eric).

const CAT_EMOJI = {
  panaderia:'🥖', pan:'🥖', bebida:'🥤', bebidas:'🥤', gaseosa:'🥤', agua:'💧', vino:'🍷', cerveza:'🍺',
  lacteo:'🧀', lacteos:'🧀', queso:'🧀', leche:'🥛', carne:'🥩', carnes:'🥩', pollo:'🍗', pescado:'🐟',
  fruta:'🍎', frutas:'🍎', verdura:'🥬', verduras:'🥬', fiambre:'🥓', fiambres:'🥓', embutido:'🌭',
  limpieza:'🧴', higiene:'🧼', papel:'🧻', descartable:'🥡', descartables:'🥡', aceite:'🫒', aceites:'🫒',
  conserva:'🥫', conservas:'🥫', pasta:'🍝', pastas:'🍝', arroz:'🍚', harina:'🌾', harinas:'🌾',
  dulce:'🍬', dulces:'🍬', snack:'🍪', snacks:'🍪', cafe:'☕', te:'🍵', condimento:'🧂', condimentos:'🧂',
  congelado:'🧊', congelados:'🧊', construccion:'🏗️', ferreteria:'🔧', pintura:'🎨', electrico:'💡',
  cosmetica:'💄', cosmeticos:'💄', perfumeria:'🧴',
};
function catEmoji(name){
  const k = String(name||'').trim().toLowerCase();
  if (CAT_EMOJI[k]) return CAT_EMOJI[k];
  for (const key in CAT_EMOJI){ if (k.includes(key)) return CAT_EMOJI[key]; }
  return '🛒';
}

// Encabezado de sección editorial: titular serif (Playfair) en tinta cálida,
// acción opcional "Ver todo →" en verde apagado.
function SectionHead({ title, subtitle, actionLabel, onAction, extra }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const hasActions = extra || (actionLabel && onAction);
  // En mobile con acciones (ej. "Agregar todo" + "Ver todo") la fila única apretaba
  // el subtítulo contra los botones. Apilamos: título/subtítulo arriba (ancho completo),
  // acciones abajo en su propia fila. En desktop se mantiene la fila con space-between.
  const stack = isMobile && hasActions;
  return (
    <div style={{ display:'flex', flexDirection: stack ? 'column' : 'row',
      alignItems: stack ? 'stretch' : 'flex-end', justifyContent:'space-between',
      gap: stack ? 10 : 12, marginBottom:16 }}>
      <div style={{ minWidth:0 }}>
        <h2 style={{ fontFamily:SANS, fontSize:isMobile?16.5:19, fontWeight:700, color:INK, margin:0, letterSpacing:-.1, lineHeight:1.2 }}>{title}</h2>
        {subtitle && <p style={{ fontSize:isMobile?12.5:13, color:GRAY, margin:'3px 0 0' }}>{subtitle}</p>}
      </div>
      {hasActions && (
        <div style={{ flexShrink:0, display:'flex', alignItems:'center',
          justifyContent: stack ? 'space-between' : 'flex-end', gap:isMobile?8:12 }}>
          {extra}
          {actionLabel && onAction && (
            <button onClick={onAction} style={{ background:'none', border:'none', cursor:'pointer',
              color:FOREST, fontWeight:600, fontSize:13.5, fontFamily:SANS, display:'flex', alignItems:'center', gap:4, padding:'4px 0', letterSpacing:.2 }}>
              {actionLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Fila con scroll horizontal + snap. En desktop, chevrons flotantes que corren la fila.
function HScroll({ children, gap = 14 }) {
  const ref = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const nudge = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior:'smooth' }); };
  return (
    <div style={{ position:'relative' }}>
      <div ref={ref} className="pz-hscroll" style={{ display:'flex', gap, overflowX:'auto', scrollSnapType:'x mandatory',
        paddingBottom:4, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
        {children}
      </div>
      {!isMobile && (
        <>
          <button aria-label="Anterior" onClick={() => nudge(-1)} style={hscrollBtn('left')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a18" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button aria-label="Siguiente" onClick={() => nudge(1)} style={hscrollBtn('right')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a18" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
    </div>
  );
}
function hscrollBtn(side){
  return { position:'absolute', top:'42%', [side]:-6, transform:'translateY(-50%)', zIndex:5,
    width:36, height:36, borderRadius:'50%', border:'1px solid #ececE6', background:'rgba(255,255,255,.96)',
    boxShadow:'0 4px 14px rgba(0,0,0,.14)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
}

// Hero editorial (lenguaje Faire): lienzo crema, titular serif, acento verde
// apagado. Sin degradados neón, sin scrims, sin sombras duras. Auto-rota 7s.
function HeroCarousel({ banners, isMobile }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setI(p => (p + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[i];
  return (
    <div style={{ position:'relative', borderRadius:isMobile?18:22, overflow:'hidden',
      background:CREAM_TILE, border:'1px solid #ece3d3', minHeight:isMobile?190:252 }}>
      {/* filete superior en verde bosque — sello editorial, sin ruido */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:FOREST }} />
      <div style={{ position:'relative', padding:isMobile?'32px 24px 44px':'48px 52px', maxWidth:660 }}>
        {b.badge && <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:1.4,
          textTransform:'uppercase', color:FOREST, marginBottom:14 }}>{b.badge}</span>}
        <div style={{ fontFamily:DISPLAY, fontSize:isMobile?27:41, fontWeight:600, color:INK, lineHeight:1.08, letterSpacing:-.4 }}>{b.titulo}</div>
        {b.subtitulo && <div style={{ fontSize:isMobile?14:16, color:GRAY, marginTop:12, lineHeight:1.5, maxWidth:470 }}>{b.subtitulo}</div>}
        {b.cta && b.onClick && (
          <button onClick={b.onClick} style={{ marginTop:22, padding:'12px 26px', border:'none', borderRadius:50,
            background:FOREST, color:'#f7f3ea', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:SANS,
            display:'inline-flex', alignItems:'center', gap:8, letterSpacing:.2 }}>
            {b.cta}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>
      {banners.length > 1 && (
        <div style={{ position:'absolute', bottom:18, left:isMobile?24:52, display:'flex', gap:7 }}>
          {banners.map((_, k) => (
            <button key={k} aria-label={`Banner ${k+1}`} onClick={() => setI(k)} style={{ width:k===i?22:8, height:8, borderRadius:50,
              border:'none', cursor:'pointer', background:k===i?FOREST:'#d9cfba', transition:'width .25s, background .2s' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Tile de categoría estilo editorial (Faire): la foto arriba (portada o mosaico
// limpio sobre blanco) y el nombre DEBAJO, sobre crema — sin scrim oscuro ni
// emojis. La categoría destacada (featured) ocupa 2x2 → jerarquía y usa serif.
// Si no hay fotos, la inicial de la categoría en serif sobre crema (elegante).
function CategoryTile({ cat, imgs, coverOverride, featured, isMobile, onClick }) {
  // Portada elegida por el distribuidor (brandCfg.catPortadas) tiene prioridad; si no
  // eligió ninguna, cae a la primera foto del rubro (comportamiento automático).
  const cover = coverOverride || (imgs || []).filter(Boolean)[0] || null;
  const nameSize = featured ? (isMobile ? 18 : 24) : (isMobile ? 13.5 : 15.5);
  return (
    <button onClick={onClick} className="pz-cattile" style={{
      gridColumn: featured ? 'span 2' : 'span 1',
      gridRow: (featured && !isMobile) ? 'span 2' : 'span 1',
      display:'flex', flexDirection:'column', cursor:'pointer', padding:0, border:'1px solid #e7dcc9',
      borderRadius: isMobile ? 14 : 16, background:CREAM_TILE, fontFamily:SANS, overflow:'hidden', textAlign:'left' }}>
      {/* foto: UNA sola imagen del producto, centrada sobre blanco con aire (estética
          Faire) — sin mosaicos apretados ni recortes. Si no hay foto, la inicial en serif. */}
      <div style={{ position:'relative', flex:1, minHeight:0, overflow:'hidden', background: cover ? '#fff' : '#efe9dd' }}>
        {cover ? (
          <img src={cover} alt="" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%',
            boxSizing:'border-box', objectFit:'contain', padding: featured ? (isMobile?20:30) : (isMobile?14:20), display:'block' }} />
        ) : (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:DISPLAY, fontSize:featured?68:42, color:'#c8bda3' }}>{String(cat.nombre).trim().charAt(0).toUpperCase()}</div>
        )}
      </div>
      {/* etiqueta debajo, sobre crema. flexShrink:0 = la etiqueta SIEMPRE reserva su
          alto; sin esto la foto (flex:1) se comía el espacio y, con overflow:hidden,
          el nombre de la categoría quedaba tapado/recortado. */}
      <div style={{ flexShrink:0, padding: isMobile ? '10px 12px' : (featured ? '16px 18px' : '11px 14px'), background:CREAM_TILE }}>
        <div style={{ fontFamily: featured ? DISPLAY : SANS, fontSize:nameSize, fontWeight:600, color:INK, lineHeight:1.15, letterSpacing:featured?-.2:-.1 }}>{cat.nombre}</div>
        <div style={{ fontSize:12, color:GRAY, marginTop:featured?5:2, fontWeight:500 }}>{cat.count} producto{cat.count!==1?'s':''}</div>
      </div>
    </button>
  );
}

function PortalHome({ items, buyAgain, recommended, onRepetirTodo, catArbol, cats, brandCfg, brandNombre, clienteNombre,
                      clienteRut, clienteContacto,
                      isMobile, carrito, addItem, removeItem, onOpen, onPickVariants, onSelectCat, onVerTodo,
                      social, socialOn, entregaCorta }) {
  const byId = (id) => items.find(p => p.id === id);
  const cardW = isMobile ? 158 : 196;

  // Categorías (madre) con conteo real + fotos reales para el collage.
  const catList = useMemo(() => {
    const base = (catArbol && catArbol.length) ? catArbol.map(m => m.nombre)
      : (cats || []).filter(c => c && c !== 'Todos');
    const norm = (s) => String(s||'').trim().toLowerCase();
    // Portadas elegidas por el distribuidor, indexadas por nombre normalizado para
    // tolerar diferencias de mayúsculas/acentos entre config y catálogo.
    const portadas = (brandCfg?.catPortadas && typeof brandCfg.catPortadas === 'object') ? brandCfg.catPortadas : {};
    const portadaByNorm = {};
    Object.keys(portadas).forEach(k => { if (portadas[k]) portadaByNorm[norm(k)] = portadas[k]; });
    return base.map(c => {
      const prods = items.filter(p => norm(p.categoria) === norm(c));
      const imgs = prods.map(p => p.imagen_url).filter(Boolean);
      return { nombre: c, count: prods.length, imgs, cover: portadaByNorm[norm(c)] || null };
    }).filter(c => c.count > 0);
  }, [catArbol, cats, items, brandCfg]);

  const habituales = (buyAgain || []).map(b => byId(b.id)).filter(Boolean);

  // Saludo sobrio del home (reemplaza el hero-slogan). Empresa con RUT → razón social;
  // persona sin RUT → nombre de pila. Ver detalle en la lógica de `banners`.
  const saludo = (() => {
    const esEmpresa = clienteRut && String(clienteRut).trim();
    if (esEmpresa) return String(clienteNombre || '').trim();
    const persona = String(clienteContacto || clienteNombre || '').trim();
    return persona.split(' ')[0];
  })();
  // Sólo mostramos el carrusel-hero cuando el distribuidor cargó banners promocionales
  // a propósito (contenido editorial legítimo). En el caso por defecto no auto-generamos
  // un slogan de bienvenida: el comprador logueado quiere pedir, no leer un pitch.
  const customBanners = Array.isArray(brandCfg?.banners) && brandCfg.banners.length > 0;

  // Palanca 1 — OFERTAS automáticas: productos con descuento "siempre" en su lista
  // de precios (dtoSiempre). Cero configuración: sale solo de los precios que el
  // distribuidor ya carga. Es el "Ofertas" de PedidosYa, pero automático.
  const ofertas = useMemo(() => items.filter(p => dtoSiempre(p)).slice(0, 16), [items]);

  // Palanca 2 — DESTACADOS: sólo lo que el distribuidor marcó desde el panel
  // (brandCfg.destacados). Si no marcó nada, no inventamos una fila artificial.
  const destIds = Array.isArray(brandCfg?.destacados) ? brandCfg.destacados : [];
  const destacados = destIds.map(byId).filter(Boolean);

  // Palanca 2 — ANUNCIO de portada: una línea que el distribuidor escribe; la
  // plataforma la maqueta en el estilo de la casa (él no diseña nada). Sólo si
  // está activo y tiene texto.
  const anuncio = (brandCfg?.anuncio && brandCfg.anuncio.activo && String(brandCfg.anuncio.texto || '').trim())
    ? String(brandCfg.anuncio.texto).trim() : null;

  // Fallback: si no hay habituales NI ofertas NI destacados marcados, la portada
  // quedaría sin ninguna fila de productos → mostramos una selección del catálogo.
  const fallbackSel = useMemo(() =>
    [...items].sort((a,b) => (b.imagen_url?1:0) - (a.imagen_url?1:0)).slice(0, 12), [items]);
  const sinRieles = !habituales.length && !ofertas.length && !destacados.length;

  // #3 — "Quizás no sabías que también vendemos": expansión de cartera fundada en el
  // historial. Tomamos las categorías que el cliente YA compra (de sus habituales) y
  // ofrecemos productos de las categorías que NUNCA tocó → descubrimiento real, no ML
  // al azar. Máx 2 por categoría nueva para dar variedad. Sin historial no aplica
  // (no podríamos afirmar "nueva"). Priorizamos con foto.
  const nuevasCategorias = useMemo(() => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const compradas = new Set(habituales.map(p => norm(p.categoria)).filter(Boolean));
    if (!compradas.size) return [];
    const porCat = {};
    const out = [];
    const orden = [...items].sort((a, b) => (b.imagen_url ? 1 : 0) - (a.imagen_url ? 1 : 0));
    for (const p of orden) {
      const c = norm(p.categoria);
      if (!c || compradas.has(c)) continue;
      porCat[c] = (porCat[c] || 0) + 1;
      if (porCat[c] > 2) continue;
      out.push(p);
      if (out.length >= 12) break;
    }
    return out;
  }, [habituales, items]);

  // #4 — "Locales como el tuyo también piden": prueba social por segmento. Tomamos
  // los productos con más COMPRADORES distintos (social[id].c) — pedidos reales, no
  // ML — y excluimos lo que este cliente ya compra (sus habituales) para que sea
  // descubrimiento y no repetición. Ordenado por popularidad. Priorizamos con foto.
  const popularEntreLocales = useMemo(() => {
    const yaCompra = new Set(habituales.map(p => p.id));
    return items
      .filter(p => !yaCompra.has(p.id) && social && social[p.id] && (social[p.id].c || 0) >= 3)
      .sort((a, b) => {
        const ca = social[a.id].c || 0, cb = social[b.id].c || 0;
        if (cb !== ca) return cb - ca;
        return (b.imagen_url ? 1 : 0) - (a.imagen_url ? 1 : 0);
      })
      .slice(0, 12);
  }, [items, habituales, social]);

  const scrollToId = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); };

  // Riel reutilizable de productos (horizontal). `ribbon` pinta el badge "−X%"
  // sobre las cards en oferta (sólo en la fila de Ofertas, para no recargar).
  // Es una función que devuelve JSX (no un componente) para no re-montar el riel.
  const railSection = ({ id, title, sub, list, origin, ribbon, bulk }) => (
    <section id={id}>
      <SectionHead title={title} subtitle={sub} actionLabel="Ver todo" onAction={onVerTodo}
        extra={bulk ? (
          /* Recompra 1-toque: carga toda la canasta habitual al carrito. Verde =
             acción de agregar (coherente con +Agregar/precios). */
          <button onClick={bulk.onClick} style={{ display:'inline-flex', alignItems:'center', gap:6,
            background:G, color:'#fff', border:'none', borderRadius:50, cursor:'pointer',
            fontWeight:700, fontSize:isMobile?12:12.5, fontFamily:SANS, padding:isMobile?'7px 12px':'7px 14px',
            letterSpacing:.2, whiteSpace:'nowrap', boxShadow:'0 1px 3px rgba(5,150,105,.3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            {bulk.label}
          </button>
        ) : null} />
      <HScroll>
        {list.map(item => {
          const d = ribbon ? dtoSiempre(item) : null;
          return (
            <div key={item.id} style={{ scrollSnapAlign:'start', flex:'0 0 auto', width:cardW, position:'relative' }}>
              {d && (
                <span style={{ position:'absolute', top:8, left:8, zIndex:2, background:'#b23a2e', color:'#fff',
                  fontSize:11, fontWeight:800, letterSpacing:.3, padding:'3px 8px', borderRadius:6, fontFamily:SANS,
                  boxShadow:'0 2px 6px rgba(178,58,46,.35)' }}>−{d.pct}%</span>
              )}
              <ProductCard {...cardProps(item)} onAdd={(it,v)=>addItem(it,v,origin)} />
            </div>
          );
        })}
      </HScroll>
    </section>
  );

  // Banners: si el distribuidor los configuró se respetan; si no, un default limpio.
  const banners = useMemo(() => {
    if (Array.isArray(brandCfg?.banners) && brandCfg.banners.length) {
      return brandCfg.banners.map(bn => ({
        ...bn,
        onClick: bn.categoria ? () => onSelectCat(bn.categoria) : (bn.scrollTo ? () => scrollToId(bn.scrollTo) : (bn.verTodo ? onVerTodo : undefined)),
      }));
    }
    // Saludo del hero: si el cliente tiene RUT (razón social) es una empresa →
    // saludamos por el nombre de la empresa (la razón social, sin recortar). Si no
    // tiene RUT es una persona física → saludamos por su nombre de pila (el contacto
    // asociado, o el nombre a secas). Motivo: en una empresa el contacto cargado no
    // necesariamente es quien está haciendo la compra, así que el nombre neutro es
    // el de la empresa.
    const saludo = (() => {
      const esEmpresa = clienteRut && String(clienteRut).trim();
      if (esEmpresa) return String(clienteNombre || '').trim();
      const persona = String(clienteContacto || clienteNombre || '').trim();
      return persona.split(' ')[0];
    })();
    const out = [];
    out.push({
      badge: brandNombre || 'Catálogo',
      titulo: saludo ? `Hola ${saludo}, hacé tu pedido` : 'Hacé tu pedido en minutos',
      subtitulo: 'Todo tu catálogo mayorista en un solo lugar. Elegí, sumá al carrito y confirmá.',
      cta: 'Ver todo el catálogo', onClick: onVerTodo,
    });
    if (habituales.length) out.push({
      badge: 'Tus habituales', titulo: 'Volvé a pedir lo de siempre',
      subtitulo: 'Tus productos más pedidos, listos para repetir en un toque.',
      cta: 'Volver a comprar', onClick: () => scrollToId('pz-riel'),
    });
    return out;
  }, [brandCfg, brandNombre, clienteNombre, clienteRut, clienteContacto, habituales.length]);

  const cardProps = (item) => ({ item, brandCfg, carrito, qty: carrito[item.id] || 0,
    onAdd: addItem, onRemove: removeItem, onOpen, onPickVariants,
    social: socialOn ? social?.[item.id] : null, entregaCorta });

  return (
    <div style={{ background:'transparent',
      padding:isMobile?'16px 0 24px':'32px 0 48px',
      display:'flex', flexDirection:'column', gap:isMobile?28:40 }}>

      {/* Palanca 2 — ANUNCIO: tira que el distribuidor escribe; Pazque la maqueta.
          Estilo Faire (disciplina de color): fondo cálido muy claro + hairline, el
          verde queda solo como acento en el ícono. No es un bloque de color pleno. */}
      {anuncio && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          color:GRAY, borderBottom:'1px solid #ececE6',
          padding:isMobile?'0 0 12px':'0 0 14px', marginBottom:isMobile?-16:-26 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" style={{ flexShrink:0 }}>
            <path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
          <span style={{ fontSize:isMobile?12:13, fontWeight:500, lineHeight:1.35, letterSpacing:.1 }}>{anuncio}</span>
        </div>
      )}

      {/* Hero: sólo carrusel si el distribuidor cargó banners promocionales a propósito.
          En el default, un saludo sobrio en vez del slogan de bienvenida a pantalla. */}
      {customBanners
        ? <HeroCarousel banners={banners} isMobile={isMobile} />
        : (
          <div>
            <div style={{ fontFamily:DISPLAY, fontSize:isMobile?23:27, fontWeight:500, color:INK, lineHeight:1.1, letterSpacing:-.3 }}>
              {saludo ? `Hola ${saludo}` : 'Armá tu pedido'}
            </div>
          </div>
        )}

      {/* Volver a comprar — PRIMERO: es la espina dorsal de la recompra mayorista.
          "Agregar todo" (bulk) = recompra 1-toque de toda la canasta habitual. */}
      {habituales.length > 0 && railSection({ id:'pz-riel', title:'Volver a comprar', origin:'volver_a_pedir',
        sub:'Tus productos habituales, listos para repetir.', list:habituales,
        bulk: onRepetirTodo ? { label:'Agregar todo', onClick:onRepetirTodo } : null })}

      {/* #3 — Expansión de cartera: rubros que este cliente todavía no te compra. */}
      {nuevasCategorias.length > 0 && railSection({ id:'pz-nuevas', title:'Quizás no sabías que también vendemos', origin:'nueva_categoria',
        sub:'Rubros que todavía no pediste, listos para sumar a tu pedido.', list:nuevasCategorias })}

      {/* #4 — Prueba social por segmento: lo que más piden otros locales, fundado en
          pedidos reales. Excluye lo que este cliente ya compra (es descubrimiento). */}
      {popularEntreLocales.length > 0 && railSection({ id:'pz-social', title:'Locales como el tuyo también piden', origin:'popular_segmento',
        sub:'Los productos más elegidos por otros negocios como el tuyo.', list:popularEntreLocales })}

      {/* Palanca 1 — OFERTAS (automático): productos con descuento, badge "−X%". */}
      {ofertas.length > 0 && railSection({ id:'pz-ofertas', title:'Ofertas', origin:'oferta', ribbon:true,
        sub:'Aprovechá los descuentos vigentes de esta semana.', list:ofertas })}

      {/* Palanca 2 — DESTACADOS: lo que el distribuidor eligió promocionar. */}
      {destacados.length > 0 && railSection({ id:'pz-destacados', title:'Destacados', origin:'destacado',
        sub:'Una selección elegida para vos.', list:destacados })}

      {/* Fallback: sin habituales/ofertas/destacados, mostramos algo para arrancar. */}
      {sinRieles && fallbackSel.length > 0 && railSection({ id:'pz-riel', title:'Para arrancar',
        origin:'destacado', sub:'Una selección del catálogo para empezar tu pedido.', list:fallbackSel })}

      {/* Explorar por categoría — hacia el final: para el que quiere navegar, no el
          camino rápido de recompra. Fotos reales sobre blanco, caption debajo. */}
      {catList.length > 0 && (
        <section>
          <SectionHead title="Comprá por categoría" subtitle="Elegí un rubro y armá tu pedido." />
          <div style={{ display:'grid', gap:isMobile?12:16, gridAutoFlow:'dense',
            gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4, 1fr)',
            gridAutoRows:isMobile?152:198 }}>
            {catList.map((c, idx) => (
              <CategoryTile key={c.nombre} cat={c} imgs={c.imgs} coverOverride={c.cover} featured={idx === 0} isMobile={isMobile} onClick={() => onSelectCat(c.nombre)} />
            ))}
          </div>
        </section>
      )}

      {/* Banda "ver todo": tarjeta blanca sobre el canvas, titular serif, CTA verde apagado */}
      <button onClick={onVerTodo} style={{ cursor:'pointer', textAlign:'left', width:'100%',
        borderRadius:isMobile?16:20, padding:isMobile?'24px 22px':'34px 38px', fontFamily:SANS,
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
        background:'#fff', border:'1px solid #f0f0ec', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
        <div>
          <div style={{ fontSize:isMobile?11:12, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:FOREST }}>Catálogo completo</div>
          <div style={{ fontFamily:DISPLAY, fontSize:isMobile?21:28, fontWeight:600, color:INK, marginTop:7, lineHeight:1.12 }}>Explorá los {items.length} productos</div>
          <div style={{ fontSize:isMobile?13:14.5, color:GRAY, marginTop:6 }}>Buscá, filtrá y sumá todo lo que necesites al carrito.</div>
        </div>
        <span style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap:8, background:FOREST,
          padding:isMobile?'11px 18px':'13px 24px', borderRadius:50, fontWeight:600, fontSize:isMobile?13:15, color:'#f7f3ea' }}>
          Ver todo
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7f3ea" strokeWidth="2.2"><path d="M9 18l6-6-6-6"/></svg>
        </span>
      </button>
    </div>
  );
}

// ── Motor de búsqueda (helpers puros, nivel módulo) ───────────────────────────
// Objetivo: que el buscador se sienta "serio" (Amazon/ML) sin backend de búsqueda.
//   1) Tolerancia a errores de tipeo (Levenshtein acotado) → "conaprole" mal escrito
//      igual encuentra el producto, en vez de "0 resultados".
//   2) Plural/singular a nivel lenguaje (genérico, no atado a un rubro).
//   3) Ranking por relevancia: coincidir en el NOMBRE pesa más que en la descripción,
//      y un match al principio del nombre más que uno en el medio.
// NO hay diccionario de sinónimos por-dominio hardcodeado: rompería el modelo genérico
// multi-tenant y metería falsos positivos en rubros no-comida. Un thesaurus por-org es
// el camino turnkey correcto (config futura), no una lista fija en el código.

// Distancia de edición acotada: si supera `max`, corta temprano (barato). Suficiente
// para typos comunes (una letra cambiada/faltante/sobrante).
function editDistanceLE(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return false;
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false; // ninguna celda de la fila puede bajar de `max`
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[lb] <= max;
}

// Umbral de typos según largo: palabras cortas exigen más precisión (evita ruido).
function fuzzyBudget(len) { return len <= 4 ? (len <= 3 ? 0 : 1) : 2; }

// ¿Este token de la consulta matchea el documento? Exacto → plural/singular → fuzzy.
function tokenMatchesDoc(token, hay, words) {
  if (hay.includes(token)) return true;
  if (token.length > 3) {
    const alt = token.endsWith('s') ? token.slice(0, -1) : token + 's';
    if (hay.includes(alt)) return true;
  }
  const budget = fuzzyBudget(token.length);
  if (budget === 0) return false;
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    if (Math.abs(w.length - token.length) > budget) continue;
    if (editDistanceLE(token, w, budget)) return true;
  }
  return false;
}

// Puntaje de relevancia de un doc para los tokens (mayor = más arriba).
function scoreDoc(doc, tokens) {
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (doc.name.startsWith(t)) score += 100;
    else if (doc.nameWordStart.indexOf('\u0001' + t) !== -1) score += 60; // arranque de palabra en el nombre
    else if (doc.name.includes(t)) score += 40;
    else if (doc.marca.includes(t)) score += 30;
    else if (doc.cat.includes(t)) score += 16;
    else if (doc.desc.includes(t)) score += 8;
    else score += 2; // matcheó sólo por plural/typo: cuenta, pero pesa poco
  }
  if (doc.hasImg) score += 6;      // con foto: mejor percepción, leve empujón
  if (doc.inStock) score += 3;
  return score;
}

// ── Pagina principal ──────────────────────────────────────────────────────────
export default function PedidosPage({ vendorSession = null, onVendorExit = null, vendorName = '' }) {
  // Modo vendedor: el vendedor ya eligió un cliente y entramos con una sesión de
  // portal real minteada en el servidor (api/vendedor?action=open). Reusamos TODO
  // el portal del cliente tal cual (catálogo con su lista, carrito, pedido) → mismo
  // mail/PDF/push. La diferencia visible es una barra arriba para cambiar de cliente.
  const vendorMode = !!vendorSession;
  const onVendorExitRef = useRef(onVendorExit);
  onVendorExitRef.current = onVendorExit;

  const [portalDemo, setPortalDemo] = useState(null); // null | 'selecting' | dataset key
  const isPortalDemo = !!portalDemo && portalDemo !== 'selecting';
  const [session,  setSession]  = useState(() => vendorSession || loadSession());
  const [vista,    setVista]    = useState('catalogo');
  const [verTodoCatalogo, setVerTodoCatalogo] = useState(false); // vidriera: true = mostrar la grilla completa
  const [detalle,  setDetalle]  = useState(null); // producto abierto en la PDP (null = grilla)
  const [pickSheet, setPickSheet] = useState(null); // producto con variantes abierto en el quick-add sheet
  const [showEstadoCuenta, setShowEstadoCuenta] = useState(false);
  // Resumen de cuenta corriente (deuda) para el banner del portal. null = sin datos
  // o sin deuda; { saldo, vencido, nVencidas } cuando el cliente debe plata.
  const [cuentaResumen, setCuentaResumen] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [buyAgain, setBuyAgain] = useState([]);
  const [coBuy, setCoBuy] = useState({}); // productoId -> [ids que suele pedirse junto]
  const [social, setSocial] = useState({}); // productoId -> { c: nº clientes, best: bool } (prueba social real)
  const [items,    setItems]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [catArbol, setCatArbol] = useState([]); // [{nombre, subcategorias:[]}] — orden del admin
  const [subFil,   setSubFil]   = useState(''); // subcategoría activa dentro de la categoría madre
  const [brandNombre, setBrandNombre] = useState('');
  const [brandCfg, setBrandCfg] = useState(null);
  const [portalBloqueado, setPortalBloqueado] = useState(null); // mensaje si el portal está deshabilitado
  const [horarioInfo, setHorarioInfo] = useState(null);
  const [catFil,   setCatFil]   = useState('Todos');
  const [busq,     setBusq]     = useState('');
  // Autocompletar del buscador (patrón Amazon: sugerencias mientras tipeás).
  // `sugOpen` = dropdown visible; `sugIdx` = opción resaltada (nav con flechas, -1 = ninguna).
  const [sugOpen,  setSugOpen]  = useState(false);
  const [sugIdx,   setSugIdx]   = useState(-1);
  // Orden + filtros facetados (patrón Amazon: barra de "Ordenar/Filtrar" sobre los
  // resultados). Genéricos por-rubro: las marcas y el rango de precio se derivan del
  // catálogo, no se hardcodean. Todo vive en el cliente (no toca API).
  const [orden,     setOrden]     = useState('relevancia'); // relevancia | precio_asc | precio_desc | nombre
  const [fMarcas,   setFMarcas]   = useState([]);           // marcas seleccionadas (multi)
  const [fOfertas,  setFOfertas]  = useState(false);        // sólo productos con descuento
  const [fStock,    setFStock]    = useState(false);        // sólo con stock disponible
  const [fPrecioMax, setFPrecioMax] = useState(null);       // techo de precio (null = sin tope)
  const [filtrosOpen, setFiltrosOpen] = useState(false);    // hoja de filtros (mobile)
  const [carrito,  setCarrito]  = useState(() => loadCart((vendorSession || loadSession())?.clienteId));
  const [listas,   setListas]   = useState(() => loadListas((vendorSession || loadSession())?.clienteId));
  const [showCart, setShowCart] = useState(false);
  const [vozOpen,  setVozOpen]  = useState(false); // modal "Pedí por voz"
  const [loading,  setLoading]  = useState(false);
  const [ddOpen,   setDdOpen]   = useState(false);
  const ddRef = useRef(null); // wrapper del menú "Todas las categorías" para cerrar al clickear afuera
  const [menuCat,  setMenuCat]  = useState(null); // categoría madre "abierta" dentro del panel (nivel 2 del drilldown)
  const [udOpen,   setUdOpen]   = useState(false);
  // Resolución del org para dominios custom (pedidos.aryes.com.uy → org de Eric).
  // Si no hay que resolver (host conocido o ?org=), arranca listo de una.
  const [orgReady, setOrgReady] = useState(!ORG_NEEDS_RESOLUTION);
  const [reorderMsg, setReorderMsg] = useState(''); // toast al reordenar (items no disponibles)
  const NAV_MAX = 10; // tope de candidatas destacadas; cuántas se muestran es adaptativo (ver navVisibles)

  // ── Historial de navegación interna (para el botón "atrás" del navegador) ──
  // Moverse entre catálogo, categorías, subcategorías y ficha de producto es
  // estado de React: NO cambia la URL, así que el back del navegador no tenía
  // nada que deshacer y se salía del sitio. Guardamos cada paso en una pila y el
  // "atrás" (botón físico, popstate o swipe) la va desandando paso a paso —como
  // una app nativa o Amazon/Shopify—, y recién sale del sitio cuando no queda
  // nada atrás. `skipRecord` evita que restaurar un paso cuente como uno nuevo.
  const navStack = useRef([]);
  const skipRecord = useRef(false);
  // La ficha de producto (detalle) NO va en esta pila: tiene su propia entrada
  // REAL en el historial del navegador (URL ?p=<id>, ver efecto más abajo). Acá
  // sólo registramos las "páginas": catálogo / categoría / subcategoría.
  const navSig = `${vista}|${catFil}|${subFil}`;
  const prevNav = useRef({ sig: navSig, snap: { vista, catFil, subFil } });
  useEffect(() => {
    if (navSig === prevNav.current.sig) return;
    if (skipRecord.current) {
      skipRecord.current = false;                    // vino de un "atrás": no registrar
    } else {
      navStack.current.push(prevNav.current.snap);   // guardamos de dónde venimos
      if (navStack.current.length > 50) navStack.current.shift();
    }
    prevNav.current = { sig: navSig, snap: { vista, catFil, subFil } };
  }, [navSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL propia para la ficha de producto (estilo Amazon/Shopify) ───────────
  // Abrir un producto empuja una entrada REAL al historial con la URL ?p=<id>.
  // Así el botón "atrás" del navegador (Safari/Chrome, iOS incluido) tiene una
  // entrada del MISMO sitio a la que volver y regresa al catálogo en lugar de
  // salirse del portal —que era el bug: al no cambiar nunca la URL, el atrás no
  // tenía nada real que deshacer—. Al cerrar la ficha desde la UI, limpiamos la
  // URL de vuelta al catálogo.
  const pdpUrlRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (detalle && !pdpUrlRef.current) {
      pdpUrlRef.current = true;
      try {
        const u = new URL(window.location.href);
        u.searchParams.set('p', String(detalle.id));
        window.history.pushState({ __pzqTrap: 1 }, '', u.toString());
      } catch { /* noop */ }
    } else if (!detalle && pdpUrlRef.current) {
      pdpUrlRef.current = false;
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has('p')) {
          u.searchParams.delete('p');
          window.history.replaceState({ __pzqTrap: 1 }, '', u.toString());
        }
      } catch { /* noop */ }
    }
  }, [detalle]);

  // ── Swipe-back (gesto "volver" tipo app nativa) ───────────────────────────
  // Deslizar desde el borde izquierdo hacia la derecha (y el botón atrás del
  // navegador vía popstate) vuelve a la pantalla anterior, respetando el MISMO
  // orden: primero cierra lo más "encima" (drawer/menús/buscador), después
  // desanda el historial interno (categoría/PDP → paso anterior), y en modo
  // vendedor sale del catálogo del cliente. Si no hay nada atrás, deja salir el
  // back nativo. Hook compartido con los 3 portales.
  useSwipeBack(() => {
    if (pickSheet) { setPickSheet(null); return true; }
    if (vozOpen) { setVozOpen(false); return true; }
    if (showCart) { setShowCart(false); return true; }
    if (ddOpen || udOpen) { setDdOpen(false); setUdOpen(false); return true; }
    if (showEstadoCuenta) { setShowEstadoCuenta(false); return true; }
    if (busq) { setBusq(''); return true; }
    if (detalle) { setDetalle(null); return true; }   // cerrar la ficha de producto
    if (navStack.current.length > 0) {
      const prev = navStack.current.pop();
      skipRecord.current = true;
      setVista(prev.vista); setDetalle(null);
      setCatFil(prev.catFil); setSubFil(prev.subFil);
      return true;
    }
    if (vendorMode && onVendorExitRef.current) { onVendorExitRef.current(); return true; }
    return false;
  });

  // Al abrir la ficha de un producto (PDP) o cambiar de vista, la pantalla debe
  // arrancar ARRIBA. Sin esto quedaba en el scroll del catálogo y el cliente
  // entraba "por el medio/fondo" del producto y tenía que subir a mano.
  useEffect(() => { if (typeof window !== 'undefined') window.scrollTo(0, 0); }, [detalle, vista]);

  useEffect(() => {
    if (!reorderMsg) return;
    const t = setTimeout(() => setReorderMsg(''), 4000);
    return () => clearTimeout(t);
  }, [reorderMsg]);

  const totalItems = Object.values(carrito).reduce((s, q) => s + q, 0);

  // ── Persistencia del carrito por cliente ──────────────────────────────────
  // Identidad del carrito: cliente logueado, o un slot propio por dataset demo.
  const cartCli = isPortalDemo ? `demo-${portalDemo}` : (session?.clienteId || null);
  const loadedCliRef = useRef((vendorSession || loadSession())?.clienteId || null);
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

  // "Mis listas": recargar las del cliente al cambiar de identidad y persistir al editar.
  const listasCliRef = useRef(cartCli);
  useEffect(() => {
    if (listasCliRef.current === cartCli) return;
    listasCliRef.current = cartCli;
    setListas(loadListas(cartCli));
  }, [cartCli]);
  const guardarLista = (nombre) => {
    const items = Object.fromEntries(Object.entries(carrito).filter(([, q]) => q > 0));
    if (Object.keys(items).length === 0) return null;
    const nueva = { id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      nombre: (nombre || '').trim() || `Lista ${new Date().toLocaleDateString('es-UY')}`,
      items, createdAt: new Date().toISOString() };
    const next = [nueva, ...listas];
    setListas(next); saveListas(cartCli, next);
    return nueva;
  };
  const eliminarLista = (id) => {
    const next = listas.filter(l => l.id !== id);
    setListas(next); saveListas(cartCli, next);
  };
  // Recompra 1-toque: carga TODA la canasta habitual (rail "Volver a comprar") al
  // carrito de una sola vez. Patrón "Add all to cart" (Faire) / "Buy it again"
  // (Amazon) para la reposición mayorista, que es repetir lo de siempre. Sólo mete
  // productos directamente agregables (con precio, sin variantes, en stock), respeta
  // el mínimo de compra y NO pisa cantidades ya elegidas por el cliente.
  const repetirHabituales = useCallback(() => {
    const nc = { ...carrito };
    let added = 0;
    (buyAgain || []).forEach(b => {
      const prod = items.find(p => p.id === b.id);
      if (!prod) return;
      if (!(prod.precio > 0) || (prod.variants?.options?.length)) return;  // sin precio o con variantes → requiere elegir
      if (!(prod.stock == null || Number(prod.stock) > 0)) return;          // sin stock
      if (nc[prod.id]) return;                                              // ya en el carrito: no lo tocamos
      nc[prod.id] = prod.min_order_qty || 1;
      added++;
    });
    if (added === 0) { setReorderMsg('Ya tenés tus habituales en el carrito.'); return; }
    setCarrito(nc);
    setVista('catalogo');   // salir del home al catálogo (igual que reorder/cargar lista) para que el drawer quede visible sobre la grilla
    setReorderMsg(`${added} producto${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''} a tu carrito.`);
    setTimeout(() => setShowCart(true), 250);
  }, [carrito, buyAgain, items]);
  // Cargar una lista al carrito: validamos contra el catálogo ACTUAL (productos
  // discontinuados o sin stock se omiten y se avisa), igual que el reorder de un
  // pedido viejo. Reemplaza el carrito (patrón "reposición": esta lista ES el pedido).
  const cargarLista = (lista) => {
    const nc = {}; let omitidos = 0;
    Object.entries(lista.items || {}).forEach(([key, qty]) => {
      const baseId = key.indexOf('::') === -1 ? key : key.slice(0, key.indexOf('::'));
      const prod = baseId && items.find(p => p.id === baseId);
      if (prod && (prod.stock == null || Number(prod.stock) > 0)) nc[key] = qty;
      else omitidos++;
    });
    if (Object.keys(nc).length === 0) { setReorderMsg('Ninguno de esos productos está disponible ahora.'); return; }
    setCarrito(nc);
    setVista('catalogo');
    if (omitidos > 0) setReorderMsg(`${omitidos} producto${omitidos !== 1 ? 's' : ''} ya no está${omitidos !== 1 ? 'n' : ''} disponible${omitidos !== 1 ? 's' : ''} y no se agregó${omitidos !== 1 ? 'aron' : ''}.`);
    setTimeout(() => setShowCart(true), 200);
  };

  // ── Sync cross-device: traer el carrito del servidor al loguearse ─────────
  // Caso de uso: armás el pedido en la compu y lo seguís en el cel. El server
  // (por sesión) es la fuente de verdad; si tiene carrito, lo adoptamos. Si está
  // vacío pero teníamos algo local, lo subimos para que esté en todos lados.
  const serverCartLoadedRef = useRef(null);
  useEffect(() => {
    if (isPortalDemo) return;                         // el demo no sincroniza
    const token = session?.token;
    const cli = session?.clienteId;
    if (!token || !cli) return;
    if (serverCartLoadedRef.current === cli) return;  // ya cargado para este cliente
    serverCartLoadedRef.current = cli;
    let cancelled = false;
    (async () => {
      const remote = await fetchServerCart(token);
      if (cancelled) return;
      if (remote && Object.keys(remote).length > 0) {
        setCarrito(remote);                           // adoptar carrito de otro dispositivo
      } else {
        const local = loadCart(cli);
        if (Object.keys(local).length > 0) saveServerCart(token, local);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.token, session?.clienteId, isPortalDemo]);

  // Guardado al servidor con debounce — sólo logueado, sólo tras la carga inicial
  // (para no pisar el carrito remoto antes de haberlo traído).
  useEffect(() => {
    if (isPortalDemo) return;
    const token = session?.token;
    const cli = session?.clienteId;
    if (!token || !cli) return;
    if (serverCartLoadedRef.current !== cli) return;
    const t = setTimeout(() => { saveServerCart(token, carrito); }, 800);
    return () => clearTimeout(t);
  }, [carrito, session?.token, session?.clienteId, isPortalDemo]);

  // ── Resumen de cuenta corriente (deuda) ───────────────────────────────────
  // Trae una sola vez la cuenta del cliente y calcula cuánto debe, para mostrar
  // un banner glance-able en el portal (antes la deuda estaba enterrada en el
  // menú de usuario). Genérico multi-tenant: si la org no usa cuenta corriente
  // no hay CFEs → saldo 0 → no se muestra nada. El detalle completo sigue en el
  // modal de Estado de cuenta (reusa los mismos datos).
  const cuentaLoadedRef = useRef(null);
  useEffect(() => {
    if (isPortalDemo) { setCuentaResumen(null); return; }
    const token = session?.token;
    const cli = session?.clienteId;
    if (!token || !cli) { setCuentaResumen(null); return; }
    if (cuentaLoadedRef.current === cli) return;
    cuentaLoadedRef.current = cli;
    const org = session?.org || new URLSearchParams(window.location.search).get('org') || getOrgId();
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/historial?action=cuenta&cliente_id=${encodeURIComponent(cli)}&org=${encodeURIComponent(org)}`,
          { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const cfes = data.cfes || [];
        const cobros = data.cobros || [];
        // Saldo = facturado − cobrado (misma lógica que el Estado de cuenta).
        const saldo = cfes.reduce((s, c) => s + (c.total || 0), 0) - cobros.reduce((s, c) => s + (c.monto || 0), 0);
        // Vencido = CFEs con saldo pendiente y fecha de vencimiento ya pasada.
        const hoy = Date.now();
        let vencido = 0, nVencidas = 0;
        cfes.forEach(c => {
          const pend = c.saldoPendiente || 0;
          if (pend > 0 && c.fechaVenc && new Date(c.fechaVenc).getTime() < hoy) { vencido += pend; nVencidas++; }
        });
        setCuentaResumen(saldo > 0 ? { saldo, vencido, nVencidas } : null);
      } catch { /* sin cuenta / error de red → no mostramos banner */ }
    })();
    return () => { cancelled = true; };
  }, [session?.token, session?.clienteId, session?.org, isPortalDemo]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Categorías destacadas inline: mostramos sólo las que entran ENTERAS según el
  // ancho real del nav (nunca cortadas a la mitad, estilo Amazon). El resto vive
  // en "Todas las categorías". Renderizamos las NAV_MAX candidatas y medimos:
  // las que se pasan del borde quedan con visibility:hidden (siguen ocupando su
  // ancho, así la medición es estable y no entra en bucle).
  const navRowRef = useRef(null);
  const [navVisibles, setNavVisibles] = useState(NAV_MAX);
  useLayoutEffect(() => {
    if (isMobile) { setNavVisibles(NAV_MAX); return; }
    const row = navRowRef.current;
    if (!row) return;
    const measure = () => {
      // Comparamos bordes derechos en coordenadas de viewport (getBoundingClientRect):
      // robusto sin importar el offsetParent posicionado del nav. Una categoría se
      // muestra sólo si su borde derecho no pasa el del contenedor (+0.5 subpíxel).
      const rowRight = row.getBoundingClientRect().right + 0.5;
      let n = 0;
      for (const k of row.children) {
        if (k.getBoundingClientRect().right <= rowRight) n++;
        else break;
      }
      setNavVisibles(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [cats, isMobile]);

  // Cerrar el menú "Todas las categorías" al clickear fuera de él (estilo Amazon).
  useEffect(() => {
    if (!ddOpen) return undefined;
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) { setDdOpen(false); setMenuCat(null); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ddOpen]);

  // Detect demo mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !portalDemo) setPortalDemo('selecting');
  }, []);

  // Dominio custom: resolver el org real contra domain_orgs antes de cargar nada.
  // Así pedidos.aryes.com.uy abre el catálogo de Eric sin ?org= en la URL, y
  // sumar un cliente nuevo es solo agregar una fila en domain_orgs (genérico).
  useEffect(() => {
    if (orgReady) return;
    let cancelled = false;
    (async () => {
      const resolved = await resolveOrgFromDomain(window.location.hostname);
      if (cancelled) return;
      if (resolved) ORG = resolved;
      setOrgReady(true);
      // Branding temprano (antes del login): el nombre del "Agregar a inicio" de
      // iOS sale del título / apple-mobile-web-app-title. Lo tomamos del manifest
      // (que resuelve el org por el dominio) para que diga la marca, no "Pazque".
      try {
        const m = await fetch('/api/manifest').then(r => r.json());
        if (!cancelled && m?.name) {
          document.title = m.name;
          const t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
          if (t) t.setAttribute('content', m.short_name || m.name);
        }
      } catch { /* sin red → queda el default */ }
    })();
    return () => { cancelled = true; };
  }, [orgReady]);

  // Load demo products when dataset selected
  useEffect(() => {
    if (!isPortalDemo) return;
    const ds = DEMO_DATASETS[portalDemo];
    if (!ds) return;
    const prods = ds.data.products.map((p, __i) => {
      const base = {
        id: p.id, nombre: p.name, precio: p.price, categoria: p.category,
        unidad: p.unit || 'un', marca: p.brand || p.category,
        imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,
        stock: p.stock || 100,
      };
      // Demo Palanca 1 (Ofertas automáticas): sembramos un dto "siempre" en algunos
      // productos (v2: precioBase > precio + descGlobal) para que se vean el badge
      // −X% y el riel "Ofertas" sin tocar nada. Sólo demo — el cliente real refleja
      // los descuentos que ya cargó en su lista de precios.
      const promo = { 1: 15, 4: 20, 7: 10, 10: 25 }[__i];
      if (promo && base.precio > 0) {
        base.reglasV2   = true;
        base.descGlobal = promo;
        base.precioBase = Math.round(base.precio / (1 - promo / 100));
      }
      return base;
    }); // precio 0 = consultar precio, se muestra igual
    // Enriquecido SÓLO demo para mostrar Punto 2 (galería + señal de stock).
    // En cliente real estos campos salen de la DB (imagen única / stock propio).
    const conFoto = prods.map(p => p.imagen_url).filter(Boolean);
    // Punto 5 (multi-rubro) — atributos flexibles de ejemplo por vertical. En un org
    // real los carga el distribuidor (ProductForm → Especificaciones). Acá los sembramos
    // según el rubro elegido para mostrar cómo la MISMA ficha se adapta a cada negocio.
    const attrPools = {
      horeca:       [['Origen', 'Uruguay'], ['Presentación', 'Caja cerrada'], ['Vida útil', '12 meses']],
      bebidas:      [['Origen', 'Importado'], ['Presentación', 'Retornable'], ['Servir', 'Bien frío']],
      limpieza:     [['Rendimiento', 'Alto'], ['Biodegradable', 'Sí'], ['Aroma', 'Neutro']],
      construccion: [['Procedencia', 'Nacional'], ['Norma', 'UNIT'], ['Uso', 'Estructural']],
    };
    const pool = attrPools[portalDemo] || attrPools.horeca;
    prods.forEach((p, i) => {
      // Galería: a los primeros con foto les damos varias imágenes (distintas, de otros
      // productos demo) para que se vea la tira de miniaturas + el zoom por foto.
      if (p.imagen_url && i < 3 && conFoto.length >= 3) {
        const extra = conFoto.filter(u => u !== p.imagen_url).slice(0, 2);
        p.imagenes = [p.imagen_url, ...extra];
      }
      // Stock: variamos para ver los 3 estados (en stock / pocas unidades / sin stock).
      if (i % 9 === 4)      { p.available_stock = 0;   p.min_stock = 5;  }   // sin stock
      else if (i % 4 === 0) { p.available_stock = 2 + (i % 4); p.min_stock = 10; } // pocas
      else                  { p.available_stock = 9999; p.min_stock = 0; }   // en stock
      // Slice A (unidad de medida flexible): a una parte del catálogo le damos bulto real
      // (caja cerrada) con su descuento, para que aparezca el selector "Comprar por".
      if (p.precio > 0 && i % 3 === 0) {
        const n = (i / 3) % 3;             // 0,1,2 cíclico
        p.unidades_por_caja = [6, 12, 24][n];
        p.descuento_caja = [8, 10, 12][n]; // 8–12 %
      }
      // Slice B (atributos por vertical): las primeras cards muestran 2–3 specs del rubro.
      if (i < 6) p.atributos = pool.slice(0, 2 + (i % 2)).map(([k, v]) => ({ k, v }));
    });
    setItems(prods);
    const categories = ['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))];
    setCats(categories);
    setBrandNombre(ds.data.org.name);
    // Demo Palanca 2 (Destacar + Anunciar): sembramos brandCfg con un anuncio y unos
    // destacados para que ambas palancas se vean en la demo. En un org real esto lo
    // configura el distribuidor desde Configuración → Portal → Vidriera / Portada.
    // #7 (envío sin cargo): umbral demo derivado del catálogo (≈ un pedido de varios
    // ítems) redondeado a una cifra "linda", así la barra se ve parcial y creíble en
    // cualquier dataset. En un org real lo fija el distribuidor en Configuración.
    const preciosDemo = prods.map(p => p.precio).filter(x => x > 0).sort((a, b) => a - b);
    const medianaDemo = preciosDemo.length ? preciosDemo[Math.floor(preciosDemo.length / 2)] : 0;
    const freeShipDemo = medianaDemo > 0 ? Math.max(1000, Math.round((medianaDemo * 6) / 500) * 500) : 0;
    setBrandCfg({
      homeVidriera: true,
      anuncio: { activo: true, texto: `Envío sin cargo en pedidos desde ${fmt.currency(freeShipDemo)}.` },
      destacados: prods.slice(2, 6).map(p => p.id),
      freeShipThreshold: freeShipDemo,
      // Reparto de muestra (modo por zona/ruta): en la maqueta muestra la "Entrega
      // estimada" en el checkout. En un org real lo fija el distribuidor en Config.
      reparto: { modo: 'zona', diasDefault: ['lun', 'mar', 'mie', 'jue', 'vie'], corte: '14:00' },
    });
    // Sembramos las señales del "vendedor digital" para que en la demo se vean todos
    // los rieles como en un org con historial real: recompra (buyAgain), prueba social
    // por segmento (social) y co-compra para cross-sell (coBuy). En un org real esto
    // sale del historial de pedidos; acá lo derivamos del catálogo para la maqueta.
    const conFotoDemo = prods.filter(p => p.imagen_url);
    // "Volver a comprar" toma los primeros 4 con foto; el resto de los productos con
    // foto quedan libres para el riel "Locales como el tuyo también piden" (#4, que
    // EXCLUYE los habituales) → ambos rieles se ven con foto y no se solapan.
    setBuyAgain(conFotoDemo.slice(0, 4).map(p => ({ id: p.id })));
    const habitualesDemo = new Set(conFotoDemo.slice(0, 4).map(p => p.id));
    // Prueba social sobre TODO el catálogo (en un org real sale del historial de
    // pedidos). Los productos con foto reciben un conteo más alto y algún "Más pedido"
    // para que floten al frente del riel #4; los demás rellenan el resto.
    const socialSeed = {};
    prods.forEach((p, i) => {
      const foto = !!p.imagen_url;
      socialSeed[p.id] = { c: (foto ? 9 : 3) + ((i * 4) % 6), best: foto && !habitualesDemo.has(p.id) && i % 5 === 0 };
    });
    setSocial(socialSeed);
    const coBuySeed = {};
    conFotoDemo.slice(0, 8).forEach((p, i) => {
      coBuySeed[p.id] = conFotoDemo.slice(20).concat(conFotoDemo).filter(q => q.id !== p.id).slice(i, i + 4).map(q => q.id);
    });
    setCoBuy(coBuySeed);
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
        // En modo vendedor la sesión es la del cliente abierta por el vendedor:
        // si expira/revoca, volvemos a la lista de clientes, no al login por OTP.
        if (onVendorExitRef.current) { setItems([]); setCarrito({}); onVendorExitRef.current(); return; }
        localStorage.removeItem(SK);
        setSession(null); setItems([]); setCarrito({});
        return;
      }
      const d = await r.json();

      // Branding vive en portalCfg (catalogo.js carga app_config key=brandcfg ahí).
      // Antes se leía d.brandCfg (inexistente) con campo .nombre (es .name) → marca nunca cargaba.
      if (d.portalCfg) {
        setBrandCfg(d.portalCfg);
        if (d.portalCfg.name) {
          setBrandNombre(d.portalCfg.name);
          // iOS lee el título de "Agregar a inicio" del meta apple-mobile-web-app-title
          // (estático en el HTML). Lo actualizamos a la marca del org para que el
          // ícono en el homescreen diga, ej., "Aryes" y no "Pazque".
          try {
            document.title = d.portalCfg.name;
            const m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (m) m.setAttribute('content', d.portalCfg.name);
          } catch { /* no-op */ }
        }
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
        setCatArbol(Array.isArray(d.categoriasArbol) ? d.categoriasArbol : []);
        if (d.horarioDesde || d.horarioHasta) setHorarioInfo({ desde: d.horarioDesde, hasta: d.horarioHasta });
        try { window.posthog?.identify(ses.clienteId, { nombre: ses.nombre, org: ORG }); } catch {}
        trackWeb('catalogo_visto', { productos: prods.length }, 'catalogo');
        try { window.posthog?.capture('catalogo_visto', { org: ORG, productos: prods.length }); } catch {}
        if (Array.isArray(d.recommended)) setRecommended(d.recommended);
        if (Array.isArray(d.buyAgain)) setBuyAgain(d.buyAgain);
        if (d.coBuy && typeof d.coBuy === 'object') setCoBuy(d.coBuy);
        if (d.social && typeof d.social === 'object') setSocial(d.social);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Demo mode: sólo sembramos `recommended` acá. buyAgain / social / coBuy se siembran
  // (foto-aware) en el effect de carga del dataset; NO los pisamos desde este effect
  // o volvería a solaparse "Volver a comprar" con "Locales como el tuyo también piden".
  useEffect(() => {
    if (!isPortalDemo || items.length === 0) return;
    var recItems = items.slice(8, 12).map(function(p) {
      return { id: p.id, nombre: p.nombre, precio: p.precio || 100, unit: p.unidad || 'u.', reason: Math.ceil(2 + ((p.nombre||'').length % 3)) + ' clientes lo compran' };
    });
    setRecommended(recItems);
  }, [isPortalDemo, items]);

    useEffect(() => { if (orgReady && session) loadCatalogo(session); }, [orgReady, session, loadCatalogo]);

  // Subcategorías de la categoría madre activa (según la taxonomía del admin).
  const subActuales = useMemo(() => {
    if (catFil === 'Todos') return [];
    return catArbol.find(m => m.nombre === catFil)?.subcategorias || [];
  }, [catArbol, catFil]);
  // Categorías madre para el panel "Todas las categorías" (drilldown estilo Amazon).
  // Usa el árbol del admin si existe (respeta su orden); si no, deriva de cats.
  const catsMenu = useMemo(
    () => (catArbol.length ? catArbol.map(m => m.nombre) : cats.filter(c => c !== 'Todos')),
    [catArbol, cats],
  );
  const subsDe = (cat) => catArbol.find(m => m.nombre === cat)?.subcategorias || [];
  // Al cambiar de categoría madre se limpia la subcategoría, SALVO que la nueva
  // categoría contenga esa misma subcategoría (caso del menú "Todas las categorías":
  // elige categoría + subcategoría de una, y no queremos que este reset la pise).
  useEffect(() => { setSubFil(prev => (prev && subActuales.includes(prev) ? prev : '')); }, [catFil, subActuales]);

  // Normaliza para comparar categoría/subcategoría sin que diferencias de mayúsculas
  // o espacios sobrantes escondan productos: la etiqueta del filtro viene de la
  // taxonomía (admin) y el valor del producto viene de su ficha, y pueden diferir
  // en casing/espacios aunque sean "la misma" categoría.
  const norm = (s) => String(s || '').trim().toLowerCase();
  // Normalización tolerante a acentos/ñ para búsqueda (Amazon indexa así): "cafe"
  // encuentra "café", "jamon" encuentra "jamón". Evita el 0-resultados por tilde.
  const deburr = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Índice de búsqueda: precalcula por producto los campos deburr + el set de palabras
  // (para el fuzzy). Se recalcula sólo cuando cambia el catálogo, no en cada tecla.
  const searchDocs = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      const name  = deburr(i.nombre);
      const marca = deburr(i.marca || '');
      const cat   = deburr(`${i.categoria || ''} ${i.subcategoria || ''}`);
      const desc  = deburr(i.descripcion || '');
      const nameWordStart = '\u0001' + name.split(/\s+/).filter(Boolean).join('\u0001');
      // Palabras candidatas para el fuzzy: nombre+marca+categoría (no descripción, para
      // acotar ruido y costo). Sólo palabras de >2 letras.
      const wordSet = new Set();
      (name + ' ' + marca + ' ' + cat).split(/\s+/).forEach(w => { if (w.length > 2) wordSet.add(w); });
      m.set(i.id, { name, nameWordStart, marca, cat, desc, words: [...wordSet], hasImg: !!i.imagen_url, inStock: Number(i.stock) > 0 });
    }
    return m;
  }, [items]);

  // Etapa 1 — filtro por categoría/subcategoría/facetas + match de texto (exacto,
  // plural/singular o typo). Etapa 2 — orden: si hay búsqueda, por RELEVANCIA (el
  // match en el nombre pesa más que en la descripción); si no, orden natural o el
  // criterio elegido. "queso conaprole" encuentra el queso de esa marca aunque el
  // orden no coincida, y "conaprol" (mal tipeado) igual lo encuentra.
  const filtered = useMemo(() => {
    const tokens = deburr(busq).split(/\s+/).filter(Boolean);
    const scored = [];
    for (const i of items) {
      if (!(catFil === 'Todos' || norm(i.categoria) === norm(catFil))) continue;
      if (!(!subFil || norm(i.subcategoria) === norm(subFil))) continue;
      if (!(fMarcas.length === 0 || fMarcas.some(m => norm(m) === norm(i.marca)))) continue;
      if (!(!fOfertas || !!dtoSiempre(i))) continue;
      if (!(!fStock || Number(i.stock) > 0)) continue;
      if (!(fPrecioMax == null || (Number(i.precio) > 0 && Number(i.precio) <= fPrecioMax))) continue;

      let relevance = 0;
      if (tokens.length) {
        const doc = searchDocs.get(i.id);
        if (!doc) continue;
        const hay = `${doc.name} ${doc.marca} ${doc.cat} ${doc.desc}`;
        let all = true;
        for (let t = 0; t < tokens.length; t++) {
          if (!tokenMatchesDoc(tokens[t], hay, doc.words)) { all = false; break; }
        }
        if (!all) continue;
        relevance = scoreDoc(doc, tokens);
      }
      scored.push({ i, relevance });
    }

    if (orden === 'precio_asc')       scored.sort((a, b) => (Number(a.i.precio) || 0) - (Number(b.i.precio) || 0));
    else if (orden === 'precio_desc') scored.sort((a, b) => (Number(b.i.precio) || 0) - (Number(a.i.precio) || 0));
    else if (orden === 'nombre')      scored.sort((a, b) => String(a.i.nombre).localeCompare(String(b.i.nombre), 'es'));
    else if (tokens.length)           scored.sort((a, b) => b.relevance - a.relevance); // relevancia sólo con búsqueda
    // sin búsqueda y orden por defecto → se mantiene el orden natural del catálogo (sort estable)
    return scored.map(s => s.i);
  }, [items, catFil, subFil, busq, fMarcas, fOfertas, fStock, fPrecioMax, orden, searchDocs]);

  // Sugerencias del autocompletar (patrón Amazon: dropdown mientras tipeás). Busca en
  // TODO el catálogo (ignora la categoría/facetas activas, como Amazon) usando el mismo
  // índice y scoring que la grilla. Top 6, sólo con 2+ caracteres. Prioriza los que
  // tienen foto (se ven mejor en el dropdown) sin romper el orden por relevancia.
  const sugerencias = useMemo(() => {
    const tokens = deburr(busq).split(/\s+/).filter(Boolean);
    if (!tokens.length || busq.trim().length < 2) return [];
    const scored = [];
    for (const i of items) {
      const doc = searchDocs.get(i.id);
      if (!doc) continue;
      const hay = `${doc.name} ${doc.marca} ${doc.cat} ${doc.desc}`;
      let all = true;
      for (let t = 0; t < tokens.length; t++) {
        if (!tokenMatchesDoc(tokens[t], hay, doc.words)) { all = false; break; }
      }
      if (!all) continue;
      scored.push({ i, r: scoreDoc(doc, tokens) + (doc.hasImg ? 0.5 : 0) });
    }
    scored.sort((a, b) => b.r - a.r);
    return scored.slice(0, 6).map(s => s.i);
  }, [items, busq, searchDocs]);

  // Datos derivados para los facetas (genéricos, salen del catálogo del org):
  //  • marcas disponibles (ordenadas, sin vacías)
  //  • si tiene sentido el toggle "En stock" (hay productos agotados)
  //  • si hay al menos una oferta (para mostrar el toggle "Ofertas")
  const marcasDisponibles = useMemo(() => {
    const set = new Set();
    items.forEach(i => { const m = String(i.marca || '').trim(); if (m) set.add(m); });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);
  const hayAgotados = useMemo(() => items.some(i => Number(i.stock) <= 0), [items]);
  const hayOfertas  = useMemo(() => items.some(i => !!dtoSiempre(i)), [items]);
  const nFiltros = fMarcas.length + (fOfertas ? 1 : 0) + (fStock ? 1 : 0) + (fPrecioMax != null ? 1 : 0);
  // Prueba social ON: en la demo siempre; en real, sólo si el distribuidor la
  // prende (brandCfg.socialProof). Así no aparece en portales reales sin querer.
  const socialOn = isPortalDemo || brandCfg?.socialProof === true;
  const limpiarFiltros = () => { setFMarcas([]); setFOfertas(false); setFStock(false); setFPrecioMax(null); };
  const toggleMarca = (m) => setFMarcas(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  // Umbrales de precio "lindos" derivados de la distribución del catálogo (cuartiles
  // redondeados hacia arriba). Genérico: se adapta a cualquier rubro/moneda.
  const precioBuckets = useMemo(() => {
    const ps = items.map(i => Number(i.precio) || 0).filter(p => p > 0).sort((a, b) => a - b);
    if (ps.length < 4) return [];
    const niceCeil = (n) => { const mag = Math.pow(10, Math.floor(Math.log10(n))); return Math.ceil(n / mag) * mag; };
    const raw = [0.25, 0.5, 0.75].map(q => niceCeil(ps[Math.floor(q * (ps.length - 1))]));
    return [...new Set(raw)].filter(v => v > 0);
  }, [items]);

  // Analytics — PedidosPage scope
  const track = (event, props = {}) => { trackWeb(event, props); try { window.posthog?.capture(event, { org: ORG, ...props }); } catch {} };

  // page_view: cada vez que el cliente cambia de pantalla (catálogo, historial,
  // habituales, ...). El tiempo en cada pantalla se reconstruye en el panel a
  // partir de los timestamps de los eventos de la misma sesión.
  useEffect(() => { trackWeb('page_view', { vista }, vista); }, [vista]);

  // producto_visto: cuando abre la ficha (PDP) de un producto.
  useEffect(() => {
    if (detalle) trackWeb('producto_visto', { producto: detalle.nombre, precio: detalle.precio, categoria: detalle.categoria || '' }, 'pdp');
  }, [detalle]);

  // busqueda: con debounce, para no registrar cada tecla.
  useEffect(() => {
    const q = (busq || '').trim();
    if (q.length < 2) return undefined;
    const t = setTimeout(() => { trackWeb('busqueda', { q: q.slice(0, 60), resultados: filtered.length }); }, 800);
    return () => clearTimeout(t);
  }, [busq, filtered.length]);

  // Clave de carrito: producto simple -> "id". Con variante -> "id::variantId".
  // Retrocompatible: los productos sin variante siguen usando su id pelado.
  const cartKey = (item, variantId) => variantId ? `${item.id}::${variantId}` : item.id;
  // origen: de qué superficie salió el "+". 'catalogo'/'ficha' = el cliente lo
  // buscó; 'carrito_sugerido'/'volver_a_pedir' = lo empujó el vendedor digital.
  // Permite medir en Analítica si las recomendaciones realmente venden (moat).
  const addItem = (item, variantId, origen = 'catalogo') => { track('producto_agregado', { producto: item.nombre, precio: item.precio, variante: variantId || null, origen }); setCarrito(c => { const k = cartKey(item, variantId); const cur = c[k] || 0; const min = item.min_order_qty || 1; return { ...c, [k]: cur === 0 ? min : cur + 1 }; }); };
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

  // ── Pedí por voz: suma las líneas dictadas al carrito ─────────────────────
  // Recibe [{ productId, qty }] ya resuelto por /api/voz-pedido contra la lista
  // del cliente. Suma a lo que ya tenga cargado (respeta el mínimo por producto)
  // y abre el carrito para que revise. Productos sin variante → clave = id.
  const confirmVoz = (lineas) => {
    setCarrito(c => {
      const n = { ...c };
      (lineas || []).forEach(l => {
        const it = items.find(p => p.id === l.productId);
        if (!it) return;
        // Clave con variante (color/sabor/tamaño) igual que en el catálogo manual:
        // "id::variantId". Sin variante queda "id".
        const k = cartKey(it, l.variantId || null);
        const min = it.min_order_qty || 1;
        const add = Math.max(min, Math.floor(l.qty) || min);
        n[k] = (n[k] || 0) + add;
      });
      return n;
    });
    track('voz_pedido_confirmado', { lineas: (lineas || []).length });
    setVozOpen(false);
    setShowCart(true);
  };

  const logout = () => {
    if (isPortalDemo) { setPortalDemo(null); setItems([]); setCarrito({}); window.location.href = '/pedidos'; return; }
    // Modo vendedor: no hay sesión propia en localStorage que limpiar; volvemos a
    // la lista de clientes del vendedor.
    if (vendorMode && onVendorExitRef.current) { setItems([]); setCarrito({}); onVendorExitRef.current(); return; }

    localStorage.removeItem(SK);
    setSession(null); setItems([]); setCarrito({});
  };

  // Entrega estimada a nivel de portal, para la línea compacta en las cards
  // (criterio Amazon: fecha visible antes del checkout). El motor decide por org
  // (brandCfg.reparto); modo 'off' → fecha null → la card no muestra nada.
  // IMPORTANTE: este hook va ANTES de cualquier return condicional (selecting /
  // !orgReady) para no romper el orden de hooks entre renders.
  const entregaPortal = useMemo(
    () => calcularEntrega(brandCfg?.reparto, isPortalDemo ? undefined : session?.zona, new Date()),
    [brandCfg?.reparto, isPortalDemo, session?.zona]
  );

  if (portalDemo === 'selecting') return <PortalDemoSelector onSelect={key => setPortalDemo(key)} />;

  // Dominio custom: mientras resolvemos el org no mostramos login ni catálogo
  // (evita pedir OTP / cargar con el org equivocado). Resuelve en ~200ms.
  if (!orgReady && !isPortalDemo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f4', fontFamily: SANS }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${G}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  // Demo mode: create a fake session so the catalog renders without null errors
  const effectiveSession = isPortalDemo ? {
    nombre: 'Cliente Demo',
    rut: '210000000015',
    contacto: 'Juan Pérez',
    clienteId: 'demo-client',
    token: 'demo-token',
    tel: '099000000',
    org: 'demo',
  } : session;
  // Línea compacta en las cards (card estática, sin countdown; el countdown vivo
  // vive sólo en la PDP vía EntregaHint). entregaPortal ya se calculó arriba.
  const entregaCortaCard = entregaPortal.modo !== 'off' && entregaPortal.fecha
    ? formatFechaCorta(entregaPortal.fecha, new Date()) : '';
  if (!session && !isPortalDemo) return <LoginStep onLogin={ses => setSession(ses)} />;

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: SANS }}>
      {/* Transición sutil al cambiar de pantalla (catálogo ↔ ficha): leve fade +
          subida, como las apps nativas. Suave, no "salta". */}
      <style>{'@keyframes pzFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.pz-fade{animation:pzFade .22s ease both}.pz-hscroll::-webkit-scrollbar{display:none}.pz-cattile{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.pz-cattile:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(63,83,68,.14);border-color:#d8ccb2}.pz-cattile img{transition:transform .4s ease}.pz-cattile:hover img{transform:scale(1.04)}'}</style>

      {vendorMode && (
        <div style={{ background: '#0f3d2e', color: '#fff', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          fontFamily: SANS, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: Z.header + 1 }}>
          <span style={{ fontSize: 12.5 }}>
            {vendorName ? `${vendorName} · ` : ''}Pedido por cuenta de <strong>{session?.nombre}</strong>
          </span>
          <button onClick={() => { setItems([]); setCarrito({}); onVendorExitRef.current && onVendorExitRef.current(); }}
            style={{ fontSize: 11.5, color: '#0f3d2e', background: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontFamily: SANS }}>
            Cambiar cliente
          </button>
        </div>
      )}

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
        position: 'sticky', top: 0, zIndex: Z.header }} onClick={() => { setDdOpen(false); setMenuCat(null); setUdOpen(false); }}>

        <div style={{ maxWidth: 1300, margin: '0 auto', padding: isMobile ? '6px 12px' : '0 24px',
          minHeight: 56, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 16,
          borderBottom: '0.5px solid #f0f0ec', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div onClick={() => { setVista('catalogo'); setCatFil('Todos'); setBusq(''); setDetalle(null); setVerTodoCatalogo(false); }}
            role="button" tabIndex={0} aria-label="Volver al catálogo"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setVista('catalogo'); setCatFil('Todos'); setBusq(''); setDetalle(null); setVerTodoCatalogo(false); } }}
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
                <input value={busq}
                  onChange={e => { setBusq(e.target.value); if (detalle) setDetalle(null); setSugOpen(true); setSugIdx(-1); }}
                  placeholder="Buscar producto o marca..." aria-label="Buscar producto o marca"
                  role="combobox" aria-expanded={sugOpen && sugerencias.length > 0} aria-autocomplete="list"
                  onKeyDown={e => {
                    if (!sugOpen || sugerencias.length === 0) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx(i => Math.min(i + 1, sugerencias.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSugIdx(i => Math.max(i - 1, -1)); }
                    else if (e.key === 'Enter' && sugIdx >= 0) {
                      e.preventDefault();
                      const it = sugerencias[sugIdx];
                      if (it) { setVista('catalogo'); setDetalle(it); setSugOpen(false); setSugIdx(-1); }
                    } else if (e.key === 'Escape') { setSugOpen(false); setSugIdx(-1); }
                  }}
                  style={{ width: '100%', padding: `9px ${brandCfg?.portalVoz === false ? 16 : 46}px 9px 36px`,
                    border: '1.5px solid #e0e0d8', borderRadius: 28, fontSize: 16,
                    fontFamily: SANS, boxSizing: 'border-box', outline: 'none',
                    background: '#f7f7f4', color: '#1a1a18' }}
                  onFocus={e => { e.target.style.borderColor = G; if (busq.trim().length >= 2) setSugOpen(true); }}
                  onBlur={e => { e.target.style.borderColor = '#e0e0d8'; setSugOpen(false); setSugIdx(-1); }} />
                {/* Dropdown de autocompletar (criterio Amazon). onMouseDown+preventDefault
                    evita que el blur del input cierre el panel antes del click. */}
                {sugOpen && sugerencias.length > 0 && (
                  <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #ececE6', borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 12px 34px rgba(0,0,0,.14)' }}>
                    {sugerencias.map((s, i) => {
                      const on = i === sugIdx;
                      return (
                        <div key={s.id} role="option" aria-selected={on}
                          onMouseDown={e => { e.preventDefault(); setVista('catalogo'); setDetalle(s); setSugOpen(false); setSugIdx(-1); }}
                          onMouseEnter={() => setSugIdx(i)}
                          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', cursor: 'pointer',
                            background: on ? '#f4f7f5' : '#fff', borderBottom: i < sugerencias.length - 1 ? '1px solid #f4f4f0' : 'none' }}>
                          <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, background: '#f7f7f4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {s.imagen_url
                              ? <img src={s.imagen_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              : <span style={{ color: GRAY }}>{Icon.search}</span>}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, fontFamily: SANS,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                            {(s.marca || s.categoria) && (
                              <div style={{ fontSize: 11.5, color: GRAY, fontFamily: SANS,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.marca || s.categoria}</div>
                            )}
                          </div>
                          {s.precio > 0 && (
                            <div style={{ fontSize: 13, fontWeight: 700, color: G, flexShrink: 0 }}>{fmt.currency(s.precio)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {brandCfg?.portalVoz !== false && (
                  <button type="button" onClick={() => setVozOpen(true)}
                    aria-label="Pedir por voz" title="Pedí por voz"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: G, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(5,150,105,.35)' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                  </button>
                )}
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
              <button onClick={() => { setUdOpen(false); setVista('listas'); setDetalle(null); }} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 16px', border: 'none', background: 'transparent',
                fontSize: 13, color: '#3a3a32', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f7f7f4'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                Mis listas{listas.length > 0 ? ` (${listas.length})` : ''}
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
          height: 44, position: 'relative', overflowX: 'visible' }} onClick={e => e.stopPropagation()}>
          {/* "Todas las categorías": menú completo estilo Amazon, SIEMPRE a la
              izquierda del nav. Contiene el árbol entero (drilldown nivel 1 →
              nivel 2), así que reemplaza cualquier overflow "Mas": las categorías
              inline son solo destacadas y lo que no entra vive acá adentro. */}
          {(vista === 'catalogo' || vista === 'habituales') && catsMenu.length > 0 && (
            <div ref={ddRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button" aria-haspopup="menu" aria-expanded={ddOpen}
                onClick={e => { e.stopPropagation(); setMenuCat(null); setDdOpen(o => !o); }} style={{
                display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 14px',
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS,
                fontSize: 14, fontWeight: 500, color: ddOpen ? G : '#3a3a32', whiteSpace: 'nowrap',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                Todas las categorías
              </button>
              {ddOpen && (
                <div role="menu" style={{ position: 'absolute', top: 44, left: 0, background: '#fff',
                  border: '0.5px solid #e0e0d8', borderRadius: 10, padding: '6px 0',
                  minWidth: 260, maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto',
                  boxShadow: '0 6px 24px rgba(0,0,0,.10)', zIndex: Z.dropdown }}>
                  {menuCat == null ? (
                    <>
                    {/* "Todos los productos" limpia el filtro. Vive acá adentro
                        (no como chip suelto) para no duplicar con el botón del
                        menú "Todas las categorías", que estaba al lado. */}
                    <button type="button" onClick={() => { setVista('catalogo'); setCatFil('Todos'); setSubFil(''); setDdOpen(false); setDetalle(null); }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f7f7f4'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = (vista === 'catalogo' && catFil === 'Todos') ? '#f0fdf4' : 'transparent'; }}
                      style={{
                      display: 'block', width: '100%', padding: '9px 16px', border: 'none',
                      borderBottom: '1px solid #f0f0ee',
                      background: (vista === 'catalogo' && catFil === 'Todos') ? '#f0fdf4' : 'transparent',
                      fontSize: 13, color: (vista === 'catalogo' && catFil === 'Todos') ? G : '#3a3a32',
                      fontWeight: (vista === 'catalogo' && catFil === 'Todos') ? 600 : 500,
                      textAlign: 'left', cursor: 'pointer', fontFamily: SANS }}>
                      Todos los productos
                    </button>
                    {catsMenu.map(cat => {
                      const subs = subsDe(cat);
                      const activa = vista === 'catalogo' && catFil === cat;
                      return (
                        <button key={cat} type="button" onClick={() => {
                          if (subs.length) { setMenuCat(cat); }
                          else { setVista('catalogo'); setCatFil(cat); setSubFil(''); setDdOpen(false); setDetalle(null); }
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f7f7f4'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = activa && !subs.length ? '#f0fdf4' : 'transparent'; }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                          width: '100%', padding: '9px 16px', border: 'none',
                          background: activa && !subs.length ? '#f0fdf4' : 'transparent',
                          fontSize: 13, color: activa ? G : '#3a3a32', fontWeight: activa ? 500 : 400,
                          textAlign: 'left', cursor: 'pointer', fontFamily: SANS }}>
                          <span>{cat}</span>
                          {subs.length > 0 && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a9a92" strokeWidth="2.5">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMenuCat(null)}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f7f7f4'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px',
                        border: 'none', borderBottom: '1px solid #f0f0ee', background: 'transparent',
                        fontSize: 12.5, fontWeight: 600, color: '#6a6a68', cursor: 'pointer', fontFamily: SANS }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Todas las categorías
                      </button>
                      <button type="button" onClick={() => { setVista('catalogo'); setCatFil(menuCat); setSubFil(''); setDdOpen(false); setMenuCat(null); setDetalle(null); }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f7f7f4'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        style={{
                        display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'transparent',
                        fontSize: 13, fontWeight: 600, color: G, textAlign: 'left', cursor: 'pointer', fontFamily: SANS }}>
                        Ver todo {menuCat}
                      </button>
                      {subsDe(menuCat).map(sub => {
                        const activa = vista === 'catalogo' && catFil === menuCat && subFil === sub;
                        return (
                          <button key={sub} type="button" onClick={() => { setVista('catalogo'); setCatFil(menuCat); setSubFil(sub); setDdOpen(false); setMenuCat(null); setDetalle(null); }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f7f7f4'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = activa ? '#f0fdf4' : 'transparent'; }}
                            style={{
                            display: 'block', width: '100%', padding: '8px 16px 8px 28px', border: 'none',
                            background: activa ? '#f0fdf4' : 'transparent',
                            fontSize: 13, color: activa ? G : '#3a3a32', fontWeight: activa ? 500 : 400,
                            textAlign: 'left', cursor: 'pointer', fontFamily: SANS }}>
                            {sub}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Categorías destacadas inline. Sólo en desktop: viven en un contenedor
              flexible (flex:1, minWidth:0) que se queda con el espacio libre; se
              miden y sólo se muestran las que entran enteras (navVisibles), el
              resto queda invisible y disponible en "Todas". En mobile NO se
              muestran (quedaba un despliegue enorme de categorías apretadas): ahí
              se navega sólo por el menú "Todas las categorías". */}
          {!isMobile && (vista === 'catalogo' || vista === 'habituales') && (
            <div ref={navRowRef} style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {catsMenu.slice(0, NAV_MAX).map((cat, i) => (
                <button key={cat} onClick={() => { setVista('catalogo'); setCatFil(cat); setDdOpen(false); setDetalle(null); }} style={{
                  padding: '0 16px', height: 44, border: 'none', background: 'transparent',
                  fontSize: 14, letterSpacing: '0.1px', fontFamily: SANS, flexShrink: 0,
                  visibility: (i >= navVisibles) ? 'hidden' : 'visible',
                  fontWeight: (vista === 'catalogo' && catFil === cat) ? 500 : 400,
                  color: (vista === 'catalogo' && catFil === cat) ? G : '#5a5a52',
                  borderBottom: (vista === 'catalogo' && catFil === cat) ? `2px solid ${G}` : '2px solid transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {cat}
                </button>
              ))}
            </div>
          )}
          {buyAgain.length > 0 && (vista === 'catalogo' || vista === 'habituales') && (
            <button onClick={() => { setVista('habituales'); setDetalle(null); setDdOpen(false); }} style={{
              padding: '0 14px', height: 44, border: 'none', background: 'transparent',
              marginLeft: 'auto',
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
        </nav>
      </header>

      {/* Subcategorías: segundo nivel del filtro. Solo aparece cuando la categoría
          madre activa tiene subcategorías definidas en la taxonomía del admin. */}
      {(vista === 'catalogo' || vista === 'habituales') && subActuales.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 24px', borderBottom: '1px solid #f0f0ee', background: '#fafaf8' }}>
          <button onClick={() => setSubFil('')} style={{
            flex: '0 0 auto', padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5,
            border: `1px solid ${subFil === '' ? G : '#e2e2de'}`, background: subFil === '' ? '#ecfdf5' : '#fff',
            color: subFil === '' ? G : '#5a5a52', fontWeight: subFil === '' ? 600 : 400, whiteSpace: 'nowrap' }}>
            Todo {catFil}
          </button>
          {subActuales.map(sub => (
            <button key={sub} onClick={() => setSubFil(sub)} style={{
              flex: '0 0 auto', padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5,
              border: `1px solid ${subFil === sub ? G : '#e2e2de'}`, background: subFil === sub ? '#ecfdf5' : '#fff',
              color: subFil === sub ? G : '#5a5a52', fontWeight: subFil === sub ? 600 : 400, whiteSpace: 'nowrap' }}>
              {sub}
            </button>
          ))}
        </div>
      )}

      {!isPortalDemo && !vendorMode && <InstallAppBanner brandNombre={brandNombre} />}

      {horarioInfo && (
        <div style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', padding:'6px 24px', fontSize:12, color:'#92400e', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {Icon.clock} <span>Horario de recepción: <strong>{horarioInfo.desde||'?'} – {horarioInfo.hasta||'?'}</strong></span>
        </div>
      )}
      {/* Banner de cuenta corriente — el cliente ve su deuda de un vistazo.
          Sólo aparece si debe plata. Si tiene facturas vencidas, en rojo. */}
      {!isPortalDemo && cuentaResumen && !detalle && (vista === 'catalogo' || vista === 'habituales') && (() => {
        const vencido = cuentaResumen.vencido > 0;
        return (
          <div role="status" style={{
            background: vencido ? '#fef2f2' : '#fffbeb',
            borderBottom: `1px solid ${vencido ? '#fecaca' : '#fde68a'}`,
            padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, flexWrap: 'wrap', fontFamily: SANS }}>
            <span style={{ fontSize: 13, color: vencido ? '#991b1b' : '#92400e' }}>
              {vencido
                ? <>Tenés <strong>{cuentaResumen.nVencidas}</strong> factura{cuentaResumen.nVencidas !== 1 ? 's' : ''} vencida{cuentaResumen.nVencidas !== 1 ? 's' : ''} por <strong>{fmt.currency(cuentaResumen.vencido)}</strong>. Saldo total: <strong>{fmt.currency(cuentaResumen.saldo)}</strong>.</>
                : <>Saldo en tu cuenta: <strong>{fmt.currency(cuentaResumen.saldo)}</strong>.</>}
            </span>
            <button onClick={() => setShowEstadoCuenta(true)} style={{
              padding: '5px 14px', borderRadius: 50, border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
              background: vencido ? '#dc2626' : G, color: '#fff' }}>
              Ver estado de cuenta
            </button>
          </div>
        );
      })()}
      {vista === 'catalogo' && detalle && (
        <div key={detalle.id} className="pz-fade">
          <ProductDetail item={detalle} carrito={carrito} onAdd={(it, v) => addItem(it, v, 'ficha')} onRemove={removeItem} onSetQty={setItemQty}
            brandCfg={brandCfg} isMobile={isMobile} onBack={() => setDetalle(null)}
            items={items} coBuy={coBuy} social={social} socialOn={socialOn}
            onOpen={setDetalle} onPickVariants={setPickSheet} demo={isPortalDemo}
            zona={effectiveSession?.zona} entregaCorta={entregaCortaCard} />
        </div>
      )}
      {vista === 'catalogo' && !detalle && (
        <main className="pz-fade" style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 60px' }}>
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
            /* Skeleton que CALCA la forma de la card real (foto + categoría + 2
               líneas de nombre + precio + botón). Al llegar los productos encajan
               en el mismo molde → sin "salto" de layout. Las medidas espejan
               ProductCard: imagen imgH (120/160), cuerpo padding 10/12/12. */
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0f0ec', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="sk-shimmer" style={{ height: isMobile ? 120 : 160 }} />
                  <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="sk-shimmer" style={{ height: 9,  width: '40%', borderRadius: 4 }} />
                    <div className="sk-shimmer" style={{ height: 11, width: '92%', borderRadius: 4 }} />
                    <div className="sk-shimmer" style={{ height: 11, width: '64%', borderRadius: 4 }} />
                    <div className="sk-shimmer" style={{ height: 15, width: '46%', borderRadius: 4, marginTop: 6 }} />
                    <div className="sk-shimmer" style={{ height: 38, width: '100%', borderRadius: 8, marginTop: 4 }} />
                  </div>
                </div>
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
              {(busq || catFil !== 'Todos' || nFiltros > 0) && items.length > 0 && (
                <button onClick={() => { setBusq(''); setCatFil('Todos'); limpiarFiltros(); }} style={{
                  marginTop: 18, padding: '10px 20px', background: G, color: '#fff', border: 'none',
                  borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Vidriera (home): sólo cuando no hay búsqueda ni filtro activo. Al
                  buscar o filtrar, esto se colapsa y el grid pasa a ser "resultados"
                  (patrón Amazon: home vs. página de resultados).
                  FLAG: por ahora la vidriera se muestra sólo en el catálogo de PRUEBA
                  (demo) o si el org la habilita con brandCfg.homeVidriera=true. Así
                  queda ARMADA sin aplicarla a clientes reales hasta prender el flag. */}
              {(() => {
                const vidrieraEnabled = isPortalDemo || brandCfg?.homeVidriera === true;
                const homeContext = catFil === 'Todos' && !subFil && !busq;
                // Home puro (sólo vidriera, sin grilla). El catálogo completo aparece
                // cuando el cliente toca "Ver todo", elige categoría o busca.
                const showVidriera = vidrieraEnabled && homeContext && !verTodoCatalogo;
                const showBackToHome = vidrieraEnabled && homeContext && verTodoCatalogo;
                if (showVidriera) return (
                  <PortalHome
                    items={items} buyAgain={buyAgain} recommended={recommended}
                    onRepetirTodo={repetirHabituales}
                    catArbol={catArbol} cats={cats} brandCfg={brandCfg} brandNombre={brandNombre}
                    clienteNombre={effectiveSession?.nombre}
                    clienteRut={effectiveSession?.rut}
                    clienteContacto={effectiveSession?.contacto}
                    isMobile={isMobile} carrito={carrito}
                    addItem={addItem} removeItem={removeItem}
                    onOpen={setDetalle} onPickVariants={setPickSheet}
                    social={social} socialOn={socialOn} entregaCorta={entregaCortaCard}
                    onSelectCat={(cat) => { setVista('catalogo'); setCatFil(cat); setSubFil(''); setDetalle(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onVerTodo={() => { setVerTodoCatalogo(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  />
                );
                return (<>
              {showBackToHome && (
                <button onClick={() => { setVerTodoCatalogo(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer',
                    color: G, fontWeight:700, fontSize:13.5, fontFamily: SANS, padding:'2px 0', marginBottom:12 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                  Volver al inicio
                </button>
              )}
              <div id="pz-todo-catalogo" style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                {showBackToHome && (
                  <h2 style={{ fontSize: 19, fontWeight: 800, color: '#12120f', margin: 0, letterSpacing: -.3 }}>Todo el catálogo</h2>
                )}
                <span style={{ fontSize: 12, color: GRAY }}>
                  {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Barra de orden + filtros facetados (contexto "resultados", estilo casa).
                  Genérico por-org: marcas y tramos de precio salen del catálogo, no se
                  hardcodean. En mobile los filtros van a un sheet; el orden queda inline. */}
              {(() => {
                const chip = (active) => ({
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 50,
                  border: `1px solid ${active ? G : '#e3e0d6'}`, background: active ? G : '#fff',
                  color: active ? '#fff' : INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: SANS, whiteSpace: 'nowrap' });
                const money = (n) => '$' + Number(n).toLocaleString('es-UY');
                const OrdenSelect = (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 12, color: GRAY, fontWeight: 600 }}>Ordenar</span>
                    <select value={orden} onChange={e => setOrden(e.target.value)} style={{
                      padding: '7px 30px 7px 12px', borderRadius: 50, border: '1px solid #e3e0d6', background: '#fff',
                      color: INK, fontSize: 12.5, fontWeight: 600, fontFamily: SANS, cursor: 'pointer',
                      appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b66' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                      <option value="relevancia">Relevancia</option>
                      <option value="precio_asc">Precio: menor a mayor</option>
                      <option value="precio_desc">Precio: mayor a menor</option>
                      <option value="nombre">Nombre (A–Z)</option>
                    </select>
                  </div>
                );
                const facetChips = (
                  <>
                    {hayOfertas && (
                      <button onClick={() => setFOfertas(v => !v)} style={chip(fOfertas)}>Ofertas</button>
                    )}
                    {hayAgotados && (
                      <button onClick={() => setFStock(v => !v)} style={chip(fStock)}>En stock</button>
                    )}
                    {precioBuckets.map(v => (
                      <button key={v} onClick={() => setFPrecioMax(fPrecioMax === v ? null : v)} style={chip(fPrecioMax === v)}>Hasta {money(v)}</button>
                    ))}
                    {marcasDisponibles.slice(0, 12).map(m => (
                      <button key={m} onClick={() => toggleMarca(m)} style={chip(fMarcas.includes(m))}>{m}</button>
                    ))}
                  </>
                );
                const hayFacetas = hayOfertas || hayAgotados || precioBuckets.length > 0 || marcasDisponibles.length > 0;
                if (isMobile) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      {hayFacetas && (
                        <button onClick={() => setFiltrosOpen(true)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 50,
                          border: `1px solid ${nFiltros ? G : '#e3e0d6'}`, background: nFiltros ? G : '#fff',
                          color: nFiltros ? '#fff' : INK, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                          Filtros{nFiltros ? ` · ${nFiltros}` : ''}
                        </button>
                      )}
                      <div style={{ marginLeft: 'auto' }}>{OrdenSelect}</div>
                      {filtrosOpen && (
                        <div onClick={() => setFiltrosOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,.4)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}>
                          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '18px 18px 0 0', padding: '18px 18px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                              <span style={{ fontFamily: DISPLAY, fontSize: 19, color: INK }}>Filtros</span>
                              <button onClick={() => setFiltrosOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{facetChips}</div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                              <button onClick={limpiarFiltros} disabled={!nFiltros} style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 50, border: '1px solid #e3e0d6', background: '#fff', color: nFiltros ? INK : '#bbb', fontSize: 13, fontWeight: 600, cursor: nFiltros ? 'pointer' : 'default', fontFamily: SANS }}>Limpiar</button>
                              <button onClick={() => setFiltrosOpen(false)} style={{ flex: 1, padding: '11px 16px', borderRadius: 50, border: 'none', background: G, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Ver {filtered.length} producto{filtered.length !== 1 ? 's' : ''}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                      {facetChips}
                      {nFiltros > 0 && (
                        <button onClick={limpiarFiltros} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: GRAY, fontSize: 12.5, fontWeight: 600, fontFamily: SANS, textDecoration: 'underline', padding: '7px 4px' }}>Limpiar ({nFiltros})</button>
                      )}
                    </div>
                    {OrdenSelect}
                  </div>
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(190px,1fr))', gap: isMobile ? 10 : 14 }}>
                {filtered.map(item => (
                  <ProductCard key={item.id} item={item} brandCfg={brandCfg} carrito={carrito}
                    qty={carrito[item.id] || 0} onAdd={addItem} onRemove={removeItem} onOpen={setDetalle}
                    onPickVariants={setPickSheet} social={socialOn ? social[item.id] : null}
                    entregaCorta={entregaCortaCard} />
                ))}
              </div>
                </>);
              })()}
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
                    qty={carrito[item.id] || 0} onAdd={(it, v) => addItem(it, v, 'volver_a_pedir')} onRemove={removeItem}
                    onPickVariants={setPickSheet} social={socialOn ? social[item.id] : null}
                    entregaCorta={entregaCortaCard}
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

      {vista === 'listas' && (
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
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>Mis listas</h1>
          <p style={{ fontSize: 13, color: GRAY, margin: '0 0 18px', lineHeight: 1.5 }}>
            Guardá tu pedido habitual una vez y repetilo en un toque. Armás el carrito y tocás "Guardar como lista".
          </p>
          {listas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', maxWidth: 440, margin: '0 auto' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f4f4f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: GRAY }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', margin: '0 0 6px' }}>Todavía no tenés listas guardadas</p>
              <p style={{ fontSize: 13, color: GRAY, margin: '0 0 18px', lineHeight: 1.5 }}>
                Agregá productos al carrito y guardalos como lista para repetir tu pedido cuando quieras.
              </p>
              <button onClick={() => { setVista('catalogo'); setCatFil('Todos'); }} style={{
                padding: '10px 20px', background: G, color: '#fff', border: 'none',
                borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                Ir al catálogo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {listas.map(l => {
                const keys = Object.keys(l.items || {});
                const nombres = keys.map(k => {
                  const baseId = k.indexOf('::') === -1 ? k : k.slice(0, k.indexOf('::'));
                  return items.find(p => p.id === baseId)?.nombre;
                }).filter(Boolean);
                const totalUnid = Object.values(l.items || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                return (
                  <div key={l.id} style={{ border: '1px solid #ececec', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18' }}>{l.nombre}</div>
                        <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
                          {keys.length} producto{keys.length !== 1 ? 's' : ''} · {totalUnid} unidad{totalUnid !== 1 ? 'es' : ''}
                        </div>
                        {nombres.length > 0 && (
                          <div style={{ fontSize: 12, color: '#8a8a82', marginTop: 6, lineHeight: 1.4,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {nombres.slice(0, 6).join(' · ')}{nombres.length > 6 ? ` +${nombres.length - 6} más` : ''}
                          </div>
                        )}
                      </div>
                      <button onClick={() => eliminarLista(l.id)} aria-label={`Eliminar lista ${l.nombre}`} style={{
                        background: 'none', border: 'none', color: '#b0b0a8', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                        onMouseLeave={e => e.currentTarget.style.color = '#b0b0a8'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                    <button onClick={() => cargarLista(l)} style={{
                      marginTop: 12, width: '100%', padding: '10px 0', background: G, color: '#fff',
                      border: 'none', borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                      </svg>
                      Cargar al carrito
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {pickSheet && (
        <VariantSheet item={pickSheet} carrito={carrito} onAdd={addItem} onRemove={removeItem}
          onClose={() => setPickSheet(null)} isMobile={isMobile} />
      )}

      <PoweredByPazque />

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

      {/* Pedí por voz (estilo Zapia) */}
      <VozPedido
        open={vozOpen}
        token={session?.token}
        isMobile={isMobile}
        onClose={() => setVozOpen(false)}
        onConfirm={confirmVoz}
      />

      {/* Estado de cuenta modal */}
      {showEstadoCuenta && (
        <EstadoCuentaPortal
          session={effectiveSession}
          brandCfg={brandCfg}
          onClose={() => setShowEstadoCuenta(false)}
        />
      )}

      {showCart && (
        <CartDrawer carrito={carrito} items={items} session={session} brandCfg={brandCfg} brandNombre={brandNombre}
          coBuy={coBuy} recommended={recommended}
          onAdd={(it, v) => addItem(it, v, 'carrito_mas')} onAddSugerido={(it) => addItem(it, undefined, 'carrito_sugerido')} onRemove={removeItem} onRemoveLine={removeLine}
          onClose={() => setShowCart(false)}
          onGuardarLista={guardarLista}
          onConfirm={() => { setCarrito({}); setShowCart(false); }} />
      )}
    </div>
  );
}
