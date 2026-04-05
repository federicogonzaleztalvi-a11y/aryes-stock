// ResetPasswordPage.jsx — Password reset flow
// Two modes: (1) request reset email, (2) set new password (after clicking email link)
import { useState, useEffect } from 'react';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const F = "'Inter','SF Pro Display',-apple-system,sans-serif";

export default function ResetPasswordPage() {
  // Detect if we arrived from a reset email (Supabase adds tokens to URL hash)
  const [mode, setMode] = useState('loading'); // 'loading' | 'request' | 'update'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if URL has access_token (user clicked reset link in email)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      setMode('update');
    } else {
      setMode('request');
    }
  }, []);

  // Extract access token from URL hash
  const getAccessToken = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
  };

  // Step 1: Request password reset email
  const handleRequestReset = async () => {
    if (!email) { setErr('Ingresá tu email'); return; }
    setLoading(true); setErr(''); setMsg('');
    try {
      const r = await fetch(SB_URL + '/auth/v1/recover', {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const data = await r.json();
        setErr(data.error_description || data.message || 'Error al enviar el email');
      } else {
        setMsg('Te enviamos un email con un link para restablecer tu contraseña. Revisá tu bandeja de entrada.');
      }
    } catch {
      setErr('Error de conexión. Verificá tu internet.');
    }
    setLoading(false);
  };

  // Step 2: Set new password (after clicking email link)
  const handleUpdatePassword = async () => {
    if (!password || !confirm) { setErr('Completá ambos campos'); return; }
    if (password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirm) { setErr('Las contraseñas no coinciden'); return; }
    setLoading(true); setErr(''); setMsg('');
    try {
      const token = getAccessToken();
      if (!token) { setErr('Link inválido o expirado. Pedí un nuevo link.'); setLoading(false); return; }
      const r = await fetch(SB_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const data = await r.json();
        setErr(data.error_description || data.message || 'Error al cambiar la contraseña');
      } else {
        setMsg('Contraseña actualizada correctamente.');
        setTimeout(() => { window.location.href = '/app'; }, 2000);
      }
    } catch {
      setErr('Error de conexión. Verificá tu internet.');
    }
    setLoading(false);
  };

  if (mode === 'loading') return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{'.au{animation:fadeUp .25s ease both;}@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'}</style>
      <div className="au" style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 12, padding: '40px 44px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 52, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <h2 style={{ fontFamily: F, fontSize: 18, fontWeight: 600, color: '#1a1a18', margin: '16px 0 4px' }}>
            {mode === 'request' ? 'Restablecer contraseña' : 'Nueva contraseña'}
          </h2>
          <p style={{ fontFamily: F, fontSize: 13, color: '#6a6a68', margin: 0 }}>
            {mode === 'request'
              ? 'Ingresá tu email y te enviaremos un link para restablecer tu contraseña.'
              : 'Elegí tu nueva contraseña.'}
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {mode === 'request' ? (
            <>
              <div>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6a6a68' }}>Email</span>
                </div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
                  onKeyDown={e => e.key === 'Enter' && handleRequestReset()}
                  style={{ width: '100%', fontFamily: F, fontSize: 13, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 11px', borderRadius: 4 }} />
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6a6a68' }}>Nueva contraseña</span>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
                  style={{ width: '100%', fontFamily: F, fontSize: 13, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 11px', borderRadius: 4 }} />
              </div>
              <div>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6a6a68' }}>Confirmar contraseña</span>
                </div>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
                  style={{ width: '100%', fontFamily: F, fontSize: 13, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 11px', borderRadius: 4 }} />
              </div>
            </>
          )}

          {err && <p style={{ fontFamily: F, fontSize: 12, color: '#dc2626', textAlign: 'center', margin: 0 }}>{err}</p>}
          {msg && <p style={{ fontFamily: F, fontSize: 12, color: '#1a8a3c', textAlign: 'center', margin: 0 }}>{msg}</p>}

          <button
            onClick={mode === 'request' ? handleRequestReset : handleUpdatePassword}
            disabled={loading}
            style={{
              background: '#1a8a3c', color: '#fff', border: '1px solid #1a8a3c',
              fontFamily: F, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '10px 22px', cursor: loading ? 'default' : 'pointer',
              width: '100%', opacity: loading ? 0.4 : 1, borderRadius: 4,
            }}
          >
            {loading
              ? (mode === 'request' ? 'Enviando...' : 'Guardando...')
              : (mode === 'request' ? 'Enviar link de recuperación' : 'Guardar nueva contraseña')}
          </button>

          <p style={{ fontFamily: F, fontSize: 13, color: '#6a6a68', textAlign: 'center', marginTop: 8 }}>
            <a href="/app" style={{ color: '#1a8a3c', fontWeight: 600, textDecoration: 'none' }}>← Volver al login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
