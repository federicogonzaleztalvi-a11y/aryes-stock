import React from 'react';
import { T } from '../lib/ui.jsx';

function UserMenuDropdown({ session, userMenuOpen, setUserMenuOpen, canTab, setTab, handleLogout }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!userMenuOpen) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = (session?.name || session?.email || 'U')[0].toUpperCase();
  const displayName = session?.name || session?.email?.split('@')[0] || 'Usuario';
  const roleLabel = session?.role === 'admin' ? 'Administrador' : session?.role === 'operador' ? 'Operador' : 'Vendedor';

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Pill button */}
      <div
        style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer',
          padding:'6px 12px 6px 8px', borderRadius:8,
          border:`1px solid ${userMenuOpen ? T.greenBd : T.border}`,
          background: userMenuOpen ? T.greenBg : T.card, transition:'background .15s' }}
        onMouseEnter={e => { if (!userMenuOpen) e.currentTarget.style.background = T.muted; }}
        onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.background = T.card; }}
        onClick={() => setUserMenuOpen(m => !m)}
      >
        <div style={{ width:30, height:30, borderRadius:'50%', background:T.greenBg,
          border:`2px solid ${T.greenBd}`, display:'flex', alignItems:'center',
          justifyContent:'center', fontFamily:T.sans, fontSize:12, fontWeight:700,
          color:T.green, flexShrink:0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.text, lineHeight:1.2 }}>{displayName}</div>
          <div style={{ fontFamily:T.sans, fontSize:10, color:T.textXs, textTransform:'capitalize' }}>{roleLabel}</div>
        </div>
        <span style={{ fontSize:10, color:T.textXs, marginLeft:2 }}>{userMenuOpen ? '▲' : '▾'}</span>
      </div>

      {/* Dropdown */}
      {userMenuOpen && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:T.card,
          border:`1px solid ${T.border}`, borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,.1)',
          minWidth:200, zIndex:200, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.text }}>{displayName}</div>
            <div style={{ fontFamily:T.sans, fontSize:11, color:T.textXs, marginTop:2 }}>{session?.email || ''}</div>
          </div>
          {canTab('config') && (
            <button
              onClick={() => { setTab('config'); setUserMenuOpen(false); }}
              style={{ width:'100%', textAlign:'left', padding:'10px 16px', background:'none',
                border:'none', fontFamily:T.sans, fontSize:13, color:T.textMd, cursor:'pointer',
                display:'flex', alignItems:'center', gap:8 }}
            >
              ⚙  Configuración
            </button>
          )}
          <div style={{ borderTop:`1px solid ${T.border}`, margin:'4px 0' }} />
          <button
            onClick={() => { setUserMenuOpen(false); handleLogout(); }}
            style={{ width:'100%', textAlign:'left', padding:'10px 16px', background:'none',
              border:'none', fontFamily:T.sans, fontSize:13, color:'#dc2626', cursor:'pointer',
              display:'flex', alignItems:'center', gap:8, marginBottom:4 }}
          >
            ↩  Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenuDropdown;
