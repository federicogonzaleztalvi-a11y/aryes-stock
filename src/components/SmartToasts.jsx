import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── SmartToasts ──────────────────────────────────────────────────────────────
// Self-contained toast notification system.
// Fires alerts once per session via a ref-based deduplication set.
// Zero references to the T theme object — all colors are inline literals.
// Receives only: critN (number), _orders (array).
// Reads CFE overdue count from localStorage internally.

const TOAST_STYLES = {
  danger:  { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '⚠' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: '⏰' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: 'ℹ' },
};

function SmartToasts({ critN = 0, orders = [] }) {
  const [toasts, setToasts] = useState([]);
  const shown = useRef(new Set());

  const add = useCallback((id, msg, type = 'info') => {
    if (shown.current.has(id)) return;
    shown.current.add(id);
    setToasts(prev => [...prev.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    // Critical stock alert
    if (critN > 0) {
      add(
        'crit-stock',
        `${critN} producto${critN > 1 ? 's' : ''} requiere${critN > 1 ? 'n' : ''} pedido urgente`,
        'danger'
      );
    }

    // Overdue invoices — read from localStorage
    try {
      const cfes = JSON.parse(localStorage.getItem('aryes-cfe') || '[]');
      const overdueCount = cfes.filter(f =>
        ['emitida', 'cobrado_parcial'].includes(f.status) &&
        f.fechaVenc &&
        Math.floor((new Date(f.fechaVenc).getTime() - Date.now()) / 86400000) < 0
      ).length;
      if (overdueCount > 0) {
        add(
          'cfe-overdue',
          `${overdueCount} factura${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''} sin cobrar`,
          'warning'
        );
      }
    } catch { /* ignore localStorage errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire once on mount — shown ref prevents duplicates

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 8000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 340,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
        return (
          <div
            key={t.id}
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,.08)',
              pointerEvents: 'all',
              animation: 'smartToastIn .2s ease',
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
            <span style={{
              flex: 1,
              fontFamily: "'DM Sans','Inter',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: s.color,
              lineHeight: 1.4,
            }}>
              {t.msg}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: s.color,
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                opacity: 0.6,
                flexShrink: 0,
              }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

export default SmartToasts;
