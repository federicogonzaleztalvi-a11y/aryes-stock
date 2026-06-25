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

// ── Lista de clientes asignados ─────────────────────────────────────────────
function ClientesAsignados({ session, onLogout, onSelect }) {
  const [clients, setClients] = useState(null); // null = cargando
  const [error, setError]     = useState('');
  const [q, setQ]             = useState('');

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
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: SANS }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e6e9e6', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18' }}>Hola, {session.name}</div>
          <div style={{ fontSize: 12, color: '#6a6a68' }}>Tus clientes</div>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12.5, color: '#6a6a68', background: 'transparent', border: '1px solid #e2e2de', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: SANS }}>
          Salir
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px 16px 40px' }}>
        {/* Buscador */}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente por nombre o código…"
          style={{ width: '100%', fontFamily: SANS, fontSize: 14, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box', marginBottom: 16 }} />

        {clients === null && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6a6a68', fontSize: 14 }}>Cargando…</div>
        )}

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: 14, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {clients !== null && clients.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6a6a68' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>Todavía no tenés clientes asignados</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>Pedile al administrador que te asigne clientes desde la pestaña Clientes.</div>
          </div>
        )}

        {clients !== null && clients.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: '#6a6a68', fontSize: 14 }}>Sin resultados para “{q}”.</div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              style={{ textAlign: 'left', background: '#fff', border: '1px solid #e6e9e6', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'border-color .12s, box-shadow .12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G; e.currentTarget.style.boxShadow = '0 2px 8px rgba(5,150,105,.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e6e9e6'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#6a6a68', marginTop: 2 }}>
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

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSelected(null);
  }, []);

  if (!session) return <VendedorLogin onLogin={setSession} />;
  if (selected) return <PedidoCliente session={session} cliente={selected} onBack={() => setSelected(null)} />;
  return <ClientesAsignados session={session} onLogout={logout} onSelect={setSelected} />;
}
