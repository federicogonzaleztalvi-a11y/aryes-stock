import React, { useState } from 'react';

const LS_DISMISSED = 'aryes-setup-dismissed';
const G = '#1a8a3c';
const F = { sans: "'Inter',system-ui,sans-serif" };

const STEPS = [
  { id: 'brand',    label: 'Configurar nombre y logo',          icon: '🏷', tab: 'config',      desc: 'Dale identidad a tu plataforma' },
  { id: 'supplier', label: 'Agregar primer proveedor',           icon: '🏭', tab: 'suppliers',   desc: 'Necesario para calcular lead times' },
  { id: 'products', label: 'Cargar productos al inventario',     icon: '📦', tab: 'inventory',   desc: 'Importá desde Excel o uno por uno' },
  { id: 'cliente',  label: 'Agregar primer cliente',             icon: '👥', tab: 'clientes',    desc: 'Con teléfono para activar el portal B2B' },
  { id: 'venta',    label: 'Registrar primera venta',            icon: '💰', tab: 'ventas',      desc: 'El corazón del sistema' },
  { id: 'ruta',     label: 'Crear primera ruta de entrega',      icon: '🚛', tab: 'rutas',       desc: 'Optimizá tus recorridos' },
  { id: 'portal',   label: 'Activar portal B2B para un cliente', icon: '🛍', tab: 'clientes',    desc: 'Tus clientes piden solos' },
  { id: 'cfe',      label: 'Emitir primera factura CFE',         icon: '🧾', tab: 'facturacion', desc: 'Facturación electrónica DGI' },
];

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function SetupChecklist({ products = [], setTab }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(LS_DISMISSED) === 'true');
  const [expanded, setExpanded]   = useState(false);

  const brand    = (() => { try { return JSON.parse(localStorage.getItem('aryes-brand') || 'null'); } catch { return null; } })();
  const clientes = readLS('aryes-clients');
  const cfes     = readLS('aryes-cfe');

  const suppliers = readLS('aryes-suppliers');
  const ventas    = readLS('aryes-ventas');
  const rutas     = readLS('aryes-rutas');

  const steps = STEPS.map(s => {
    let done = false;
    if (s.id === 'brand')    done = !!(brand?.name);
    if (s.id === 'supplier') done = suppliers.length > 0;
    if (s.id === 'cliente')  done = clientes.length > 0;
    if (s.id === 'products') done = products.length > 0;
    if (s.id === 'venta')    done = ventas.length > 0;
    if (s.id === 'ruta')     done = rutas.length > 0;
    if (s.id === 'portal')   done = clientes.some(c => c.portal_activo !== false && c.telefono);
    if (s.id === 'cfe')      done = cfes.length > 0;
    return { ...s, done };
  });

  const done  = steps.filter(s => s.done).length;
  const total = steps.length;
  const pct   = Math.round((done / total) * 100);
  const next  = steps.find(s => !s.done);
  const allDone = done === total;

  if (dismissed || allDone) return null;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8f5e0',
      borderLeft: `3px solid ${G}`,
      borderRadius: 10,
      marginBottom: 20,
      overflow: 'hidden',
      boxShadow: '0 1px 6px rgba(26,138,60,.08)',
    }}>
      {/* ── Banner header — always visible ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', cursor: 'pointer',
          background: expanded ? '#f6fbf4' : '#fff',
          transition: 'background .12s',
        }}
      >
        {/* Progress ring */}
        <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
          <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="16" cy="16" r="13" fill="none" stroke="#e8f0e4" strokeWidth="3"/>
            <circle cx="16" cy="16" r="13" fill="none" stroke={G} strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 13}`}
              strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct/100)}`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: F.sans, fontSize: 9, fontWeight: 700, color: G,
          }}>{pct}%</div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
            Configuración inicial · {done} de {total} completados
          </div>
          {next && !expanded && (
            <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 1 }}>
              Siguiente: {next.icon} {next.label}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: F.sans, fontSize: 11, color: G, fontWeight: 600 }}>
            {expanded ? 'Cerrar ↑' : 'Ver pasos ↓'}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true); localStorage.setItem(LS_DISMISSED, 'true'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0bbb4', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        </div>
      </div>

      {/* ── Expanded steps ── */}
      {expanded && (
        <div style={{ padding: '4px 16px 14px', borderTop: '1px solid #f0ede8' }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#f0f0ec', borderRadius: 2, overflow: 'hidden', margin: '10px 0 12px' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: G, borderRadius: 2, transition: 'width 0.5s ease' }}/>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {steps.map((step, idx) => {
              const isNext = step.id === next?.id;
              return (
                <button key={step.id} onClick={() => setTab(step.tab)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  border: `1px solid ${step.done ? '#bbf7d0' : isNext ? '#c8e6c0' : '#f0f0ec'}`,
                  borderRadius: 7,
                  background: step.done ? '#f0fdf4' : isNext ? '#f6fbf4' : '#fafaf8',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all 0.12s',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: step.done ? G : isNext ? '#fff' : '#f5f5f3',
                    border: `2px solid ${step.done ? G : isNext ? G : '#e2e2de'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {step.done
                      ? <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>
                      : <span style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 700, color: isNext ? G : '#c8c8c4' }}>{idx + 1}</span>
                    }
                  </div>
                  <span style={{ fontSize: 13, flexShrink: 0, opacity: step.done ? 0.4 : 1 }}>{step.icon}</span>
                  <div style={{ flex: 1, fontFamily: F.sans, fontSize: 12, fontWeight: step.done ? 400 : 600,
                    color: step.done ? '#9a9a98' : '#1a1a18',
                    textDecoration: step.done ? 'line-through' : 'none' }}>
                    {step.label}
                  </div>
                  {isNext && <span style={{ color: G, fontSize: 13, fontWeight: 700 }}>→</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SetupChecklist;
