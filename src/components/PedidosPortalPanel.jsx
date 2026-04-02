// PedidosPortalPanel — Auto-importa pedidos del portal B2B al llegar
// Cada pedido nuevo se convierte automáticamente en venta pendiente
// El panel muestra un historial de lo importado recientemente

import { useState, useEffect, useCallback, useRef } from 'react';
import { fmt } from '../lib/constants.js';

const G = '#1a8a3c';

function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1)  return 'ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffMin < 1440) return `hace ${Math.floor(diffMin/60)} h`;
  return d.toLocaleDateString('es-UY');
}

export default function PedidosPortalPanel({ onImportar }) {
  const [importing, setImporting] = useState(false);
  const [lastImported, setLastImported] = useState([]);  // historial reciente
  const [toast, setToast] = useState(null);
  const processedIds = useRef(new Set());

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAndAutoImport = useCallback(async () => {
    if (importing) return;
    try {
      const r = await fetch('/api/pedido?action=pendientes&org=aryes');
      const d = await r.json();
      if (!d.ok || !Array.isArray(d.pedidos) || d.pedidos.length === 0) return;

      // Filtrar solo los que no procesamos aún en esta sesión
      const nuevos = d.pedidos.filter(o => !processedIds.current.has(o.id));
      if (nuevos.length === 0) return;

      setImporting(true);

      for (const order of nuevos) {
        processedIds.current.add(order.id);
        try {
          await onImportar(order);
          setLastImported(prev => [{
            id: order.id,
            cliente: order.cliente_nombre,
            total: order.total,
            items: Array.isArray(order.items) ? order.items.length : 0,
            ts: new Date().toISOString(),
          }, ...prev].slice(0, 5));
        } catch (err) {
          console.error('[AutoImport] Error importando pedido:', order.id, err);
        }
      }

      if (nuevos.length === 1) {
        showToast(`Pedido de ${nuevos[0].cliente_nombre} importado automáticamente`);
      } else {
        showToast(`${nuevos.length} pedidos importados automáticamente`);
      }

    } catch (err) {
      console.error('[AutoImport] Error fetching pedidos:', err);
    } finally {
      setImporting(false);
    }
  }, [importing, onImportar]);

  useEffect(() => {
    // Primera carga inmediata
    fetchAndAutoImport();
    // Polling cada 30 segundos
    const iv = setInterval(fetchAndAutoImport, 30_000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // No renderizar nada visible si no hay historial ni actividad
  if (lastImported.length === 0 && !importing && !toast) return null;

  return (
    <>
      {/* Toast de confirmación */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, padding: '12px 18px',
          boxShadow: '0 4px 16px rgba(0,0,0,.10)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600,
          color: G, animation: 'fadeUp .25s ease both', maxWidth: 360,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          {toast.msg}
        </div>
      )}

      {/* Indicador de procesando */}
      {importing && (
        <div style={{
          background: '#f0fdf4', border: `1px solid #bbf7d0`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'Inter,sans-serif', fontSize: 13, color: G,
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%',
            border: `2px solid ${G}`, borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite' }}/>
          Importando pedidos del portal...
        </div>
      )}

      {/* Historial reciente — últimos 5 importados */}
      {lastImported.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12,
          border: `1.5px solid #e8f5e0`,
          marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            background: '#f6fbf4',
            borderBottom: '1px solid #e8f5e0',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: G }}>
              Importados automáticamente
            </span>
          </div>
          {lastImported.map(imp => (
            <div key={imp.id} style={{
              padding: '9px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #f0ede8',
              fontFamily: 'Inter,sans-serif',
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{imp.cliente}</span>
                <span style={{ fontSize: 11, color: '#9a9a98', marginLeft: 8 }}>{fmtTs(imp.ts)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: G }}>{fmt.currencyCompact(imp.total)}</span>
                <span style={{ fontSize: 11, color: '#9a9a98', marginLeft: 6 }}>{imp.items} prod.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
