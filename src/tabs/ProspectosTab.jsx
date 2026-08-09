import React from 'react';
import { getAuthHeaders } from '../lib/constants.js';

// ProspectosTab — Bandeja de prospectos captados por el portal (Camino B).
// ----------------------------------------------------------------------------
// Lista a quienes dejaron sus datos en la landing (?org=) sin ser clientes aún,
// con la FUENTE de campaña (utm/fbclid/gclid) para saber de qué anuncio vinieron.
// Desde acá el admin los aprueba → se crean como cliente, o los descarta.
// Arriba, un switch prende/apaga la captación para SU org (flag genérico por-org).
//
// Todo el acceso pasa por api/lead.js con el JWT del admin (getAuthHeaders).

const C = {
  ink: '#1a1a18', sub: '#6a6a68', faint: '#9a9a98',
  line: '#ecebe6', bg: '#faf9f6', card: '#ffffff',
  blue: '#2563eb', blueBg: '#eff6ff',
  green: '#059669', greenBg: '#f0fdf4',
  red: '#dc2626', redBg: '#fef2f2',
  amber: '#d97706', amberBg: '#fffbeb',
  sans: "'Inter',system-ui,sans-serif",
};

function fuenteOf(l) {
  if (l.utm_source || l.utm_campaign) return [l.utm_source, l.utm_campaign].filter(Boolean).join(' · ');
  if (l.fbclid) return 'Meta Ads';
  if (l.gclid)  return 'Google Ads';
  if (l.referrer) { try { return new URL(l.referrer).hostname.replace(/^www\./,''); } catch { return l.referrer; } }
  return 'Directo';
}

const ESTADO = {
  nuevo:      { label: 'Nuevo',      bg: C.blueBg,  fg: C.blue },
  contactado: { label: 'Contactado', bg: C.amberBg, fg: C.amber },
  convertido: { label: 'Cliente',    bg: C.greenBg, fg: C.green },
  descartado: { label: 'Descartado', bg: '#f3f4f6', fg: C.faint },
};

const PRIOR = {
  alta:  { label: 'Prioridad alta',  bg: C.greenBg, fg: C.green },
  media: { label: 'Prioridad media', bg: C.amberBg, fg: C.amber },
  baja:  { label: 'Prioridad baja',  bg: '#f3f4f6', fg: C.faint },
};

function waLink(tel, msg) {
  const num = String(tel || '').replace(/\D/g, '');
  const q = msg ? `?text=${encodeURIComponent(msg)}` : '';
  return num ? `https://wa.me/${num}${q}` : '';
}

function fmtDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

export default function ProspectosTab() {
  const [leads,   setLeads]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState('');
  const [activa,  setActiva]  = React.useState(false);
  const [phone,   setPhone]   = React.useState('');   // teléfono de notificación WhatsApp
  const [savedPh, setSavedPh] = React.useState('');   // último valor guardado (para detectar cambios)
  const [email,   setEmail]   = React.useState('');   // mail de notificación (opcional)
  const [savedEm, setSavedEm] = React.useState('');
  const [busy,    setBusy]    = React.useState('');   // id en proceso
  const [filtro,  setFiltro]  = React.useState('activos'); // activos | todos

  // Sourcing por-org: buscar comercios reales del rubro del cliente.
  const [srcCfg,     setSrcCfg]     = React.useState({ rubros: [], ciudad: '', tope: 20, usadas: 0 });
  const [srcBusy,    setSrcBusy]    = React.useState('');  // rubro buscándose
  const [srcMsg,     setSrcMsg]     = React.useState('');
  const [editRubros, setEditRubros] = React.useState(false);
  const [newRubro,   setNewRubro]   = React.useState('');
  const [ciudadIn,   setCiudadIn]   = React.useState('');
  const [enrichBusy, setEnrichBusy] = React.useState('');  // id enriqueciéndose
  const [openEnrich, setOpenEnrich] = React.useState('');  // id con panel abierto

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [lr, cr, sr] = await Promise.all([
        fetch('/api/lead?action=list',            { headers: getAuthHeaders() }),
        fetch('/api/lead?action=config',          { headers: getAuthHeaders() }),
        fetch('/api/lead?action=sourcing-config', { headers: getAuthHeaders() }),
      ]);
      if (!lr.ok) throw new Error('No se pudieron cargar los prospectos');
      const ld = await lr.json();
      setLeads(Array.isArray(ld?.leads) ? ld.leads : []);
      if (cr.ok) {
        const cfg = await cr.json();
        setActiva(!!cfg?.activa);
        setPhone(cfg?.notify_phone || '');
        setSavedPh(cfg?.notify_phone || '');
        setEmail(cfg?.notify_email || '');
        setSavedEm(cfg?.notify_email || '');
      }
      if (sr.ok) {
        const s = await sr.json();
        setSrcCfg({ rubros: s.rubros || [], ciudad: s.ciudad || '', tope: s.tope ?? 20, usadas: s.usadas ?? 0 });
        setCiudadIn(s.ciudad || '');
      }
    } catch (e) {
      setError(e.message || 'Error al cargar');
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const toggleCaptacion = async () => {
    const next = !activa;
    setActiva(next); // optimista
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'config', activa: next }),
      });
      if (!r.ok) setActiva(!next); // revertir si falló
    } catch { setActiva(!next); }
  };

  const savePhone = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits === savedPh) return; // sin cambios
    setSavedPh(digits); setPhone(digits);
    try {
      await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'config', notify_phone: digits }),
      });
    } catch { /* noop */ }
  };

  const saveEmail = async () => {
    const val = email.trim().toLowerCase();
    if (val === savedEm) return; // sin cambios
    setSavedEm(val); setEmail(val);
    try {
      await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'config', notify_email: val }),
      });
    } catch { /* noop */ }
  };

  const approve = async (l) => {
    if (!window.confirm(`¿Crear a "${l.nombre}" como cliente? Después le asignás lista de precios y stock en Clientes.`)) return;
    setBusy(l.id);
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'approve', id: l.id }),
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || 'No se pudo crear el cliente'); return; }
      await load();
    } catch { alert('Error de conexión'); }
    finally { setBusy(''); }
  };

  const dismiss = async (l) => {
    setBusy(l.id);
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'dismiss', id: l.id }),
      });
      if (r.ok) await load();
    } catch { /* noop */ }
    finally { setBusy(''); }
  };

  // ── Sourcing: buscar comercios reales por rubro ──────────────────────────
  const runSource = async (rubro) => {
    if (srcBusy) return;
    setSrcBusy(rubro); setSrcMsg('');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'source', rubro }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.tope != null) setSrcCfg(s => ({ ...s, usadas: d.usadas ?? s.usadas, tope: d.tope }));
      if (!r.ok) { setSrcMsg(d.error || 'No se pudo buscar'); return; }
      setSrcMsg(d.added > 0
        ? `Se agregaron ${d.added} comercios nuevos de “${rubro}”.`
        : `Sin comercios nuevos de “${rubro}” (ya los tenías o no hubo resultados).`);
      await load();
    } catch { setSrcMsg('Error de conexión'); }
    finally { setSrcBusy(''); }
  };

  const saveRubros = async (rubros, ciudad) => {
    setSrcCfg(s => ({ ...s, rubros, ciudad })); // optimista
    try {
      await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'sourcing-config', rubros, ciudad }),
      });
    } catch { /* noop */ }
  };
  const addRubro = () => {
    const v = newRubro.trim();
    if (!v || srcCfg.rubros.includes(v)) { setNewRubro(''); return; }
    setNewRubro('');
    saveRubros([...srcCfg.rubros, v].slice(0, 12), ciudadIn.trim());
  };
  const removeRubro = (r) => saveRubros(srcCfg.rubros.filter(x => x !== r), ciudadIn.trim());
  const saveCiudad = () => { if (ciudadIn.trim() !== srcCfg.ciudad) saveRubros(srcCfg.rubros, ciudadIn.trim()); };

  // ── Enriquecer un comercio con IA ────────────────────────────────────────
  const enrich = async (l) => {
    setEnrichBusy(l.id);
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'enrich', id: l.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.enriquecimiento) {
        setLeads(prev => prev.map(x => x.id === l.id
          ? { ...x, enriquecimiento: d.enriquecimiento, enriquecido_at: new Date().toISOString() } : x));
        setOpenEnrich(l.id);
      } else alert(d.error || 'No se pudo enriquecer');
    } catch { alert('Error de conexión'); }
    finally { setEnrichBusy(''); }
  };

  const visibles = filtro === 'todos'
    ? leads
    : leads.filter(l => l.estado === 'nuevo' || l.estado === 'contactado');

  const nuevos = leads.filter(l => l.estado === 'nuevo').length;

  return (
    <div style={{ padding: '24px clamp(16px,4vw,32px)', fontFamily: C.sans, color: C.ink, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Prospectos</h1>
          <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>
            Interesados que dejaron sus datos en tu portal. Aprobalos para convertirlos en clientes.
          </p>
        </div>
        {/* Config de captación: switch + teléfono de aviso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>Captación en el portal</div>
              <div style={{ color: C.faint, fontSize: 11.5 }}>{activa ? 'Visible: “Pedí acceso”' : 'Oculto para visitantes'}</div>
            </div>
            <button onClick={toggleCaptacion} aria-label="Activar captación" style={{
              width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
              background: activa ? C.green : '#d1d5db', transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: activa ? 21 : 3, width: 20, height: 20,
                borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
            <label style={{ fontSize: 11.5, color: C.faint, display: 'block', marginBottom: 4 }}>
              Avisarme por WhatsApp al
            </label>
            <input
              type="tel" inputMode="numeric" value={phone} placeholder="Ej: 598 91 806 973"
              onChange={e => setPhone(e.target.value)} onBlur={savePhone}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontFamily: C.sans, color: C.ink,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', outline: 'none' }} />
            <div style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }}>
              Cada prospecto te llega también acá. Vacío = solo por email.
            </div>

            <label style={{ fontSize: 11.5, color: C.faint, display: 'block', margin: '10px 0 4px' }}>
              Mail para avisos de prospectos
            </label>
            <input
              type="email" inputMode="email" value={email} placeholder="Ej: ventas@tucomercio.com"
              onChange={e => setEmail(e.target.value)} onBlur={saveEmail}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontFamily: C.sans, color: C.ink,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', outline: 'none' }} />
            <div style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }}>
              Vacío = usa el mail de tus pedidos.
            </div>
          </div>
        </div>
      </div>

      {/* Buscar comercios (sourcing por-org) */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Buscar comercios</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, maxWidth: 540 }}>
              Traé comercios reales de tu rubro desde Google. Después los enriquecés con IA y les escribís por WhatsApp a mano.
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>
            {srcCfg.usadas}/{srcCfg.tope} búsquedas este mes
          </div>
        </div>

        {/* Zona + editar rubros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
          <label style={{ fontSize: 12, color: C.faint }}>Zona</label>
          <input value={ciudadIn} onChange={e => setCiudadIn(e.target.value)} onBlur={saveCiudad}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder="Ej: Montevideo"
            style={{ fontSize: 13, fontFamily: C.sans, color: C.ink, border: `1px solid ${C.line}`,
              borderRadius: 8, padding: '6px 10px', outline: 'none', width: 180 }} />
          <button onClick={() => setEditRubros(v => !v)} style={{ marginLeft: 'auto', fontSize: 12.5, color: C.blue,
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: C.sans }}>
            {editRubros ? 'Listo' : 'Editar rubros'}
          </button>
        </div>

        {/* Chips de rubro */}
        {srcCfg.rubros.length === 0 && !editRubros ? (
          <div style={{ fontSize: 13, color: C.sub }}>
            Todavía no configuraste rubros. Tocá <b>Editar rubros</b> y agregá los tipos de comercio que querés buscar
            (ej: Cafeterías, Restaurantes, Hoteles).
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {srcCfg.rubros.map(r => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => runSource(r)} disabled={!!srcBusy} style={{
                  fontSize: 13, fontFamily: C.sans, cursor: srcBusy ? 'default' : 'pointer',
                  border: `1px solid ${C.line}`, background: srcBusy === r ? C.ink : C.bg,
                  color: srcBusy === r ? '#fff' : C.ink, borderRadius: 50, padding: '7px 14px', fontWeight: 500 }}>
                  {srcBusy === r ? 'Buscando…' : `＋ ${r}`}
                </button>
                {editRubros && (
                  <button onClick={() => removeRubro(r)} aria-label={`Quitar ${r}`} style={{ fontSize: 16, lineHeight: 1,
                    color: C.faint, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
                )}
              </span>
            ))}
            {editRubros && (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <input value={newRubro} onChange={e => setNewRubro(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRubro(); } }} placeholder="Agregar rubro…"
                  style={{ fontSize: 13, fontFamily: C.sans, border: `1px solid ${C.line}`, borderRadius: 50,
                    padding: '7px 12px', outline: 'none', width: 150 }} />
                <button onClick={addRubro} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: C.ink,
                  border: 'none', borderRadius: 50, padding: '7px 14px', cursor: 'pointer', fontFamily: C.sans }}>Agregar</button>
              </span>
            )}
          </div>
        )}

        {srcMsg && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 12 }}>{srcMsg}</div>}
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {[['activos', `Activos${nuevos ? ` (${nuevos})` : ''}`], ['todos', 'Todos']].map(([id, lbl]) => (
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
            {activa
              ? 'Cuando alguien deje sus datos desde tu portal, va a aparecer acá con la campaña de la que vino.'
              : 'Activá la captación (arriba) para que los visitantes que aún no son clientes puedan pedir acceso desde tu portal.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.map(l => {
            const est = ESTADO[l.estado] || ESTADO.nuevo;
            const isBusy = busy === l.id;
            const open = l.estado === 'nuevo' || l.estado === 'contactado';
            const isSourced = l.origen === 'sourcing';
            const enr = l.enriquecimiento;
            const eb = enrichBusy === l.id;
            const showEnr = openEnrich === l.id && enr;
            const wa = waLink(l.tel, enr?.mensaje_wa);
            return (
              <div key={l.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16,
                display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{l.nombre}</span>
                    <span style={{ background: est.bg, color: est.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>{est.label}</span>
                    {enr?.prioridad && (() => { const p = PRIOR[enr.prioridad] || PRIOR.media; return (
                      <span style={{ background: p.bg, color: p.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>{p.label}</span>
                    ); })()}
                  </div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
                    {l.comercio ? l.comercio + ' · ' : ''}{l.ciudad || ''}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: C.faint }}>
                    <span>📅 {fmtDate(l.created_at)}</span>
                    {isSourced
                      ? <span title="Encontrado en Google">🔎 Google</span>
                      : <span title="Fuente de campaña">🎯 {fuenteOf(l)}</span>}
                    {l.landing_url && (
                      <a href={/^https?:\/\//i.test(l.landing_url) ? l.landing_url : 'https://' + l.landing_url}
                        target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>🌐 Ver sitio</a>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: C.green, textDecoration: 'none',
                        border: `1px solid ${C.green}55`, borderRadius: 50, padding: '7px 14px' }}>
                      WhatsApp
                    </a>
                  )}
                  {isSourced && (enr
                    ? <button onClick={() => setOpenEnrich(showEnr ? '' : l.id)} style={{
                        fontSize: 13, fontWeight: 600, color: C.blue, background: C.blueBg, border: 'none',
                        borderRadius: 50, padding: '8px 16px', cursor: 'pointer', fontFamily: C.sans }}>
                        {showEnr ? 'Ocultar análisis' : 'Ver análisis'}
                      </button>
                    : <button onClick={() => enrich(l)} disabled={eb} style={{
                        fontSize: 13, fontWeight: 600, color: '#fff', background: eb ? '#b0b0a8' : C.ink, border: 'none',
                        borderRadius: 50, padding: '8px 16px', cursor: eb ? 'default' : 'pointer', fontFamily: C.sans }}>
                        {eb ? 'Analizando…' : '✨ Enriquecer'}
                      </button>
                  )}
                  {open && (
                    <>
                      <button onClick={() => approve(l)} disabled={isBusy} style={{
                        fontSize: 13, fontWeight: 600, color: '#fff', background: isBusy ? '#b0b0a8' : C.ink,
                        border: 'none', borderRadius: 50, padding: '8px 16px', cursor: isBusy ? 'default' : 'pointer', fontFamily: C.sans }}>
                        {isBusy ? '…' : 'Aprobar → cliente'}
                      </button>
                      <button onClick={() => dismiss(l)} disabled={isBusy} style={{
                        fontSize: 13, color: C.faint, background: 'transparent', border: 'none',
                        cursor: isBusy ? 'default' : 'pointer', fontFamily: C.sans }}>
                        Descartar
                      </button>
                    </>
                  )}
                  {l.estado === 'convertido' && (
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>✓ Ya es cliente</span>
                  )}
                </div>

                {showEnr && (
                  <div style={{ flexBasis: '100%', borderTop: `1px solid ${C.line}`, marginTop: 4, paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: 12.5, color: C.sub }}>
                      {enr.rubro && enr.rubro !== 'sin datos' && <span style={{ color: C.ink, fontWeight: 600 }}>{enr.rubro}</span>}
                      {enr.tamano && enr.tamano !== 'sin datos' && <span>· tamaño {enr.tamano}</span>}
                    </div>
                    {enr.angulo && <div style={{ fontSize: 13, color: C.ink, marginBottom: 8 }}>{enr.angulo}</div>}
                    {Array.isArray(enr.senales) && enr.senales.length > 0 && (
                      <ul style={{ margin: '0 0 10px', paddingLeft: 18, color: C.sub, fontSize: 12.5 }}>
                        {enr.senales.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}
                    {enr.mensaje_wa && (
                      <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10.5, color: C.faint, fontWeight: 700, letterSpacing: 0.4, marginBottom: 6 }}>MENSAJE DE WHATSAPP LISTO</div>
                        <div style={{ fontSize: 13.5, color: C.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{enr.mensaje_wa}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {wa
                            ? <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600,
                                color: '#fff', background: C.green, textDecoration: 'none', borderRadius: 50, padding: '8px 16px' }}>
                                Abrir en WhatsApp
                              </a>
                            : <span style={{ fontSize: 12, color: C.faint, alignSelf: 'center' }}>Sin teléfono — copiá el mensaje</span>}
                          <button onClick={() => { try { navigator.clipboard?.writeText(enr.mensaje_wa); } catch { /* noop */ } }}
                            style={{ fontSize: 13, color: C.ink, background: 'transparent', border: `1px solid ${C.line}`,
                              borderRadius: 50, padding: '8px 16px', cursor: 'pointer', fontFamily: C.sans }}>
                            Copiar mensaje
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
