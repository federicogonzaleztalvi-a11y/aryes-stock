// ── PedidosPage — Portal de pedidos B2B con autenticación OTP por teléfono ──
// URL: /pedidos
// El cliente ingresa su número → recibe código SMS → ve su catálogo con precios
// personalizados → arma el carrito → confirma → pedido en Supabase WMS

import { useState, useEffect, useMemo, useCallback } from 'react';

const G       = '#3a7d1e';
const API     = import.meta.env.VITE_API_BASE || '';
const ORG     = 'aryes';
const SESSION_KEY = 'aryes-pedidos-session';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtUSD = n => 'US$ ' + Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s?.expiresAt) return null;
    if (new Date(s.expiresAt) < new Date()) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

// ── Step 1: Login con teléfono ────────────────────────────────────────────────
function LoginStep({ onLogin }) {
  const [tel,       setTel]       = useState('');
  const [code,      setCode]      = useState('');
  const [step,      setStep]      = useState('tel'); // tel | code
  const [nombre,    setNombre]    = useState('');
  const [devCode,   setDevCode]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState('');

  const sendOTP = async () => {
    if (!tel.trim()) { setErr('Ingresá tu número de WhatsApp'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Error al enviar el código'); return; }
      setNombre(d.clienteNombre || '');
      if (d._devMode && d.code) setDevCode(d.code); // only in dev
      setStep('code');
    } catch { setErr('Error de conexión. Intentá de nuevo.'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!code.trim()) { setErr('Ingresá el código recibido'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/otp-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel: tel.trim(), code: code.trim(), org: ORG }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Código incorrecto'); return; }
      saveSession(d.session);
      onLogin(d.session);
    } catch { setErr('Error de conexión. Intentá de nuevo.'); }
    finally { setLoading(false); }
  };

  const inp = {
    width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb',
    borderRadius: 12, fontSize: 16, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 36px',
        maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        {/* Logo + título */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26,
            fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Aryes</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Portal de pedidos para clientes
          </div>
        </div>

        {err && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
            {err}
          </div>
        )}

        {step === 'tel' ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 8 }}>
              Tu número de WhatsApp
            </label>
            <input
              type="tel" placeholder="+598 9X XXX XXX"
              value={tel} onChange={e => setTel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOTP()}
              style={inp}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 20px' }}>
              Ingresá el número que registraste con Aryes. Te enviamos un código para ingresar.
            </p>
            <button onClick={sendOTP} disabled={loading}
              style={{ width: '100%', padding: '14px 0', background: loading ? '#9ca3af' : G,
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Enviando...' : 'Enviar código →'}
            </button>
          </>
        ) : (
          <>
            {nombre && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                fontSize: 14, color: G, fontWeight: 600 }}>
                ¡Hola, {nombre.split(' ')[0]}! 👋
              </div>
            )}
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 8 }}>
              Código de acceso
            </label>
            {devCode && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12,
                color: '#92400e' }}>
                🔧 Modo dev — tu código: <strong style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</strong>
              </div>
            )}
            <input
              type="text" inputMode="numeric" placeholder="1234"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,4))}
              onKeyDown={e => e.key === 'Enter' && verifyOTP()}
              style={{ ...inp, fontSize: 28, textAlign: 'center', letterSpacing: 12, fontWeight: 700 }}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              autoFocus
            />
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 20px' }}>
              Ingresá el código de 4 dígitos. Válido por 10 minutos.
            </p>
            <button onClick={verifyOTP} disabled={loading}
              style={{ width: '100%', padding: '14px 0', background: loading ? '#9ca3af' : G,
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 12 }}>
              {loading ? 'Verificando...' : 'Ingresar al catálogo →'}
            </button>
            <button onClick={() => { setStep('tel'); setCode(''); setErr(''); setDevCode(''); }}
              style={{ width: '100%', padding: '10px 0', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13,
                color: '#6b7280', cursor: 'pointer' }}>
              ← Cambiar número
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ item, qty, onAdd, onRemove }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0ec',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column' }}>
      {/* Category pill */}
      <div style={{ padding: '10px 14px 0' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: .5, background: '#f3f4f6',
          padding: '2px 8px', borderRadius: 20 }}>{item.categoria}</span>
      </div>
      <div style={{ padding: '8px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{item.nombre}</div>
        {item.marca && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{item.marca}</div>}
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
          {item.unidad}
          {item.stock > 0 && item.stock <= 10 && (
            <span style={{ marginLeft: 8, color: '#d97706', fontWeight: 700 }}>⚠ últimas {item.stock} uds.</span>
          )}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: G, marginBottom: 10 }}>
            {item.precio > 0 ? fmtUSD(item.precio) : <span style={{ color: '#9ca3af', fontSize: 13 }}>Consultar</span>}
          </div>
          {qty > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => onRemove(item)}
                style={{ width: 32, height: 32, border: `1px solid ${G}`, borderRadius: 8,
                  background: '#fff', color: G, fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>−</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => onAdd(item)}
                style={{ width: 32, height: 32, background: G, border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
            </div>
          ) : (
            <button onClick={() => onAdd(item)} disabled={item.precio === 0}
              style={{ width: '100%', padding: '8px 0', background: item.precio > 0 ? G : '#e5e7eb',
                color: item.precio > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8,
                cursor: item.precio > 0 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
              {item.precio > 0 ? '+ Agregar' : 'Sin precio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cart sidebar / bottom sheet ───────────────────────────────────────────────
function CartPanel({ carrito, items, session, onClose, onConfirm }) {
  const [notas,    setNotas]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const total = Object.entries(carrito).reduce((s, [id, qty]) => {
    const p = items.find(i => i.id === id);
    return s + (p ? p.precio * qty : 0);
  }, 0);

  const lineas = Object.entries(carrito)
    .filter(([,qty]) => qty > 0)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id), qty }))
    .filter(l => l.item);

  const confirmar = async () => {
    setLoading(true);
    try {
      const orderItems = lineas.map(l => ({
        productId:   l.item.id,
        nombre:      l.item.nombre,
        unidad:      l.item.unidad,
        cantidad:    l.qty,
        precioUnit:  l.item.precio,
        subtotal:    l.item.precio * l.qty,
      }));
      const r = await fetch(`${window.location.origin}/api/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org:             ORG,
          clienteId:       session.clienteId,
          clienteNombre:   session.nombre,
          clienteTelefono: session.tel,
          items:           orderItems,
          total,
          notas,
        }),
      });
      if (r.ok) { setDone(true); onConfirm(); }
      else { const d = await r.json(); alert(d.error || 'Error al enviar el pedido'); }
    } catch { alert('Error de conexión'); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40,
        maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          ¡Pedido enviado!
        </div>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999 }} onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: Math.min(420, window.innerWidth),
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>
            Tu pedido ({lineas.length} producto{lineas.length !== 1 ? 's' : ''})
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {lineas.map(({ item, qty }) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nombre}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{qty} × {fmtUSD(item.precio)}</div>
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
              placeholder="Ej: entregar antes del mediodía, factura a nombre de..."
              rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                boxSizing: 'border-box' }} />
          </div>
        </div>
        {/* Footer */}
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
            {loading ? 'Enviando pedido...' : '✓ Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main portal ───────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const [session,  setSession]  = useState(() => loadSession());
  const [items,    setItems]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [catFil,   setCatFil]   = useState('Todos');
  const [busq,     setBusq]     = useState('');
  const [carrito,  setCarrito]  = useState({});
  const [showCart, setShowCart] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const totalItems = Object.values(carrito).reduce((s, q) => s + q, 0);

  const loadCatalogo = useCallback(async (ses) => {
    if (!ses?.clienteId) return;
    setLoading(true);
    try {
      const r = await fetch(`${window.location.origin}/api/catalogo?org=${ORG}&cliente=${ses.clienteId}`);
      const d = await r.json();
      if (d.items) {
        setItems(d.items.filter(i => i.precio > 0));
        setCats(['Todos', ...(d.categorias || [])]);
      }
    } catch {/* silent */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (session) loadCatalogo(session); }, [session, loadCatalogo]);

  const filtered = useMemo(() => items.filter(i => {
    const matchCat = catFil === 'Todos' || i.categoria === catFil;
    const matchBusq = !busq || i.nombre.toLowerCase().includes(busq.toLowerCase()) ||
      (i.marca || '').toLowerCase().includes(busq.toLowerCase());
    return matchCat && matchBusq;
  }), [items, catFil, busq]);

  const addItem    = (item) => setCarrito(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }));
  const removeItem = (item) => setCarrito(c => {
    const q = (c[item.id] || 0) - 1;
    if (q <= 0) { const n = { ...c }; delete n[item.id]; return n; }
    return { ...c, [item.id]: q };
  });

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null); setItems([]); setCarrito({});
  };

  if (!session) return <LoginStep onLogin={ses => { setSession(ses); }} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700,
            color: G, marginRight: 'auto' }}>🌿 Aryes</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Hola, <strong>{session.nombre.split(' ')[0]}</strong>
          </div>
          {/* Carrito */}
          <button onClick={() => totalItems > 0 && setShowCart(true)}
            style={{ padding: '8px 16px', background: totalItems > 0 ? G : '#e5e7eb',
              color: totalItems > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 20,
              cursor: totalItems > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6 }}>
            🛒 {totalItems > 0 ? `${totalItems} producto${totalItems !== 1 ? 's' : ''}` : 'Carrito vacío'}
          </button>
          <button onClick={logout} style={{ background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}>Salir</button>
        </div>
        {/* Buscador + filtros */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 14px',
          display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input placeholder="Buscar producto o marca..."
            value={busq} onChange={e => setBusq(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '8px 14px', border: '1px solid #e5e7eb',
              borderRadius: 20, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
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
      </div>

      {/* Productos */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
            Cargando catálogo...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
            {items.length === 0
              ? 'No hay productos disponibles con precio asignado.'
              : 'Sin resultados para esa búsqueda.'}
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
                  qty={carrito[item.id] || 0}
                  onAdd={addItem} onRemove={removeItem} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cart panel */}
      {showCart && (
        <CartPanel
          carrito={carrito} items={items} session={session}
          onClose={() => setShowCart(false)}
          onConfirm={() => { setCarrito({}); setShowCart(false); }}
        />
      )}
    </div>
  );
}
