// ── CatalogoPage — Portal público de catálogo para clientes ───────────────────
// Accessible at /catalogo?org=aryes
// No authentication required. Reads from /api/catalogo (public endpoint).
// Clients can browse products and send orders via WhatsApp.

import { useState, useEffect, useMemo } from 'react';

const G       = '#3a7d1e';
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_CATALOG || '59899000000';
const API_BASE = import.meta.env.VITE_API_BASE || '';

function fmtUSD(n) {
  return 'US$ ' + Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ item, onPedir }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 6px rgba(0,0,0,.07)',
      display: 'flex', flexDirection: 'column', gap: 8,
      border: '1px solid #f0f0ec',
      transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,.07)'}
    >
      {/* Category badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: .6, color: G, background: G + '18',
          padding: '2px 8px', borderRadius: 20,
        }}>{item.categoria}</span>
        {item.marca && (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.marca}</span>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 15, fontWeight: 700, color: '#1a1a1a',
        lineHeight: 1.3, flex: 1,
      }}>{item.nombre}</div>

      {/* Price + unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: G }}>{fmtUSD(item.precio)}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>/ {item.unidad}</span>
      </div>

      {/* Order button */}
      <button onClick={() => onPedir(item)} style={{
        marginTop: 4, padding: '9px 0', background: G, color: '#fff',
        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
        cursor: 'pointer', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span>🛒</span> Pedir por WhatsApp
      </button>
    </div>
  );
}

// ── Order composer modal ──────────────────────────────────────────────────────
function PedidoModal({ carrito, onClose }) {
  const [nombre, setNombre] = useState('');
  const [nota,   setNota]   = useState('');

  const total = carrito.reduce((s, it) => s + it.precio * it.qty, 0);

  const enviar = () => {
    if (!nombre.trim()) { alert('Por favor ingresá tu nombre o empresa'); return; }
    const lineas = carrito
      .map(it => `• ${it.nombre} × ${it.qty} ${it.unidad} = ${fmtUSD(it.precio * it.qty)}`)
      .join('\n');
    const msg = [
      `Hola, soy *${nombre.trim()}* y quiero hacer un pedido:`,
      '',
      lineas,
      '',
      `*TOTAL: ${fmtUSD(total)}*`,
      nota.trim() ? `\nNotas: ${nota.trim()}` : '',
    ].join('\n');
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28,
        maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, margin: 0 }}>Tu pedido</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        {/* Items */}
        <div style={{ marginBottom: 16 }}>
          {carrito.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{it.nombre}</span>
                <span style={{ color: '#6b7280', marginLeft: 6 }}>× {it.qty} {it.unidad}</span>
              </div>
              <span style={{ fontWeight: 700, color: G }}>{fmtUSD(it.precio * it.qty)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 800, fontSize: 15 }}>
            <span>TOTAL</span>
            <span style={{ color: G }}>{fmtUSD(total)}</span>
          </div>
        </div>

        {/* Contact */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
            Tu nombre o empresa *
          </label>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Panadería La Aurora"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
            Notas adicionales
          </label>
          <textarea value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Día preferido de entrega, observaciones..."
            rows={2}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <button onClick={enviar} style={{
          width: '100%', padding: '13px 0', background: '#25d366', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>💬</span> Enviar pedido por WhatsApp
        </button>
        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
          Se abrirá WhatsApp con tu pedido listo para enviar.
        </p>
      </div>
    </div>
  );
}

// ── Main catalog page ─────────────────────────────────────────────────────────
export default function CatalogoPage() {
  const [items,      setItems]      = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [q,          setQ]          = useState('');
  const [catActiva,  setCatActiva]  = useState('Todos');
  const [carrito,    setCarrito]    = useState([]); // [{...item, qty}]
  const [modalOpen,  setModalOpen]  = useState(false);

  // Read org from URL ?org=aryes
  const org = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('org') || 'aryes';
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/catalogo?org=${org}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        setItems(data.items || []);
        setCategorias(['Todos', ...(data.categorias || [])]);
      })
      .catch(() => setError('No se pudo cargar el catálogo. Intentá de nuevo.'))
      .finally(() => setLoading(false));
  }, [org]);

  const itemsFiltrados = useMemo(() => {
    return items.filter(it => {
      const matchQ   = !q || it.nombre.toLowerCase().includes(q.toLowerCase()) || it.marca?.toLowerCase().includes(q.toLowerCase());
      const matchCat = catActiva === 'Todos' || it.categoria === catActiva;
      return matchQ && matchCat;
    });
  }, [items, q, catActiva]);

  const agregarAlCarrito = (item) => {
    setCarrito(prev => {
      const exists = prev.find(x => x.id === item.id);
      if (exists) return prev.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const totalCarrito = carrito.reduce((s, it) => s + it.qty, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: "'DM Sans','Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e5e5e0', position: 'sticky',
        top: 0, zIndex: 100, padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, height: 64 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 36, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
              Catálogo
            </span>
          </div>
          {/* Cart button */}
          {totalCarrito > 0 && (
            <button onClick={() => setModalOpen(true)} style={{
              background: G, color: '#fff', border: 'none', borderRadius: 10,
              padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🛒 Ver pedido
              <span style={{ background: '#fff', color: G, borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                {totalCarrito}
              </span>
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 60px' }}>
        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar producto o marca..."
            style={{
              flex: 1, minWidth: 200, padding: '10px 14px',
              border: '1px solid #e5e5e0', borderRadius: 10, fontSize: 14,
              fontFamily: 'inherit', background: '#fff',
            }}
          />
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCatActiva(cat)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: catActiva === cat ? G : '#f3f4f6',
              color:      catActiva === cat ? '#fff' : '#374151',
              transition: 'all .15s',
            }}>
              {cat}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ fontSize: 15 }}>Cargando catálogo...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#dc2626' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 15 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              style={{ marginTop: 12, padding: '8px 20px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && itemsFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 15 }}>No se encontraron productos para "{q}"</p>
          </div>
        )}

        {/* Products grid */}
        {!loading && !error && itemsFiltrados.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
              {itemsFiltrados.length} producto{itemsFiltrados.length !== 1 ? 's' : ''}
              {catActiva !== 'Todos' ? ` en ${catActiva}` : ''}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {itemsFiltrados.map(item => (
                <ProductCard key={item.id} item={item} onPedir={agregarAlCarrito} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating cart button (mobile) */}
      {totalCarrito > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}>
          <button onClick={() => setModalOpen(true)} style={{
            background: G, color: '#fff', border: 'none', borderRadius: 50,
            width: 60, height: 60, fontSize: 22, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(58,125,30,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            🛒
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#dc2626', color: '#fff', borderRadius: 20,
              fontSize: 10, fontWeight: 800, padding: '1px 5px', minWidth: 18, textAlign: 'center',
            }}>{totalCarrito}</span>
          </button>
        </div>
      )}

      {/* Order modal */}
      {modalOpen && carrito.length > 0 && (
        <PedidoModal carrito={carrito} onClose={() => setModalOpen(false)} org={org} />
      )}
    </div>
  );
}
