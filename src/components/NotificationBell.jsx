import { LS } from '../lib/constants.js';
import React, { useState, useEffect, useRef } from 'react';

// ── NotificationBell ─────────────────────────────────────────────────────────
// Persistent alert panel in the topbar.
// Receives: critN (number), orders (array), setTab (fn)
// Reads CFE overdue count from localStorage internally.
// Zero T.* references — all colors are inline literals.

const COLORS = {
  danger:  { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#d97706' },
};

const F = { sans: "'DM Sans','Inter',system-ui,sans-serif" };

function buildAlerts(critN, orders) {
  const alerts = [];

  // 1. Critical stock
  if (critN > 0) {
    alerts.push({
      id: 'crit-stock',
      type: 'danger',
      icon: '📦',
      title: `${critN} producto${critN > 1 ? 's' : ''} con stock crítico`,
      body: 'Requieren pedido urgente para evitar quiebre.',
      action: { label: 'Ver inventario', tab: 'inventory' },
    });
  }

  // 2. Overdue orders (pending + expectedArrival < today)
  const today = Date.now();
  const overdueOrders = (orders || []).filter(
    o => o.status === 'pending' &&
         o.expectedArrival &&
         new Date(o.expectedArrival).getTime() < today
  );
  if (overdueOrders.length > 0) {
    alerts.push({
      id: 'overdue-orders',
      type: 'warning',
      icon: '🚛',
      title: `${overdueOrders.length} pedido${overdueOrders.length > 1 ? 's' : ''} atrasado${overdueOrders.length > 1 ? 's' : ''}`,
      body: 'La fecha de llegada estimada ya pasó.',
      action: { label: 'Ver pedidos', tab: 'orders' },
    });
  }

  // 3. Overdue invoices (from localStorage)
  try {
    const cfes = LS.get('aryes-cfe', []);
    const overdueCFEs = cfes.filter(f =>
      ['emitida', 'cobrado_parcial'].includes(f.status) &&
      f.fechaVenc &&
      Math.floor((new Date(f.fechaVenc).getTime() - today) / 86400000) < 0
    );
    if (overdueCFEs.length > 0) {
      alerts.push({
        id: 'overdue-cfe',
        type: 'warning',
        icon: '🧾',
        title: `${overdueCFEs.length} factura${overdueCFEs.length > 1 ? 's' : ''} vencida${overdueCFEs.length > 1 ? 's' : ''}`,
        body: 'Sin cobrar y fuera de plazo.',
        action: { label: 'Ver facturación', tab: 'facturacion' },
      });
    }
  } catch { /* ignore localStorage errors */ }

  // 4. Pending setup (brand not configured)
  try {
    const brand = LS.get('aryes-brand', null);
    if (!brand?.name) {
      alerts.push({
        id: 'setup-brand',
        type: 'warning',
        icon: '🏷',
        title: 'Configuración inicial pendiente',
        body: 'Completá el nombre y logo de tu empresa.',
        action: { label: 'Ir a configuración', tab: 'config' },
      });
    }
  } catch { /* ignore */ }

  return alerts;
}

function NotificationBell({ critN = 0, orders = [], setTab }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const alerts = buildAlerts(critN, orders);
  const count = alerts.length;

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const navigate = tab => {
    setTab(tab);
    setOpen(false);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', marginRight: 6 }}>

      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notificaciones"
        style={{
          position: 'relative',
          width: 34, height: 34,
          borderRadius: 8,
          border: '1px solid #e2e2de',
          background: open ? '#f0f7ec' : '#f5f5f3',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#eaeae6'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#f5f5f3'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>

        {/* Badge */}
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            minWidth: 16, height: 16,
            borderRadius: 8,
            background: '#dc2626',
            color: '#fff',
            fontSize: 9, fontWeight: 700,
            fontFamily: F.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #fff',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 320,
          background: '#fff',
          border: '1px solid #e2e2de',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
          zIndex: 7000,
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid #f0f0ec',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 700,
              color: '#1a1a18', letterSpacing: '0.01em',
            }}>
              Notificaciones
            </span>
            {count > 0 && (
              <span style={{
                fontFamily: F.sans, fontSize: 11,
                color: '#9a9a98',
              }}>
                {count} activa{count > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Alerts list */}
          {count === 0 ? (
            <div style={{
              padding: '28px 16px',
              textAlign: 'center',
              fontFamily: F.sans, fontSize: 13, color: '#9a9a98',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              Todo en orden, sin alertas activas
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {alerts.map((alert, i) => {
                const c = COLORS[alert.type] || COLORS.warning;
                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: i < alerts.length - 1 ? '1px solid #f5f5f3' : 'none',
                      background: '#fff',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                  >
                    {/* Color dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: c.dot, flexShrink: 0, marginTop: 5,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: F.sans, fontSize: 13, fontWeight: 600,
                        color: '#1a1a18', lineHeight: 1.3, marginBottom: 2,
                      }}>
                        {alert.icon} {alert.title}
                      </div>
                      <div style={{
                        fontFamily: F.sans, fontSize: 11,
                        color: '#6a6a68', lineHeight: 1.4, marginBottom: 6,
                      }}>
                        {alert.body}
                      </div>
                      <button
                        onClick={() => navigate(alert.action.tab)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', fontFamily: F.sans,
                          fontSize: 11, fontWeight: 700, color: '#1a8a3c',
                        }}
                      >
                        {alert.action.label} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
