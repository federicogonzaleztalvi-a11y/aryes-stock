// src/demo/DemoBanner.jsx
// Banner flotante que aparece cuando el usuario está en demo mode
// Muestra la empresa demo + industria + CTA para crear cuenta

import { DEMO_INDUSTRIES } from './datasets.js';

const COLORS = {
  horeca: '#059669',
  bebidas: '#185FA5',
  limpieza: '#0F6E56',
  construccion: '#BA7517',
};

export default function DemoBanner({ industry, orgName, onExit, onSignup }) {
  const color = COLORS[industry] || '#059669';
  const industryName = DEMO_INDUSTRIES.find(i => i.id === industry)?.name || '';

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, height: 48,
      left: 0,
      right: 0,
      zIndex: 899,
      background: '#fff',
      borderTop: `2px solid ${color}`,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 13, color: '#86868b',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {orgName} · {industryName}
        </span>
        <button
          onClick={onExit}
          style={{
            background: 'none', border: 'none',
            color: '#86868b', fontSize: 12, cursor: 'pointer',
            padding: '2px 8px', flexShrink: 0,
          }}
        >
          Salir
        </button>
      </div>
      <button
        onClick={onSignup}
        style={{
          background: color,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Empezar gratis
      </button>
    </div>
  );
}