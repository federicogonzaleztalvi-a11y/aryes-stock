// LandingPage.jsx — Aryes Stock landing page v8
// Design: Stripe clarity × Linear aesthetic × Faire warmth
// Typography: DM Serif Display (titles) + DM Sans (body)
import { useState, useEffect, useRef } from 'react';

const G = '#1a8a3c';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: G,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 500,
            }}>A</div>
            <span style={{ fontFamily: F.serif, fontSize: 20, color: '#1a1a18', letterSpacing: -0.5 }}>aryes</span>
          </div>

          {!mobile && (
            <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
              <span onClick={() => scrollTo('producto')} style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>Producto</span>
              <span onClick={() => scrollTo('precios')} style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>Precios</span>
              <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Aryes%20Stock" target="_blank" rel="noreferrer"
                style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer', textDecoration: 'none' }}>Contacto</a>
              <span onClick={() => window.location.href = '/'} style={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>
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
            <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Aryes%20Stock" target="_blank" rel="noreferrer"
              style={{ fontSize: 15, color: '#6b7280', textDecoration: 'none' }}>Contacto</a>
            <span onClick={() => window.location.href = '/'} style={{ fontSize: 15, color: '#6b7280', cursor: 'pointer' }}>Iniciar sesión</span>
            <button onClick={() => { setMenuOpen(false); window.location.href = '/demo'; }}
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
            <button onClick={() => window.location.href = '/demo'}
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
            <button onClick={() => window.location.href = '/demo'}
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
            alt="Dashboard de Aryes Stock con KPIs financieros y operativos"
            style={{ maxWidth: 960, margin: '0 auto', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
          />
        </FadeIn>
      </section>

      {/* ── Social proof + Testimonio ────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        <FadeIn>
          <div style={{
            display: 'flex', justifyContent: 'space-around', textAlign: 'center',
            padding: '28px 0', borderBottom: '1px solid #e8e8e6',
            flexWrap: 'wrap', gap: 24,
          }}>
            {[
              { val: '14 días', sub: 'Gratis para probar' },
              { val: '$0', sub: 'Costo implementación' },
              { val: '+500', sub: 'Entregas gestionadas' },
            ].map(m => (
              <div key={m.val}>
                <div style={{ fontSize: 28, fontWeight: 500, color: '#1a1a18', fontFamily: F.serif }}>{m.val}</div>
                <div style={{ fontSize: 13, color: '#9a9a96', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '28px 0', maxWidth: 600, margin: '0 auto' }}>
            <div style={{
              minWidth: 44, height: 44, borderRadius: '50%', background: '#e6f1fb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 500, fontSize: 15, color: '#185fa5',
            }}>MR</div>
            <div>
              <p style={{ fontSize: 15, color: '#1a1a18', fontStyle: 'italic', margin: '0 0 8px', lineHeight: 1.5 }}>
                "Pasamos de 3 horas armando rutas en Excel a tenerlas listas en 10 minutos. Los clientes ahora piden solos."
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Martín R.</p>
              <p style={{ fontSize: 12, color: '#9a9a96', margin: 0 }}>Distribuidora de alimentos — 250+ SKUs · Ahorro: 15 horas/semana</p>
            </div>
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

            <button onClick={() => window.location.href = '/demo'}
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
            <button onClick={() => window.location.href = '/demo'}
              style={{
                padding: '14px 32px', background: G, color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>
              Empezar gratis
            </button>
            <a href="https://wa.me/59899123456?text=Hola%2C%20me%20interesa%20Aryes%20Stock" target="_blank" rel="noreferrer"
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

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: G,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 500,
              }}>A</div>
              <span style={{ fontFamily: F.serif, fontSize: 18, color: '#1a1a18' }}>aryes</span>
            </div>
            <p style={{ fontSize: 13, color: '#9a9a96', marginTop: 4, lineHeight: 1.5 }}>
              Plataforma para<br />distribuidoras B2B
            </p>
          </div>
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 12 }}>Producto</div>
              <div style={{ fontSize: 13, color: '#9a9a96', lineHeight: 2.2 }}>
                <div style={{ cursor: 'pointer' }} onClick={() => scrollTo('producto')}>Inventario</div>
                <div style={{ cursor: 'pointer' }} onClick={() => scrollTo('producto')}>Rutas</div>
                <div style={{ cursor: 'pointer' }} onClick={() => scrollTo('producto')}>Portal B2B</div>
                <div style={{ cursor: 'pointer' }} onClick={() => scrollTo('producto')}>Dashboard</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 12 }}>Empresa</div>
              <div style={{ fontSize: 13, color: '#9a9a96', lineHeight: 2.2 }}>
                <div style={{ cursor: 'pointer' }} onClick={() => scrollTo('precios')}>Precios</div>
                <a href="https://wa.me/59899123456" target="_blank" rel="noreferrer" style={{ color: '#9a9a96', textDecoration: 'none', display: 'block' }}>Contacto</a>
                <div style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/demo'}>Demo</div>
                <div style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Iniciar sesión</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{
          borderTop: '1px solid #e8e8e6', paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b0b0ac',
        }}>
          <span>Hecho en Latinoamérica</span>
          <span>© 2026 Aryes</span>
        </div>
      </footer>
    </div>
  );
}
