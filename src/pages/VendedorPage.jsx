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
function useBrand() {
  const [brand, setBrand] = useState({ logo: null, name: '' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await fetch('/api/manifest?app=vendedor').then(r => r.json());
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
  }, []);
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
function InstallVendedorBanner() {
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
      <div style={{ background: '#ecfdf3', borderBottom: '1px solid #bbf7d0', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: SANS }}>
        <span style={{ fontSize: 12.5, color: '#166534', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
          Instalá el portal en tu celular
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
  const brand = useBrand();
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
      <InstallVendedorBanner />

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
            {brand.name || 'Portal de vendedores'}
          </span>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12.5, color: '#6a6a68', background: 'transparent', border: '1px solid #e2e2de', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: SANS, flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '22px 16px 48px' }}>
        {/* Saludo */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', letterSpacing: '-0.01em' }}>Hola, {firstName}</div>
          <div style={{ fontSize: 13.5, color: '#6a6a68', marginTop: 3 }}>
            {clients === null ? 'Cargando tus clientes…'
              : clients.length === 0 ? 'Sin clientes asignados'
              : `${clients.length} cliente${clients.length !== 1 ? 's' : ''} asignado${clients.length !== 1 ? 's' : ''} · elegí uno para armar su pedido`}
          </div>
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

export default function VendedorPage() {
  const [session, setSession] = useState(() => loadSession());
  const [selected, setSelected] = useState(null);

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
  return <ClientesAsignados session={session} onLogout={logout} onSelect={setSelected} />;
}
