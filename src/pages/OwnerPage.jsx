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

// Prioridad que sugiere el enriquecimiento (qué tan buen fit es para Pazque).
const PRIORIDAD = {
  alta:  { label: 'Fit alto',  bg: C.greenBg, fg: C.green },
  media: { label: 'Fit medio', bg: C.amberBg, fg: C.amber },
  baja:  { label: 'Fit bajo',  bg: '#f3f4f6', fg: C.faint },
};

function fuenteOf(l) {
  if (l.utm_source || l.utm_campaign) return [l.utm_source, l.utm_campaign].filter(Boolean).join(' · ');
  if (l.fbclid) return 'Meta Ads';
  if (l.gclid)  return 'Google Ads';
  if (l.referrer) { try { return new URL(l.referrer).hostname.replace(/^www\./,''); } catch { return l.referrer; } }
  return 'Directo';
}

// Link de WhatsApp con el mensaje ya cargado. Federico solo revisa y da enviar.
function waLink(tel, mensaje) {
  const num = String(tel || '').replace(/\D/g, '');
  if (num.length < 8) return null;
  const base = `https://wa.me/${num}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

function fmtDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

// Días enteros transcurridos desde una fecha (para "le escribiste hace X días").
function diasDesde(s) {
  if (!s) return null;
  const ms = Date.now() - new Date(s).getTime();
  if (isNaN(ms)) return null;
  return Math.floor(ms / 86400000);
}

// Un prospecto "toca seguir" si está activo (contactado/demo), ya le escribiste
// alguna vez y la fecha del próximo toque (seguir_desde) ya pasó.
const ACTIVOS_SEGUIBLES = ['contactado', 'demo'];
function tocaSeguir(l) {
  if (!ACTIVOS_SEGUIBLES.includes(l.estado)) return false;
  if (!l.ultimo_contacto_at) return false;
  if (!l.seguir_desde) return true; // le escribiste pero no hay próximo toque agendado
  return new Date(l.seguir_desde).getTime() <= Date.now();
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
    else setErr('No pudimos enviar el código en este momento. Volvé a intentar en unos segundos.');
  };

  const verify = async (e) => {
    e.preventDefault();
    const c = code.trim().replace(/\D/g, '');
    if (c.length !== 6) { setErr('El código tiene 6 dígitos.'); return; }
    setBusy(true); setErr('');
    const { ok, status, data } = await ownerFetch({ action: 'verify-code', email: email.trim().toLowerCase(), code: c });
    setBusy(false);
    if (ok && data?.token) {
      try { localStorage.setItem(TOKEN_LS, data.token); } catch { /* noop */ }
      onEnter(data.token);
      return;
    }
    setErr(status === 401 ? 'El código no es válido o ya expiró. Pedí uno nuevo.' : 'No pudimos verificar el código. Volvé a intentar.');
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
              Ingresá a tu panel
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 22 }}>
              Por tu seguridad, te enviamos un código de acceso a tu correo. Sin contraseñas.
            </div>
            <input type="email" value={email} autoFocus placeholder="Tu correo electrónico"
              onChange={e => setEmail(e.target.value)} style={inputStyle} />
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button type="submit" disabled={busy} style={btnStyle(busy)}>
              {busy ? 'Enviando código…' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div style={{ fontFamily: C.serif, fontSize: 28, fontWeight: 400, color: C.ink, lineHeight: 1.15, marginBottom: 6 }}>
              Revisá tu correo
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 22 }}>
              Enviamos un código de 6 dígitos a <strong>{email}</strong>. Ingresalo para continuar.
            </div>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
              autoFocus placeholder="000000" maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 600 }} />
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button type="submit" disabled={busy} style={btnStyle(busy)}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setErr(''); }} style={{
              width: '100%', marginTop: 10, fontSize: 13, color: C.sub, background: 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: C.sans }}>
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Panel con lo que el agente infirió del prospecto (peldaño 1b, solo lectura).
function EnrichPanel({ e }) {
  if (!e) return null;
  const prio = PRIORIDAD[e.prioridad] || PRIORIDAD.media;
  const bits = [e.rubro && e.rubro !== 'sin datos' ? e.rubro : null,
                e.tamano && e.tamano !== 'sin datos' ? `Tamaño ${e.tamano}` : null].filter(Boolean);
  return (
    <div style={{ background: C.greenSoft, border: `1px solid ${C.green}22`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: e.angulo ? 6 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: .3 }}>✨ ANÁLISIS</span>
        <span style={{ background: prio.bg, color: prio.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>{prio.label}</span>
        {bits.length > 0 && <span style={{ fontSize: 12.5, color: C.sub }}>{bits.join(' · ')}</span>}
      </div>
      {e.angulo && <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{e.angulo}</div>}
      {Array.isArray(e.senales) && e.senales.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {e.senales.map((s, i) => (
            <span key={i} style={{ fontSize: 11.5, color: C.sub, background: C.card, border: `1px solid ${C.line}`, borderRadius: 50, padding: '2px 9px' }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de prospecto ─────────────────────────────────────────────
function LeadCard({ l, onUpdate, onEnrich, onFollowUp, onReply, busy, enriching, drafting, replying }) {
  const [notas, setNotas]   = React.useState(l.notas || '');
  const [editing, setEditing] = React.useState(false);
  const est = ESTADO[l.estado] || ESTADO.nuevo;
  const idx = FLUJO.indexOf(l.estado);
  const next = idx >= 0 && idx < 3 ? FLUJO[idx + 1] : null; // avanza hasta "convertido"
  const msgWa = l.enriquecimiento?.mensaje_wa || '';
  // Loop de aprendizaje: el mensaje es EDITABLE antes de mandar. 'draft' arranca
  // en el borrador del agente; si Federico lo ajusta acá, el botón de WhatsApp usa
  // su versión y, al marcar "Ya le escribí", guardamos borrador vs final.
  const [draft, setDraft] = React.useState(msgWa);
  // Si el agente re-genera el mensaje (re-analizar), refrescamos el editor.
  React.useEffect(() => { setDraft(msgWa); }, [msgWa]);
  const whref = waLink(l.tel, draft || msgWa);
  // ¿Ya lo contactó y falta registrar si contestó? (señal de oro del loop)
  const yaContactado = !!l.ultimo_contacto_at;
  const faltaResultado = yaContactado && (l.respondio === null || l.respondio === undefined);
  const dias = diasDesde(l.ultimo_contacto_at);
  const seguir = tocaSeguir(l);

  // Punto 1 — seguimiento redactado. 'segDraft' arranca en el mensaje que dejó el
  // agente (si lo hay) y es editable antes de mandar, igual que el primero.
  const [segDraft, setSegDraft] = React.useState(l.seguimiento_mensaje || '');
  React.useEffect(() => { setSegDraft(l.seguimiento_mensaje || ''); }, [l.seguimiento_mensaje]);
  const segHref = waLink(l.tel, segDraft || l.seguimiento_mensaje);
  const proximoToque = (Number(l.toques) || 1) + 1;
  // Mostramos el seguimiento cuando toca seguir y ya confirmó que NO contestó.
  const puedeSeguir = seguir && l.respondio === false;

  // Punto 2 — ayuda para responder cuando el prospecto SÍ contestó. Efímero.
  const contesto = l.respondio === true;
  const [replyIn, setReplyIn]   = React.useState('');
  const [replyOut, setReplyOut] = React.useState('');
  const replyHref = waLink(l.tel, replyOut);

  // Atribución: link de auto-registro de ESTE prospecto. Si entra por acá, la
  // prueba queda conectada al lead (lo ves como "inició prueba"). Usamos el host
  // actual (sirve igual en preview que en pazque.com).
  const regLink = `${window.location.origin}/register?ref=${l.id}`;
  const [copiedReg, setCopiedReg] = React.useState(false);
  const copyReg = () => {
    try { navigator.clipboard.writeText(regLink); setCopiedReg(true); setTimeout(() => setCopiedReg(false), 1600); }
    catch { /* clipboard no disponible: el link igual se ve en el title */ }
  };
  const inicioPrueba = !!l.inicio_prueba_at;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{l.nombre}</span>
            <span style={{ background: est.bg, color: est.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>{est.label}</span>
            {seguir && (
              <span style={{ background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 50 }}>⏰ Seguí hoy</span>
            )}
            {inicioPrueba && (
              <span title={`Se registró e inició la prueba el ${fmtDate(l.inicio_prueba_at)}`}
                style={{ background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 50 }}>
                ✅ Inició prueba
              </span>
            )}
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
            {dias != null && (
              <span title="Última vez que le escribiste" style={{ color: seguir ? C.amber : C.faint, fontWeight: seguir ? 600 : 400 }}>
                💬 {dias === 0 ? 'Le escribiste hoy' : `Hace ${dias} día${dias === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {whref && (
            <a href={whref} target="_blank" rel="noopener noreferrer"
              title={msgWa ? 'Abre WhatsApp con el mensaje de apertura ya escrito. Revisalo y dale enviar.' : 'Abre el chat de WhatsApp'}
              style={{ fontSize: 13, fontWeight: 600, color: msgWa ? '#fff' : C.green,
                background: msgWa ? C.green : 'transparent', textDecoration: 'none',
                border: `1px solid ${msgWa ? C.green : C.green + '55'}`, borderRadius: 50, padding: '7px 14px' }}>
              {msgWa ? 'Abrir en WhatsApp' : 'WhatsApp'}
            </a>
          )}
          {l.email && (
            <a href={`mailto:${l.email}`}
              style={{ fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: 'none',
                border: `1px solid ${C.blue}55`, borderRadius: 50, padding: '7px 14px' }}>
              Email
            </a>
          )}
          {!inicioPrueba && (
            <button onClick={copyReg} title={`Copia el link de auto-registro de este prospecto:\n${regLink}\nSi entra por acá, la prueba queda atribuida a este lead.`}
              style={{ fontSize: 13, fontWeight: 600, color: copiedReg ? '#fff' : C.sub,
                background: copiedReg ? C.green : 'transparent', cursor: 'pointer', fontFamily: C.sans,
                border: `1px solid ${copiedReg ? C.green : C.line}`, borderRadius: 50, padding: '7px 14px' }}>
              {copiedReg ? '✓ Copiado' : '🔗 Link de registro'}
            </button>
          )}
        </div>
      </div>

      {/* Análisis del agente (peldaño 1b) */}
      {l.enriquecimiento && <EnrichPanel e={l.enriquecimiento} />}

      {/* Mensaje de WhatsApp — EDITABLE (loop de aprendizaje peldaño 3).
          Federico lo ajusta acá; el botón de WhatsApp manda su versión y el agente
          aprende de lo que corrige. */}
      {msgWa && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.faint, letterSpacing: .4 }}>MENSAJE DE WHATSAPP</span>
            <span style={{ fontSize: 11.5, color: C.sub }}>— editalo si querés antes de mandar</span>
            {draft.trim() !== msgWa.trim() && (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, borderRadius: 50, padding: '1px 8px' }}>editado</span>
            )}
          </div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.ink, lineHeight: 1.5,
              fontFamily: C.sans, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 11px',
              resize: 'vertical', background: C.bg }} />
          {draft.trim() !== msgWa.trim() && (
            <button onClick={() => setDraft(msgWa)} style={{
              fontSize: 12, color: C.sub, background: 'transparent', border: 'none',
              cursor: 'pointer', fontFamily: C.sans, marginTop: 4, padding: 0 }}>
              ↺ Volver al borrador del agente
            </button>
          )}
        </div>
      )}

      {/* Loop de aprendizaje — señal de oro: ¿contestó el prospecto? */}
      {faltaResultado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: C.greenSoft, border: `1px solid ${C.green}22`, borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>¿Te respondió?</span>
          <span style={{ fontSize: 12, color: C.sub }}>Así el agente aprende qué mensajes funcionan.</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={() => onUpdate(l.id, { respondio: true })} disabled={busy} style={{
              fontSize: 13, fontWeight: 600, color: '#fff', background: busy ? '#b0b0a8' : C.green,
              border: 'none', borderRadius: 50, padding: '7px 14px', cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
              👍 Sí, contestó
            </button>
            <button onClick={() => onUpdate(l.id, { respondio: false })} disabled={busy} style={{
              fontSize: 13, fontWeight: 600, color: C.sub, background: C.card,
              border: `1px solid ${C.line}`, borderRadius: 50, padding: '7px 14px', cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
              👎 Todavía no
            </button>
          </div>
        </div>
      )}

      {/* Punto 1 — seguimiento redactado. La plata está en el toque 2 al 5: no
          contestó, acá tenés el próximo mensaje listo (otro ángulo, más corto). */}
      {puedeSeguir && (
        <div style={{ background: C.amberBg, border: `1px solid ${C.amber}33`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: l.seguimiento_mensaje ? 8 : 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber, letterSpacing: .4 }}>⏰ SEGUIMIENTO · TOQUE {proximoToque}</span>
            <span style={{ fontSize: 11.5, color: C.sub }}>No contestó todavía. Este es el próximo toque, listo para revisar y mandar.</span>
          </div>
          {l.seguimiento_mensaje ? (
            <>
              <textarea value={segDraft} onChange={e => setSegDraft(e.target.value)} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.ink, lineHeight: 1.5,
                  fontFamily: C.sans, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 11px',
                  resize: 'vertical', background: C.card }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {segHref && (
                  <a href={segHref} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 13, fontWeight: 600, color: '#fff', background: C.green, textDecoration: 'none',
                    border: `1px solid ${C.green}`, borderRadius: 50, padding: '7px 14px' }}>
                    Abrir en WhatsApp
                  </a>
                )}
                <button onClick={() => onUpdate(l.id, { marcar_contacto: true })} disabled={busy}
                  title="Registra el toque y agenda el próximo seguimiento." style={{
                  fontSize: 13, fontWeight: 600, color: C.ink, background: C.card,
                  border: `1px solid ${C.line}`, borderRadius: 50, padding: '7px 14px',
                  cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
                  ✓ Ya le seguí
                </button>
                <button onClick={() => onFollowUp(l.id)} disabled={drafting} style={{
                  fontSize: 13, color: C.sub, background: 'transparent', border: 'none',
                  cursor: drafting ? 'default' : 'pointer', fontFamily: C.sans }}>
                  {drafting ? 'Redactando…' : '↻ Probar otro'}
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => onFollowUp(l.id)} disabled={drafting} style={{
              fontSize: 13, fontWeight: 600, color: C.amber, background: C.card,
              border: `1px solid ${C.amber}55`, borderRadius: 50, padding: '8px 14px',
              cursor: drafting ? 'default' : 'pointer', fontFamily: C.sans, marginTop: 8 }}>
              {drafting ? 'Redactando…' : '✍️ Redactar seguimiento'}
            </button>
          )}
        </div>
      )}

      {/* Punto 2 — te contestó: ayuda para responder la objeción. Efímero: pegás
          lo que te dijo y el agente te arma la contrarréplica (no se guarda). */}
      {contesto && (
        <div style={{ background: C.greenSoft, border: `1px solid ${C.green}22`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.green, letterSpacing: .4 }}>💬 TE CONTESTÓ — AYUDA PARA RESPONDER</span>
          </div>
          <textarea value={replyIn} onChange={e => setReplyIn(e.target.value)} rows={2}
            placeholder="Pegá acá lo que te dijo (ej: “ya tengo un sistema”, “¿cuánto sale?”, “mandame info”)."
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.ink, lineHeight: 1.5,
              fontFamily: C.sans, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 11px',
              resize: 'vertical', background: C.card }} />
          <div style={{ marginTop: 8 }}>
            <button onClick={async () => { const r = await onReply(l.id, replyIn); if (r) setReplyOut(r); }}
              disabled={replying || !replyIn.trim()} style={{
              fontSize: 13, fontWeight: 600, color: '#fff', background: (replying || !replyIn.trim()) ? '#b0b0a8' : C.green,
              border: 'none', borderRadius: 50, padding: '8px 14px',
              cursor: (replying || !replyIn.trim()) ? 'default' : 'pointer', fontFamily: C.sans }}>
              {replying ? 'Redactando…' : 'Redactar respuesta'}
            </button>
          </div>
          {replyOut && (
            <div style={{ marginTop: 10 }}>
              <textarea value={replyOut} onChange={e => setReplyOut(e.target.value)} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.ink, lineHeight: 1.5,
                  fontFamily: C.sans, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 11px',
                  resize: 'vertical', background: C.card }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {replyHref && (
                  <a href={replyHref} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 13, fontWeight: 600, color: '#fff', background: C.green, textDecoration: 'none',
                    border: `1px solid ${C.green}`, borderRadius: 50, padding: '7px 14px' }}>
                    Abrir en WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Acciones de estado + notas */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <button onClick={() => onEnrich(l.id)} disabled={enriching} title="El agente lee el prospecto y sugiere rubro, tamaño y ángulo de venta" style={{
          fontSize: 13, fontWeight: 600, color: C.green, background: C.greenSoft,
          border: `1px solid ${C.green}33`, borderRadius: 50, padding: '8px 14px',
          cursor: enriching ? 'default' : 'pointer', fontFamily: C.sans, opacity: enriching ? .6 : 1 }}>
          {enriching ? 'Analizando…' : (l.enriquecimiento ? '↻ Re-analizar' : '✨ Enriquecer')}
        </button>
        {l.estado !== 'descartado' && l.estado !== 'convertido' && (
          <button onClick={() => onUpdate(l.id, {
              marcar_contacto: true,
              // Guardamos lo que realmente mandó (editado o no) + el borrador original:
              // es la señal que el agente usa para aprender su estilo y correcciones.
              ...(msgWa ? { mensaje_final: draft, mensaje_borrador: msgWa } : {}),
            })} disabled={busy}
            title="Registra que ya le escribiste. Te lo recuerdo para seguirlo en unos días." style={{
            fontSize: 13, fontWeight: 600, color: C.ink, background: C.card,
            border: `1px solid ${C.line}`, borderRadius: 50, padding: '8px 14px',
            cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
            ✓ Ya le escribí
          </button>
        )}
        {seguir && (
          <button onClick={() => onUpdate(l.id, { posponer: 3 })} disabled={busy}
            title="Posponer el seguimiento 3 días" style={{
            fontSize: 13, color: C.sub, background: 'transparent', border: `1px solid ${C.line}`,
            borderRadius: 50, padding: '8px 14px', cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
            Posponer 3 días
          </button>
        )}
        {next && (
          <button onClick={() => onUpdate(l.id, { estado: next })} disabled={busy} style={{
            fontSize: 13, fontWeight: 600, color: '#fff', background: busy ? '#b0b0a8' : C.ink,
            border: 'none', borderRadius: 50, padding: '8px 16px', cursor: busy ? 'default' : 'pointer', fontFamily: C.sans }}>
            Marcar como {ESTADO[next].label.toLowerCase()}
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
            placeholder="Anotá lo que hablaron y los próximos pasos del seguimiento."
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

// Link fijo a la landing, copiable de un clic. Para pasarle la web al prospecto
// cuando engancha, sin depender de que la IA lo redacte cada vez.
function CopyLink() {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText('https://pazque.com'); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* noop */ }
  };
  return (
    <button onClick={copy} title="Copiar el link de la web para pasárselo al prospecto" style={{
      fontSize: 12.5, fontWeight: 600, color: copied ? C.green : C.sub, background: copied ? C.greenSoft : C.card,
      border: `1px solid ${copied ? C.green + '55' : C.line}`, borderRadius: 50, padding: '6px 12px',
      cursor: 'pointer', fontFamily: C.sans }}>
      {copied ? '✓ Copiado' : '🔗 pazque.com'}
    </button>
  );
}

// ── Métricas del agente (peldaño c) ──────────────────────────────────
// Mide con datos REALES (lo que Federico marcó: contacto + ¿respondió? + edición)
// si el agente está funcionando. Tres preguntas que importan:
//   1) ¿Qué tasa de respuesta estoy teniendo? (termómetro general)
//   2) ¿El "fit" que predice el agente se traduce en respuestas? (¿acierta?)
//   3) ¿Editar el mensaje a mano ayuda a que respondan? (¿vale la pena editar?)
// Todo se calcula acá, en el cliente, desde los leads que ya cargamos: nada de
// inventar, cero llamadas extra al server.
function pct(num, den) { return den > 0 ? Math.round((num / den) * 100) : null; }

const FIT_META = {
  alta:  { label: 'Fit alto',  fg: C.green },
  media: { label: 'Fit medio', fg: C.amber },
  baja:  { label: 'Fit bajo',  fg: C.faint },
};

// Barrita de tasa de respuesta (resp / contactados) con su porcentaje.
function RateRow({ label, labelColor, cont, resp }) {
  const p = pct(resp, cont);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: labelColor || C.ink, minWidth: 92, fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 7, background: C.line, borderRadius: 50, overflow: 'hidden' }}>
        <div style={{ width: `${p || 0}%`, height: '100%', background: C.green, borderRadius: 50,
          transition: 'width 320ms cubic-bezier(0.23,1,0.32,1)' }} />
      </div>
      <span style={{ fontSize: 12.5, color: C.sub, minWidth: 74, textAlign: 'right' }}>
        {p == null ? '—' : `${p}%`} <span style={{ color: C.faint }}>({resp}/{cont})</span>
      </span>
    </div>
  );
}

// ── RevOps: el embudo de ventas de Pazque ────────────────────────────
// La foto de dónde están TODOS los prospectos: de prospectado a cliente, con
// el % que pasa de una etapa a la otra y cuánto tarda cada salto. Es el cimiento
// del equipo de ventas: sin estos números no se pueden construir los agentes de
// aprendizaje y de A/B que vienen después. Calcula todo acá en el navegador con
// los leads que ya están cargados — no agrega llamadas ni toca el servidor.
const DAY_MS = 86400000;
function avgDias(arr) {
  if (!arr.length) return null;
  return +(arr.reduce((a, b) => a + b, 0) / arr.length / DAY_MS).toFixed(1);
}
function tsOf(v) { const t = v ? Date.parse(v) : NaN; return Number.isNaN(t) ? null : t; }

function FunnelPanel({ leads }) {
  const [open, setOpen] = React.useState(false);

  const f = React.useMemo(() => {
    const esContactado = (l) => (l.toques || 0) > 0 || !!l.ultimo_contacto_at ||
      ['contactado', 'demo', 'convertido'].includes(l.estado);
    const esRespondio = (l) => l.respondio === true || ['demo', 'convertido'].includes(l.estado);
    const esConvertido = (l) => l.estado === 'convertido';

    const sourced = leads.length;
    const enriched = leads.filter(l => !!l.enriquecido_at).length;
    const contacted = leads.filter(esContactado).length;
    const replied = leads.filter(esRespondio).length;
    const converted = leads.filter(esConvertido).length;

    const etapas = [
      { etapa: 'Prospectados', total: sourced,   from: null },
      { etapa: 'Enriquecidos', total: enriched,  from: sourced },
      { etapa: 'Contactados',  total: contacted, from: enriched },
      { etapa: 'Respondieron', total: replied,   from: contacted },
      { etapa: 'Clientes',     total: converted, from: replied },
    ].map(e => ({ ...e, conv: e.from == null ? null : pct(e.total, e.from), ancho: sourced ? Math.round((e.total / sourced) * 100) : 0 }));

    // Velocidad: días promedio por salto, sólo sobre los que efectivamente saltaron.
    const dEnrich = [], dContact = [], dReply = [], dConvert = [];
    for (const l of leads) {
      const c = tsOf(l.created_at), e = tsOf(l.enriquecido_at),
        k = tsOf(l.ultimo_contacto_at), rp = tsOf(l.respondio_at), u = tsOf(l.updated_at);
      if (c && e && e >= c) dEnrich.push(e - c);
      if (e && k && k >= e) dContact.push(k - e);
      if (k && rp && rp >= k) dReply.push(rp - k);
      if (c && esConvertido(l) && u && u >= c) dConvert.push(u - c);
    }
    const velocidad = [
      { label: 'Prospectar → enriquecer', dias: avgDias(dEnrich) },
      { label: 'Enriquecer → contactar',  dias: avgDias(dContact) },
      { label: 'Contactar → respuesta',   dias: avgDias(dReply) },
      { label: 'Prospectar → cliente',    dias: avgDias(dConvert) },
    ].filter(v => v.dias != null);

    const now = Date.now();
    const nuevosEn = (d) => leads.filter(l => { const c = tsOf(l.created_at); return c && (now - c) <= d * DAY_MS; }).length;

    // A/B: tasa de respuesta por molde de mensaje (solo cuentan los contactados).
    const byVar = {};
    for (const l of leads) {
      if (!l.variante) continue;
      const v = (byVar[l.variante] ||= { variante: l.variante, cont: 0, resp: 0 });
      if (esContactado(l)) v.cont += 1;
      if (esRespondio(l))  v.resp += 1;
    }
    const variantes = Object.values(byVar)
      .map(v => ({ ...v, tasa: pct(v.resp, v.cont) }))
      .sort((a, b) => b.tasa - a.tasa);
    const hayAB = variantes.some(v => v.cont > 0);

    return { etapas, velocidad, sem: nuevosEn(7), mes: nuevosEn(30), sourced, variantes, hayAB };
  }, [leads]);

  const VLABEL = { observacion: 'Molde A · con observación', directo: 'Molde B · directo' };

  const wrap = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 };

  if (f.sourced === 0) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Embudo de ventas</div>
        <div style={{ fontSize: 12.5, color: C.sub }}>
          Cuando el agente sume prospectos vas a ver acá el embudo completo: de prospectado a cliente, con el % que pasa cada etapa.
        </div>
      </div>
    );
  }

  const clientes = f.etapas[f.etapas.length - 1].total;
  const convTotal = pct(clientes, f.sourced);

  return (
    <div style={wrap}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent',
        border: 'none', padding: 0, cursor: 'pointer', fontFamily: C.sans, textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Embudo de ventas</span>
        <span style={{ fontSize: 13, color: C.sub }}>
          <strong style={{ color: C.ink }}>{f.sourced}</strong> prospectos
          {clientes > 0 && <> · <strong style={{ color: C.green }}>{clientes} cliente{clientes === 1 ? '' : 's'}</strong>
            {convTotal != null && <span style={{ color: C.faint }}> ({convTotal}%)</span>}</>}
        </span>
        {f.sem > 0 && <span style={{ fontSize: 12.5, color: C.sub }}>· +{f.sem} esta semana</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.faint }}>{open ? 'ocultar ▲' : 'ver detalle ▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Embudo: cada etapa como barra, con el % que pasó de la anterior */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {f.etapas.map((e, i) => (
              <div key={e.etapa} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: C.ink, minWidth: 104, fontWeight: 500 }}>{e.etapa}</span>
                <div style={{ flex: 1, height: 22, background: C.bg, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.line}` }}>
                  <div style={{ width: `${Math.max(e.ancho, e.total > 0 ? 3 : 0)}%`, height: '100%',
                    background: i === f.etapas.length - 1 ? C.green : C.greenDeep, opacity: 1 - i * 0.14,
                    borderRadius: 5, transition: 'width 360ms cubic-bezier(0.23,1,0.32,1)' }} />
                </div>
                <span style={{ fontSize: 12.5, color: C.sub, minWidth: 88, textAlign: 'right' }}>
                  <strong style={{ color: C.ink }}>{e.total}</strong>
                  {e.conv != null && <span style={{ color: C.faint }}> · {e.conv}% ↓</span>}
                </span>
              </div>
            ))}
          </div>

          {f.velocidad.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: .3, marginBottom: 8 }}>
                VELOCIDAD — DÍAS PROMEDIO POR SALTO
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {f.velocidad.map(v => (
                  <div key={v.label} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 11px' }}>
                    <div style={{ fontSize: 11.5, color: C.sub }}>{v.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{v.dias} <span style={{ fontSize: 11.5, fontWeight: 400, color: C.faint }}>días</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {f.hayAB && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: .3, marginBottom: 8 }}>
                QUÉ MENSAJE FUNCIONA MEJOR — TASA DE RESPUESTA POR MOLDE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {f.variantes.map((v, i) => (
                  <div key={v.variante} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: C.ink, flex: 1 }}>
                      {VLABEL[v.variante] || v.variante}
                      {i === 0 && v.cont > 0 && v.tasa > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: C.green,
                          background: C.greenBg || '#f0fdf4', borderRadius: 50, padding: '1px 8px' }}>mejor</span>
                      )}
                    </span>
                    <span style={{ fontSize: 12.5, color: C.sub }}>
                      {v.resp}/{v.cont} respondieron · <strong style={{ color: C.ink }}>{v.tasa}%</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: C.sub }}>
            <span>Prospectos nuevos — <strong style={{ color: C.ink }}>{f.sem}</strong> últimos 7 días</span>
            <span><strong style={{ color: C.ink }}>{f.mes}</strong> últimos 30 días</span>
          </div>

          <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
            El % de cada barra es cuántos pasaron desde la etapa de arriba. La velocidad se mide sólo sobre los que ya dieron ese salto.
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsPanel({ leads }) {
  const [open, setOpen] = React.useState(false);

  const m = React.useMemo(() => {
    const contactados = leads.filter(l => l.ultimo_contacto_at);
    const respondieron = contactados.filter(l => l.respondio === true).length;
    const demos = leads.filter(l => l.estado === 'demo' || l.estado === 'convertido').length;
    const clientes = leads.filter(l => l.estado === 'convertido').length;
    // El norte del agente: cuántos se registraron e iniciaron la prueba solos.
    const pruebas = leads.filter(l => l.inicio_prueba_at).length;

    // Por fit (lo que el agente predijo) → ¿se traduce en respuestas reales?
    const porFit = ['alta', 'media', 'baja'].map(p => {
      const g = contactados.filter(l => (l.enriquecimiento?.prioridad || 'media') === p);
      return { fit: p, cont: g.length, resp: g.filter(l => l.respondio === true).length };
    }).filter(x => x.cont > 0);

    // Por rubro (top 5 por volumen de contactados).
    const rubroMap = {};
    for (const l of contactados) {
      const ru = (l.enriquecimiento?.rubro && l.enriquecimiento.rubro !== 'sin datos')
        ? l.enriquecimiento.rubro : (l.rubro || 'Sin rubro');
      (rubroMap[ru] ||= { rubro: ru, cont: 0, resp: 0 }).cont++;
      if (l.respondio === true) rubroMap[ru].resp++;
    }
    const porRubro = Object.values(rubroMap).sort((a, b) => b.cont - a.cont).slice(0, 5);

    // ¿Editar el mensaje ayuda? Tal cual vs editado, sobre los que tienen mensaje final.
    const conMsg = contactados.filter(l => l.mensaje_final);
    const grp = (ed) => {
      const g = conMsg.filter(l => !!l.fue_editado === ed);
      return { cont: g.length, resp: g.filter(l => l.respondio === true).length };
    };

    return {
      contactados: contactados.length, respondieron, demos, clientes, pruebas,
      porFit, porRubro, edit: { talCual: grp(false), editado: grp(true) },
    };
  }, [leads]);

  const wrap = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 };

  if (m.contactados === 0) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Rendimiento</div>
        <div style={{ fontSize: 12.5, color: C.sub }}>
          A medida que marques contactos y respuestas, acá vas a ver tu tasa de respuesta y qué está funcionando.
        </div>
      </div>
    );
  }

  const tasa = pct(m.respondieron, m.contactados);
  const mostrarEdit = m.edit.talCual.cont > 0 || m.edit.editado.cont > 0;

  return (
    <div style={wrap}>
      {/* Resumen siempre visible: el termómetro general */}
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent',
        border: 'none', padding: 0, cursor: 'pointer', fontFamily: C.sans, textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Rendimiento</span>
        <span style={{ fontSize: 13, color: C.sub }}>
          <strong style={{ color: C.green }}>{tasa}% de respuesta</strong> · {m.respondieron} de {m.contactados} contactados
        </span>
        {m.demos > 0 && <span style={{ fontSize: 12.5, color: C.sub }}>· {m.demos} demo{m.demos === 1 ? '' : 's'}</span>}
        {m.pruebas > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.green }}>· {m.pruebas} {m.pruebas === 1 ? 'inició' : 'iniciaron'} prueba</span>}
        {m.clientes > 0 && <span style={{ fontSize: 12.5, color: C.green }}>· {m.clientes} cliente{m.clientes === 1 ? '' : 's'}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.faint }}>{open ? 'ocultar ▲' : 'ver detalle ▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {m.porFit.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: .3, marginBottom: 8 }}>
                ¿ACIERTA EL AGENTE? — RESPUESTA SEGÚN EL FIT QUE PREDIJO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.porFit.map(f => (
                  <RateRow key={f.fit} label={FIT_META[f.fit].label} labelColor={FIT_META[f.fit].fg} cont={f.cont} resp={f.resp} />
                ))}
              </div>
            </div>
          )}

          {mostrarEdit && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: .3, marginBottom: 8 }}>
                ¿CONVIENE EDITAR EL MENSAJE?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.edit.talCual.cont > 0 && <RateRow label="Tal cual" cont={m.edit.talCual.cont} resp={m.edit.talCual.resp} />}
                {m.edit.editado.cont > 0 && <RateRow label="Editado" cont={m.edit.editado.cont} resp={m.edit.editado.resp} />}
              </div>
            </div>
          )}

          {m.porRubro.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: .3, marginBottom: 8 }}>
                RESPUESTA POR RUBRO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.porRubro.map(r => (
                  <RateRow key={r.rubro} label={r.rubro} cont={r.cont} resp={r.resp} />
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
            Las tasas se calculan sobre prospectos que ya contactaste. Cuantos más marques, más confiables son.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Punto 3: Foco de hoy ─────────────────────────────────────────────
// Lo primero que ve Federico al entrar: qué mover HOY, ordenado por urgencia.
// No inventa trabajo — resume el que ya existe en la lista y lo lleva de un clic
// al filtro correcto. Si no hay nada pendiente, lo dice en calma (no ruido).
function FocoHoy({ pruebas, contesto, seguir, listos, onVerSeguir, onVerActivos, onVerPruebas }) {
  const items = [];
  // El norte del agente: alguien entró y arrancó la prueba solo. Va primero —
  // es el momento de oro para acompañar el arranque (red de seguridad humana).
  if (pruebas > 0) items.push({
    icon: '✅', fg: C.green, bg: C.greenSoft,
    txt: <><strong>{pruebas}</strong> inici{pruebas === 1 ? 'ó' : 'aron'} la prueba — acompañá el arranque antes de que se enfríe</>,
    cta: { label: 'Ver', onClick: onVerPruebas },
  });
  if (contesto > 0) items.push({
    icon: '💬', fg: C.green, bg: C.greenSoft,
    txt: <><strong>{contesto}</strong> te contest{contesto === 1 ? 'ó' : 'aron'} — respondé la objeción antes de que se enfríe</>,
    cta: { label: 'Ver', onClick: onVerActivos },
  });
  if (seguir > 0) items.push({
    icon: '⏰', fg: C.amber, bg: C.amberBg,
    txt: <><strong>{seguir}</strong> para seguir hoy — el próximo toque ya está redactado</>,
    cta: { label: 'Ver', onClick: onVerSeguir },
  });
  if (listos > 0) items.push({
    icon: '✨', fg: C.green, bg: C.greenSoft,
    txt: <><strong>{listos}</strong> fit alto sin contactar — los mejores para abrir primero</>,
    cta: { label: 'Ver', onClick: onVerActivos },
  });

  const wrap = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 };

  if (items.length === 0) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Foco de hoy</div>
        <div style={{ fontSize: 12.5, color: C.sub }}>Estás al día. El agente va a sumar más prospectos y seguimientos mañana.</div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Foco de hoy</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: it.bg, border: `1px solid ${it.fg}22`, borderRadius: 10, padding: '9px 12px' }}>
            <span style={{ fontSize: 15 }}>{it.icon}</span>
            <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>{it.txt}</span>
            {it.cta && (
              <button onClick={it.cta.onClick} style={{
                marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: it.fg, background: C.card,
                border: `1px solid ${it.fg}55`, borderRadius: 50, padding: '5px 13px',
                cursor: 'pointer', fontFamily: C.sans, whiteSpace: 'nowrap' }}>
                {it.cta.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bandeja ──────────────────────────────────────────────────────────
function Inbox({ token, onLogout }) {
  const [leads,   setLeads]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState('');
  const [busy,    setBusy]    = React.useState('');
  const [enriching, setEnriching] = React.useState('');
  const [drafting, setDrafting] = React.useState(''); // redactando seguimiento
  const [replying, setReplying] = React.useState(''); // redactando respuesta a objeción
  const [filtro,  setFiltro]  = React.useState('activos'); // activos | todos
  const [sourcing, setSourcing] = React.useState(false);
  const [srcMsg,   setSrcMsg]   = React.useState('');

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
    // Optimista: traducimos los flags de control (marcar_contacto/posponer) a los
    // campos reales que muestra la tarjeta, replicando lo que hace el server.
    const now = Date.now();
    const vista = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'marcar_contacto' || k === 'posponer') continue;
      vista[k] = v;
    }
    if (patch.marcar_contacto) {
      vista.ultimo_contacto_at = new Date(now).toISOString();
      vista.seguir_desde = new Date(now + 3 * 86400000).toISOString();
      vista.estado = patch.estado || 'contactado';
      // El servidor consume el seguimiento y resetea el resultado en cada toque.
      vista.seguimiento_mensaje = null;
      vista.seguimiento_generado_at = null;
      vista.respondio = null;
      vista.respondio_at = null;
    }
    if (patch.posponer != null) {
      vista.seguir_desde = new Date(now + (patch.posponer || 3) * 86400000).toISOString();
    }
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const merged = { ...l, ...vista };
      // El toque se cuenta al marcar contacto (el server lee+incrementa; acá reflejamos).
      if (patch.marcar_contacto) merged.toques = (Number(l.toques) || 0) + 1;
      return merged;
    }));
    const { ok, status } = await ownerFetch({ action: 'update', id, ...patch }, token);
    if (status === 401) { onLogout(); return; }
    if (!ok) await load(); // si falló, recargamos la verdad del server
    setBusy('');
  };

  const enrich = async (id) => {
    setEnriching(id);
    const { ok, status, data } = await ownerFetch({ action: 'enrich', id }, token);
    if (status === 401) { onLogout(); return; }
    if (ok && data?.enriquecimiento) {
      setLeads(prev => prev.map(l => l.id === id
        ? { ...l, enriquecimiento: data.enriquecimiento, enriquecido_at: data.enriquecido_at } : l));
    } else {
      setError(data?.error || 'No pudimos analizar ese prospecto.');
    }
    setEnriching('');
  };

  // Punto 1 — pide al agente el próximo toque de seguimiento y lo guarda.
  const followUp = async (id) => {
    setDrafting(id);
    const { ok, status, data } = await ownerFetch({ action: 'follow-up', id }, token);
    setDrafting('');
    if (status === 401) { onLogout(); return; }
    if (ok && data?.seguimiento_mensaje) {
      setLeads(prev => prev.map(l => l.id === id
        ? { ...l, seguimiento_mensaje: data.seguimiento_mensaje, seguimiento_generado_at: data.seguimiento_generado_at } : l));
    } else {
      setError(data?.error || 'No pudimos redactar el seguimiento.');
    }
  };

  // Punto 2 — pide una respuesta a la objeción. Efímero: devuelve el texto y no
  // toca la fila (cada conversación es distinta). La tarjeta lo muestra editable.
  const reply = async (id, prospectoDijo) => {
    setReplying(id);
    const { ok, status, data } = await ownerFetch({ action: 'reply', id, prospecto_dijo: prospectoDijo }, token);
    setReplying('');
    if (status === 401) { onLogout(); return ''; }
    if (ok && data?.respuesta) return data.respuesta;
    setError(data?.error || 'No pudimos redactar la respuesta.');
    return '';
  };

  const source = async (query) => {
    setSourcing(true); setSrcMsg('');
    const { ok, status, data } = await ownerFetch({ action: 'source', query }, token);
    if (status === 401) { onLogout(); return; }
    if (ok) {
      setSrcMsg(data.added > 0
        ? `Agregué ${data.added} distribuidora${data.added === 1 ? '' : 's'} nueva${data.added === 1 ? '' : 's'}. Enriquecé cada una para tener el mensaje listo.`
        : 'No encontré distribuidoras nuevas con esa búsqueda (las que salieron ya estaban en tu lista).');
      await load();
    } else {
      setSrcMsg(data?.error || 'No pudimos completar la búsqueda.');
    }
    setSourcing(false);
  };

  const activos = leads.filter(l => l.estado === 'nuevo' || l.estado === 'contactado' || l.estado === 'demo');
  const paraSeguir = leads.filter(tocaSeguir)
    .sort((a, b) => new Date(a.seguir_desde || 0) - new Date(b.seguir_desde || 0)); // más atrasado primero
  // Inició prueba y todavía no es cliente pago: están en la ventana de onboarding.
  const paraPruebas = leads.filter(l => l.inicio_prueba_at && l.estado !== 'convertido')
    .sort((a, b) => new Date(b.inicio_prueba_at || 0) - new Date(a.inicio_prueba_at || 0)); // más reciente primero
  const visibles = filtro === 'todos' ? leads
    : filtro === 'seguir' ? paraSeguir
    : filtro === 'pruebas' ? paraPruebas
    : activos;
  const nuevos = leads.filter(l => l.estado === 'nuevo').length;

  // Foco de hoy (punto 3): qué mover primero, calculado en el cliente.
  const focoPruebas = paraPruebas.length;
  const focoContesto = leads.filter(l => l.respondio === true && ACTIVOS_SEGUIBLES.includes(l.estado)).length;
  const focoListos = leads.filter(l => l.estado === 'nuevo' && l.enriquecimiento?.prioridad === 'alta').length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.sans, color: C.ink }}>
      <Fonts />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(16px,4vw,32px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: C.serif, fontSize: 30, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>Prospectos</h1>
            <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>
              Distribuidoras que pidieron una demo. Contactalas y llevá el seguimiento de cada una.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <CopyLink />
            <button onClick={onLogout} style={{
              fontSize: 12.5, color: C.faint, background: 'transparent', border: `1px solid ${C.line}`,
              borderRadius: 50, padding: '6px 12px', cursor: 'pointer', fontFamily: C.sans }}>
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Foco de hoy: lo primero que hay que mover (punto 3) */}
        {!loading && !error && leads.length > 0 && (
          <FocoHoy pruebas={focoPruebas} contesto={focoContesto} seguir={paraSeguir.length} listos={focoListos}
            onVerSeguir={() => setFiltro('seguir')} onVerActivos={() => setFiltro('activos')}
            onVerPruebas={() => setFiltro('pruebas')} />
        )}

        {/* RevOps: el embudo completo de prospectado a cliente (dónde están todos) */}
        {!loading && !error && <FunnelPanel leads={leads} />}

        {/* Métricas: ¿está funcionando el agente? (datos reales de Federico) */}
        {!loading && !error && <MetricsPanel leads={leads} />}

        {/* Sourcing: el agente busca distribuidoras reales en Google */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Buscar distribuidoras</span>
            <span style={{ fontSize: 12.5, color: C.sub }}>El agente busca en Google y las suma a tu lista. Vos elegís a quién escribirle.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['Mayoristas', 'distribuidoras mayoristas en Uruguay'],
              ['Alimentos', 'distribuidoras de alimentos en Uruguay'],
              ['Bebidas', 'distribuidoras de bebidas en Uruguay'],
              ['Limpieza', 'distribuidoras de productos de limpieza en Uruguay'],
              ['Cosmética', 'distribuidoras de cosmética y perfumería en Uruguay'],
            ].map(([lbl, q]) => (
              <button key={lbl} onClick={() => source(q)} disabled={sourcing} style={{
                fontSize: 13, fontWeight: 500, color: sourcing ? C.faint : C.ink, background: C.bg,
                border: `1px solid ${C.line}`, borderRadius: 50, padding: '7px 14px',
                cursor: sourcing ? 'default' : 'pointer', fontFamily: C.sans }}>
                {lbl}
              </button>
            ))}
          </div>
          {(sourcing || srcMsg) && (
            <div style={{ fontSize: 12.5, color: sourcing ? C.faint : C.green, marginTop: 10 }}>
              {sourcing ? 'Buscando distribuidoras…' : srcMsg}
            </div>
          )}
        </div>

        {/* Filtro */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ...(paraPruebas.length ? [['pruebas', `✅ Inició prueba (${paraPruebas.length})`]] : []),
            ['seguir',  `⏰ Para seguir${paraSeguir.length ? ` (${paraSeguir.length})` : ''}`],
            ['activos', `Activos${nuevos ? ` (${nuevos})` : ''}`],
            ['todos',   `Todos (${leads.length})`],
          ].map(([id, lbl]) => {
            const sel = filtro === id;
            const alert = id === 'seguir' && paraSeguir.length > 0;
            const win = id === 'pruebas';
            return (
              <button key={id} onClick={() => setFiltro(id)} style={{
                padding: '6px 14px', borderRadius: 50, fontSize: 13, fontFamily: C.sans, cursor: 'pointer', fontWeight: 500,
                border: `1px solid ${sel ? (win ? C.green : alert ? C.amber : C.ink) : (win ? C.green + '55' : alert ? C.amber + '55' : C.line)}`,
                background: sel ? (win ? C.green : alert ? C.amber : C.ink) : C.card,
                color: sel ? '#fff' : (win ? C.green : alert ? C.amber : C.sub) }}>
                {lbl}
              </button>
            );
          })}
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
              Cuando una distribuidora pida una demo desde tu sitio, vas a verla acá con la campaña por la que llegó.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibles.map(l => (
              <LeadCard key={l.id} l={l} onUpdate={update} onEnrich={enrich}
                onFollowUp={followUp} onReply={reply}
                busy={busy === l.id} enriching={enriching === l.id}
                drafting={drafting === l.id} replying={replying === l.id} />
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
