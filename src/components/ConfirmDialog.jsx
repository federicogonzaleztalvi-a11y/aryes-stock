import React, { useState, useCallback, useRef, useEffect } from 'react';

// ── ConfirmDialog + useConfirm ────────────────────────────────────────────────
// Drop-in replacement for window.confirm() — same API, proper UI.
//
// Usage:
//   const { confirm, ConfirmDialog } = useConfirm();
//   // In JSX: <ConfirmDialog />
//   // In handlers:
//   const ok = await confirm({ title: '¿Eliminar?', description: 'Esta acción no se puede deshacer.', variant: 'danger' });
//   if (!ok) return;
//
// Variants: 'danger' (red) | 'warning' (amber) | 'info' (default blue/green)

const F = { sans: "'DM Sans','Inter',system-ui,sans-serif" };

const VARIANTS = {
  danger:  { icon: '🗑', confirmBg: '#dc2626', confirmColor: '#fff', confirmLabel: 'Eliminar' },
  warning: { icon: '⚠️', confirmBg: '#d97706', confirmColor: '#fff', confirmLabel: 'Continuar' },
  info:    { icon: 'ℹ️', confirmBg: '#3a7d1e', confirmColor: '#fff', confirmLabel: 'Confirmar' },
};

function Dialog({ open, title, description, variant = 'danger', confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const v = VARIANTS[variant] || VARIANTS.danger;
  const btnLabel = confirmLabel || v.confirmLabel;

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          animation: 'cdFadeIn 0.12s ease both',
        }}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby={description ? 'cd-desc' : undefined}
        style={{
          position: 'fixed', zIndex: 9001,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          padding: '28px 28px 22px',
          width: 380, maxWidth: 'calc(100vw - 32px)',
          fontFamily: F.sans,
          animation: 'cdSlideIn 0.15s ease both',
        }}
      >
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: description ? 10 : 24 }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{v.icon}</span>
          <h3
            id="cd-title"
            style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a18', lineHeight: 1.3 }}
          >
            {title}
          </h3>
        </div>

        {/* Description */}
        {description && (
          <p
            id="cd-desc"
            style={{ margin: '0 0 22px 36px', fontSize: 13, color: '#6a6a68', lineHeight: 1.5 }}
          >
            {description}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              border: '1px solid #e2e2de',
              borderRadius: 8,
              background: '#fff',
              color: '#3a3a38',
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f3'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 8,
              background: v.confirmBg,
              color: v.confirmColor,
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {btnLabel}
          </button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes cdFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cdSlideIn { from { opacity:0; transform:translate(-50%,-48%) scale(0.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
      `}</style>
    </>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const [state, setState] = useState({ open: false, title: '', description: '', variant: 'danger', confirmLabel: null, cancelLabel: null });
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, description, variant = 'danger', confirmLabel, cancelLabel } = {}) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ open: true, title, description, variant, confirmLabel, cancelLabel });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialogEl = (
    <Dialog
      open={state.open}
      title={state.title}
      description={state.description}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogEl };
}

export default Dialog;
