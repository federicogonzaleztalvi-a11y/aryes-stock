import React from 'react';
import { useApp } from '../context/AppContext.tsx';

// ─── Design tokens ────────────────────────────────────────────────────────────
const S = {
  bg:        '#ffffff',
  border:    '#f0ede8',
  green:     '#059669',
  greenBg:   '#f0fdf4',
  greenSoft: '#e8f5e0',
  danger:    '#dc2626',
  amber:     '#d97706',
  text:      '#1a1a18',
  textSm:    '#5a5a58',
  textXs:    '#9a9a98',
  sans:      "'Inter',system-ui,sans-serif",
};

// ─── SVG icons — consistent 16×16, single color ──────────────────────────────
const Icon = ({ name, size = 15, color = 'currentColor' }) => {
  const icons = {
    dashboard:     <path d="M3 3h7v7H3zm0 9h3v3H3zm5 0h3v3H8zm5-9h3v3h-3zm0 5h3v3h-3zM10 3h3v3h-3z" fill={color}/>,
    inventory:     <path d="M2 3h20v3H2zm0 5h20v3H2zm0 5h20v3H2z" fill={color}/>,
    orders:        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>,
    suppliers:     <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill={color}/>,
    clientes:      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill={color}/>,
    ventas:        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" fill={color}/>,
    facturacion:   <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" fill={color}/>,
    movimientos:   <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill={color}/>,
    lotes:         <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill={color}/>,
    deposito:      <path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={color}/>,
    rutas:         <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={color}/>,
    portal:        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z" fill={color}/>,
    tracking:      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06z" fill={color}/>,
    kpis:          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill={color}/>,
    resultados:    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill={color}/>,
    informes:      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill={color}/>,
    demanda:       <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" fill={color}/>,
    audit:         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill={color}/>,
    importar:      <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z" fill={color}/>,
    scanner:       <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z" fill={color}/>,
    config:        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill={color}/>,
    recepcion:     <path d="M20 6h-2.18c.07-.44.18-.86.18-1.3C18 2.55 15.45 0 12.3 0c-1.7 0-3.2.75-4.2 1.95L6 4 3.7 1.95C2.7.75 1.2 0-.5 0-3.65 0-6.2 2.55-6.2 5.7c0 .44.11.86.18 1.3H-8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h28c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM7.5 5.7c0-1.71 1.39-3.1 3.1-3.1.79 0 1.5.31 2.05.8l-3.7 4.43C8.12 7.3 7.5 6.57 7.5 5.7zM20 18H4V8h16v10z" fill={color}/>,
    compras:       <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 18 8 18h12v-2H8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.49 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" fill={color}/>,
    transferencias:<path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" fill={color}/>,
    conteo:        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" fill={color}/>,
    devoluciones:  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill={color}/>,
    precios:       <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill={color}/>,
    packing:       <path d="M20 7l-8-4-8 4v10l8 4 8-4V7zm-8 1.62L18.47 12 12 15.38 5.53 12 12 8.62z" fill={color}/>,
    'batch-picking':<path d="M3 3h2v2H3zm0 4h2v2H3zm0 4h2v2H3zm4-8h14v2H7zm0 4h14v2H7zm0 4h14v2H7z" fill={color}/>,
  };

  const path = icons[name];
  if (!path) return <span style={{ width: size, height: size, display: 'inline-block' }} />;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }}>
      {path}
    </svg>
  );
};

// ─── Nav definition ───────────────────────────────────────────────────────────
const NAV_ALL = [
  { id: 'dashboard',      label: 'Dashboard',       icon: 'dashboard' },
  { id: 'inventory',      label: 'Inventario',       icon: 'inventory' },
  { id: 'orders',         label: 'Pedidos',           icon: 'orders' },
  { id: 'suppliers',      label: 'Proveedores',       icon: 'suppliers' },
  { id: 'clientes',       label: 'Clientes',          icon: 'clientes' },
  { id: 'ventas',         label: 'Ventas',            icon: 'ventas' },
  { id: 'portal',         label: 'Portal B2B',        icon: 'portal' },
  { id: 'facturacion',    label: 'Facturación',       icon: 'facturacion' },
  { id: 'movimientos',    label: 'Movimientos',       icon: 'movimientos' },
  { id: 'lotes',          label: 'Lotes/Venc.',       icon: 'lotes' },
  { id: 'conteo',         label: 'Conteo',            icon: 'conteo' },
  { id: 'transferencias', label: 'Transferencias',    icon: 'transferencias' },
  { id: 'deposito',       label: 'Depósito',          icon: 'deposito' },
  { id: 'rutas',          label: 'Rutas',             icon: 'rutas' },
  { id: 'tracking',       label: 'Tracking',          icon: 'tracking' },
  { id: 'kpis',           label: 'KPIs',              icon: 'kpis' },
  { id: 'resultados',     label: 'Resultados',        icon: 'resultados' },
  { id: 'recepcion',      label: 'Recepción',         icon: 'recepcion' },
  { id: 'compras',        label: 'Compras',           icon: 'compras' },
  { id: 'packing',        label: 'Packing',           icon: 'packing' },
  { id: 'batch-picking',  label: 'Batch Picking',     icon: 'batch-picking' },
  { id: 'informes',       label: 'Informes',          icon: 'informes' },
  { id: 'devoluciones',   label: 'Devoluciones',      icon: 'devoluciones' },
  { id: 'precios',        label: 'Precios',           icon: 'precios' },
  { id: 'demanda',        label: 'Demanda',           icon: 'demanda' },
  { id: 'audit',          label: 'Auditoría',         icon: 'audit' },
  { id: 'importar',       label: 'Importar datos',    icon: 'importar' },
  { id: 'scanner',        label: 'Scanner',           icon: 'scanner' },
  { id: 'config',         label: 'Configuración',     icon: 'config' },
];

const DEFAULT_NAV_ROLES = {
  admin:    ['dashboard','inventory','orders','suppliers','clientes','ventas','portal','facturacion','movimientos','lotes','deposito','rutas','tracking','kpis','resultados','recepcion','compras','informes','demanda','audit','importar','scanner','config','conteo','devoluciones','packing','precios','transferencias','batch-picking'],
  operador: ['dashboard','inventory','movimientos','lotes','deposito','transferencias','rutas','tracking','recepcion','scanner'],
  vendedor: ['dashboard','clientes','ventas','facturacion','kpis','resultados','informes'],
  contador: ['dashboard','facturacion','movimientos','resultados','informes','clientes','compras'],
};

// Dynamic NAV_ROLES — reads custom_roles from brandCfg if available
function getNavRoles(brandCfg) {
  var custom = brandCfg && brandCfg.custom_roles;
  if (!custom) return DEFAULT_NAV_ROLES;
  var result = {};
  Object.keys(custom).forEach(function(k) {
    result[k] = custom[k].tabs || DEFAULT_NAV_ROLES[k] || ['dashboard'];
  });
  // Always ensure admin has all tabs
  result.admin = DEFAULT_NAV_ROLES.admin;
  return result;
}

const NAV_GROUPS = [
  { label: 'Principal',   ids: ['dashboard','inventory','orders','suppliers'] },
  { label: 'Operaciones', ids: ['movimientos','lotes','deposito','transferencias','rutas','tracking','recepcion','compras','scanner'] },
  { label: 'Comercial',   ids: ['clientes','ventas','portal','facturacion'] },
  { label: 'Análisis',    ids: ['kpis','resultados','informes','demanda','audit'] },
  { label: 'Sistema',     ids: ['importar','config'] },
];

export function getNavForRole(role, brandCfg) {
  var roles = getNavRoles(brandCfg);
  var allowed = roles[role] || roles.admin || DEFAULT_NAV_ROLES.admin;
  return NAV_ALL.filter(function(n) { return allowed.includes(n.id); });
}

export function canAccessTab(role, tabId, brandCfg) {
  var roles = getNavRoles(brandCfg);
  return (roles[role] || roles.admin || DEFAULT_NAV_ROLES.admin).includes(tabId);
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ n, color = S.danger }) => (
  <span style={{
    background: color, color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
    lineHeight: '16px', flexShrink: 0,
  }}>{n}</span>
);

// ─── NavItem ──────────────────────────────────────────────────────────────────
const NavItem = ({ item, active, onClick, badge }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '7px 14px 7px 16px',
        margin: '1px 0',
        background: active ? S.greenBg : hovered ? '#f6f5f2' : 'transparent',
        border: 'none',
        borderLeft: `2.5px solid ${active ? S.green : 'transparent'}`,
        borderRadius: '0 8px 8px 0',
        fontFamily: S.sans, fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? S.green : hovered ? S.text : S.textSm,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        marginRight: 8,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon
          name={item.icon}
          size={15}
          color={active ? S.green : hovered ? S.text : '#8a8a88'}
        />
        <span style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
      </span>
      {badge}
    </button>
  );
};

// ─── AppSidebar ───────────────────────────────────────────────────────────────
export default function AppSidebar({ session, tab, setTab }) {
  const { syncStatus, hasPendingSync, brandCfg, critN, orders, cfes } = useApp();

  const role = session?.role || 'admin';
  const nav  = getNavForRole(role, brandCfg);

  const vencidasN  = cfes.filter(f =>
    ['emitida','cobrado_parcial'].includes(f.status) &&
    f.fechaVenc &&
    Math.floor((new Date(f.fechaVenc).getTime() - Date.now()) / 86400000) < 0
  ).length;
  const pendOrders = orders.filter(o => o.status === 'pending').length;

  const getBadge = (id) => {
    if (id === 'dashboard'   && critN > 0)      return <Badge n={critN} />;
    if (id === 'inventory'   && critN > 0)      return <Badge n={critN} />;
    if (id === 'orders'      && pendOrders > 0) return <Badge n={pendOrders} color={S.amber} />;
    if (id === 'facturacion' && vencidasN > 0)  return <Badge n={vencidasN} />;
    return null;
  };

  const brandName = brandCfg?.name || '';
  const brandColor = brandCfg?.color || S.green;

  return (
    <aside style={{
      width: 220, background: S.bg,
      borderRight: `1px solid ${S.border}`,
      position: 'fixed', top: 0, left: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      fontFamily: S.sans,
    }}>

      {/* ── Logo / Brand ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '18px 18px 14px',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        {brandCfg?.logoUrl ? (
          <img
            src={brandCfg.logoUrl}
            alt={brandName || 'Logo'}
            style={{ height: 36, objectFit: 'contain', maxWidth: '100%', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <img
            src="/pazque-logo.png"
            alt="Pazque"
            style={{ height: 36, objectFit: 'contain', maxWidth: '100%', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}

        {brandName && (
          <div style={{
            marginTop: 8, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: brandColor,
          }}>
            {brandName}
          </div>
        )}

        {/* Sync status — minimal, unobtrusive */}
        {(syncStatus === 'error' || hasPendingSync) && (
          <div style={{ marginTop: 5, fontSize: 10, color: S.amber, fontWeight: 500 }}>
            ⚠ {hasPendingSync ? 'Sync pendiente' : 'Modo local'}
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', scrollbarWidth: 'none' }}>
        <style>{`nav::-webkit-scrollbar { display: none; }`}</style>

        {NAV_GROUPS.map(g => {
          const items = nav.filter(n => g.ids.includes(n.id));
          if (!items.length) return null;

          return (
            <React.Fragment key={g.label}>
              {/* Group label */}
              <div style={{
                padding: '12px 18px 4px',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#b8b4ac',
              }}>
                {g.label}
              </div>

              {/* Items */}
              {items.map(n => (
                <NavItem
                  key={n.id}
                  item={n}
                  active={tab === n.id}
                  onClick={() => setTab(n.id)}
                  badge={getBadge(n.id)}
                />
              ))}
            </React.Fragment>
          );
        })}
      </nav>


    </aside>
  );
}
