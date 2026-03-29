// →→ PedidosPage → Portal de pedidos B2B con autenticación OTP por teléfono →→
import { useState, useEffect, useMemo, useCallback } from 'react';

const G           = '#3a7d1e';
const API         = import.meta.env.VITE_API_BASE || '';
const ORG         = 'aryes';
const SESSION_KEY = 'aryes-pedidos-session';

const fmtUSD = n => 'US$ ' + Number(n).toLocaleString('es-UY', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s?.expiresAt) return null;
    if (new Date(s.expiresAt) < new Date()) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }

// →→ LoginStep →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
function LoginStep({ onLogin }) {
  const [tel,     setTel]     = useState('');
  const [code,    setCode]    = useState('');
  const [step,    setStep]    = useState('tel');
  const [nombre,  setNombre]  = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const sendOTP = async () => {
    if (!tel.trim()) { setErr('Ingresá tu número de WhatsApp'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Error al enviar el código'); return; }
      setNombre(d.clienteNombre || '');
      if (d._devMode && d.code) setDevCode(d.code);
      setStep('code');
    } catch { setErr('Error de conexión.'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!code.trim()) { setErr('Ingresá el código recibido'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.trim(), code: code.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Código incorrecto'); return; }
      saveSession(d.session); onLogin(d.session);
    } catch { setErr('Error de conexión.'); }
    finally { setLoading(false); }
  };

  const inp = { width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb',
    borderRadius: 12, fontSize: 16, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .15s' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 36px',
        maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📊¿</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26,
            fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Aryes</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Portal de pedidos para clientes</div>
        </div>
        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{err}</div>}
        {step === 'tel' ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 8 }}>
              Tu número de WhatsApp
            </label>
            <input type="tel" placeholder="+598 9X XXX XXX" value={tel}
              onChange={e => setTel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOTP()} style={inp}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 20px' }}>
              Ingresá el número que registraste con Aryes.
            </p>
            <button onClick={sendOTP} disabled={loading}
              style={{ width: '100%', padding: '14px 0', background: loading ? '#9ca3af' : G,
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Enviando...' : 'Enviar código →'}
            </button>
          </>
        ) : (
          <>
            {nombre && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 14, color: G, fontWeight: 600 }}>
              ¡Hola, {nombre.split(' ')[0]}! 📊
            </div>}
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 8 }}>
              Código de acceso
            </label>
            {devCode && <div style={{ background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, padding: '8px 12px', marginBottom: 12,
              fontSize: 12, color: '#92400e' }}>
              📊§ Modo dev → tu código:{' '}
              <strong style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</strong>
            </div>}
            <input type="text" inputMode="numeric" placeholder="1234"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,4))}
              onKeyDown={e => e.key === 'Enter' && verifyOTP()} autoFocus
              style={{ ...inp, fontSize: 28, textAlign: 'center', letterSpacing: 12, fontWeight: 700 }}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 20px' }}>
              Código de 4 dígitos. Válido por 10 minutos.
            </p>
            <button onClick={verifyOTP} disabled={loading}
              style={{ width: '100%', padding: '14px 0', background: loading ? '#9ca3af' : G,
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
              {loading ? 'Verificando...' : 'Ingresar al catálogo →'}
            </button>
            <button onClick={() => { setStep('tel'); setCode(''); setErr(''); setDevCode(''); }}
              style={{ width: '100%', padding: '10px 0', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13,
                color: '#6b7280', cursor: 'pointer' }}>
              → Cambiar número
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// →→ ProductCard →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
function ProductCard({ item, qty, onAdd, onRemove }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px 0' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: .5,
          background: '#f3f4f6', padding: '2px 8px', borderRadius: 20 }}>
          {item.categoria}
        </span>
      </div>
      <div style={{ padding: '8px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{item.nombre}</div>
        {item.marca && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{item.marca}</div>}
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
          {item.unidad}
          {(item.available_stock ?? item.stock) > 0 && (item.available_stock ?? item.stock) <= 10 && (
            <span style={{ marginLeft: 8, color: '#d97706', fontWeight: 700 }}>
              ⚠️ últimas {item.available_stock ?? item.stock} uds.
            </span>
          )}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: G, marginBottom: 10 }}>
            {item.precio > 0 ? fmtUSD(item.precio)
              : <span style={{ color: '#9ca3af', fontSize: 13 }}>Consultar</span>}
          </div>
          {qty > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => onRemove(item)}
                style={{ width: 32, height: 32, border: `1px solid ${G}`, borderRadius: 8,
                  background: '#fff', color: G, fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>→</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a',
                minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => onAdd(item)}
                style={{ width: 32, height: 32, background: G, border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>+</button>
            </div>
          ) : (
            <button onClick={() => onAdd(item)} disabled={item.precio === 0}
              style={{ width: '100%', padding: '8px 0',
                background: item.precio > 0 ? G : '#e5e7eb',
                color: item.precio > 0 ? '#fff' : '#9ca3af', border: 'none',
                borderRadius: 8, cursor: item.precio > 0 ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 700 }}>
              {item.precio > 0 ? '+ Agregar' : 'Sin precio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// →→ HistorialPanel →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
function HistorialPanel({ orders, loading, onReordenar }) {
  if (loading) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px',
      textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
      Cargando tus pedidos...
    </div>
  );
  if (!orders.length) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
        Todavía no tenés pedidos
      </div>
      <p style={{ fontSize: 13, color: '#9ca3af' }}>Tus pedidos confirmados aparecerán acá.</p>
    </div>
  );
  const BADGE = {
    pendiente:  { label: 'Pendiente',      icon: '⏳', bg: '#fffbeb', color: '#d97706' },
    importada:  { label: 'Confirmado',     icon: '✅', bg: '#f0fdf4', color: '#16a34a' },
    confirmada: { label: 'Confirmado',     icon: '✅', bg: '#f0fdf4', color: '#16a34a' },
    preparada:  { label: 'En preparacion', icon: '📦', bg: '#eff6ff', color: '#3b82f6' },
    en_ruta:    { label: 'En camino',      icon: '🚚', bg: '#f5f3ff', color: '#7c3aed' },
    entregada:  { label: 'Entregado',      icon: '🎉', bg: '#f0fdf4', color: '#16a34a' },
    cancelada:  { label: 'Cancelado',      icon: '❌', bg: '#fef2f2', color: '#dc2626' },
  };
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        {orders.length} pedido{orders.length !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map(order => {
          const badge  = BADGE[order.venta_estado] || BADGE[order.estado] || BADGE.pendiente;
          const items  = Array.isArray(order.items) ? order.items : [];
          const fecha  = new Date(order.creado_en).toLocaleDateString('es-UY', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          return (
            <div key={order.id} style={{ background: '#fff', borderRadius: 12,
              border: '1px solid #f0f0ec', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
              overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', display: 'flex',
                alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>{fecha}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 20, background: badge.bg, color: badge.color }}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {items.length} producto{items.length !== 1 ? 's' : ''}
                    {order.notas && <span style={{ marginLeft: 8, color: '#d97706' }}>
                      · 📊 {order.notas.slice(0, 40)}
                    </span>}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: G }}>{fmtUSD(order.total)}</div>
                {(order.venta_estado === 'entregada' || order.estado === 'importada') && onSolicitarDev && (
                  <button onClick={() => onSolicitarDev(order)}
                    style={{ padding: '8px 14px', background: '#fff', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Devolver
                  </button>
                )}
                <button onClick={() => onReordenar(order)}
                  style={{ padding: '8px 16px', background: G, color: '#fff', border: 'none',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    whiteSpace: 'nowrap' }}>
                  �🔄 Repetir pedido
                </button>
              </div>
              <div style={{ padding: '0 18px 14px', borderTop: '1px solid #f3f4f6' }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, color: '#6b7280', padding: '4px 0',
                    borderBottom: idx < items.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                    <span>{it.cantidad || it.qty || 1} Í {it.nombre || it.descripcion}</span>
                    <span>{fmtUSD(it.subtotal || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// →→ CartPanel →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
function CartPanel({ carrito, items, session, onClose, onConfirm }) {
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const lineas = Object.entries(carrito)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id), qty }))
    .filter(l => l.item);

  const total = lineas.reduce((s, l) => s + l.item.precio * l.qty, 0);

  const confirmar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${window.location.origin}/api/pedido`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          org: ORG, clienteId: session.clienteId,
          clienteNombre: session.nombre, clienteTelefono: session.tel,
          items: lineas.map(l => ({
            productId: l.item.id, nombre: l.item.nombre, unidad: l.item.unidad,
            cantidad: l.qty, precioUnit: l.item.precio, subtotal: l.item.precio * l.qty,
          })),
          total, notas,
          idempotencyKey: `${session.tel}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        }),
      });
      if (r.ok) { setDone(true); onConfirm(); }
      else { const d = await r.json(); alert(d.error || 'Error'); }
    } catch { alert('Error de conexión'); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40,
        maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>→</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22,
          fontWeight: 700, marginBottom: 8 }}>¡Pedido enviado!</div>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Tu pedido fue recibido. Te avisamos cuando esté confirmado.
        </p>
        <button onClick={onClose}
          style={{ padding: '12px 32px', background: G, color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Ver más productos
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999 }}
      onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.min(420, window.innerWidth), background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,.12)', display: 'flex',
        flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>
            Tu pedido ({lineas.length} producto{lineas.length !== 1 ? 's' : ''})
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>Í</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {lineas.map(({ item, qty }) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nombre}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{qty} Í {fmtUSD(item.precio)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: G }}>{fmtUSD(item.precio * qty)}</div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>
              Notas del pedido
            </label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: entregar antes del mediodía..." rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '2px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: G }}>{fmtUSD(total)}</span>
          </div>
          <button onClick={confirmar} disabled={loading || lineas.length === 0}
            style={{ width: '100%', padding: '14px 0',
              background: loading || lineas.length === 0 ? '#9ca3af' : G,
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Enviando pedido...' : '→ Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// →→ Main →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

// →→ HistorialPedidos →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
function HistorialPedidos({ session }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expand,  setExpand]  = useState(null);

  const ESTADOS = {
    pendiente:  { label: 'Pendiente',  color: '#f59e0b', bg: '#fffbeb' },
    confirmada: { label: 'Confirmado', color: '#3b82f6', bg: '#eff6ff' },
    preparada:  { label: 'Preparando', color: '#8b5cf6', bg: '#f5f3ff' },
    en_ruta:    { label: 'En camino',  color: '#f97316', bg: '#fff7ed' },
    entregada:  { label: 'Entregado',  color: '#3a7d1e', bg: '#f0fdf4' },
    cancelada:  { label: 'Cancelado',  color: '#ef4444', bg: '#fef2f2' },
  };

  useEffect(() => {
    if (!session?.token) return;
    fetch(`${API}/api/pedido?action=historial`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPedidos(d.pedidos || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
      Cargando historial...
    </div>
  );

  if (!pedidos.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 15, color: '#6b7280', fontWeight: 600 }}>Sin pedidos aún</div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>Tus pedidos aparecerán acá</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {pedidos.map(p => {
        const est = ESTADOS[p.estado] || ESTADOS.pendiente;
        const isExp = expand === p.id;
        return (
          <div key={p.id} onClick={() => setExpand(isExp ? null : p.id)}
            style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5e7eb',
              overflow: 'hidden', cursor: 'pointer',
              boxShadow: isExp ? '0 2px 12px rgba(0,0,0,.08)' : 'none' }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                  {new Date(p.creado_en).toLocaleDateString('es-UY', { day:'2-digit', month:'short', year:'numeric' })}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {Array.isArray(p.items) ? p.items.length : 0} producto{p.items?.length !== 1 ? 's' : ''}
                  {p.notas ? ' · 📝 nota' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: G }}>{fmtUSD(p.total)}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: est.color,
                  background: est.bg, padding: '2px 8px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                  {est.label}
                </span>
              </div>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{isExp ? '▲' : '▼'}</span>
            </div>
            {isExp && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {(p.items || []).map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 13, padding: '4px 0',
                      borderBottom: i < p.items.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <span style={{ color: '#374151' }}>{it.cantidad} × {it.nombre} <span style={{ color: '#9ca3af' }}>({it.unidad})</span></span>
                      <span style={{ fontWeight: 600, color: G }}>{fmtUSD(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                {p.notas && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280',
                    background: '#fffbeb', padding: '8px 10px', borderRadius: 8 }}>
                    📝 {p.notas}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PedidosPage() {
  const [session,   setSession]   = useState(() => loadSession());
  const [vista,     setVista]     = useState('catalogo');
  const [items,     setItems]     = useState([]);
  const [cats,      setCats]      = useState([]);
  const [catFil,    setCatFil]    = useState('Todos');
  const [busq,      setBusq]      = useState('');
  const [carrito,   setCarrito]   = useState({});
  const [tabPortal,  setTabPortal]  = useState('catalogo');
  const [showCart,  setShowCart]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [historial, setHistorial] = useState([]);
  const [devModal,  setDevModal]  = useState(null); // order para devolver
  const [devItems,  setDevItems]  = useState([]);   // items con cantDevolver
  const [devMotivo, setDevMotivo] = useState('');
  const [devNotas,  setDevNotas]  = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [devMsg,    setDevMsg]    = useState('');
  const [histLoad,  setHistLoad]  = useState(false);

  const totalItems = Object.values(carrito).reduce((s, q) => s + q, 0);

  const loadCatalogo = useCallback(async (ses) => {
    if (!ses?.clienteId) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${window.location.origin}/api/catalogo?org=${ORG}&cliente=${ses.clienteId}`
      );
      const d = await r.json();
      if (d.items) { setItems(d.items.filter(i => i.precio > 0)); setCats(['Todos', ...(d.categorias || [])]); }
    } catch {/* silent */}
    finally { setLoading(false); }
  }, []);

  const loadHistorial = useCallback(async (ses) => {
    if (!ses?.tel) return;
    setHistLoad(true);
    try {
      const tel = ses.tel.replace(/\D/g, '');
      const r = await fetch(
        `${window.location.origin}/api/historial?tel=${encodeURIComponent(tel)}&org=${ORG}`
      );
      const d = await r.json();
      if (Array.isArray(d.orders)) setHistorial(d.orders);
    } catch {/* silent */}
    finally { setHistLoad(false); }
  }, []);

  useEffect(() => { if (session) loadCatalogo(session); }, [session, loadCatalogo]);
  useEffect(() => {
    if (session && vista === 'historial') loadHistorial(session);
  }, [session, vista, loadHistorial]);

  const filtered = useMemo(() => items.filter(i => {
    const matchCat  = catFil === 'Todos' || i.categoria === catFil;
    const matchBusq = !busq || i.nombre.toLowerCase().includes(busq.toLowerCase())
      || (i.marca || '').toLowerCase().includes(busq.toLowerCase());
    return matchCat && matchBusq;
  }), [items, catFil, busq]);

  const addItem    = item => setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }));
  const removeItem = item => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    if (q <= 0) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });

  const confirmarDevolucion = async () => {
    const itemsADev = devItems.filter(it => Number(it.cantDevolver) > 0);
    if (!itemsADev.length) { setDevMsg('Selecciona al menos un producto'); return; }
    if (!devMotivo)        { setDevMsg('Indica el motivo'); return; }
    setDevLoading(true);
    try {
      const r = await fetch('/api/devolucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ventaId:       devModal.venta_id || devModal.id,
          clienteNombre: devModal.cliente_nombre || session?.nombre || '',
          clienteTel:    (session?.tel||'').replace(/[^0-9]/g,''),
          motivo:        devMotivo, notas: devNotas,
          items:         itemsADev, org: ORG,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setDevMsg(d.error || 'Error al enviar'); setDevLoading(false); return; }
      setDevModal(null); setDevMotivo(''); setDevNotas(''); setDevItems([]);
      alert('Solicitud enviada. Te contactaremos para coordinar la devolución.');
    } catch { setDevMsg('Error de conexión'); }
    setDevLoading(false);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null); setItems([]); setCarrito({}); setHistorial([]);
  };

  if (!session) return <LoginStep onLogin={ses => setSession(ses)} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* →→ Header →→ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        {/* Top bar */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20,
            fontWeight: 700, color: G, marginRight: 'auto' }}>📊¿ Aryes</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Hola, <strong>{session.nombre.split(' ')[0]}</strong>
          </div>
          <button onClick={() => totalItems > 0 && setShowCart(true)}
            style={{ padding: '8px 16px', background: totalItems > 0 ? G : '#e5e7eb',
              color: totalItems > 0 ? '#fff' : '#9ca3af', border: 'none',
              borderRadius: 20, cursor: totalItems > 0 ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 700 }}>
            📊 {totalItems > 0
              ? `${totalItems} producto${totalItems !== 1 ? 's' : ''}`
              : 'Carrito vacío'}
          </button>
          <button onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}>
            Salir
          </button>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px',
          display: 'flex', gap: 4, borderBottom: '1px solid #f3f4f6' }}>
          {[{id:'catalogo',label:'📊 Catálogo'},{id:'historial',label:'📊 Mis pedidos'}].map(tab => (
            <button key={tab.id} onClick={() => setVista(tab.id)}
              style={{ padding: '10px 18px', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, background: 'transparent',
                color: vista === tab.id ? G : '#6b7280',
                borderBottom: vista === tab.id ? `2px solid ${G}` : '2px solid transparent',
                marginBottom: -1 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador → solo en catálogo */}
        {vista === 'catalogo' && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 20px 14px',
            display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Buscar producto o marca..." value={busq}
              onChange={e => setBusq(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '8px 14px',
                border: '1px solid #e5e7eb', borderRadius: 20,
                fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <button key={c} onClick={() => setCatFil(c)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: catFil === c ? G : '#e5e7eb',
                    background: catFil === c ? G : '#fff',
                    color: catFil === c ? '#fff' : '#374151',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* →→ Catálogo →→ */}
      {vista === 'catalogo' && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
              Cargando catálogo...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
              {items.length === 0 ? 'No hay productos disponibles.' : 'Sin resultados.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {filtered.map(item => (
                  <ProductCard key={item.id} item={item}
                    qty={carrito[item.id] || 0} onAdd={addItem} onRemove={removeItem} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* →→ Historial →→ */}
      {vista === 'historial' && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
          <HistorialPedidos session={session} />
        </div>
      )}

      {/* →→ Cart →→ */}
      {/* →→ Modal devolucion →→ */}
      {devModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, maxWidth:480, width:'100%',
            maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#1a1a18' }}>Solicitar devolucion</div>
              <button onClick={()=>setDevModal(null)}
                style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9a9a98' }}>x</button>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#6a6a68', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                Que productos queres devolver?
              </div>
              {devItems.map((it, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ flex:1, fontSize:13 }}>{it.nombre || it.name}</div>
                  <div style={{ fontSize:11, color:'#9a9a98' }}>max. {it.cantidad || it.qty}</div>
                  <input type="number" min={0} max={it.cantidad || it.qty}
                    value={it.cantDevolver || 0}
                    onChange={e => {
                      const val = Math.min(Number(e.target.value), it.cantidad || it.qty || 0);
                      setDevItems(prev => prev.map((x,j) => j===i ? {...x, cantDevolver: val} : x));
                    }}
                    style={{ width:60, padding:'4px 8px', border:'1px solid #e2e2de', borderRadius:6, fontSize:13, textAlign:'center' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <select value={devMotivo} onChange={e=>setDevMotivo(e.target.value)}
                style={{ width:'100%', padding:'8px 12px', border:'1px solid #e2e2de', borderRadius:8, fontSize:13 }}>
                <option value="">Motivo de la devolucion...</option>
                {['Producto danado','Error en el pedido','Producto vencido','Exceso de stock','Otro'].map(m=>(
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <textarea value={devNotas} onChange={e=>setDevNotas(e.target.value)}
              placeholder="Descripcion adicional (opcional)..." rows={2}
              style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', border:'1px solid #e2e2de',
                borderRadius:8, fontSize:13, resize:'none', marginBottom:12 }}
            />
            {devMsg && <div style={{ color:'#dc2626', fontSize:12, marginBottom:10 }}>{devMsg}</div>}
            <button onClick={confirmarDevolucion} disabled={devLoading}
              style={{ width:'100%', background:'#dc2626', color:'#fff', border:'none',
                borderRadius:10, padding:'12px', fontSize:14, fontWeight:700,
                cursor: devLoading ? 'default':'pointer', opacity: devLoading ? 0.6:1 }}>
              {devLoading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </div>
      )}

      {showCart && (
        <CartPanel carrito={carrito} items={items} session={session}
          onClose={() => setShowCart(false)}
          onConfirm={() => { setCarrito({}); setShowCart(false); }} />
      )}
    </div>
  );
}
