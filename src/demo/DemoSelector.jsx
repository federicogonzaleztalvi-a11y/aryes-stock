// src/demo/DemoSelector.jsx
// Pantalla de selección de industria para el ambiente demo
// Se muestra al tocar "Explorar la plataforma →" en el login

import { useState } from 'react';
import { DEMO_INDUSTRIES } from './datasets.js';

const ICONS = {
  horeca: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="14" width="20" height="14" rx="2" />
      <path d="M10 14V8a6 6 0 0 1 12 0v6" />
      <circle cx="16" cy="20" r="2" />
    </svg>
  ),
  bebidas: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 6h12l-2 20H12L10 6z" strokeLinejoin="round" />
      <path d="M8 6h16" strokeLinecap="round" />
      <path d="M13 16h6" strokeLinecap="round" />
    </svg>
  ),
  limpieza: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="10" y="12" width="12" height="16" rx="2" />
      <path d="M14 12V8h4v4" />
      <path d="M13 18h6" strokeLinecap="round" />
      <path d="M13 22h4" strokeLinecap="round" />
    </svg>
  ),
  construccion: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 28l8-20 8 20" strokeLinejoin="round" />
      <path d="M11 22h10" />
      <path d="M16 8V4" strokeLinecap="round" />
    </svg>
  ),
};

const COLORS = {
  horeca: '#1a8a3c',
  bebidas: '#185FA5',
  limpieza: '#0F6E56',
  construccion: '#BA7517',
};

// Nombres de empresa por industria (se muestran al seleccionar)
const EMPRESA = {
  horeca: { name: 'Distribuciones Del Sur S.R.L.', skus: '250 productos', clientes: '45 clientes', examples: 'Quesos, fiambres, aceites, harinas, lácteos, conservas' },
  bebidas: { name: 'Bebidas Express S.A.', skus: '180 productos', clientes: '60 clientes', examples: 'Cervezas, refrescos, aguas, jugos, vinos, espirituosas' },
  limpieza: { name: 'HigienePro Uruguay S.R.L.', skus: '320 productos', clientes: '80 clientes', examples: 'Desinfectantes, jabones, papel, bolsas, químicos' },
  construccion: { name: 'MatCon Distribuidora S.A.', skus: '420 productos', clientes: '35 clientes', examples: 'Cemento, hierro, pinturas, herramientas, sanitaria' },
};

export default function DemoSelector({ onSelect }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (id) => {
    setSelected(id);
  };

  const handleEnter = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f7',
      padding: '24px',
    }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#1d1d1f',
            margin: '0 0 4px',
          }}>
            ¿Qué tipo de distribuidora operás?
          </p>
        </div>

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}>
          {DEMO_INDUSTRIES.map((ind) => {
            const isSelected = selected === ind.id;
            const color = COLORS[ind.id];
            return (
              <div
                key={ind.id}
                onClick={() => handleSelect(ind.id)}
                style={{
                  background: '#fff',
                  border: isSelected ? `2px solid ${color}` : '1px solid #e5e5e7',
                  borderRadius: 12,
                  padding: '20px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div style={{ color, marginBottom: 10 }}>
                  {ICONS[ind.id]}
                </div>
                <p style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: '#1d1d1f',
                  margin: '0 0 3px',
                }}>
                  {ind.name}
                </p>
                <p style={{
                  fontSize: 13,
                  color: '#86868b',
                  margin: 0,
                }}>
                  {ind.sub}
                </p>
              </div>
            );
          })}
        </div>

        {/* Detail panel — aparece al seleccionar */}
        {selected && (
          <div style={{
            background: '#fff',
            border: '1px solid #e5e5e7',
            borderRadius: 12,
            padding: '20px',
            marginBottom: 16,
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `${COLORS[selected]}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: COLORS[selected],
              }}>
                {ICONS[selected]}
              </div>
              <div>
                <p style={{ fontWeight: 500, fontSize: 15, margin: 0, color: '#1d1d1f' }}>
                  {EMPRESA[selected].name}
                </p>
                <p style={{ fontSize: 13, color: '#86868b', margin: 0 }}>
                  {EMPRESA[selected].skus} · {EMPRESA[selected].clientes}
                </p>
              </div>
            </div>
            <div style={{
              borderTop: '1px solid #f0f0f0',
              paddingTop: 12,
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, color: '#86868b', margin: '0 0 4px' }}>Catálogo incluye</p>
              <p style={{ fontSize: 14, color: '#1d1d1f', margin: 0 }}>{EMPRESA[selected].examples}</p>
            </div>
            <button
              onClick={handleEnter}
              style={{
                width: '100%',
                padding: '12px 0',
                background: COLORS[selected],
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Explorar {DEMO_INDUSTRIES.find(i => i.id === selected)?.name} →
            </button>
          </div>
        )}

        {/* Back link */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'none',
              border: 'none',
              color: '#86868b',
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 16px',
            }}
          >
            ← Volver al login
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}