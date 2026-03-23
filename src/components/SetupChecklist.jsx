import React, { useState, useEffect } from 'react';

// ── SetupProgressCard ────────────────────────────────────────────────────────
// Self-contained: reads all state from localStorage.
// Only needs products.length and setTab from DashboardInline's existing props.
// Auto-hides permanently when all steps are complete.
// Can be manually dismissed via the × button.

const LS_DISMISSED = 'aryes-setup-dismissed';

const F = {
  sans:  "'DM Sans','Inter',system-ui,sans-serif",
  serif: "'Playfair Display',Georgia,serif",
};

const STEPS = [
  { id: 'brand',    label: 'Configurar nombre y logo',       hint: 'Dale identidad a tu plataforma',     icon: '🏷',  tab: 'config'      },
  { id: 'cliente',  label: 'Agregar primer cliente',          hint: 'Empezá a gestionar tu cartera',      icon: '👥',  tab: 'clientes'    },
  { id: 'products', label: 'Cargar productos al inventario',  hint: 'Necesario para facturar y costear',  icon: '📦',  tab: 'inventory'   },
  { id: 'cfe',      label: 'Emitir primera factura CFE',      hint: 'Probá el módulo de facturación',     icon: '🧾',  tab: 'facturacion' },
  { id: 'dgi',      label: 'Conectar proveedor DGI',          hint: 'Habilitá CFEs con validez legal',    icon: '🔗',  tab: 'config'      },
];

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function SetupChecklist({ products = [], setTab }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(LS_DISMISSED) === 'true'
  );

  const brand    = (() => { try { return JSON.parse(localStorage.getItem('aryes-brand') || 'null'); } catch { return null; } })();
  const clientes = readLS('aryes-clients');
  const cfes     = readLS('aryes-cfe');

  const steps = STEPS.map(s => {
    let done = false;
    if (s.id === 'brand')    done = !!(brand?.name);
    if (s.id === 'cliente')  done = clientes.length > 0;
    if (s.id === 'products') done = products.length > 0;
    if (s.id === 'cfe')      done = cfes.length > 0;
    if (s.id === 'dgi')      done = false;
    return { ...s, done };
  });

  const doneCount = steps.filter(s => s.done).length;
  const total     = steps.length;
  const pct       = Math.round((doneCount / total) * 100);
  const allDone   = doneCount === total;
  const nextStep  = steps.find(s => !s.done);

  useEffect(() => {
    if (allDone) {
      localStorage.setItem(LS_DISMISSED, 'true');
      setDismissed(true);
    }
  }, [allDone]);

  if (dismissed || allDone) return null;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e2de',
      borderRadius: 12,
      padding: '20px 22px 16px',
      marginBottom: 8,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: F.sans, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#9a9a98', marginBottom: 4,
          }}>
            Configuración inicial
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 400, color: '#1a1a18' }}>
              {doneCount} de {total} pasos
            </span>
            <span style={{ fontFamily: F.sans, fontSize: 12, color: '#9a9a98' }}>completados</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: '#3a7d1e' }}>
            {pct}%
          </span>
          <button
            onClick={() => { localStorage.setItem(LS_DISMISSED, 'true'); setDismissed(true); }}
            title="Ocultar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c4', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#f0f0ec', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#3a7d1e', borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>

      {/* Steps — vertical list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((step, idx) => {
          const isNext = step.id === nextStep?.id;
          return (
            <button
              key={step.id}
              onClick={() => setTab(step.tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 12px',
                border: `1px solid ${step.done ? '#bbf7d0' : isNext ? '#b8d9a8' : '#f0f0ec'}`,
                borderRadius: 8,
                background: step.done ? '#f0fdf4' : isNext ? '#f6faf4' : '#fafaf8',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => {
                if (!step.done) { e.currentTarget.style.borderColor = '#3a7d1e'; e.currentTarget.style.background = '#f0f7ec'; }
              }}
              onMouseLeave={e => {
                if (!step.done) { e.currentTarget.style.borderColor = isNext ? '#b8d9a8' : '#f0f0ec'; e.currentTarget.style.background = isNext ? '#f6faf4' : '#fafaf8'; }
              }}
            >
              {/* Step number / checkmark */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: step.done ? '#3a7d1e' : isNext ? '#fff' : '#f5f5f3',
                border: `2px solid ${step.done ? '#3a7d1e' : isNext ? '#3a7d1e' : '#e2e2de'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.done
                  ? <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>
                  : <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, color: isNext ? '#3a7d1e' : '#c8c8c4', lineHeight: 1 }}>{idx + 1}</span>
                }
              </div>

              {/* Icon */}
              <span style={{ fontSize: 15, flexShrink: 0, opacity: step.done ? 0.5 : 1 }}>{step.icon}</span>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: F.sans, fontSize: 13,
                  fontWeight: step.done ? 400 : 600,
                  color: step.done ? '#9a9a98' : '#1a1a18',
                  textDecoration: step.done ? 'line-through' : 'none',
                  lineHeight: 1.3,
                }}>
                  {step.label}
                </div>
                {!step.done && (
                  <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 1, lineHeight: 1.3 }}>
                    {step.hint}
                  </div>
                )}
              </div>

              {/* Arrow on next pending step */}
              {isNext && (
                <span style={{ color: '#3a7d1e', fontSize: 14, flexShrink: 0, fontWeight: 600 }}>→</span>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}

export default SetupChecklist;
