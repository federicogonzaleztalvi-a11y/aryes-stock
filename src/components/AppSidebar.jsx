import React from 'react';
import { useApp } from '../context/AppContext.tsx';

const T = {
  bg: '#f9f9f7', card: '#ffffff', border: '#e2e2de',
  green: '#3a7d1e', greenBg: '#f0fdf4', danger: '#dc2626',
  amber: '#d97706', textSm: '#4a4a48', textXs: '#9a9a98',
  sans: "'Inter',system-ui,sans-serif",
};

const Cap = ({ children, style }) => (
  <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textXs, ...style }}>
    {children}
  </span>
);

const NAV_ALL = [
  { id: 'dashboard',     label: 'Dashboard',      icon: '📊' },
  { id: 'inventory',     label: 'Inventario',      icon: '📦' },
  { id: 'orders',        label: 'Pedidos',          icon: '📋' },
  { id: 'suppliers',     label: 'Proveedores',      icon: '🏭' },
  { id: 'clientes',      label: 'Clientes',         icon: '👥' },
  { id: 'ventas',        label: 'Ventas',           icon: '🧾' },
  { id: 'facturacion',   label: 'Facturación',      icon: '📄' },
  { id: 'movimientos',   label: 'Movimientos',      icon: '🔄' },
  { id: 'lotes',         label: 'Lotes/Venc.',      icon: '📅' },
  { id: 'conteo',        label: 'Conteo',           icon: '🔢' },
  { id: 'transferencias',label: 'Transferencias',   icon: '↔' },
  { id: 'deposito',      label: 'Depósito',         icon: '🏗' },
  { id: 'rutas',         label: 'Rutas',            icon: '🗺' },
  { id: 'tracking',      label: 'Tracking',         icon: '📍' },
  { id: 'kpis',          label: 'KPIs',             icon: '📈' },
  { id: 'resultados',    label: 'Resultados',       icon: '📉' },
  { id: 'recepcion',     label: 'Recepción',        icon: '📥' },
  { id: 'compras',       label: 'Compras',          icon: '🧾' },
  { id: 'packing',       label: 'Packing',          icon: '📦' },
  { id: 'batch-picking', label: 'Batch Pick',       icon: '📋' },
  { id: 'informes',      label: 'Informes',         icon: '📊' },
  { id: 'devoluciones',  label: 'Devoluciones',     icon: '↩' },
  { id: 'precios',       label: 'Precios',          icon: '💲' },
  { id: 'demanda',       label: 'Demanda',          icon: '📈' },
  { id: 'audit',         label: 'Auditoría',        icon: '🔍' },
  { id: 'importar',      label: 'Importar datos',   icon: '📂' },
  { id: 'scanner',       label: 'Scanner',          icon: '📷' },
  { id: 'config',        label: 'Config',           icon: '⚙' },
];

const NAV_ROLES = {
  admin:    ['dashboard','inventory','orders','suppliers','clientes','ventas','facturacion','movimientos','lotes','deposito','rutas','tracking','kpis','resultados','recepcion','compras','informes','demanda','audit','importar','scanner','config','conteo','devoluciones','packing','precios','transferencias','batch-picking'],
  operador: ['dashboard','inventory','movimientos','lotes','deposito','transferencias','rutas','tracking','recepcion','scanner'],
  vendedor: ['dashboard','clientes','ventas','facturacion','kpis','resultados','informes'],
};

const NAV_GROUPS = [
  { label: 'Principal',   ids: ['dashboard','inventory','orders','suppliers'] },
  { label: 'Operaciones', ids: ['movimientos','lotes','deposito','transferencias','rutas','tracking','recepcion','compras','scanner'] },
  { label: 'Comercial',   ids: ['clientes','ventas','facturacion'] },
  { label: 'Análisis',    ids: ['kpis','resultados','informes','demanda','audit'] },
  { label: 'Sistema',     ids: ['importar','config'] },
];

export function getNavForRole(role) {
  const allowed = NAV_ROLES[role] || NAV_ROLES.admin;
  return NAV_ALL.filter(n => allowed.includes(n.id));
}

export function canAccessTab(role, tabId) {
  return (NAV_ROLES[role] || NAV_ROLES.admin).includes(tabId);
}

export default function AppSidebar({ session, tab, setTab }) {
  const { syncStatus, hasPendingSync, brandCfg, critN, orders, cfes } = useApp();

  const role    = session?.role || 'admin';
  const nav     = getNavForRole(role);
  const allowed = NAV_ROLES[role] || NAV_ROLES.admin;

  const vencidasN  = cfes.filter(f =>
    ['emitida','cobrado_parcial'].includes(f.status) &&
    f.fechaVenc &&
    Math.floor((new Date(f.fechaVenc).getTime() - Date.now()) / 86400000) < 0
  ).length;
  const pendOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <aside style={{ overflowY: 'auto', width: 220, background: T.card,
      borderRight: `1px solid ${T.border}`, position: 'fixed',
      top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}` }}>
        {brandCfg.logoUrl
          ? <img src={brandCfg.logoUrl} alt={brandCfg.name || 'Logo'}
              style={{ height: 52, objectFit: 'contain', maxWidth: '100%' }}
              onError={e => { e.target.style.display = 'none'; }} />
          : <img src="/logo.png" alt="Logo"
              style={{ height: 52, objectFit: 'contain', maxWidth: '100%' }}
              onError={e => { e.target.style.display = 'none'; }} />
        }
        {syncStatus === 'sync' && <div style={{ fontSize: 10, color: '#9a9a98', marginTop: 3 }}>⟳ Sincronizando...</div>}
        {syncStatus === 'ok'   && <div style={{ fontSize: 10, color: '#3a7d1e', marginTop: 3 }}>✓ Sincronizado</div>}
        {syncStatus === 'error'&& <div style={{ fontSize: 10, color: '#d97706', marginTop: 3 }}>⚠ Modo local</div>}
        {hasPendingSync        && <div style={{ fontSize: 10, color: '#d97706', marginTop: 3, fontWeight: 600 }}>⚠ Sync pendiente</div>}
        <div style={{ marginTop: 6 }}>
          <Cap style={{ color: brandCfg.color || T.green }}>{brandCfg.name || 'Gestión de stock'}</Cap>
        </div>
      </div>

      {/* Nav grouped */}
      <nav style={{ padding: '10px 0', flex: 1, overflowY: 'auto' }}>
        {NAV_GROUPS.map(g => {
          const items = nav.filter(n => g.ids.includes(n.id) && n.id !== 'usuarios');
          if (!items.length) return null;
          return (
            <React.Fragment key={g.label}>
              <div style={{ padding: '12px 18px 4px', fontFamily: T.sans, fontSize: 10,
                fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textXs }}>
                {g.label}
              </div>
              {items.map(n => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 18px',
                    background: tab === n.id ? T.greenBg : 'none', border: 'none',
                    borderLeft: tab === n.id ? `3px solid ${T.green}` : '3px solid transparent',
                    fontFamily: T.sans, fontSize: 13, fontWeight: tab === n.id ? 600 : 400,
                    color: tab === n.id ? T.green : T.textSm, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 8, borderRadius: '0 6px 6px 0', marginRight: 8, transition: 'background .15s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, lineHeight: 1, opacity: tab === n.id ? 1 : 0.7 }}>{n.icon}</span>
                    {n.label}
                  </span>
                  {n.id === 'dashboard'   && critN > 0      && <span style={{ background: T.danger, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{critN}</span>}
                  {n.id === 'inventory'   && critN > 0      && <span style={{ background: T.danger, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>{critN}</span>}
                  {n.id === 'orders'      && pendOrders > 0 && <span style={{ background: T.amber, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>{pendOrders}</span>}
                  {n.id === 'facturacion' && vencidasN > 0  && <span style={{ background: T.danger, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>{vencidasN}</span>}
                </button>
              ))}
            </React.Fragment>
          );
        })}
      </nav>
    </aside>
  );
}
