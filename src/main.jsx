/* eslint-disable react-refresh/only-export-components */
import React, { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReactDOM from 'react-dom/client'
import AryesApp from './App.jsx';
import { AppProvider } from './context/AppContext.tsx';
import { SB_URL, SKEY as SB_KEY } from './lib/constants.js';
const OnboardingWizard = lazy(() => import('./tabs/OnboardingWizard.jsx'));
const ONBOARDING_KEY = 'stock-onboarding-done';

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    if (s && s.expiresAt != null && Date.now() > s.expiresAt) {
      localStorage.removeItem('aryes-session');
      return null;
    }
    return s;
  } catch { return null; }
}

// ── Root Error Boundary ───────────────────────────────────────────
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e, info: null }; }
  componentDidCatch(e, info) { console.error('[ARYES ROOT ERROR]', e, info); this.setState({ info }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position:'fixed', inset:0, background:'#fff', display:'flex',
          flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:32, fontFamily:'monospace', zIndex:99999 }}>
          <h2 style={{ color:'#dc2626', marginBottom:16, fontSize:18 }}>⛔ Error de aplicación</h2>
          <pre style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8,
            padding:16, fontSize:12, maxWidth:'90vw', overflowX:'auto',
            whiteSpace:'pre-wrap', wordBreak:'break-all', color:'#7f1d1d' }}>
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop:20, background:'#dc2626', color:'#fff', border:'none',
              padding:'10px 20px', borderRadius:6, cursor:'pointer', fontSize:14 }}>
            Limpiar cache y recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Login Screen ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!email || !pass) { setErr('Ingresá tu email y contraseña'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error_description || data.message || 'Credenciales incorrectas'); setLoading(false); return; }
      const userR = await fetch(SB_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&limit=1', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + data.access_token }
      });
      const users = await userR.json();
      const role = users?.[0]?.role || 'operador';
      const name = users?.[0]?.name || email.split('@')[0];
      const orgId = users?.[0]?.org_id || 'aryes';
      const expiresIn = (data.expires_in || 3600) * 1000;
      const session = { ...data, email, role, name, orgId, expiresAt: Date.now() + expiresIn };
      localStorage.setItem('aryes-session', JSON.stringify(session));
      onLogin(session);
    } catch {
      setErr('Error de conexión. Verificá tu internet.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{'.au{animation:fadeUp .25s ease both;}@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'}</style>
      <div className="au" style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 12, padding: '40px 44px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 52, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#6a6a68', marginTop: 12 }}>Sistema de gestión de stock</p>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ marginBottom: 5 }}><span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6a6a68' }}>Email</span></div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
              onKeyDown={e => e.key === 'Enter' && handle()}
              style={{ width: '100%', fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 11px', borderRadius: 4 }} />
          </div>
          <div>
            <div style={{ marginBottom: 5 }}><span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6a6a68' }}>Contraseña</span></div>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handle()}
              style={{ width: '100%', fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 11px', borderRadius: 4 }} />
          </div>
          {err && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#dc2626', textAlign: 'center' }}>{err}</p>}
          <button onClick={handle} disabled={loading}
            style={{ background: '#3a7d1e', color: '#fff', border: '1px solid #3a7d1e', fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 22px', cursor: loading ? 'default' : 'pointer', width: '100%', opacity: loading ? 0.4 : 1, borderRadius: 4 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root: owns auth state, renders Login OR App ───────────────────
function Root() {
  const [session, setSession] = useState(() => readSession());
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(ONBOARDING_KEY); }
    catch { return false; }
  });

  const handleLogin = (s) => setSession(s);
  const handleLogout = () => {
    try {
      const s = readSession();
      if (s?.access_token) {
        fetch(SB_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + s.access_token }
        }).catch(() => {});
      }
    } catch { /* non-blocking */ }
    localStorage.removeItem('aryes-session');
    setSession(null);
  };

  if (!session) return <LoginScreen onLogin={handleLogin} />;
  return (
    <>
      <AppProvider session={session} onLogout={handleLogout} onSessionUpdate={setSession}>
        <Routes>
          {/* Redirect bare /app to /app/dashboard */}
          <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
          {/* Main app — tab is the URL segment */}
          <Route
            path="/app/:tab"
            element={
              <AryesApp
                session={session}
                onLogout={handleLogout}
                onSessionUpdate={setSession}
              />
            }
          />
          {/* Catch-all: redirect anything else to /app/dashboard */}
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </AppProvider>
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard
            session={session}
            onComplete={() => setShowOnboarding(false)}
            onSkip={() => setShowOnboarding(false)}
          />
        </Suspense>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </RootErrorBoundary>
);
