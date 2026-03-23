import React, { useState, useEffect } from 'react';

// ── SetupChecklist ─────────────────────────────────────────────────────────
// Reads all state from localStorage — zero external dependencies beyond
// products.length and setTab which come from DashboardInline's existing props.
// Auto-hides when all steps are complete.

const LS_KEY = 'aryes-setup-dismissed';

function SetupChecklist({ products = [], setTab }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(LS_KEY) === 'true'
  );

  // Read state from localStorage on each render
  const brand   = (() => { try { return JSON.parse(localStorage.getItem('aryes-brand') || 'null'); } catch { return null; } })();
  const clientes = (() => { try { return JSON.parse(localStorage.getItem('aryes-clients') || '[]'); } catch { return []; } })();
  const cfes     = (() => { try { return JSON.parse(localStorage.getItem('aryes-cfe') || '[]'); } catch { return []; } })();

  const steps = [
    {
      id: 'brand',
      label: 'Configurar nombre y logo',
      done: !!(brand?.name),
      tab: 'config',
    },
    {
      id: 'cliente',
      label: 'Agregar primer cliente',
      done: clientes.length > 0,
      tab: 'clientes',
    },
    {
      id: 'products',
      label: 'Cargar productos en inventario',
      done: products.length > 0,
      tab: 'inventory',
    },
    {
      id: 'cfe',
      label: 'Emitir primera factura CFE',
      done: cfes.length > 0,
      tab: 'facturacion',
    },
    {
      id: 'dgi',
      label: 'Conectar proveedor DGI',
      done: false,
      tab: 'config',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const total     = steps.length;
  const pct       = Math.round((doneCount / total) * 100);
  const allDone   = doneCount === total;

  // Auto-dismiss when everything is complete
  useEffect(() => {
    if (allDone) {
      localStorage.setItem(LS_KEY, 'true');
      setDismissed(true);
    }
  }, [allDone]);

  if (dismissed || allDone) return null;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e2de',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{
            fontFamily: "'DM Sans','Inter',sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#9a9a98', marginBottom: 3,
          }}>
            Configuración inicial
          </div>
          <div style={{
            fontFamily: "'Playfair Display',Georgia,serif",
            fontSize: 18, fontWeight: 400, color: '#1a1a18',
          }}>
            {doneCount} de {total} pasos completados
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: "'DM Sans','Inter',sans-serif",
            fontSize: 13, fontWeight: 700, color: '#3a7d1e',
          }}>
            {pct}%
          </span>
          <button
            onClick={() => { localStorage.setItem(LS_KEY, 'true'); setDismissed(true); }}
            title="Ocultar checklist"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#c8c8c4', fontSize: 18, lineHeight: 1, padding: 2,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: '#f0f0ec', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: '#3a7d1e',
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Steps grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => setTab(step.tab)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              border: `1px solid ${step.done ? '#bbf7d0' : '#e2e2de'}`,
              borderRadius: 8,
              background: step.done ? '#f0fdf4' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => {
              if (!step.done) e.currentTarget.style.borderColor = '#3a7d1e';
            }}
            onMouseLeave={e => {
              if (!step.done) e.currentTarget.style.borderColor = '#e2e2de';
            }}
          >
            {/* Circle indicator */}
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: step.done ? '#3a7d1e' : 'transparent',
              border: `2px solid ${step.done ? '#3a7d1e' : '#d1d5db'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step.done && (
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>
              )}
            </div>

            {/* Label */}
            <span style={{
              fontFamily: "'DM Sans','Inter',sans-serif",
              fontSize: 12,
              fontWeight: step.done ? 400 : 600,
              color: step.done ? '#6a6a68' : '#1a1a18',
              textDecoration: step.done ? 'line-through' : 'none',
              lineHeight: 1.3,
            }}>
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SetupChecklist;
