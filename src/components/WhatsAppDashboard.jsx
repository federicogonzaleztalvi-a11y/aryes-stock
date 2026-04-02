/**
 * WhatsAppDashboard — Panel de resumen diario enviable por WhatsApp.
 *
 * Genera un mensaje de texto con los KPIs del día (ventas, cobros,
 * stock crítico, entregas, lotes por vencer) y abre WhatsApp
 * directamente con el mensaje listo para enviar.
 *
 * El número de destino se configura en Config → Marca y empresa.
 */
import { useMemo, useState } from 'react';
import { fmt } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

const G = '#1a8a3c';
const WA = '#25d366';

  '$' + Number(n || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isHoy(fechaStr) {
  if (!fechaStr) return false;
  const f   = new Date(fechaStr);
  const hoy = new Date();
  return (
    f.getDate()     === hoy.getDate() &&
    f.getMonth()    === hoy.getMonth() &&
    f.getFullYear() === hoy.getFullYear()
  );
}

function esMes(fechaStr) {
  if (!fechaStr) return false;
  const f   = new Date(fechaStr);
  const hoy = new Date();
  return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
}

const diasHasta = fechaStr =>
  Math.ceil((new Date(fechaStr) - new Date()) / 86400000);

export default function WhatsAppDashboard() {
  const {
    products, ventas, cobros, lotes, rutas,
    orders, brandCfg, critN,
  } = useApp();

  const [copiado, setCopiado] = useState(false);

  const hoyStr = new Date().toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // ── Calcular métricas ─────────────────────────────────────────────────────
  const metricas = useMemo(() => {
    // Ventas de hoy
    const ventasHoy = ventas.filter(v =>
      v.estado !== 'cancelada' && isHoy(v.fecha || v.creadoEn)
    );
    const totalHoy = ventasHoy.reduce((a, v) => a + Number(v.total || 0), 0);

    // Ventas del mes
    const ventasMes = ventas.filter(v =>
      v.estado !== 'cancelada' && esMes(v.fecha || v.creadoEn)
    );
    const totalMes = ventasMes.reduce((a, v) => a + Number(v.total || 0), 0);

    // Cobros de hoy
    const cobrosHoy   = cobros.filter(c => isHoy(c.fecha || c.creadoEn));
    const totalCobros = cobrosHoy.reduce((a, c) => a + Number(c.monto || 0), 0);

    // Pendiente cobrar (todas las ventas entregadas no cobradas)
    const pendienteCobrar = ventas
      .filter(v => ['entregada', 'emitida'].includes(v.estado))
      .reduce((a, v) => a + Number(v.total || 0), 0)
      - cobros.reduce((a, c) => a + Number(c.monto || 0), 0);

    // Stock crítico
    const stockCritico  = products.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= (p.minStock || p.rop || 5));
    const sinStock      = products.filter(p => Number(p.stock || 0) === 0);

    // Lotes por vencer (≤7 días)
    const lotesUrgentes = lotes.filter(l =>
      l.fechaVenc && diasHasta(l.fechaVenc) >= 0 && diasHasta(l.fechaVenc) <= 7
    );
    const lotesVencidos = lotes.filter(l =>
      l.fechaVenc && diasHasta(l.fechaVenc) < 0
    );

    // Entregas del día
    const entregasHoy = rutas.flatMap(r => (r.entregas || []).filter(e =>
      isHoy(e.fecha || r.fecha)
    ));
    const entregadasHoy = entregasHoy.filter(e => e.estado === 'entregado');

    // Pedidos B2B pendientes
    const pedidosPendientes = orders.filter(o => o.status === 'pending').length;

    return {
      ventasHoy: ventasHoy.length,
      totalHoy,
      ventasMes: ventasMes.length,
      totalMes,
      cobrosHoy: cobrosHoy.length,
      totalCobros,
      pendienteCobrar: Math.max(0, pendienteCobrar),
      stockCritico: stockCritico.length,
      sinStock: sinStock.length,
      stockCriticoNombres: stockCritico.slice(0, 3).map(p => p.name || p.nombre),
      lotesUrgentes: lotesUrgentes.length,
      lotesVencidos: lotesVencidos.length,
      entregasHoy: entregasHoy.length,
      entregadasHoy: entregadasHoy.length,
      pedidosPendientes,
    };
  }, [ventas, cobros, products, lotes, rutas, orders]);

  // ── Generar mensaje WhatsApp ──────────────────────────────────────────────
  const mensaje = useMemo(() => {
    const m = metricas;
    const empresa = brandCfg?.name || 'Aryes';
    const lines = [];

    lines.push(`📊 *Resumen ${hoyStr}*`);
    lines.push(`_${empresa}_`);
    lines.push('');

    // Ventas
    lines.push('💰 *VENTAS*');
    lines.push(`Hoy: *${fmt.currencyCompact(m.totalHoy)}* (${m.ventasHoy} venta${m.ventasHoy !== 1 ? 's' : ''})`);
    lines.push(`Mes: *${fmt.currencyCompact(m.totalMes)}* (${m.ventasMes} venta${m.ventasMes !== 1 ? 's' : ''})`);
    lines.push('');

    // Cobros
    lines.push('💳 *COBROS*');
    if (m.cobrosHoy > 0) {
      lines.push(`Hoy: *${fmt.currencyCompact(m.totalCobros)}* (${m.cobrosHoy} cobro${m.cobrosHoy !== 1 ? 's' : ''})`);
    } else {
      lines.push('Hoy: sin cobros');
    }
    if (m.pendienteCobrar > 0) {
      lines.push(`⚠️ Pendiente cobrar: *${fmt.currencyCompact(m.pendienteCobrar)}*`);
    }
    lines.push('');

    // Stock
    if (m.stockCritico > 0 || m.sinStock > 0) {
      lines.push('📦 *STOCK*');
      if (m.sinStock > 0) lines.push(`🔴 Sin stock: ${m.sinStock} producto${m.sinStock !== 1 ? 's' : ''}`);
      if (m.stockCritico > 0) {
        lines.push(`🟡 Stock crítico: ${m.stockCritico} producto${m.stockCritico !== 1 ? 's' : ''}`);
        if (m.stockCriticoNombres.length > 0) {
          lines.push(`   (${m.stockCriticoNombres.join(', ')}${m.stockCritico > 3 ? '...' : ''})`);
        }
      }
      lines.push('');
    }

    // Lotes
    if (m.lotesVencidos > 0 || m.lotesUrgentes > 0) {
      lines.push('⏰ *VENCIMIENTOS*');
      if (m.lotesVencidos > 0)  lines.push(`🔴 Vencidos: ${m.lotesVencidos} lote${m.lotesVencidos !== 1 ? 's' : ''}`);
      if (m.lotesUrgentes > 0) lines.push(`🟡 Próximos a vencer (≤7 días): ${m.lotesUrgentes} lote${m.lotesUrgentes !== 1 ? 's' : ''}`);
      lines.push('');
    }

    // Entregas
    if (m.entregasHoy > 0) {
      lines.push('🚚 *ENTREGAS HOY*');
      lines.push(`${m.entregadasHoy}/${m.entregasHoy} completada${m.entregadasHoy !== 1 ? 's' : ''}`);
      lines.push('');
    }

    // Pedidos B2B
    if (m.pedidosPendientes > 0) {
      lines.push(`🛒 *${m.pedidosPendientes} pedido${m.pedidosPendientes !== 1 ? 's' : ''} B2B pendiente${m.pedidosPendientes !== 1 ? 's' : ''}* de importar`);
      lines.push('');
    }

    lines.push(`_Generado desde Aryes Stock · ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}_`);

    return lines.join('\n');
  }, [metricas, brandCfg, hoyStr]);

  const ownerPhone = (brandCfg?.ownerPhone || '').replace(/\D/g, '');

  const abrirWhatsApp = () => {
    const url = ownerPhone
      ? `https://wa.me/${ownerPhone}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = mensaje;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const m = metricas;
  const hayAlertas = m.stockCritico > 0 || m.sinStock > 0 || m.lotesVencidos > 0 || m.pendienteCobrar > 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        padding: '18px 22px', borderBottom: '1px solid #d1fae5',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ fontSize: 32 }}>📱</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            Resumen del día para WhatsApp
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
            {hoyStr}
          </div>
        </div>
        {hayAlertas && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 11, fontWeight: 700, color: '#92400e',
          }}>
            ⚠️ Hay alertas
          </div>
        )}
      </div>

      <div style={{ padding: '18px 22px' }}>
        {/* KPIs rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { icon: '💰', label: 'Ventas hoy',    valor: fmt.currencyCompact(m.totalHoy),      sub: `${m.ventasHoy} ventas`,          color: G },
            { icon: '💳', label: 'Cobrado hoy',   valor: fmt.currencyCompact(m.totalCobros),   sub: `${m.cobrosHoy} cobros`,          color: '#059669' },
            { icon: '📦', label: 'Stock crítico', valor: m.stockCritico + m.sinStock, sub: `${m.sinStock} sin stock`,     color: m.stockCritico + m.sinStock > 0 ? '#dc2626' : G },
            { icon: '⏰', label: 'Lotes urgentes',valor: m.lotesUrgentes,          sub: `${m.lotesVencidos} vencidos`,    color: m.lotesVencidos > 0 ? '#dc2626' : m.lotesUrgentes > 0 ? '#d97706' : G },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
              border: `1px solid ${kpi.color === '#dc2626' && kpi.valor > 0 ? '#fecaca' : '#f3f4f6'}`,
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{kpi.icon}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{kpi.valor}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Preview del mensaje */}
        <div style={{
          background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb',
          padding: '14px 16px', marginBottom: 16,
          fontFamily: 'monospace', fontSize: 12, color: '#374151',
          lineHeight: 1.7, maxHeight: 220, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {mensaje}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={abrirWhatsApp}
            style={{
              flex: 1, padding: '12px 20px',
              background: WA, color: '#fff', border: 'none',
              borderRadius: 10, cursor: 'pointer', fontWeight: 700,
              fontSize: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, transition: 'opacity .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: 18 }}>💬</span>
            {ownerPhone ? 'Enviar por WhatsApp' : 'Abrir WhatsApp'}
          </button>
          <button onClick={copiar}
            style={{
              padding: '12px 18px', background: copiado ? G : '#fff',
              color: copiado ? '#fff' : '#374151',
              border: '1px solid #e5e7eb', borderRadius: 10,
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
              transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
        </div>

        {!ownerPhone && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            Configurá tu número en <strong>Config → Marca y empresa</strong> para enviar directo a tu WhatsApp
          </div>
        )}
      </div>
    </div>
  );
}
