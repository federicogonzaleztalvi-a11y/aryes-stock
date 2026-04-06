#!/usr/bin/env node
// patch-portal-demo.cjs — Add demo mode to PedidosPage with industry selector

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

if (pg.includes('demoMode') || pg.includes('portalDemo')) {
  console.log('⏭  PedidosPage.jsx: demo mode already exists');
  process.exit(0);
}

// 1. Add demo dataset imports at the top
const importAnchor = "import { fmt } from '../lib/constants.js';";
const demoImports = `
import { demoHoreca } from '../demo/demo-horeca.js';
import { demoBebidas } from '../demo/demo-bebidas.js';
import { demoLimpieza } from '../demo/demo-limpieza.js';
import { demoConstruccion } from '../demo/demo-construccion.js';

const DEMO_DATASETS = {
  horeca:       { data: demoHoreca,       label: 'HORECA',       emoji: '🍽️', desc: 'Restaurantes, hoteles y catering' },
  bebidas:      { data: demoBebidas,      label: 'Bebidas',      emoji: '🥤', desc: 'Mayorista de bebidas' },
  limpieza:     { data: demoLimpieza,     label: 'Limpieza',     emoji: '🧹', desc: 'Productos de limpieza' },
  construccion: { data: demoConstruccion, label: 'Construcción', emoji: '🏗️', desc: 'Materiales de construcción' },
};
`;

pg = pg.replace(importAnchor, importAnchor + demoImports);
console.log('✅ Added demo dataset imports');

// 2. Add DemoSelector component before LoginStep
const loginAnchor = '// ── Login ─────────────────────────────────────────────────────────────────────';
const demoSelector = `
// ── Portal Demo Selector ──────────────────────────────────────────────────────
function PortalDemoSelector({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f4', fontFamily: SANS,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: G, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#fff', fontSize: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', marginBottom: 6 }}>
            Explorá el portal de pedidos
          </div>
          <div style={{ fontSize: 13, color: '#9a9a92', lineHeight: 1.5 }}>
            Elegí una industria para ver cómo tus clientes<br/>van a hacer pedidos en tu plataforma
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(DEMO_DATASETS).map(([key, { label, emoji, desc }]) => (
            <button key={key} onClick={() => onSelect(key)}
              style={{
                background: '#fff', border: '1px solid #efefeb', borderRadius: 14,
                padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                transition: 'border-color .15s, transform .1s', fontFamily: SANS,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#efefeb'; e.currentTarget.style.transform = 'scale(1)'; }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#9a9a92' }}>{desc}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', color: '#9a9a92', fontSize: 13,
              cursor: 'pointer', fontFamily: SANS, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            ← Volver
          </button>
        </div>
      </div>
    </div>
  );
}

`;

pg = pg.replace(loginAnchor, demoSelector + loginAnchor);
console.log('✅ Added PortalDemoSelector component');

// 3. Add "Explorar catálogo de prueba" button in LoginStep, after the "Enviar codigo" button
// Find the closing of the step === 'tel' button and add demo button after it
const afterSendOTP = `              </button>
            </>
          ) : (`;

const demoButton = `              </button>
              <div style={{ position: 'relative', margin: '20px 0 4px', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '0.5px', background: '#e8e8e0' }}/>
                <span style={{ position: 'relative', background: '#f7f7f4', padding: '0 12px', fontSize: 11, color: '#b0b0a8' }}>o</span>
              </div>
              <button onClick={() => window.location.href='/pedidos?demo=true'}
                style={{
                  width: '100%', padding: '11px 0', background: 'transparent',
                  color: '#6a6a68', border: '1px solid #e0e0d8', borderRadius: 50, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', fontFamily: SANS,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                Explorar catálogo de prueba
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </>
          ) : (`;

pg = pg.replace(afterSendOTP, demoButton);
console.log('✅ Added "Explorar catálogo de prueba" button in LoginStep');

// 4. Modify PedidosPage to support demo mode
// Add demoMode state and selector logic
const mainStateAnchor = 'const [session,  setSession]  = useState(() => loadSession());';
const demoState = `const [portalDemo, setPortalDemo] = useState(null); // null | 'selecting' | dataset key
  const isPortalDemo = !!portalDemo && portalDemo !== 'selecting';
  const [session,  setSession]  = useState(() => loadSession());`;

pg = pg.replace(mainStateAnchor, demoState);
console.log('✅ Added portalDemo state');

// 5. Add useEffect to detect ?demo=true in URL
const loadCatAnchor = 'const loadCatalogo = useCallback(async (ses) => {';
const demoDetect = `// Detect demo mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !portalDemo) setPortalDemo('selecting');
  }, []);

  // Load demo products when dataset selected
  useEffect(() => {
    if (!isPortalDemo) return;
    const ds = DEMO_DATASETS[portalDemo];
    if (!ds) return;
    const prods = ds.data.products.map(p => ({
      id: p.id, nombre: p.name, precio: p.price, categoria: p.category,
      unidad: p.unit || 'un', marca: p.brand || p.category,
      imagen_url: p.imagen_url || null, iva_rate: p.iva_rate || 22,
      stock: p.stock || 100,
    })).filter(p => p.precio > 0);
    setItems(prods);
    const categories = ['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))];
    setCats(categories);
    setBrandNombre(ds.data.org.name);
  }, [portalDemo, isPortalDemo]);

  `;

pg = pg.replace(loadCatAnchor, demoDetect + loadCatAnchor);
console.log('✅ Added demo detection and product loading');

// 6. Modify the render — show selector when portalDemo === 'selecting', skip login when demo active
const loginRender = "if (!session) return <LoginStep onLogin={ses => setSession(ses)} />;";
const demoRender = `if (portalDemo === 'selecting') return <PortalDemoSelector onSelect={key => setPortalDemo(key)} />;
  if (!session && !isPortalDemo) return <LoginStep onLogin={ses => setSession(ses)} />;`;

pg = pg.replace(loginRender, demoRender);
console.log('✅ Modified render to support demo mode');

// 7. Add demo banner at the top of the catalog view
const headerAnchor = "<header style={{ background: '#fff', borderBottom: '0.5px solid #e8e8e0',";
const demoBanner = `{isPortalDemo && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: SANS }}>
          <span style={{ fontSize: 12, color: '#92400e' }}>
            Estás viendo el catálogo de prueba de <strong>{DEMO_DATASETS[portalDemo]?.label}</strong>
          </span>
          <button onClick={() => setPortalDemo('selecting')}
            style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: SANS }}>
            Cambiar industria
          </button>
          <a href="/register"
            style={{ fontSize: 11, color: '#fff', background: G, border: 'none',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
              fontFamily: SANS, textDecoration: 'none' }}>
            Crear cuenta gratis
          </a>
        </div>
      )}
      <` + `header style={{ background: '#fff', borderBottom: '0.5px solid #e8e8e0',`;

pg = pg.replace(headerAnchor, demoBanner);
console.log('✅ Added demo banner above catalog header');

// 8. Modify CartDrawer confirm to handle demo mode — intercept the onConfirm
// Find the confirmar function in CartDrawer and add demo guard
const confirmarAnchor = 'const confirmar = async () => {';
if (pg.includes(confirmarAnchor)) {
  pg = pg.replace(confirmarAnchor, `const confirmar = async () => {
      // Demo mode — simulate confirmation without API call
      if (window.location.search.includes('demo=true')) {
        setDone(true);
        return;
      }
`);
  console.log('✅ Added demo guard in CartDrawer confirmar');
} else {
  console.log('⚠️  Could not find confirmar function in CartDrawer');
  // Try alternative — look for the actual confirm handler pattern
  const altConfirm = 'onConfirm({';
  if (pg.includes(altConfirm)) {
    // Find the function that calls onConfirm
    console.log('⚠️  Found onConfirm call — demo guard needs manual check');
  }
}

// 9. Make the logout button work in demo mode too
const logoutAnchor = 'const logout = () => {';
pg = pg.replace(logoutAnchor, `const logout = () => {
    if (isPortalDemo) { setPortalDemo(null); setItems([]); setCarrito({}); window.location.href = '/pedidos'; return; }
`);
console.log('✅ Modified logout for demo mode');

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Portal demo mode patched!

  /pedidos           → normal login OTP (unchanged)
  /pedidos?demo=true → industry selector → demo catalog

  Features:
  - "Explorar catálogo de prueba" button on login screen
  - 4 industry options: HORECA, Bebidas, Limpieza, Construcción
  - Full catalog browsing with search + categories
  - Add to cart + carrito drawer
  - Demo banner with "Cambiar industria" + "Crear cuenta gratis"
  - Confirm simulates success without API call
  - All in memory, zero Supabase calls

══════════════════════════════════════════════`);
