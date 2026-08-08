import React from 'react';

// OwnerPage — Consola privada del DUEÑO de Pazque (Federico). Ruta /owner.
// ----------------------------------------------------------------------------
// Esto NO es una org: es la vista de dueño de la plataforma. Hoy muestra la
// bandeja de PROSPECTOS PROPIOS (distribuidoras interesadas en contratar Pazque,
// tabla pazque_leads). Mañana va a sumar métricas de mis clientes que pagan.
//
// Seguridad: separada del sistema de roles por-org que protege a Eric. Se entra
// con una CLAVE propia (OWNER_KEY), que se valida en el servidor (api/owner.js)
// en cada pedido. Acá solo se guarda en localStorage para no reescribirla cada
// vez; nunca viaja en la URL.

// Mismos tokens que la landing (src/pages/LandingPage.jsx): fondo cálido,
// verde Pazque, títulos serif. Que /owner se sienta parte de la misma marca.
const C = {
  ink: '#1a1a18', sub: '#6a6a68', faint: '#9a9a98',
  line: '#e8e8e6', bg: '#fafaf9', card: '#ffffff',
  blue: '#2563eb', blueBg: '#eff6ff',
  green: '#059669', greenBg: '#f0fdf4', greenDeep: '#27500a', greenSoft: '#eef7ee',
  red: '#dc2626', redBg: '#fef2f2',
  amber: '#d97706', amberBg: '#fffbeb',
  violet: '#7c3aed', violetBg: '#f5f3ff',
  serif: "'DM Serif Display','Playfair Display',Georgia,serif",
  sans: "'DM Sans','Inter',system-ui,sans-serif",
};

// Carga las tipografías de la landing (DM Serif / DM Sans) sin depender del
// index global. Se monta una sola vez.
function Fonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
    </>
  );
}

const TOKEN_LS = 'pazque-owner-token';
const OWNER_EMAIL_DEFAULT = 'federico@pazque.com'; // prellenado; el server igual valida

const ESTADO = {
  nuevo:      { label: 'Nuevo',      bg: C.blueBg,   fg: C.blue },
  contactado: { label: 'Contactado', bg: C.amberBg,  fg: C.amber },
  demo:       { label: 'Demo',       bg: C.violetBg, fg: C.violet },
  convertido: { label: 'Cliente',    bg: C.greenBg,  fg: C.green },
  descartado: { label: 'Descartado', bg: '#f3f4f6',  fg: C.faint },
};
const FLUJO = ['nuevo', 'contactado', 'demo', 'convertido', 'descartado'];

function fuenteOf(l) {
  if (l.utm_source || l.utm_campaign) return [l.utm_source, l.utm_campaign].filter(Boolean).join(' · ');
  if (l.fbclid) return 'Meta Ads';
  if (l.gclid)  return 'Google Ads';
  if (l.referrer) { try { return new URL(l.referrer).hostname.replace(/^www\./,''); } catch { return l.referrer; } }
  return 'Directo';
}

function fmtDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

// Llama a api/owner.js. Si hay token de sesión, lo manda en el header.
// Devuelve {ok, status, data}.
async function ownerFetch(body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-owner-token'] = token;
  const r = await fetch('/api/owner', { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// Marca la página como no-indexable mientras está montada (que /owner nunca
// aparezca en Google). Se limpia al desmontar.
function useNoIndex() {
  React.useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', fontSize: 15, fontFamily: C.sans, color: C.ink,
  border: `1px solid ${C.line}`, borderRadius: 10, padding: '13px 15px', outline: 'none', background: C.bg,
};
const btnStyle = (busy) => ({
  width: '100%', marginTop: 16, fontSize: 15, fontWeight: 500, color: '#fff',
  background: busy ? '#7dbd9f' : C.green, border: 'none', borderRadius: 10, padding: '13px',
  cursor: busy ? 'default' : 'pointer', fontFamily: C.sans,
});

// ── Puerta de acceso: paso 1 mail → te llega código → paso 2 código ─────
function Gate({ onEnter }) {
  const [step, setStep]   = React.useState('email'); // 'email' | 'code'
  const [email, setEmail] = React.useState(OWNER_EMAIL_DEFAULT);
  const [code, setCode]   = React.useState('');
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState('');

  const askCode = async (e) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail) return;
    setBusy(true); setErr('');
    // Respuesta genérica del server (no revela si el mail es el correcto): si
    // responde ok, pasamos al paso del código igual.
    const { ok } = await ownerFetch({ action: 'request-code', email: mail });
    setBusy(false);
    if (ok) { setStep('code'); setErr(''); }
    else setErr('No pudimos enviar el código. Probá de nuevo.');
  };

  const verify = async (e) => {
    e.preventDefault();
    const c = code.trim().replace(/\D/g, '');
    if (c.length !== 6) { setErr('El código son 6 dígitos.'); return; }
    setBusy(true); setErr('');
    const { ok, status, data } = await ownerFetch({ action: 'verify-code', email: email.trim().toLowerCase(), code: c });
    setBusy(false);
    if (ok && data?.token) {
      try { localStorage.setItem(TOKEN_LS, data.token); } catch { /* noop */ }
      onEnter(data.token);
      return;
    }
    setErr(status === 401 ? 'Código incorrecto o vencido.' : 'No pudimos validar. Probá de nuevo.');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.sans, color: C.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Fonts />
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(39,80,10,.06)' }}>
        <div style={{ display: 'inline-block', background: C.greenSoft, color: C.green, fontSize: 12,
          fontWeight: 600, padding: '4px 12px', borderRadius: 50, marginBottom: 16 }}>Pazque</div>

        {step === 'email' ? (
          <form onSubmit={askCode}>
            <div style={{ fontFamily: C.serif, fontSize: 28, fontWeight: 400, color: C.ink, lineHeight: 1.15, marginBottom: 6 }}>
              Entrá a tu panel
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 22 }}>
              Te mandamos un código a tu mail para entrar seguro.
            </div>
            <input type="email" value={email} autoFocus placeholder="tu@mail.com"
              onChange={e => setEmail(e.target.value)} style={inputStyle} />
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button type="submit" disabled={busy} style={btnStyle(busy)}>
              {busy ? 'Enviando…' : 'Enviarme el código'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div style={{ fontFamily: C.serif, fontSize: 28, fontWeight: 400, color: C.ink, lineHeight: 1.15, marginBottom: 6 }}>
              Revisá tu mail
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 22 }}>
              Te enviamos un código de 6 dígitos a <strong>{email}</strong>. Pegalo acá.
            </div>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
              autoFocus placeholder="000000" maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 600 }} />
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button type="submit" disabled={busy} style={btnStyle(busy)}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setErr(''); }} style={{
              width: '100%', marginTop: 10, fontSize: 13, color: C.sub, background: 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: C.sans }}>
              Usar otro mail
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta de prospecto ─────────────────────────────────────────────
function LeadCard({ l, onUpdate, busy }) {
  const [notas, setNotas]   = React.useState(l.notas || '');
  const [editing, setEditing] = React.useState(false);
  const est = ESTADO[l.estado] || ESTADO.nuevo;
  const idx = FLUJO.indexOf(l.estado);
  const next = idx >= 0 && idx < 3 ? FLUJO[idx + 1] : null; // avanza hasta "convertido"
  const wa = String(l.tel || '').replace(/\D/g, '');

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{l.nombre}</span>
            <span style={{ background: est.bg, color: est.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>{est.label}</span>
          </div>
          {(l.empresa || l.rubro) && (
            <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
              {l.empresa || ''}{l.empresa && l.rubro ? ' · ' : ''}{l.rubro || ''}
            </div>
          )}
          {l.mensaje && (
            <div style={{ fontSize: 13, color: C.ink, marginTop: 8, background: C.bg,
              border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px' }}>
              “{l.mensaje}”
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: C.faint }}>
            <span>📅 {fmtDate(l.created_at)}</span>
            <span title="De qué campaña vino">🎯 {fuenteOf(l)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {wa.length >= 8 && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: C.green, textDecoration: 'none',
                border: `1px solid ${C.green}55`, borderRadius: 50, padding: '7px 14px' }}>
              WhatsApp
            </a>
          )}
          {l.email && (
            <a href={`mailto:${l.email}`}
              style={{ fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: 'none',
                border: `1px solid ${C.blue}55`, borderRadius: 50, padding: '7px 14px' }}>
              Email
            </a>
          )}
        </div>
      </div>

      {/* Acciones de estado + notas */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        {next && (
          <button onClick={() => onUpdate(l.id, { estado: next })} disabled={busy} style={{
            fontSize: 13, fontWeight: 600, color: '#fff', background: busy ? '#b0b0a8' : C.ink,
            border: 'none', borderRadius: 50, padding: '8px 16px', cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
            Marcar {ESTADO[next].label.toLowerCase()}
          </button>
        )}
        {l.estado !== 'descartado' && l.estado !== 'convertido' && (
          <button onClick={() => onUpdate(l.id, { estado: 'descartado' })} disabled={busy} style={{
            fontSize: 13, color: C.faint, background: 'transparent', border: 'none',
            cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
            Descartar
          </button>
        )}
        <button onClick={() => setEditing(v => !v)} style={{
          fontSize: 13, color: C.sub, background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: C.sans, marginLeft: 'auto' }}>
          {l.notas ? '📝 Notas' : '+ Nota'}
        </button>
      </div>

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
            placeholder="Anotá lo que hablaron, próximos pasos…"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontFamily: C.sans, color: C.ink,
              border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', outline: 'none', resize: 'vertical' }} />
          <div>
            <button onClick={() => { onUpdate(l.id, { notas }); setEditing(false); }} disabled={busy} style={{
              fontSize: 13, fontWeight: 600, color: '#fff', background: C.ink, border: 'none',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: C.sans }}>
              Guardar nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bandeja ──────────────────────────────────────────────────────────
function Inbox({ token, onLogout }) {
  const [leads,   setLeads]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState('');
  const [busy,    setBusy]    = React.useState('');
  const [filtro,  setFiltro]  = React.useState('activos'); // activos | todos

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    const { ok, status, data } = await ownerFetch({ action: 'list' }, token);
    if (ok) { setLeads(Array.isArray(data?.leads) ? data.leads : []); }
    else if (status === 401) { onLogout(); return; }
    else setError(data?.error || 'No pudimos cargar los prospectos.');
    setLoading(false);
  }, [token, onLogout]);

  React.useEffect(() => { load(); }, [load]);

  const update = async (id, patch) => {
    setBusy(id);
    // Optimista: reflejamos el cambio ya para que se sienta instantáneo.
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const { ok, status } = await ownerFetch({ action: 'update', id, ...patch }, token);
    if (status === 401) { onLogout(); return; }
    if (!ok) await load(); // si falló, recargamos la verdad del server
    setBusy('');
  };

  const activos = leads.filter(l => l.estado === 'nuevo' || l.estado === 'contactado' || l.estado === 'demo');
  const visibles = filtro === 'todos' ? leads : activos;
  const nuevos = leads.filter(l => l.estado === 'nuevo').length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.sans, color: C.ink }}>
      <Fonts />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(16px,4vw,32px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: C.serif, fontSize: 30, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>Prospectos de Pazque</h1>
            <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>
              Distribuidoras interesadas en contratar Pazque. Cada una que pide una demo aparece acá.
            </p>
          </div>
          <button onClick={onLogout} style={{
            fontSize: 12.5, color: C.faint, background: 'transparent', border: `1px solid ${C.line}`,
            borderRadius: 50, padding: '6px 12px', cursor: 'pointer', fontFamily: C.sans }}>
            Salir
          </button>
        </div>

        {/* Filtro */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          {[['activos', `Activos${nuevos ? ` (${nuevos})` : ''}`], ['todos', `Todos (${leads.length})`]].map(([id, lbl]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{
              padding: '6px 14px', borderRadius: 50, fontSize: 13, fontFamily: C.sans, cursor: 'pointer',
              border: `1px solid ${filtro === id ? C.ink : C.line}`,
              background: filtro === id ? C.ink : C.card, color: filtro === id ? '#fff' : C.sub, fontWeight: 500 }}>
              {lbl}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.faint, fontSize: 14 }}>Cargando…</div>
        ) : error ? (
          <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: 16, color: C.red, fontSize: 14 }}>
            {error}
          </div>
        ) : visibles.length === 0 ? (
          <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Todavía no hay prospectos</div>
            <div style={{ fontSize: 13, color: C.sub, maxWidth: 420, margin: '0 auto' }}>
              Cuando una distribuidora pida una demo desde la landing, va a aparecer acá con la campaña de la que vino.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibles.map(l => (
              <LeadCard key={l.id} l={l} onUpdate={update} busy={busy === l.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerPage() {
  useNoIndex();
  const [token, setToken] = React.useState(() => {
    try { return localStorage.getItem(TOKEN_LS) || ''; } catch { return ''; }
  });

  const logout = React.useCallback(() => {
    try { localStorage.removeItem(TOKEN_LS); } catch { /* noop */ }
    setToken('');
  }, []);

  if (!token) return <Gate onEnter={setToken} />;
  return <Inbox token={token} onLogout={logout} />;
}
