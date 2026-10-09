// RegisterPage — Public self-registration page
// Route: /register
// Creates a new organization + admin user automatically

import { useState } from 'react';
import { SB_URL, SKEY } from '../lib/constants.js';

const G   = '#059669';
const ONBOARDING_KEY = 'stock-onboarding-done';
const F   = { sans: "'Inter',system-ui,sans-serif" };

// Atribución: si el prospecto llegó desde un link del agente (/register?ref=<id>),
// capturamos ese id para que register.js conecte esta prueba con el lead.
function refFromUrl() {
  try { return (new URLSearchParams(window.location.search).get('ref') || '').trim().slice(0, 64); }
  catch { return ''; }
}

export default function RegisterPage() {
  const [ref] = useState(refFromUrl);
  const [form, setForm] = useState({ empresa: '', nombre: '', email: '', password: '', confirm: '' });
  const [err,  setErr]  = useState('');
  const [ok,   setOk]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    setErr('');
    if (!form.empresa.trim()) return setErr('Ingresa el nombre de tu empresa');
    if (!form.nombre.trim())  return setErr('Ingresa tu nombre');
    if (!form.email.trim())   return setErr('Ingresa tu email');
    if (!form.password)       return setErr('Ingresa una contraseña');
    if (form.password.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres');
    if (form.password !== form.confirm) return setErr('Las contraseñas no coinciden');

    setLoading(true);
    try {
      const r = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          empresa:  form.empresa.trim(),
          nombre:   form.nombre.trim(),
          email:    form.email.trim().toLowerCase(),
          password: form.password,
          ...(ref ? { ref } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || 'Error al registrarse'); setLoading(false); return; }
      // CRITICAL SECURITY: Clear any existing session + caches from a previous user in
      // this browser, so the fresh signup never inherits another org's data. También
      // borramos las marcas de onboarding por-navegador para que el nuevo dueño vea el
      // wizard de arranque limpio (si otro ya lo había completado en esta máquina).
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('aryes-')) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('aryes-session');
        localStorage.removeItem(ONBOARDING_KEY);      // 'stock-onboarding-done'
        localStorage.removeItem('aryes-setup-dismissed');
      } catch (e) { /* non-fatal */ }

      // ── Auto-login: entramos directo a la app, sin pedir que escriba la contraseña
      // de nuevo. register.js crea el usuario con email_confirm:true, así que el
      // grant por contraseña funciona al instante. Armamos la sesión EXACTAMENTE
      // como lo hace el login de main.jsx (mismo shape). Si algo falla, caemos a la
      // pantalla de éxito manual (fallback) para no dejar al usuario trabado.
      try {
        const tokRes = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
          method:  'POST',
          headers: { apikey: SKEY, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
        });
        const tok = await tokRes.json();
        if (tokRes.ok && tok.access_token) {
          const meta      = tok.user?.user_metadata || {};
          const role      = meta.role   || 'admin';
          const orgId     = meta.org_id || data.orgId;
          const name      = meta.nombre || form.nombre.trim();
          const username  = form.email.split('@')[0];
          const expiresIn = (tok.expires_in || 3600) * 1000;
          const session   = { ...tok, email: form.email.trim().toLowerCase(), role, name, username, orgId, expiresAt: Date.now() + expiresIn };
          localStorage.setItem('aryes-session', JSON.stringify(session));
          // Hard navigation → recarga completa: main.jsx lee la sesión fresca y
          // monta la app ya logueada, con el onboarding wizard para el admin nuevo.
          window.location.href = '/app';
          return;
        }
      } catch (e) { /* cae al fallback manual */ }

      // Fallback: no pudimos auto-loguear → pantalla de éxito con ingreso manual.
      setOrgId(data.orgId);
      setOk(true);
    } catch {
      setErr('Error de conexión. Verifica tu internet.');
    }
    setLoading(false);
  };

  const inp = {
    width: '100%', boxSizing: 'border-box',
    fontFamily: F.sans, fontSize: 14, color: '#1a1a18',
    background: '#fff', border: '1px solid #e2e2de',
    padding: '10px 12px', borderRadius: 6, outline: 'none',
  };

  const lbl = {
    display: 'block', marginBottom: 6,
    fontFamily: F.sans, fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6a6a68',
  };

  // ── Success screen ──────────────────────────────────────────────
  if (ok) return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 12, padding: '48px 44px', maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: F.sans, fontSize: 22, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>
          ¡Cuenta creada!
        </h2>
        <p style={{ fontFamily: F.sans, fontSize: 14, color: '#6a6a68', marginBottom: 24, lineHeight: 1.6 }}>
          Tu empresa <strong>{form.empresa}</strong> está lista.<br />
          Ya puedes ingresar con tu email y contraseña.
        </p>
        <a href="/app"
          onClick={(e) => {
            e.preventDefault();
            // Hard navigation to /app — forces full page reload so React state
            // and any in-memory session from a prior user is fully cleared.
            window.location.href = '/app';
          }}
          style={{ display: 'inline-block', background: G, color: '#fff', fontFamily: F.sans, fontSize: 13, fontWeight: 600, padding: '12px 28px', borderRadius: 8, textDecoration: 'none', letterSpacing: '0.04em' }}>
          Ingresar a mi cuenta →
        </a>
        <p style={{ marginTop: 20, fontFamily: F.sans, fontSize: 11, color: '#9a9a98' }}>
          ¿Necesitas ayuda? Escríbenos a <a href="mailto:hola@pazque.com" style={{ color: G }}>hola@pazque.com</a>
        </p>
      </div>
    </div>
  );

  // ── Registration form ───────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/pazque-logo.png" alt="Pazque" style={{ height: 28, objectFit: 'contain', marginBottom: 8 }} onError={e => e.target.style.display = 'none'} />
          <h1 style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 700, color: '#1a1a18', margin: '4px 0 6px', letterSpacing: -0.3 }}>
            Empieza gratis
          </h1>
          <p style={{ fontFamily: F.sans, fontSize: 15, color: '#6a6a68' }}>
            14 días de prueba. Sin tarjeta de crédito.
          </p>
        </div>

        {/* Form card */}
        <div style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 12, padding: '36px 40px', boxShadow: '0 8px 40px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'grid', gap: 20 }}>

            <div>
              <label style={lbl}>Nombre de tu empresa</label>
              <input style={inp} value={form.empresa} placeholder="Ej: Distribuidora García"
                onChange={e => set('empresa', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>

            <div>
              <label style={lbl}>Tu nombre</label>
              <input style={inp} value={form.nombre} placeholder="Ej: María García"
                onChange={e => set('nombre', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>

            <div>
              <label style={lbl}>Email de trabajo</label>
              <input style={inp} type="email" value={form.email} placeholder="maria@distribuidora.com"
                onChange={e => set('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Contraseña</label>
                <input style={inp} type="password" value={form.password} placeholder="Mínimo 8 caracteres"
                  onChange={e => set('password', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handle()} />
              </div>
              <div>
                <label style={lbl}>Confirmar</label>
                <input style={inp} type="password" value={form.confirm} placeholder="Repetir contraseña"
                  onChange={e => set('confirm', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handle()} />
              </div>
            </div>

            {err && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', fontFamily: F.sans, fontSize: 13, color: '#dc2626' }}>
                {err}
              </div>
            )}

            <button onClick={handle} disabled={loading}
              style={{ background: loading ? '#9ca3af' : G, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, fontWeight: 600, padding: '13px', borderRadius: 8, cursor: loading ? 'default' : 'pointer', width: '100%', transition: 'background .15s' }}>
              {loading ? 'Creando tu cuenta...' : 'Crear cuenta gratis →'}
            </button>

          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontFamily: F.sans, fontSize: 13, color: '#6a6a68' }}>
            ¿Ya tienes cuenta?{' '}
            <a href="/app" style={{ color: G, fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</a>
          </p>
          <p style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 12 }}>
            Al registrarte aceptas los{' '}
            <a href="/terms" style={{ color: '#9a9a98' }}>términos de servicio</a>
            {' '}y la{' '}
            <a href="/privacy" style={{ color: '#9a9a98' }}>política de privacidad</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
