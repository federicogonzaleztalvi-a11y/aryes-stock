// LandingPage.jsx — Pazque landing page v8
// Design: Stripe clarity × Linear aesthetic × Faire warmth
// Typography: DM Serif Display (titles) + DM Sans (body)
import { useState, useEffect, useRef } from 'react';

const G = '#059669';
const F = {
  serif: "'DM Serif Display','Playfair Display',Georgia,serif",
  sans: "'DM Sans','Inter',system-ui,sans-serif",
};

// ── Fade-in on scroll ────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Screenshot with browser chrome ───────────────────────────────────────
function BrowserFrame({ src, alt, style = {} }) {
  return (
    <div style={{ background: '#e8e8e6', borderRadius: 12, padding: '8px 8px 0', ...style }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 8, paddingLeft: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} />
      </div>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ width: '100%', display: 'block', borderRadius: '6px 6px 0 0' }}
      />
    </div>
  );
}

// ── Responsive hook ──────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}


function ROICalc() {
  const [horasDia, setHorasDia] = useState(3);
  const [ventasDia, setVentasDia] = useState(15);
  const [errorPct, setErrorPct] = useState(5);

  const horasMes = horasDia * 22;
  const horasAhorro = Math.round(horasMes * 0.7);
  const costoHora = 8;
  const ahorroPesos = horasAhorro * costoHora;
  const ventasMes = ventasDia * 22;
  const ventasPerdidas = Math.round(ventasMes * (errorPct / 100));
  const ticketPromedio = 120;
  const recuperado = ventasPerdidas * ticketPromedio;

  const sl = { width: '100%', accentColor: G, cursor: 'pointer' };
  const lbl = { fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' };
  const val = { fontSize: 15, fontWeight: 600, color: '#1a1a18' };

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e6', padding: '24px', marginBottom: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={lbl}>Horas por día en planillas / WhatsApp</span>
            <span style={val}>{horasDia}h</span>
          </div>
          <input type="range" min="1" max="8" value={horasDia} onChange={e => setHorasDia(Number(e.target.value))} style={sl} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={lbl}>Ventas / entregas por día</span>
            <span style={val}>{ventasDia}</span>
          </div>
          <input type="range" min="5" max="60" step="5" value={ventasDia} onChange={e => setVentasDia(Number(e.target.value))} style={sl} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={lbl}>Errores en pedidos / stock (%)</span>
            <span style={val}>{errorPct}%</span>
          </div>
          <input type="range" min="1" max="15" value={errorPct} onChange={e => setErrorPct(Number(e.target.value))} style={sl} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e6', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: G, fontFamily: F.sans }}>{horasAhorro}h</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>horas libres por mes</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e6', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: G, fontFamily: F.sans }}>US$ {ahorroPesos}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>en tiempo recuperado</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e6', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: G, fontFamily: F.sans }}>{ventasPerdidas}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>errores evitados por mes</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e6', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: G, fontFamily: F.sans }}>US$ {recuperado}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>en ventas no perdidas</div>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button onClick={function() { window.location.href = '/register'; }}
          style={{ padding: '14px 32px', background: G, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Empezar gratis
        </button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const mobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: F.sans, color: '#1a1a18' }}>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,249,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 56, overflow: 'hidden' }}>
            <img src="/pazque-logo.png" alt="Pazque" style={{ height: 180, objectFit: 'contain', margin: '0 -55px' }} onError={e => e.target.style.display='none'} />
          </div>

          {!mobile && (
            <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
              <span onClick={() => scrollTo('producto')} style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>Producto</span>
              <span onClick={() => scrollTo('precios')} style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>Precios</span>
              <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Pazque" target="_blank" rel="noreferrer"
                style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer', textDecoration: 'none' }}>Contacto</a>
              <span onClick={() => window.location.href = '/app'} style={{
                fontSize: 13, color: '#4b4b48', cursor: 'pointer', fontWeight: 500,
                padding: '7px 16px', border: '1px solid #d4d4d0', borderRadius: 8,
                transition: 'border-color 0.2s, background 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#b0b0ac'; e.currentTarget.style.background = '#f5f5f3'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d4d4d0'; e.currentTarget.style.background = 'transparent'; }}
              >
                Iniciar sesión
              </span>
            </div>
          )}

          {mobile && (
            <div onClick={() => setMenuOpen(!menuOpen)} style={{ cursor: 'pointer', padding: 8, fontSize: 20, color: '#6b7280' }}>
              {menuOpen ? '✕' : '☰'}
            </div>
          )}
        </div>

        {mobile && menuOpen && (
          <div style={{
            background: '#fafaf9', borderTop: '1px solid rgba(0,0,0,0.05)',
            padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <span onClick={() => scrollTo('producto')} style={{ fontSize: 15, color: '#6b7280', cursor: 'pointer' }}>Producto</span>
            <span onClick={() => scrollTo('precios')} style={{ fontSize: 15, color: '#6b7280', cursor: 'pointer' }}>Precios</span>
            <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Pazque" target="_blank" rel="noreferrer"
              style={{ fontSize: 15, color: '#6b7280', textDecoration: 'none' }}>Contacto</a>
            <span onClick={() => window.location.href = '/app'} style={{ fontSize: 15, color: '#6b7280', cursor: 'pointer' }}>Iniciar sesión</span>
            <button onClick={() => { setMenuOpen(false); window.location.href = '/register'; }}
              style={{ padding: '12px', background: G, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Probar 14 días gratis
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: mobile ? '48px 20px 0' : '72px 24px 0', textAlign: 'center' }}>
        <FadeIn>
          <div style={{
            display: 'inline-block', background: '#eef7ee', color: G,
            fontSize: 12, fontWeight: 500, padding: '5px 14px', borderRadius: 20, marginBottom: 20,
          }}>
            Reemplazá Excel en 24 horas
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 style={{
            fontFamily: F.serif, fontSize: mobile ? 32 : 'clamp(36px, 5vw, 56px)',
            fontWeight: 400, lineHeight: 1.1, letterSpacing: -1,
            margin: '0 auto 18px', maxWidth: 680,
          }}>
            Dejá de operar con planillas y WhatsApp suelto
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p style={{ fontSize: mobile ? 15 : 17, color: '#6b7280', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 32px' }}>
            Inventario, ventas, rutas, cobros y portal B2B en un solo lugar.
            Sin sistemas de USD 30.000. Listo en 24 horas.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => window.location.href = '/register'}
              style={{
                padding: '14px 32px', background: G, color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Probar 14 días gratis
            </button>
            <button onClick={() => window.location.href = '/app?demo=true'}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 28px', background: 'transparent', color: '#6b7280',
                border: '1px solid #e5e5e3', borderRadius: 10, fontSize: 15,
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#c0c0bc'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e3'}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%', border: '1.5px solid #c0c0bc',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
              }}>▶</span>
              Explorá el producto
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#9a9a96', margin: '0 0 48px' }}>Sin tarjeta de crédito · Cancelá cuando quieras</p>
        </FadeIn>

        <FadeIn delay={0.4}>
          <BrowserFrame
            src="/screenshots/dashboard.png"
            alt="Dashboard de Pazque con KPIs financieros y operativos"
            style={{ maxWidth: 960, margin: '0 auto', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
          />
        </FadeIn>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        <FadeIn>
          <div style={{
            display: 'flex', justifyContent: 'space-around', textAlign: 'center',
            padding: '28px 0',
            flexWrap: 'wrap', gap: 24,
          }}>
            {[
              { val: '14 días', sub: 'Gratis para probar' },
              { val: '$0', sub: 'Costo implementación' },
              { val: '24hs', sub: 'Listo para operar' },
            ].map(m => (
              <div key={m.val}>
                <div style={{ fontSize: 28, fontWeight: 500, color: '#1a1a18', fontFamily: F.serif }}>{m.val}</div>
                <div style={{ fontSize: 13, color: '#9a9a96', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── Tres pilares ─────────────────────────────────────────────────── */}
      <section id="producto" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 80px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 28 : 'clamp(28px, 3.5vw, 40px)', fontWeight: 400, margin: '0 0 8px' }}>
              Tres pilares, un sistema
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
              Todo conectado — el pedido del cliente llega, el stock baja, la ruta se arma
            </p>
          </div>
        </FadeIn>

        {/* Pilar 1 — WMS */}
        <FadeIn>
          <div style={{
            display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1fr) minmax(0,1.2fr)', gap: mobile ? 24 : 40,
            alignItems: 'center', marginBottom: 64,
          }}>
            <div>
              <div style={{
                width: 44, height: 44, background: '#eaf3de', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 500, color: '#3b6d11', marginBottom: 16,
              }}>WMS</div>
              <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400, margin: '0 0 8px' }}>Inventario y almacén</h3>
              <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                Stock en tiempo real con barras visuales, alertas de reposición, punto de reorden automático,
                lotes con vencimiento, recepciones con auditoría completa. 250+ SKUs sin esfuerzo.
              </p>
            </div>
            <BrowserFrame
              src="/screenshots/inventario.png"
              alt="Vista de inventario con stocks, proveedores y estados"
              style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}
            />
          </div>
        </FadeIn>

        {/* Pilar 2 — TMS */}
        <FadeIn>
          <div style={{
            display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.2fr) minmax(0,1fr)', gap: mobile ? 24 : 40,
            alignItems: 'center', marginBottom: 64,
          }}>
            <BrowserFrame
              src="/screenshots/rutas.png"
              alt="Vista de rutas con vehículos, zonas y entregas"
              style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.06)', order: mobile ? 2 : 1 }}
            />
            <div style={{ order: mobile ? 1 : 2 }}>
              <div style={{
                width: 44, height: 44, background: '#e6f1fb', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 500, color: '#185fa5', marginBottom: 16,
              }}>TMS</div>
              <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400, margin: '0 0 8px' }}>Ventas, rutas y entregas</h3>
              <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                Rutas optimizadas por zona, GPS live del conductor, ETA por parada, firma digital,
                foto de entrega y tracking público para tus clientes. Todo en tiempo real.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Pilar 3 — B2B */}
        <FadeIn>
          <div style={{
            display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1fr) minmax(0,1.2fr)', gap: mobile ? 24 : 40,
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                width: 44, height: 44, background: '#eeedfe', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 500, color: '#534ab7', marginBottom: 16,
              }}>B2B</div>
              <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400, margin: '0 0 8px' }}>Portal de pedidos para tus clientes</h3>
              <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                Tus clientes entran con OTP por WhatsApp, ven su catálogo con precios personalizados,
                arman el pedido y te llega directo al sistema. Sin llamadas, sin errores.
              </p>
            </div>
            <div style={{ background: '#f5f5f3', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Catálogo — Panadería Don Luis</div>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { name: 'Harina 000 x25kg', price: '$680' },
                  { name: 'Muzzarella x5kg', price: '$350' },
                  { name: 'Aceite girasol 5L', price: '$380' },
                ].map(p => (
                  <div key={p.name} style={{ background: '#fff', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={{
                      width: '100%', height: 48, background: '#f0eeeb', borderRadius: 8,
                      marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>📦</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#9a9a96', marginBottom: 10 }}>{p.price} /u</div>
                    <div style={{
                      background: G, color: '#fff', borderRadius: 6, padding: '6px 0',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}>Agregar</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Diferenciador ────────────────────────────────────────────────── */}
      <section style={{ background: '#eaf3de', padding: mobile ? '48px 20px' : '64px 24px' }}>
        <FadeIn>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#3b6d11', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Lo que nadie más tiene
            </div>
            <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 22 : 'clamp(24px, 3vw, 32px)', fontWeight: 400, color: '#27500a', margin: '0 0 24px' }}>
              Tu cliente y vos operan en la misma plataforma
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {['Cliente pide', 'Stock baja', 'Ruta se arma', 'Entrega con firma'].map((step, i) => (
                <span key={step} style={{ display: 'contents' }}>
                  <span style={{
                    background: '#fff', borderRadius: 8, padding: mobile ? '8px 12px' : '10px 16px',
                    fontSize: 13, fontWeight: 500, color: '#27500a',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>{step}</span>
                  {i < 3 && <span style={{ color: '#3b6d11', fontSize: 16 }}>→</span>}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#3b6d11', margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Todo automático. Sin copiar y pegar. Sin llamar al depósito.
            </p>
          </div>
        </FadeIn>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="precios" style={{ maxWidth: 480, margin: '0 auto', padding: mobile ? '56px 20px' : '80px 24px', textAlign: 'center' }}>
        <FadeIn>
          <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 28 : 'clamp(28px, 3.5vw, 36px)', fontWeight: 400, margin: '0 0 6px' }}>
            Un plan, todo incluido
          </h2>
          <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 32 }}>14 días gratis. Sin contratos. Cancelá cuando quieras.</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{
            background: '#fff', border: '2px solid ' + G, borderRadius: 16,
            padding: mobile ? '32px 24px' : '36px 32px', position: 'relative',
            boxShadow: '0 8px 30px rgba(26,138,60,0.08)',
          }}>
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: G, color: '#fff', fontSize: 11, fontWeight: 500,
              padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>14 días gratis · Oferta de lanzamiento</div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18, color: '#b0b0ac', textDecoration: 'line-through' }}>$299</span>
              <span style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 400, color: '#1a1a18' }}>$199</span>
              <span style={{ fontSize: 15, color: '#9a9a96' }}>USD/mes</span>
            </div>
            <p style={{ fontSize: 13, color: G, fontWeight: 500, margin: '0 0 24px' }}>Precio fijo los primeros 3 meses</p>

            <div style={{ borderTop: '1px solid #f0eeeb', paddingTop: 20, textAlign: 'left', fontSize: 14, color: '#4b4b48', lineHeight: 2.2 }}>
              {['Inventario ilimitado', 'Ventas y facturación', 'Rutas con GPS y tracking', 'Portal B2B para tus clientes',
                'Dashboard con KPIs', 'Usuarios ilimitados', 'Soporte por WhatsApp'].map(f => (
                <div key={f}><span style={{ color: G, marginRight: 8 }}>✓</span>{f}</div>
              ))}
            </div>

            <button onClick={() => window.location.href = '/register'}
              style={{
                marginTop: 28, width: '100%', padding: '14px',
                background: G, color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 16, fontWeight: 500, cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Empezar 14 días gratis
            </button>
            <p style={{ fontSize: 12, color: '#9a9a96', marginTop: 12, marginBottom: 0 }}>Sin tarjeta de crédito</p>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section style={{ background: '#f5f5f3', padding: mobile ? '48px 20px' : '64px 24px', textAlign: 'center' }}>
        <FadeIn>
          <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 22 : 'clamp(24px, 3vw, 32px)', fontWeight: 400, margin: '0 0 8px' }}>
            ¿Todavía operando con Excel?
          </h2>
          <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 420, margin: '0 auto 28px' }}>
            Migrar toma menos de un día. 14 días gratis. Sin compromiso.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.href = '/register'}
              style={{
                padding: '14px 32px', background: G, color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>
              Empezar gratis
            </button>
            <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Pazque" target="_blank" rel="noreferrer"
              style={{
                padding: '14px 32px', background: '#fff', color: '#1a1a18',
                border: '1px solid #e5e5e3', borderRadius: 10, fontSize: 15,
                textDecoration: 'none', fontWeight: 500,
              }}>
              Hablar por WhatsApp
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ── Comparison table ──────────────────────────────────────────── */}
      <FadeIn>
        <section style={{ padding: '64px 24px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#3b6d11', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>COMPARATIVA</div>
            <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 28 : 36, color: '#1a1a18', fontWeight: 400, margin: 0 }}>
              Todo en un solo lugar
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 520, margin: '12px auto 0' }}>
              Otras herramientas resuelven una parte. Aryes conecta todo el flujo de tu distribuidora.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: F.sans }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e8e6' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9a9a98', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}></th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f0fdf4', borderRadius: '10px 10px 0 0', color: G, fontWeight: 700, fontSize: 14 }}>Pazque</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>Planillas y WhatsApp</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>Software de rutas</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>ERP / sistema contable</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Inventario en tiempo real', true, false, false, true],
                  ['Ventas y facturacion', true, false, false, true],
                  ['Rutas de entrega optimizadas', true, false, true, false],
                  ['Portal de pedidos para tus clientes', true, false, false, false],
                  ['Cobros y cuenta corriente', true, false, false, true],
                  ['Tracking en vivo para el cliente', true, false, true, false],
                  ['Alertas de stock y reposición', true, false, false, false],
                  ['WhatsApp integrado al flujo', true, false, false, false],
                  ['Listo en 24 horas', true, true, true, false],
                  ['Sin capacitación', true, true, false, false],
                ].map(function(row, i) {
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0ee' }}>
                      <td style={{ padding: '12px 16px', color: '#1a1a18', fontWeight: 500 }}>{row[0]}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', background: '#f0fdf4', fontSize: 16, color: G, fontWeight: 700 }}>{row[1] ? '\u2713' : '\u2014'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16, color: row[2] ? '#6b7280' : '#d1d5db' }}>{row[2] ? '\u2713' : '\u2014'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16, color: row[3] ? '#6b7280' : '#d1d5db' }}>{row[3] ? '\u2713' : '\u2014'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16, color: row[4] ? '#6b7280' : '#d1d5db' }}>{row[4] ? '\u2713' : '\u2014'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </FadeIn>

            {/* ── ROI Calculator ─────────────────────────────────────────────── */}
      <FadeIn>
        <section id="roi" style={{ padding: '64px 24px', background: '#f9f9f7', borderTop: '1px solid #e8e8e6' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#3b6d11', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>CALCULADORA</div>
              <h2 style={{ fontFamily: F.serif, fontSize: mobile ? 28 : 36, color: '#1a1a18', fontWeight: 400, margin: 0 }}>
                Cuánto te ahorra Aryes
              </h2>
              <p style={{ fontSize: 15, color: '#6b7280', margin: '12px auto 0' }}>
                Mové los controles y mirá el impacto en tu operación.
              </p>
            </div>
            <ROICalc />
          </div>
        </section>
      </FadeIn>

            {/* ── Email capture ────────────────────────────────────────────────── */}
      <FadeIn>
        <section style={{ padding: '48px 24px', background: '#f9f9f7', borderTop: '1px solid #e8e8e6' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: F.serif, color: '#1a1a18', marginBottom: 8 }}>
              No te pierdas nada
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Dejanos tu email y te avisamos cuando lancemos novedades.
            </p>
            <form onSubmit={function(e) {
              e.preventDefault();
              var emailInput = e.target.querySelector('input[type=email]');
              var btn = e.target.querySelector('button');
              var email = emailInput?.value?.trim();
              if (!email) return;
              btn.textContent = 'Enviando...';
              btn.disabled = true;
              fetch((import.meta.env.VITE_SUPABASE_URL || '') + '/rest/v1/leads', {
                method: 'POST',
                headers: {
                  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                  Authorization: 'Bearer ' + (import.meta.env.VITE_SUPABASE_ANON_KEY || ''),
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal',
                },
                body: JSON.stringify({ email: email, source: 'landing' }),
              }).then(function(r) {
                if (r.ok || r.status === 409) {
                  emailInput.value = '';
                  btn.textContent = 'Listo!';
                  btn.style.background = '#166534';
                  setTimeout(function() { btn.textContent = 'Suscribirme'; btn.disabled = false; btn.style.background = G; }, 3000);
                } else {
                  btn.textContent = 'Error, intenta de nuevo';
                  btn.disabled = false;
                  setTimeout(function() { btn.textContent = 'Suscribirme'; btn.style.background = G; }, 3000);
                }
              }).catch(function() {
                btn.textContent = 'Error de conexion';
                btn.disabled = false;
                setTimeout(function() { btn.textContent = 'Suscribirme'; btn.style.background = G; }, 3000);
              });
            }} style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '0 auto' }}>
              <input type="email" required placeholder="tu@email.com"
                style={{ flex: 1, padding: '12px 16px', border: '1px solid #e0e0dc', borderRadius: 10, fontSize: 14, fontFamily: F.sans, outline: 'none' }} />
              <button type="submit"
                style={{ padding: '12px 24px', background: G, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F.sans, whiteSpace: 'nowrap' }}>
                Suscribirme
              </button>
            </form>
            <p style={{ fontSize: 11, color: '#b0b0ac', marginTop: 10 }}>Sin spam. Solo novedades del producto.</p>
          </div>
        </section>
      </FadeIn>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #e8e8e6' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40 }}>
          {/* Left — Logo + description + social */}
          <div style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: G,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 500,
              }}>A</div>
              <span style={{ fontFamily: F.serif, fontSize: 20, color: '#1a1a18', letterSpacing: -0.5 }}>ARYES</span>
            </div>
            <p style={{ fontSize: 13, color: '#9a9a96', lineHeight: 1.6, margin: '0 0 16px' }}>
              Plataforma de gestión para distribuidoras B2B.<br />
              Inventario, ventas, rutas y portal de pedidos.
            </p>
            {/* Social icons — official FA SVG paths inline */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <a href="https://instagram.com/pazque" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', lineHeight: 0 }}>
                <svg width="24" height="24" viewBox="0 0 448 512" fill="#8a8a86">
                  <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/>
                </svg>
              </a>
              <a href="https://linkedin.com/company/pazque" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', lineHeight: 0 }}>
                <svg width="24" height="24" viewBox="0 0 448 512" fill="#8a8a86">
                  <path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Right — Contact */}
          <div style={{ textAlign: mobile ? 'left' : 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Contacto</div>
            <a href="mailto:contacto@pazque.com" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14, display: 'block', marginBottom: 12 }}>
              contacto@pazque.com
            </a>
            <a href="https://wa.me/59897951154?text=Hola%2C%20me%20interesa%20Pazque" target="_blank" rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', border: '1px solid #e5e5e3', borderRadius: 8,
                color: '#4b4b48', fontSize: 13, textDecoration: 'none',
                transition: 'border-color 0.2s',
              }}>
              <svg width="16" height="16" viewBox="0 0 448 512" fill="#25D366"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
              Escribinos
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '16px 24px', borderTop: '1px solid #e8e8e6' }}>
          <div style={{ fontSize: 12, color: '#b0b0ac' }}>
            <span>© 2026 Pazque</span>
            <span style={{ margin: '0 8px', color: '#d0d0cc' }}>·</span>
            <a href="/terms" style={{ color: '#b0b0ac', textDecoration: 'none' }}>Términos</a>
            <span style={{ margin: '0 8px', color: '#d0d0cc' }}>·</span>
            <a href="/privacy" style={{ color: '#b0b0ac', textDecoration: 'none' }}>Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
