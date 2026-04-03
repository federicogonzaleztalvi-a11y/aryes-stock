// src/demo/DemoToast.jsx
// Toast sutil que aparece cuando el usuario intenta una acción bloqueada en demo
// Se auto-oculta después de 3 segundos

import { useState, useEffect, useCallback } from 'react';

export default function DemoToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const showToast = useCallback((msg) => {
    setMessage(msg || 'Creá tu cuenta para usar esta función');
    setVisible(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      showToast(e.detail?.action);
    };
    window.addEventListener('demo-blocked', handler);
    return () => window.removeEventListener('demo-blocked', handler);
  }, [showToast]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      background: '#1d1d1f',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 400,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      animation: 'toastIn 0.2s ease',
      maxWidth: '90vw',
      textAlign: 'center',
    }}>
      {message}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}