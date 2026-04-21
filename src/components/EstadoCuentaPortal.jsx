// src/components/EstadoCuentaPortal.jsx
// Wrapper para el portal B2B — carga cfes y cobros del cliente via API
// y los pasa a EstadoCuentaPDF para renderizar

import { useState, useEffect } from 'react';
import { getOrgId } from '../lib/constants.js';
import EstadoCuentaPDF from './EstadoCuentaPDF.jsx';

const API = window.location.origin;
const SANS = "'Inter',system-ui,sans-serif";

export default function EstadoCuentaPortal({ session, brandCfg, onClose }) {
  const [cfes, setCfes] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.clienteId) {
      setError('Sin datos de cliente');
      setLoading(false);
      return;
    }

    const org = session?.org || new URLSearchParams(window.location.search).get('org') || getOrgId();
    const token = session?.token || '';

    fetch(`${API}/api/historial?action=cuenta&cliente_id=${encodeURIComponent(session.clienteId)}&org=${encodeURIComponent(org)}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error('Error al cargar estado de cuenta');
        return r.json();
      })
      .then(data => {
        setCfes(data.cfes || []);
        setCobros(data.cobros || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error de conexión');
        setLoading(false);
      });
  }, [session]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '40px 48px', textAlign: 'center', fontFamily: SANS }}>
          <div style={{ width: 28, height: 28, border: '3px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: '#6a6a68' }}>Cargando estado de cuenta...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '32px 40px', textAlign: 'center', fontFamily: SANS, maxWidth: 400 }}>
          <p style={{ fontSize: 14, color: '#dc2626', marginBottom: 16 }}>{error}</p>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f0f0ec', color: '#6a6a68', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <EstadoCuentaPDF
      cliente={{
        nombre: session?.nombre || '',
        rut: '',
        condPago: '',
      }}
      cfes={cfes}
      cobros={cobros}
      brandCfg={brandCfg}
      onClose={onClose}
    />
  );
}
