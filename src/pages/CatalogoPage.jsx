// ── CatalogoPage — Portal público de catálogo estilo Faire ───────────────────
// GET /catalogo?org=aryes           → catálogo público sin precios (modo vitrina)
// GET /catalogo?org=aryes&cliente=X → catálogo con precios del cliente (modo compra)

import { useState, useEffect, useMemo } from 'react';
import { fmt } from '../lib/constants.js';

const G    = '#1a8a3c';
const SANS = "'DM Sans','Inter',system-ui,sans-serif";
const API  = import.meta.env.VITE_API_BASE || '';

// ── Placeholder cuando no hay imagen ────────────────────────────────────────
function ImgPlaceholder({ marca, categoria }) {
  const initials = (marca || categoria || '?').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: G + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: G,
      }}>{initials}</div>
      {marca && <span style={{ fontSize: 10, color: '#b0b0a8', fontWeight: 600, letterSpacing: .4 }}>{marca.toUpperCase()}</span>}
    </div>
  );
}

// ── Card vista GRID (estilo Faire) ────────────────────────────────────────────
function GridCard({ item, onAbrirModal }) {
  const [imgErr, setImgErr] = useState(false);
  const hasImg = item.imagen_url && !imgErr;

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #efefeb',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'border-color .15s, box-shadow .15s', cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8c8c0'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#efefeb'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Imagen */}
      <div style={{
        height: 160, background: hasImg ? '#f8f8f5' : '#f4f4f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {hasImg
          ? <img src={item.imagen_url} alt={item.nombre} onError={() => setImgErr(true)}
              style={{ maxHeight: 130, maxWidth: '85%', objectFit: 'contain' }} />
          : <ImgPlaceholder marca={item.marca} categoria={item.categoria} />
        }
        {item.marca && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(255,255,255,.92)', borderRadius: 6,
            padding: '2px 7px', fontSize: 9, fontWeight: 700,
            color: '#5a5a52', letterSpacing: .5,
          }}>{item.marca.toUpperCase()}</div>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, color: '#a0a098', letterSpacing: .3 }}>{item.categoria}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', lineHeight: 1.35, flex: 1 }}>
          {item.nombre}
        </div>
        {item.descripcion && (
          <div style={{ fontSize: 11, color: '#7a7a72', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.descripcion}
          </div>
        )}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b0b0a8" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ fontSize: 12, color: '#b0b0a8' }}>Solo para clientes</span>
        </div>
      </div>
    </div>
  );
}



// ── Modal de pedido ───────────────────────────────────────────────────────────
function PedidoModal({ carrito, onClose, whatsapp, showPrice }) {
  const [nombre, setNombre] = useState('');
  const [nota, setNota] = useState('');
  const total = carrito.reduce((s, it) => s + (it.precio || 0) * it.qty, 0);

  const enviar = () => {
    if (!nombre.trim()) { alert('Ingresá tu nombre o empresa'); return; }
    const lineas = carrito.map(it =>
      showPrice && it.precio > 0
        ? `• ${it.nombre} × ${it.qty} ${it.unidad} = ${fmt.currencyCompact(it.precio * it.qty)}`
        : `• ${it.nombre} × ${it.qty} ${it.unidad}`
    ).join('\n');
    const msg = [
      `Hola, soy *${nombre.trim()}* y quiero hacer un pedido:`,
      '', lineas, '',
      showPrice && total > 0 ? `*TOTAL: ${fmt.currencyCompact(total)}*` : '',
      nota.trim() ? `\nNotas: ${nota.trim()}` : '',
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 24px 32px', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: '#e0e0d8', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a18', marginBottom: 16 }}>Tu pedido</div>

        {carrito.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f3ef', fontSize: 13 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{it.nombre}</span>
              <span style={{ color: '#9a9a92', marginLeft: 6 }}>× {it.qty} {it.unidad}</span>
            </div>
            {showPrice && it.precio > 0 && <span style={{ fontWeight: 700, color: G }}>{fmt.currencyCompact(it.precio * it.qty)}</span>}
          </div>
        ))}

        {showPrice && total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15, borderTop: '1.5px solid #e8e8e0', marginTop: 4 }}>
            <span>Total</span><span style={{ color: G }}>{fmt.currencyCompact(total)}</span>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre o empresa *"
            style={{ padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 8, fontSize: 13, fontFamily: SANS }} />
          <textarea value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Notas (día de entrega, observaciones...)"
            rows={2} style={{ padding: '10px 12px', border: '1px solid #e0e0d8', borderRadius: 8, fontSize: 13, fontFamily: SANS, resize: 'none' }} />
        </div>

        <button onClick={enviar} style={{
          width: '100%', marginTop: 16, padding: '13px 0',
          background: '#25D366', color: '#fff', border: 'none', borderRadius: 10,
          fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: SANS,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Enviar pedido por WhatsApp
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────


const PAISES = [
  { code: 'UY', label: 'UY', prefix: '598', flag: '🇺🇾' },
  { code: 'AR', label: 'AR', prefix: '54',  flag: '🇦🇷' },
  { code: 'CL', label: 'CL', prefix: '56',  flag: '🇨🇱' },
  { code: 'BR', label: 'BR', prefix: '55',  flag: '🇧🇷' },
  { code: 'CO', label: 'CO', prefix: '57',  flag: '🇨🇴' },
  { code: 'MX', label: 'MX', prefix: '52',  flag: '🇲🇽' },
  { code: 'PE', label: 'PE', prefix: '51',  flag: '🇵🇪' },
  { code: 'PY', label: 'PY', prefix: '595', flag: '🇵🇾' },
  { code: 'BO', label: 'BO', prefix: '591', flag: '🇧🇴' },
  { code: 'EC', label: 'EC', prefix: '593', flag: '🇪🇨' },
];

// PhoneInput — selector de país + número
// value: solo el número sin prefijo
// onChange(fullNumber) devuelve +598XXXXXXXX
function PhoneInput({ value, onChange, placeholder = '9X XXX XXX', style = {} }) {
  const [pais,   setPais]   = useState('UY');
  const [numero, setNumero] = useState('');

  const selected = PAISES.find(p => p.code === pais) || PAISES[0];

  const handleChange = (num) => {
    setNumero(num);
    const clean = num.replace(/\D/g, '');
    onChange(clean ? `+${selected.prefix}${clean}` : '');
  };

  const handlePais = (code) => {
    setPais(code);
    const found = PAISES.find(p => p.code === code) || PAISES[0];
    const clean = numero.replace(/\D/g, '');
    onChange(clean ? `+${found.prefix}${clean}` : '');
  };

  const F = "'DM Sans','Inter',system-ui,sans-serif";

  return (
    <div style={{ display: 'flex', border: '1px solid #e0e0d8', borderRadius: 8,
      overflow: 'hidden', background: '#fafaf7', ...style }}>
      <select value={pais} onChange={e => handlePais(e.target.value)}
        style={{ border: 'none', background: 'transparent', padding: '9px 6px 9px 10px',
          fontSize: 13, fontFamily: F, color: '#1a1a18', cursor: 'pointer',
          outline: 'none', borderRight: '1px solid #e0e0d8', flexShrink: 0 }}>
        {PAISES.map(p => (
          <option key={p.code} value={p.code}>{p.flag} +{p.prefix}</option>
        ))}
      </select>
      <input
        type="tel"
        value={numero}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', background: 'transparent',
          padding: '9px 12px', fontSize: 13, fontFamily: F,
          color: '#1a1a18', outline: 'none', minWidth: 0 }}
      />
    </div>
  );
}

// ── Formulario "Quiero ser cliente" ──────────────────────────────────────────
function SolicitarAcceso({ ownerPhone, distribuidora, onEnviado }) {
  const [nombre,  setNombre]  = useState('');
  const [empresa, setEmpresa] = useState('');
  const [tel,     setTel]     = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = () => {
    if (!nombre.trim() || !tel.trim()) return;
    const msg = [
      `Hola, quiero ser cliente de *${distribuidora || 'su distribuidora'}*.`,
      ``,
      `*Nombre:* ${nombre.trim()}`,
      empresa.trim() ? `*Empresa:* ${empresa.trim()}` : '',
      `*Teléfono:* ${tel.trim()}`,
      mensaje.trim() ? `*Consulta:* ${mensaje.trim()}` : '',
    ].filter(Boolean).join('\n');
    const phone = (ownerPhone || '').replace(/\D/g, '');
    if (!phone) { alert('El distribuidor no tiene número configurado.'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    setEnviado(true);
    if (onEnviado) setTimeout(onEnviado, 2500);
  };

  const inp = {
    width: '100%', padding: '9px 12px', border: '1px solid #e0e0d8',
    borderRadius: 8, fontSize: 13, fontFamily: SANS,
    boxSizing: 'border-box', outline: 'none', background: '#fafaf7',
  };

  if (enviado) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a8a3c" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>¡Solicitud enviada!</div>
      <div style={{ fontSize: 13, color: '#9a9a92' }}>
        Te contactamos a la brevedad.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', marginBottom: 5 }}>Nombre *</div>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre" style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', marginBottom: 5 }}>Empresa / negocio</div>
          <input value={empresa} onChange={e => setEmpresa(e.target.value)}
            placeholder="Panadería, restaurante..." style={inp} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', marginBottom: 5 }}>Teléfono / WhatsApp *</div>
        <PhoneInput value={tel} onChange={setTel} placeholder="9X XXX XXX" />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', marginBottom: 5 }}>¿Qué productos te interesan? (opcional)</div>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)}
          placeholder="Ej: chocolates, bases para helado..."
          rows={2} style={{ ...inp, resize: 'none' }} />
      </div>
      <button onClick={enviar} disabled={!nombre.trim() || !tel.trim()}
        style={{
          padding: '11px 0', borderRadius: 10, border: 'none',
          cursor: nombre.trim() && tel.trim() ? 'pointer' : 'not-allowed',
          background: nombre.trim() && tel.trim() ? '#25D366' : '#e8e8e0',
          color: nombre.trim() && tel.trim() ? '#fff' : '#a0a098',
          fontSize: 13, fontWeight: 600, fontFamily: SANS,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all .15s',
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enviar por WhatsApp
      </button>
    </div>
  );
}

export default function CatalogoPage() {
  const [items,     setItems]     = useState([]);
  const [cats,      setCats]      = useState([]);
  const [brandCfg,  setBrandCfg]  = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [q,         setQ]         = useState('');
  const [catActiva, setCatActiva] = useState('Todos');
  const [marca,     setMarca]     = useState('Todas');
  const [ddOpen,    setDdOpen]    = useState(false);
  const NAV_MAX = 10;
  const [modalCliente, setModalCliente] = useState(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const org       = params.get('org')     || 'aryes';
  const clienteId = params.get('cliente') || '';
  const showPrice = !!clienteId;

  // Cargar productos + config de marca en paralelo
  useEffect(() => {
    setLoading(true);
    const catUrl = `${API}/api/catalogo?org=${org}${clienteId ? `&cliente=${clienteId}` : ''}`;
    const cfgUrl = `${API}/api/catalogo?org=${org}&config=1`;

    fetch(catUrl)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setItems(d.items || []);
        setCats(['Todos', ...(d.categorias || [])]);
        if (d.portalCfg) setBrandCfg(d.portalCfg);
        if (d.brandCfg) setBrandCfg(prev => ({...prev, ...d.brandCfg}));
      })
      .catch(() => setError('No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false));
  }, [org, clienteId]);

  // Marcas únicas
  const marcas = useMemo(() => {
    const ms = [...new Set(items.map(i => i.marca).filter(Boolean))].sort();
    return ms.length > 1 ? ['Todas', ...ms] : [];
  }, [items]);

  const filtered = useMemo(() => items.filter(it => {
    const mQ   = !q || it.nombre.toLowerCase().includes(q.toLowerCase()) || it.marca?.toLowerCase().includes(q.toLowerCase()) || it.descripcion?.toLowerCase().includes(q.toLowerCase());
    const mCat = catActiva === 'Todos' || it.categoria === catActiva;
    const mMar = marca === 'Todas' || it.marca === marca;
    return mQ && mCat && mMar;
  }), [items, q, catActiva, marca]);

  const totalCarrito = 0;
  const portalCfg = brandCfg || {};
  const portalDisabled = portalCfg.portalCatalogo === false;
  const pedidosEnabled = portalCfg.portalPedidos !== false;
  const whatsapp = brandCfg?.ownerPhone?.replace(/\D/g,'') || '59899000000';

  const nombre = brandCfg?.nombre || 'Catálogo';
  const logo   = brandCfg?.logoUrl || null;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS }}>
      {/* ── Header estilo Faire ── */}
      <header style={{ background: '#fff', borderBottom: '0.5px solid #e8e8e0', position: 'sticky', top: 0, zIndex: 100 }} onClick={() => setDdOpen(false)}>

        {/* Fila 1: logo | búsqueda | CTA */}
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px', height: 66, display: 'flex', alignItems: 'center', gap: 16, borderBottom: '0.5px solid #f0f0ec' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            {logo
              ? <img src={logo} alt={nombre} style={{ height: 28, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
              : <div style={{ width: 28, height: 28, background: G, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
            }
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', whiteSpace: 'nowrap' }}>{nombre || 'Catálogo'}</span>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 560 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0a098" strokeWidth="2"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar producto o marca..."
                style={{ width: '100%', padding: '9px 16px 9px 36px',
                  border: '1.5px solid #e0e0d8', borderRadius: 28,
                  fontSize: 13, fontFamily: SANS, boxSizing: 'border-box',
                  background: '#f7f7f4', outline: 'none', color: '#1a1a18' }}
                onFocus={e => e.target.style.borderColor = G}
                onBlur={e => e.target.style.borderColor = '#e0e0d8'} />
            </div>
          </div>

          <button onClick={e => { e.stopPropagation(); setModalCliente(true); }} style={{
            padding: '8px 20px', borderRadius: 28, border: 'none',
            background: G, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Quiero ser cliente
          </button>
        </div>

        {/* Fila 2: nav de categorías estilo Faire */}
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, position: 'relative' }}>
          {cats.map((cat, i) => {
            if (i < NAV_MAX || cats.length <= NAV_MAX + 1) return (
              <button key={cat} onClick={() => { setCatActiva(cat); setDdOpen(false); }} style={{
                padding: '0 16px', height: 44, border: 'none', background: 'transparent',
                fontSize: 14, fontWeight: catActiva === cat ? 500 : 400,
                color: catActiva === cat ? G : '#5a5a52',
                borderBottom: catActiva === cat ? `2px solid ${G}` : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: SANS,
                letterSpacing: '0.1px', transition: 'color .12s',
              }}
                onMouseEnter={e => { if (catActiva !== cat) e.target.style.color = '#1a1a18'; }}
                onMouseLeave={e => { if (catActiva !== cat) e.target.style.color = '#5a5a52'; }}
              >{cat}</button>
            );
            return null;
          })}

          {cats.length > NAV_MAX + 1 && (
            <div style={{ position: 'relative' }}
              onMouseEnter={() => setDdOpen(true)}
              onMouseLeave={() => setDdOpen(false)}
              onClick={e => e.stopPropagation()}>
              <button style={{
                padding: '0 16px', height: 44, border: 'none', background: 'transparent',
                fontSize: 14, color: ddOpen ? G : '#5a5a52', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontFamily: SANS,
                letterSpacing: '0.1px',
                borderBottom: cats.slice(NAV_MAX).includes(catActiva) ? `2px solid ${G}` : '2px solid transparent',
                fontWeight: cats.slice(NAV_MAX).includes(catActiva) ? 500 : 400,
              }}>
                {cats.slice(NAV_MAX).includes(catActiva) ? catActiva : 'Más'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {ddOpen && (
                <div style={{
                  position: 'absolute', top: 44, right: 0,
                  background: '#fff', border: '0.5px solid #e0e0d8',
                  borderRadius: 10, padding: '6px 0', minWidth: 200,
                  boxShadow: '0 4px 16px rgba(0,0,0,.08)', zIndex: 200,
                }}>
                  {cats.slice(NAV_MAX).map(cat => (
                    <button key={cat} onClick={() => { setCatActiva(cat); setDdOpen(false); }} style={{
                      display: 'block', width: '100%', padding: '8px 16px',
                      border: 'none', background: catActiva === cat ? '#f0fdf4' : 'transparent',
                      fontSize: 13, color: catActiva === cat ? G : '#3a3a32',
                      textAlign: 'left', cursor: 'pointer', fontFamily: SANS,
                      fontWeight: catActiva === cat ? 600 : 400,
                    }}
                      onMouseEnter={e => { if (catActiva !== cat) e.target.style.background = '#f7f7f4'; }}
                      onMouseLeave={e => { if (catActiva !== cat) e.target.style.background = 'transparent'; }}
                    >{cat}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 60px' }}>
        <div style={{ minWidth: 0 }}>

          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 14, height: 260, border: '1px solid #efefeb', opacity: 0.6 }} />
              ))}
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>
              <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 20px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Reintentar</button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div style={{ fontSize: 11, color: '#a0a098', marginBottom: 14 }}>
                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
                {catActiva !== 'Todos' ? ` · ${catActiva}` : ''}
                {marca !== 'Todas' ? ` · ${marca}` : ''}
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a0a098' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: .4 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <p style={{ fontSize: 14 }}>Sin resultados para "{q}"</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                  {filtered.map(item => (
                    <GridCard key={item.id} item={item} onAbrirModal={() => setModalCliente(true)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Carrito flotante mobile ── */}
      {totalCarrito > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200 }}>
          <button onClick={() => setModal(true)} style={{
            background: G, color: '#fff', border: 'none', borderRadius: '50%',
            width: 56, height: 56, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,138,60,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.96 1.61h9.72a2 2 0 001.95-1.56L23 6H6"/></svg>
            <span style={{ position: 'absolute', top: -3, right: -3, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalCarrito}</span>
          </button>
        </div>
      )}

      {/* ── Modal quiero ser cliente ── */}
      {modalCliente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setModalCliente(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
            overflow: 'hidden', fontFamily: SANS }}
            onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0ede8',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a18', marginBottom: 3 }}>
                  Quiero ser cliente
                </div>
                <div style={{ fontSize: 13, color: '#9a9a92' }}>
                  Completá tus datos y te contactamos para darte acceso.
                </div>
              </div>
              <button onClick={() => setModalCliente(false)}
                style={{ background: '#f4f4f0', border: 'none', borderRadius: 8,
                  width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#6a6a68',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ×
              </button>
            </div>
            {/* Cuerpo */}
            <div style={{ padding: '20px 24px' }}>
              <SolicitarAcceso
                ownerPhone={brandCfg?.ownerPhone || ''}
                distribuidora={brandCfg?.nombre || ''}
                onEnviado={() => setTimeout(() => setModalCliente(false), 2500)}
              />
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
