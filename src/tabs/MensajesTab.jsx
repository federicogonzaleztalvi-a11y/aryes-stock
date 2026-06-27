// MensajesTab — Broadcasts por WhatsApp (re-enganche de clientes).
// El distribuidor elige un mensaje y lo manda a sus clientes dormidos (los que
// hace tiempo no piden). Reusa la infra de WhatsApp del OTP via /api/broadcast.
// El envío real va por una plantilla aprobada en Meta (ver api/broadcast.js).

import { useState, useEffect, useCallback } from 'react';
import { getSession } from '../lib/constants.js';

const G = '#059669';

function authHeaders() {
  const token = getSession()?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const PLANTILLAS = [
  { label: 'Reactivar dormido', texto: 'Hola {nombre}! Hace un tiempo que no nos hacés un pedido. Tenemos novedades y precios actualizados. Entrá al portal y mirá lo nuevo.' },
  { label: 'Empujar un producto', texto: 'Hola {nombre}! Llegó stock fresco esta semana. Aprovechá y armá tu pedido desde el portal antes de que se agote.' },
  { label: 'Recordatorio de pedido', texto: 'Hola {nombre}! Te recordamos que podés hacer tu pedido cuando quieras desde el portal. Cualquier duda, escribinos.' },
];

export default function MensajesTab() {
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [mensaje, setMensaje] = useState(PLANTILLAS[0].texto);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const cargarAudiencia = useCallback(async (d) => {
    setCargando(true); setError(null); setResultado(null);
    try {
      const r = await fetch(`/api/broadcast?action=audiencia&dias=${d}`, { headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'No se pudo cargar la audiencia');
      setClientes(data.clientes || []);
      setSel(new Set((data.clientes || []).map(c => c.id)));  // todos preseleccionados
    } catch (e) {
      setError(e.message); setClientes([]); setSel(new Set());
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarAudiencia(dias); }, [dias, cargarAudiencia]);

  const toggle = (id) => setSel(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const todos = () => setSel(new Set(clientes.map(c => c.id)));
  const ninguno = () => setSel(new Set());

  const enviar = async () => {
    if (!sel.size || !mensaje.trim() || enviando) return;
    setEnviando(true); setError(null); setResultado(null);
    try {
      const r = await fetch('/api/broadcast?action=send', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ clienteIds: [...sel], mensaje }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'No se pudo enviar');
      setResultado(data);
    } catch (e) { setError(e.message); }
    finally { setEnviando(false); }
  };

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececec', padding: '18px 20px', marginBottom: 16 };
  const fechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  return (
    <div style={{ maxWidth: 980, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a18', margin: 0 }}>Mensajes a clientes</h2>
        <p style={{ fontSize: 13, color: '#6a6a68', margin: '4px 0 0' }}>
          Reactivá a tus clientes por WhatsApp. Elegí cuánto hace que no piden, ajustá el mensaje y enviá.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Mensaje ── */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', marginBottom: 10 }}>1. El mensaje</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PLANTILLAS.map((p, i) => (
              <button key={i} onClick={() => setMensaje(p.texto)}
                style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                  border: '1px solid ' + (mensaje === p.texto ? G : '#e0e0da'),
                  background: mensaje === p.texto ? '#f0fdf4' : '#fff', color: mensaje === p.texto ? G : '#555', fontWeight: 600 }}>
                {p.label}
              </button>
            ))}
          </div>
          <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={5}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #e0e0da',
              padding: '10px 12px', fontSize: 13, color: '#1a1a18', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ fontSize: 11, color: '#9a9a98', marginTop: 6 }}>
            Tip: escribí <b>{'{nombre}'}</b> y se reemplaza por el nombre de cada cliente.
          </div>
        </div>

        {/* ── Audiencia ── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>2. A quién</div>
            <select value={dias} onChange={e => setDias(Number(e.target.value))}
              style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0da', cursor: 'pointer' }}>
              <option value={15}>Sin pedir hace 15+ días</option>
              <option value={30}>Sin pedir hace 30+ días</option>
              <option value={60}>Sin pedir hace 60+ días</option>
              <option value={90}>Sin pedir hace 90+ días</option>
            </select>
          </div>

          {cargando ? (
            <div style={{ fontSize: 13, color: '#9a9a98', padding: '16px 0' }}>Cargando clientes...</div>
          ) : clientes.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9a9a98', padding: '16px 0' }}>
              No hay clientes dormidos en ese rango. Buena señal: están comprando.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, fontSize: 11.5, marginBottom: 8 }}>
                <span style={{ color: '#6a6a68' }}><b>{sel.size}</b> de {clientes.length} seleccionados</span>
                <button onClick={todos} style={{ background: 'none', border: 'none', color: G, cursor: 'pointer', fontWeight: 600, fontSize: 11.5 }}>Todos</button>
                <button onClick={ninguno} style={{ background: 'none', border: 'none', color: '#9a9a98', cursor: 'pointer', fontSize: 11.5 }}>Ninguno</button>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #f0f0ec', borderRadius: 10 }}>
                {clientes.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderBottom: '1px solid #f5f5f0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a18' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#9a9a98' }}>
                        {c.ultimoPedido ? `Último pedido: ${fechaCorta(c.ultimoPedido)} (${c.diasSinPedir} días)` : 'Nunca pidió'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Enviar ── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ fontSize: 12.5, color: '#6a6a68' }}>
          Se enviará por WhatsApp a <b>{sel.size}</b> cliente{sel.size === 1 ? '' : 's'}.
        </div>
        <button onClick={enviar} disabled={!sel.size || !mensaje.trim() || enviando}
          style={{ padding: '10px 22px', borderRadius: 10, border: 'none', fontSize: 13.5, fontWeight: 700,
            cursor: (!sel.size || enviando) ? 'not-allowed' : 'pointer',
            background: (!sel.size || enviando) ? '#cbd5d0' : G, color: '#fff' }}>
          {enviando ? 'Enviando...' : `Enviar a ${sel.size}`}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
          borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>{error}</div>
      )}
      {resultado && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: G,
          borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
          Enviados: <b>{resultado.enviados}</b>{resultado.fallidos ? ` · Fallidos: ${resultado.fallidos}` : ''}.
          {resultado.errores?.length > 0 && (
            <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 6 }}>
              Ej. de error: {resultado.errores[0].error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
