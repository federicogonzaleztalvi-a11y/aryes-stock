import React from 'react';

// ── QuickStats ────────────────────────────────────────────────────────────────
// Compact status pills in the topbar.
// Shows only when there's something actionable (non-zero values).
// Receives: critN (number), orders (array).
// Reads CFE overdue debt from localStorage internally.
// Zero T.* references — all colors inline. No TDZ risk.

const F = { sans: "'DM Sans','Inter',system-ui,sans-serif" };

function QuickStats({ critN = 0, orders = [] }) {
  // Pending orders count
  const pendingOrders = (orders || []).filter(o => o.status === 'pending').length;

  // Overdue debt total — read from localStorage
  const overdueDebt = React.useMemo(() => {
    try {
      const cfes = JSON.parse(localStorage.getItem('aryes-cfe') || '[]');
      return cfes
        .filter(f =>
          ['emitida', 'cobrado_parcial'].includes(f.status) &&
          f.fechaVenc &&
          Math.floor((new Date(f.fechaVenc).getTime() - Date.now()) / 86400000) < 0
        )
        .reduce((sum, f) => sum + (f.saldoPendiente || f.total || 0), 0);
    } catch { return 0; }
  }, []);

  const pills = [
    critN > 0 && {
      key: 'stock',
      label: `${critN} crítico${critN > 1 ? 's' : ''}`,
      bg: '#fef2f2',
      border: '#fecaca',
      color: '#dc2626',
      dot: '#dc2626',
    },
    pendingOrders > 0 && {
      key: 'orders',
      label: `${pendingOrders} pedido${pendingOrders > 1 ? 's' : ''}`,
      bg: '#eff6ff',
      border: '#bfdbfe',
      color: '#2563eb',
      dot: '#2563eb',
    },
    overdueDebt > 0 && {
      key: 'debt',
      label: `$${Math.round(overdueDebt).toLocaleString('es-UY')} venc.`,
      bg: '#fffbeb',
      border: '#fde68a',
      color: '#d97706',
      dot: '#d97706',
    },
  ].filter(Boolean);

  if (pills.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginRight: 4,
    }}>
      {pills.map(p => (
        <span
          key={p.key}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: p.bg,
            border: `1px solid ${p.border}`,
            borderRadius: 20,
            padding: '3px 9px',
            fontFamily: F.sans,
            fontSize: 11,
            fontWeight: 700,
            color: p.color,
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          <span style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: p.dot,
            flexShrink: 0,
          }} />
          {p.label}
        </span>
      ))}
    </div>
  );
}

export default QuickStats;
