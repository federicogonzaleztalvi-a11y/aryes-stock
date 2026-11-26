import React from 'react';
import { getNavForRole } from './AppSidebar.jsx';

// "Tu menú personal" — vive en Configuración → Roles, debajo de los permisos por rol.
// Cada usuario oculta del menú lateral las pestañas que no usa, SOLO para su vista:
// no cambia permisos ni afecta a otros. Se guarda por usuario en localStorage y
// avisa al sidebar con el evento 'pz-menu-changed' para aplicar sin recargar.
// 'dashboard' y 'config' quedan fijas (para no quedar sin inicio ni ajustes).

const G = '#059669';
const PROTECTED = ['dashboard', 'config'];

export default function MiMenuPanel({ session, brandCfg }) {
  const role = session?.role || 'admin';
  const tabs = getNavForRole(role, brandCfg); // pestañas a las que este rol TIENE acceso
  const userKey = session?.email || session?.username || session?.id || 'user';
  const HIDE_KEY = 'pz-menu-hidden:' + userKey;

  const [hidden, setHidden] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(HIDE_KEY) || '[]'); } catch { return []; }
  });

  const toggle = (id) => {
    if (PROTECTED.includes(id)) return;
    const next = hidden.includes(id) ? hidden.filter(x => x !== id) : hidden.concat(id);
    setHidden(next);
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(next)); } catch { /* storage bloqueado */ }
    try { window.dispatchEvent(new Event('pz-menu-changed')); } catch { /* noop */ }
  };

  return (
    <div style={{ marginTop: 34, paddingTop: 24, borderTop: '1px solid #e2e2de', maxWidth: 560 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1a1a18', fontFamily: 'Inter,sans-serif' }}>Tu menú personal</h3>
      <p style={{ fontSize: 12.5, color: '#6a6a68', margin: '4px 0 16px', lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}>
        Ocultá del menú lateral las pestañas que no usás. Es solo para vos — no cambia permisos
        ni afecta a otros usuarios. Reactivalas cuando quieras.
      </p>
      <div style={{ border: '1px solid #f0f0ec', borderRadius: 10, overflow: 'hidden' }}>
        {tabs.map((t, i) => {
          const off = hidden.includes(t.id);
          const locked = PROTECTED.includes(t.id);
          return (
            <div
              key={t.id}
              role="button"
              onClick={locked ? undefined : () => toggle(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff',
                borderTop: i > 0 ? '1px solid #f5f4f0' : 'none', cursor: locked ? 'default' : 'pointer',
                fontFamily: 'Inter,sans-serif' }}
            >
              <span style={{ flex: 1, fontSize: 13.5, color: '#1a1a18', opacity: off ? 0.5 : 1 }}>{t.label}</span>
              {locked ? (
                <span style={{ fontSize: 11, color: '#9a9a98' }}>fijo</span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 20,
                  background: off ? '#f0ede8' : '#f0fdf4', color: off ? '#9a9a98' : G }}>
                  {off ? 'Oculto' : 'Visible'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
