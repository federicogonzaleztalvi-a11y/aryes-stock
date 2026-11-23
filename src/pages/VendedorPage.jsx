// ── VendedorPage — Portal del vendedor (pasar pedido por el cliente) ─────────
// El vendedor entra con su usuario interno (email + contraseña) y arma pedidos
// en nombre de SUS clientes asignados. El pedido sale por el mismo flujo que el
// portal del cliente (mail/PDF/push a la distribuidora).
//
// Fase A: login + lista de clientes asignados.
// Fase B/C (próximas): elegir cliente → catálogo con su lista + carrito +
// confirmar + historial.
import React, { useState, useEffect, useCallback } from 'react';
import { SB_URL, SKEY } from '../lib/constants.js';
import PedidosPage from './PedidosPage.jsx';

const G = '#059669';
const SANS = "'Inter', system-ui, -apple-system, sans-serif";
const SESSION_KEY = 'pazque-vendedor-session';

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (s && s.expiresAt != null && Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

// ── Login del vendedor ──────────────────────────────────────────────────────
function VendedorLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  // Marca de la distribuidora (genérico por org): el manifest resuelve el org por
  // dominio/?org= y nos da el logo. Así el portal del vendedor de Eric muestra el
  // logo de Aryes, sin hardcodear nada.
  const [brandLogo, setBrandLogo] = useState(null);
  const [brandName, setBrandName] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await fetch('/api/manifest').then(r => r.json());
        if (cancelled) return;
        const icons = m?.icons || [];
        const src = icons[icons.length - 1]?.src || icons[0]?.src || null;
        if (src && !src.includes('pazque-logo')) setBrandLogo(src);
        if (m?.name && m.name !== 'Pazque') setBrandName(m.name);
      } catch { /* sin red → queda el ícono genérico */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handle = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!email || !pass) { setErr('Ingresá tu email y contraseña'); return; }
    setLoading(true); setErr('');
    try {
      // 1. Autenticación contra Supabase (mismo usuario que el sistema interno).
      const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: SKEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error_description || data.message || 'Credenciales incorrectas');
        setLoading(false); return;
      }
      // 2. Verificar que sea vendedor (o admin) y traer sus datos — del servidor.
      const meRes = await fetch('/api/vendedor?action=me', {
        headers: { Authorization: 'Bearer ' + data.access_token },
      });
      if (!meRes.ok) {
        const e2 = await meRes.json().catch(() => ({}));
        setErr(e2.error || 'Tu usuario no tiene acceso al portal de vendedores.');
        setLoading(false); return;
      }
      const { vendedor } = await meRes.json();
      const expiresIn = (data.expires_in || 3600) * 1000;
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        email,
        username: vendedor.username,
        name: vendedor.name,
        org: vendedor.org,
        role: vendedor.role,
        expiresAt: Date.now() + expiresIn,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onLogin(session);
    } catch {
      setErr('Error de conexión. Verificá tu internet.');
    }
    setLoading(false);
  };

  const inp = {
    width: '100%', fontFamily: SANS, fontSize: 14, color: '#1a1a18', background: '#fff',
    border: '1px solid #e2e2de', padding: '11px 12px', borderRadius: 8, boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          {brandLogo ? (
            <img src={brandLogo} alt={brandName || 'Logo'}
              style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'contain', background: '#fff', marginBottom: 14, display: 'inline-block' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 14, background: G, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h12" />
              </svg>
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18' }}>{brandName || 'Portal de vendedores'}</div>
          <div style={{ fontSize: 13, color: '#6a6a68', marginTop: 4 }}>{brandName ? 'Portal de vendedores · pasá pedidos de tus clientes' : 'Ingresá para pasar pedidos de tus clientes'}</div>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6a6a68', display: 'block', marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
              onKeyDown={e => e.key === 'Enter' && handle()} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6a6a68', display: 'block', marginBottom: 5 }}>Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handle()} style={inp} />
          </div>
          {err && <p style={{ fontSize: 12.5, color: '#dc2626', textAlign: 'center', margin: 0 }}>{err}</p>}
          <button onClick={handle} disabled={loading}
            style={{ background: G, color: '#fff', border: 'none', fontFamily: SANS, fontSize: 14, fontWeight: 700, padding: '12px 22px', cursor: loading ? 'default' : 'pointer', width: '100%', opacity: loading ? 0.5 : 1, borderRadius: 10, marginTop: 4 }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Marca de la distribuidora (logo + nombre), genérico por org vía /api/manifest.
function useBrand(org) {
  const [brand, setBrand] = useState({ logo: null, name: '' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Pasamos el org del vendedor logueado: en pazque.com/vendedor no hay ?org=
        // ni dominio de la distribuidora, así que sin esto el manifest cae en el
        // branding genérico de Pazque y no aparece el logo de la org.
        const url = '/api/manifest?app=vendedor' + (org ? '&org=' + encodeURIComponent(org) : '');
        const m = await fetch(url).then(r => r.json());
        if (cancelled) return;
        const icons = m?.icons || [];
        const src = icons[icons.length - 1]?.src || icons[0]?.src || null;
        // El name viene como "Aryes · Ventas"; nos quedamos con la marca.
        const baseName = (m?.name || '').split(' · ')[0];
        setBrand({
          logo: (src && !src.includes('pazque-logo')) ? src : null,
          name: (baseName && baseName !== 'Pazque') ? baseName : '',
        });
      } catch { /* sin red → marca genérica */ }
    })();
    return () => { cancelled = true; };
  }, [org]);
  return brand;
}

// Iniciales para el avatar de cada cliente (1-2 letras).
function iniciales(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// ── Banner "Instalar app" del portal del vendedor ───────────────────────────
// Mismo patrón que el portal del cliente: Android dispara beforeinstallprompt;
// iPhone es manual (Compartir → Agregar a inicio). La app se instala apuntando a
// /vendedor (manifest ?app=vendedor) → el ícono abre el login del vendedor.
function InstallVendedorBanner({ brandNombre }) {
  // Arranca con el evento que ya pudo haberse disparado antes del login (capturado
  // temprano en index.html → window.__pwaInstallEvt). Si no, espera a que llegue.
  const [deferred, setDeferred]   = useState(() => (typeof window !== 'undefined' ? window.__pwaInstallEvt : null) || null);
  const [iosHelp,  setIosHelp]    = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('pazque-vendedor-install-dismissed') === '1'; } catch { return false; } });
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); window.__pwaInstallEvt = e; setDeferred(e); };
    const onInstalled = () => { window.__pwaInstallEvt = null; setDeferred(null); setDismissed(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const cerrar = () => { setDismissed(true); try { localStorage.setItem('pazque-vendedor-install-dismissed', '1'); } catch { /* bloqueado */ } };
  const instalar = async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch { /* canceló */ } setDeferred(null); cerrar(); }
    else if (isIOS) setIosHelp(true);
  };
  if (isStandalone || dismissed) return null;
  if (!deferred && !isIOS) return null; // sólo donde realmente se puede instalar (cel)
  return (
    <>
      <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: SANS }}>
        <span style={{ fontSize: 13, color: '#166534', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>📲</span> Instalá la app {brandNombre ? 'de ' + brandNombre : 'de ventas'} en tu celular
        </span>
        <button onClick={instalar} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: G, border: 'none', borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontFamily: SANS, flexShrink: 0 }}>Instalar</button>
        <button onClick={cerrar} aria-label="Cerrar" style={{ fontSize: 18, lineHeight: 1, color: '#6a6a68', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
      </div>
      {iosHelp && (
        <div onClick={() => setIosHelp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: SANS }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 22px 32px', width: '100%', maxWidth: 460, boxShadow: '0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a18', marginBottom: 14 }}>Instalar el portal en tu iPhone</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#3a3a32', lineHeight: 1.9 }}>
              <li>Tocá el botón <strong>Compartir</strong> <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"/></svg></span> (abajo, en la barra de Safari)</li>
              <li>Deslizá y elegí <strong>"Agregar a inicio"</strong></li>
              <li>Tocá <strong>"Agregar"</strong> arriba a la derecha</li>
            </ol>
            <button onClick={() => setIosHelp(false)} style={{ marginTop: 22, width: '100%', padding: '12px 0', background: G, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Lista de clientes asignados ─────────────────────────────────────────────
function ClientesAsignados({ session, onLogout, onSelect }) {
  const [clients, setClients] = useState(null); // null = cargando
  const [error, setError]     = useState('');
  const [q, setQ]             = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const brand = useBrand(session.org);
  const firstName = String(session.name || '').trim().split(/\s+/)[0] || 'vendedor';

  const fetchClients = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/vendedor?action=clients', {
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
      if (r.status === 401) { onLogout(); return; }
      if (!r.ok) { setError('No pudimos cargar tus clientes.'); setClients([]); return; }
      const data = await r.json();
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch {
      setError('Error de conexión.'); setClients([]);
    }
  }, [session.access_token, onLogout]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = (clients || []).filter(c => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (c.name || '').toLowerCase().includes(t) || (c.codigo || '').toLowerCase().includes(t);
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f4', fontFamily: SANS }}>
      <InstallVendedorBanner brandNombre={brand.name} />

      {/* Barra de marca */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ececea', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name || 'Logo'} style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: G, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h12" /></svg>
            </div>
          )}
          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Portal de vendedores
          </span>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12.5, color: '#6a6a68', background: 'transparent', border: '1px solid #e2e2de', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: SANS, flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '22px 16px 96px' }}>
        {/* Saludo */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', letterSpacing: '-0.01em' }}>Hola, {firstName}</div>
            <div style={{ fontSize: 13.5, color: '#6a6a68', marginTop: 3 }}>
              {clients === null ? 'Cargando tus clientes…'
                : clients.length === 0 ? 'Sin clientes asignados'
                : `${clients.length} cliente${clients.length !== 1 ? 's' : ''} asignado${clients.length !== 1 ? 's' : ''} · elegí uno para armar su pedido`}
            </div>
          </div>
          <button onClick={() => setShowNuevo(true)}
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: G, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, boxShadow: '0 2px 8px rgba(5,150,105,.22)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nuevo cliente
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', color: '#9a9a96' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente por nombre o código…"
            style={{ width: '100%', fontFamily: SANS, fontSize: 15, color: '#1a1a18', background: '#fff', border: '1.5px solid #e6e6e2', padding: '12px 14px 12px 40px', borderRadius: 12, boxSizing: 'border-box', outline: 'none', transition: 'border-color .12s' }}
            onFocus={e => e.target.style.borderColor = G}
            onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
        </div>

        {clients === null && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ececea', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f0f0ec' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, width: '55%', background: '#f0f0ec', borderRadius: 5, marginBottom: 8 }} />
                  <div style={{ height: 10, width: '35%', background: '#f4f4f0', borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 12, padding: 14, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {clients !== null && clients.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6a6a68', background: '#fff', border: '1px solid #ececea', borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>Todavía no tenés clientes asignados</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>Pedile al administrador que te asigne clientes desde la pestaña Clientes.</div>
          </div>
        )}

        {clients !== null && clients.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 34, color: '#6a6a68', fontSize: 14, background: '#fff', border: '1px solid #ececea', borderRadius: 14 }}>Sin resultados para “{q}”.</div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              style={{ textAlign: 'left', background: '#fff', border: '1px solid #ececea', borderRadius: 14, padding: '13px 15px', cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 13, transition: 'transform .12s, border-color .12s, box-shadow .12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G; e.currentTarget.style.boxShadow = '0 4px 14px rgba(5,150,105,.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#ececea'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: G, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {iniciales(c.name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[c.codigo, c.ciudad].filter(Boolean).join(' · ') || 'Sin datos'}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {showNuevo && (
        <NuevoClienteModal
          session={session}
          onClose={() => setShowNuevo(false)}
          onCreated={(cli) => { setShowNuevo(false); fetchClients(); if (cli) onSelect(cli); }}
        />
      )}
    </div>
  );
}

// ── Alta de cliente nuevo (lo crea el propio vendedor) ──────────────────────
// Postea a /api/vendedor?action=create-client. El servidor fija org_id y lo
// auto-asigna a este vendedor, así aparece de una en su lista. El teléfono es
// con lo que el cliente después entra al portal por OTP.
function NuevoClienteModal({ session, onClose, onCreated }) {
  const TIPOS = ['Panadería', 'Heladería', 'Pastelería', 'HORECA', 'Catering', 'Supermercado', 'Otro'];
  const [f, setF] = useState({ nombre: '', telefono: '', tipo: 'Panadería', ciudad: '', direccion: '', codigo: '', email: '', contacto: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const inputStyle = { width: '100%', fontFamily: SANS, fontSize: 15, color: '#1a1a18', background: '#fff', border: '1.5px solid #e6e6e2', padding: '11px 13px', borderRadius: 10, boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { fontSize: 12.5, fontWeight: 600, color: '#4a4a48', marginBottom: 5, display: 'block' };

  const guardar = async () => {
    setErr('');
    if (!f.nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (f.email && !/^[^@]+@[^@]+\.[^@]+$/.test(f.email)) { setErr('Email inválido.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/vendedor?action=create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(f),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(data.error || 'No se pudo guardar el cliente.'); setSaving(false); return; }
      onCreated(data.client || null);
    } catch {
      setErr('Error de conexión.'); setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: SANS }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '22px 20px calc(28px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a18' }}>Nuevo cliente</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a9a96', padding: 4, display: 'inline-flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gap: 13 }}>
          <div>
            <label style={labelStyle}>Nombre del comercio *</label>
            <input value={f.nombre} onChange={set('nombre')} placeholder="Panadería La Esquina" style={inputStyle}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Teléfono <span style={{ color: '#9a9a96', fontWeight: 500 }}>(con lo que entra al portal)</span></label>
            <input value={f.telefono} onChange={set('telefono')} placeholder="099 123 456" inputMode="tel" style={inputStyle}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={f.tipo} onChange={set('tipo')} style={{ ...inputStyle, appearance: 'none' }}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Código</label>
              <input value={f.codigo} onChange={set('codigo')} placeholder="Opcional" style={inputStyle}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Ciudad</label>
            <input value={f.ciudad} onChange={set('ciudad')} placeholder="Montevideo" style={inputStyle}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
          </div>
          <div>
            <label style={labelStyle}>Dirección</label>
            <input value={f.direccion} onChange={set('direccion')} placeholder="Opcional" style={inputStyle}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label style={labelStyle}>Contacto</label>
              <input value={f.contacto} onChange={set('contacto')} placeholder="Opcional" style={inputStyle}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={f.email} onChange={set('email')} placeholder="Opcional" inputMode="email" style={inputStyle}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = '#e6e6e2'} />
            </div>
          </div>
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginTop: 14 }}>{err}</div>}

        <button onClick={guardar} disabled={saving}
          style={{ marginTop: 18, width: '100%', padding: '13px 0', background: saving ? '#9ca3af' : G, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: SANS }}>
          {saving ? 'Guardando…' : 'Guardar y armar pedido'}
        </button>
      </div>
    </div>
  );
}

// ── Fase B — armar el pedido del cliente elegido ────────────────────────────
// Minteamos en el servidor una sesión REAL de portal para ese cliente (verifica
// que sea del vendedor) y reusamos el portal del cliente tal cual: catálogo con
// su lista, carrito y pedido por el mismo motor (mail/PDF/push). El vendedor ve
// arriba una barra para volver / cambiar de cliente.
function PedidoCliente({ session, cliente, onBack }) {
  const [portalSession, setPortalSession] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vendedor?action=open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ clienteId: cliente.id }),
        });
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !data.session) { setErr(data.error || 'No pudimos abrir el catálogo de este cliente.'); return; }
        setPortalSession(data.session);
      } catch {
        if (!cancelled) setErr('Error de conexión.');
      }
    })();
    return () => { cancelled = true; };
  }, [session.access_token, cliente.id]);

  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: SANS, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e6e9e6', borderRadius: 14, padding: '32px 28px', maxWidth: 420 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>{cliente.name}</div>
          <div style={{ fontSize: 13.5, color: '#dc2626', lineHeight: 1.6 }}>{err}</div>
          <button onClick={onBack} style={{ marginTop: 22, background: 'transparent', color: '#1a1a18', border: '1px solid #e2e2de', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600 }}>
            ← Volver a mis clientes
          </button>
        </div>
      </div>
    );
  }

  if (!portalSession) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, border: `3px solid ${G}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  return <PedidosPage vendorSession={portalSession} onVendorExit={onBack} vendorName={session.name} />;
}

// ── Helpers del feed de pedidos ─────────────────────────────────────────────
function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'recién';
  if (diffMin < 60) return 'hace ' + diffMin + ' min';
  const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return 'hoy ' + hh + ':' + mm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'ayer ' + hh + ':' + mm;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

const ESTADOS_NUEVO = ['pendiente', 'confirmada', 'importada'];
function estadoMeta(e) {
  if (e === 'entregada') return { label: 'Entregado', tone: 'mut' };
  if (e === 'en_ruta')   return { label: 'En camino', tone: 'mut' };
  if (e === 'preparada') return { label: 'Preparando', tone: 'mut' };
  if (e === 'cancelada') return { label: 'Cancelado', tone: 'mut' };
  return { label: 'Nuevo', tone: 'new' };
}
function itemsPreview(items) {
  const parts = (items || []).map(i => (i.nombre || i.name || '') + ' ×' + (i.qty || i.cantidad || 0)).filter(p => p.trim() !== '×0' && p.trim());
  const head = parts.slice(0, 3).join(' · ');
  return parts.length > 3 ? head + ' …' : head;
}

// ── Web Push del vendedor ───────────────────────────────────────────────────
// Reusa la infra existente (/api/push). La suscripción se guarda etiquetada con
// el email del vendedor (vendedor_id) para que el motor le mande push SÓLO de los
// pedidos de SUS clientes. El SW es el mismo de toda la PWA (/sw.js).
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeVendedorPush(session) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const keyRes = await fetch('/api/push?action=vapid-key');
  if (!keyRes.ok) throw new Error('not-configured');
  const { publicKey } = await keyRes.json();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
  const save = await fetch('/api/push?action=subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!save.ok) throw new Error('save-failed');
}

// Banner para activar los avisos. Si ya están concedidos, re-suscribe en silencio
// (mantiene la sub fresca). Si están en 'default', ofrece el botón. Si 'denied' o
// sin soporte, no muestra nada (no se puede hacer desde la web).
function NotifVendedorBanner({ session }) {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [perm, setPerm] = useState(() => (supported ? Notification.permission : 'unsupported'));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('pazque-vendedor-notif-dismissed') === '1'; } catch { return false; } });

  useEffect(() => {
    if (supported && Notification.permission === 'granted') {
      subscribeVendedorPush(session).catch(() => {});
    }
  }, [supported, session]);

  if (!supported || perm === 'granted' || perm === 'denied' || dismissed) return null;

  const activar = async () => {
    setBusy(true);
    try { await subscribeVendedorPush(session); setPerm('granted'); }
    catch { setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'default'); }
    setBusy(false);
  };
  const cerrar = () => { setDismissed(true); try { localStorage.setItem('pazque-vendedor-notif-dismissed', '1'); } catch { /* bloqueado */ } };

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Activá los avisos</div>
        <div style={{ fontSize: 12, color: '#3f6b4e', marginTop: 1 }}>Te avisamos cuando un cliente tuyo haga un pedido.</div>
      </div>
      <button onClick={activar} disabled={busy} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: '#fff', background: G, border: 'none', borderRadius: 8, padding: '7px 14px', cursor: busy ? 'default' : 'pointer', fontFamily: SANS, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Activar'}</button>
      <button onClick={cerrar} aria-label="Cerrar" style={{ flexShrink: 0, fontSize: 18, lineHeight: 1, color: '#6a8a74', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
    </div>
  );
}

// ── Mis pedidos — feed de lectura de lo que piden sus clientes ───────────────
// Lee /api/vendedor?action=pedidos (ya filtrado por el servidor a sus clientes).
// Resumen arriba + filtros + lista. Tocar una tarjeta abre el detalle.
function MisPedidos({ session, onLogout, onVer }) {
  const [pedidos, setPedidos] = useState(null); // null = cargando
  const [error, setError]     = useState('');
  const [filtro, setFiltro]   = useState('todos');
  const [showAvisos, setShowAvisos] = useState(false);
  const brand = useBrand(session.org);
  const firstName = String(session.name || '').trim().split(/\s+/)[0] || 'vendedor';

  const fetchPedidos = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/vendedor?action=pedidos', { headers: { Authorization: 'Bearer ' + session.access_token } });
      if (r.status === 401) { onLogout(); return; }
      if (!r.ok) { setError('No pudimos cargar tus pedidos.'); setPedidos([]); return; }
      const d = await r.json();
      setPedidos(Array.isArray(d.pedidos) ? d.pedidos : []);
    } catch { setError('Error de conexión.'); setPedidos([]); }
  }, [session.access_token, onLogout]);
  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  const lista = pedidos || [];
  const now = new Date();
  const hoyCount = lista.filter(p => { const d = new Date(p.creadoEn); return d.toDateString() === now.toDateString(); }).length;
  const factMes = lista
    .filter(p => { const d = new Date(p.creadoEn); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, p) => s + (p.total || 0), 0);

  const filtered = lista.filter(p => {
    if (filtro === 'nuevos')   return ESTADOS_NUEVO.includes(p.estado);
    if (filtro === 'entregar') return p.estado !== 'entregada' && p.estado !== 'cancelada';
    return true;
  });

  const PILLS = [['todos', 'Todos'], ['nuevos', 'Nuevos'], ['entregar', 'Por entregar']];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f4', fontFamily: SANS }}>
      <InstallVendedorBanner brandNombre={brand.name} />
      <div style={{ background: '#fff', borderBottom: '1px solid #ececea', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name || 'Logo'} style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: G, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h12" /></svg>
            </div>
          )}
          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Portal de vendedores</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowAvisos(v => !v)} aria-label="Avisos" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'inline-flex', position: 'relative', color: '#3f5344' }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              {lista.some(p => ESTADOS_NUEVO.includes(p.estado)) && <span style={{ position: 'absolute', top: 4, right: 5, width: 8, height: 8, borderRadius: '50%', background: G, border: '1.5px solid #fff' }} />}
            </button>
            {showAvisos && (
              <>
                <div onClick={() => setShowAvisos(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 290, maxHeight: 360, overflowY: 'auto', background: '#fff', border: '1px solid #e2e2de', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,.14)', zIndex: 50 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6a6a68', padding: '11px 14px 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Avisos</div>
                  {lista.length === 0 && <div style={{ padding: '10px 14px 16px', fontSize: 13, color: '#9a9a96' }}>Sin avisos todavía.</div>}
                  {lista.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { setShowAvisos(false); onVer(p); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: '1px solid #f2f2ee', padding: '10px 14px', cursor: 'pointer', fontFamily: SANS }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.clienteNombre}</div>
                      <div style={{ fontSize: 11.5, color: '#9a9a96', marginTop: 1 }}>{timeAgo(p.creadoEn)} · {money(p.total)}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={onLogout} style={{ fontSize: 12.5, color: '#6a6a68', background: 'transparent', border: '1px solid #e2e2de', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: SANS, flexShrink: 0 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 96px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', letterSpacing: '-0.01em', marginBottom: 14 }}>Hola, {firstName}</div>
        <NotifVendedorBanner session={session} />

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #ececea', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, color: '#8a8a86' }}>Pedidos hoy</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: '#1a1a18', marginTop: 2 }}>{pedidos === null ? '—' : hoyCount}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #ececea', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, color: '#8a8a86' }}>Facturación del mes</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: '#1a1a18', marginTop: 2 }}>{pedidos === null ? '—' : money(factMes)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {PILLS.map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)}
              style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: SANS,
                background: filtro === id ? G : '#fff', color: filtro === id ? '#fff' : '#6a6a68',
                border: filtro === id ? '1px solid ' + G : '1px solid #e2e2de' }}>{label}</button>
          ))}
        </div>

        {pedidos === null && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ececea', borderRadius: 14, padding: 15 }}>
                <div style={{ height: 13, width: '55%', background: '#f0f0ec', borderRadius: 5, marginBottom: 9 }} />
                <div style={{ height: 10, width: '80%', background: '#f4f4f0', borderRadius: 5, marginBottom: 9 }} />
                <div style={{ height: 10, width: '30%', background: '#f4f4f0', borderRadius: 5 }} />
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 12, padding: 14, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {pedidos !== null && lista.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', border: '1px solid #ececea', borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>Todavía no hay pedidos</div>
            <div style={{ fontSize: 13, color: '#6a6a68', lineHeight: 1.5 }}>Cuando tus clientes hagan un pedido, lo vas a ver acá.</div>
          </div>
        )}

        {pedidos !== null && lista.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 34, color: '#6a6a68', fontSize: 14, background: '#fff', border: '1px solid #ececea', borderRadius: 14 }}>Sin pedidos en este filtro.</div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(p => {
            const meta = estadoMeta(p.estado);
            return (
              <button key={p.id} onClick={() => onVer(p)}
                style={{ textAlign: 'left', background: '#fff', border: '1px solid #ececea', borderRadius: 14, padding: '13px 15px', cursor: 'pointer', fontFamily: SANS }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.clienteNombre}</span>
                  {meta.tone === 'new'
                    ? <span style={{ fontSize: 10.5, fontWeight: 700, background: '#e5efe8', color: '#166534', padding: '2px 9px', borderRadius: 20, flexShrink: 0 }}>{meta.label}</span>
                    : <span style={{ fontSize: 10.5, fontWeight: 600, color: '#9a9a96', flexShrink: 0 }}>{meta.label}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6a6a68', margin: '5px 0 2px', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemsPreview(p.items) || 'Sin detalle'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: '#9a9a96' }}>{timeAgo(p.creadoEn)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{money(p.total)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Detalle de un pedido + acciones (WhatsApp, repetir, marcar entregado) ────
function PedidoDetalle({ session, pedido, onBack, onCargar }) {
  const [estado, setEstado] = useState(pedido.estado);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const meta = estadoMeta(estado);
  const tel = (pedido.tel || '').replace(/\D/g, '');
  const primerNombre = String(pedido.clienteNombre || '').trim().split(/\s+/)[0] || '';
  const waLink = tel ? 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Hola ' + primerNombre + ', te escribo por tu pedido.') : null;
  const horario = (pedido.horarioDesde || pedido.horarioHasta) ? [pedido.horarioDesde, pedido.horarioHasta].filter(Boolean).join(' – ') : '';

  const marcarEntregado = async () => {
    if (!window.confirm('¿Marcar este pedido como entregado?')) return;
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/vendedor?action=estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ orderId: pedido.id, estado: 'entregada' }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setEstado('entregada');
      else setErr(d.error || 'No se pudo actualizar el pedido.');
    } catch { setErr('Error de conexión.'); }
    setSaving(false);
  };

  const card = { background: '#fff', border: '1px solid #ececea', borderRadius: 14, overflow: 'hidden', marginBottom: 12 };
  const sect = { fontSize: 11, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.5px', padding: '12px 15px 6px', fontWeight: 700 };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f4', fontFamily: SANS }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #ececea', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} aria-label="Volver" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1a1a18', padding: 2, display: 'inline-flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: '#1a1a18', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pedido.clienteNombre}</span>
        {meta.tone === 'new'
          ? <span style={{ fontSize: 10.5, fontWeight: 700, background: '#e5efe8', color: '#166534', padding: '3px 10px', borderRadius: 20 }}>{meta.label}</span>
          : <span style={{ fontSize: 11, fontWeight: 600, color: '#9a9a96' }}>{meta.label}</span>}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 16px 40px' }}>
        <div style={{ fontSize: 12, color: '#9a9a96', padding: '2px 2px 10px' }}>{timeAgo(pedido.creadoEn)}</div>

        <div style={card}>
          <div style={sect}>Productos</div>
          {(pedido.items || []).map((it, i) => {
            const qty = Number(it.qty || it.cantidad || 0);
            const unit = Number(it.precio || it.precioUnit || 0);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 15px' }}>
                <span style={{ fontSize: 14, color: '#1a1a18' }}>{it.nombre || it.name || 'Producto'}<span style={{ fontSize: 12, color: '#9a9a96', marginLeft: 6 }}>×{qty}</span></span>
                {unit > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{money(unit * qty)}</span>}
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderTop: '1px solid #ececea', marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>Total</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1a18' }}>{money(pedido.total)}</span>
          </div>
        </div>

        {(pedido.direccion || pedido.ciudad || horario) && (
          <div style={card}>
            <div style={sect}>Entrega</div>
            {(pedido.direccion || pedido.ciudad) && (
              <div style={{ fontSize: 13, color: '#4a4a48', padding: '2px 15px 8px' }}>{[pedido.direccion, pedido.ciudad].filter(Boolean).join(', ')}</div>
            )}
            {horario && <div style={{ fontSize: 13, color: '#4a4a48', padding: '0 15px 10px' }}>Recibe {horario}</div>}
          </div>
        )}

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'grid', gap: 9 }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: G, color: '#fff', padding: '13px', borderRadius: 12, fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.4-.2-2.6.7.7-2.5-.3-.4A8 8 0 0 1 12 4zm4.3 10.5c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.1-.5 0a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1c0 1.3.9 2.5 1 2.7s1.8 2.9 4.5 4c1.6.6 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg>
              Escribir por WhatsApp
            </a>
          )}
          <button onClick={() => onCargar({ id: pedido.clienteId, name: pedido.clienteNombre })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', color: G, border: '1px solid ' + G, padding: '13px', borderRadius: 12, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Hacer pedido a este cliente
          </button>
          {estado !== 'entregada' && estado !== 'cancelada' && (
            <button onClick={marcarEntregado} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: '#4a4a48', border: '1px solid #e2e2de', padding: '13px', borderRadius: 12, fontSize: 14.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: SANS, opacity: saving ? 0.5 : 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4a48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              {saving ? 'Guardando…' : 'Marcar entregado'}
            </button>
          )}
          {estado === 'entregada' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#166534', background: '#e5efe8', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Entregado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Nav inferior: Pedidos · Clientes ────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const item = (id, label, draw) => {
    const on = tab === id;
    return (
      <button onClick={() => setTab(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 0', fontFamily: SANS }}>
        {draw(on ? G : '#9a9a96')}
        <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? G : '#9a9a96' }}>{label}</span>
      </button>
    );
  };
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #ececea', display: 'flex', zIndex: 20, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {item('pedidos', 'Pedidos', c => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
      ))}
      {item('clientes', 'Clientes', c => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      ))}
    </div>
  );
}

export default function VendedorPage() {
  const [session, setSession] = useState(() => loadSession());
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('pedidos');
  const [verPedido, setVerPedido] = useState(null);

  // PWA: en /vendedor apuntamos el manifest a la variante "vendedor" para que, al
  // instalar, sea una app PROPIA (start_url=/vendedor → abre el login del
  // vendedor), separada de la app del cliente. También actualizamos el título que
  // iOS usa para "Agregar a inicio".
  useEffect(() => {
    // El script inline de index.html ya apunta el manifest a la variante vendedor en
    // la carga inicial (clave para iOS). Esto cubre la navegación interna (SPA) hacia
    // /vendedor sin recarga. Al salir, restauramos el manifest del cliente por defecto.
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', '/api/manifest?app=vendedor');
    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (titleMeta) titleMeta.setAttribute('content', 'Ventas');
    return () => {
      if (link) link.setAttribute('href', '/api/manifest');
      if (titleMeta) titleMeta.setAttribute('content', 'Pazque');
    };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSelected(null);
  }, []);

  if (!session) return <VendedorLogin onLogin={setSession} />;
  if (selected) return <PedidoCliente session={session} cliente={selected} onBack={() => setSelected(null)} />;
  if (verPedido) return (
    <PedidoDetalle session={session} pedido={verPedido}
      onBack={() => setVerPedido(null)}
      onCargar={(cli) => { setVerPedido(null); setSelected(cli); }} />
  );
  return (
    <>
      {tab === 'pedidos'
        ? <MisPedidos session={session} onLogout={logout} onVer={setVerPedido} />
        : <ClientesAsignados session={session} onLogout={logout} onSelect={setSelected} />}
      <BottomNav tab={tab} setTab={setTab} />
    </>
  );
}
