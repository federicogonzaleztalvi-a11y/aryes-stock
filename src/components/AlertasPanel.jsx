import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';

// ── AlertasPanel ──────────────────────────────────────────────────────────────
// Smart business alerts computed from existing AppContext data.
// Three alert categories:
//   1. Clientes inactivos  — bought before, silent for ≥ N days
//   2. Alta rotación       — selling >2× dailyUsage vs last 7d movements
//   3. Lotes por vencer    — expiry ≤ 14 days, quantity > 0
//
// Zero new DB tables. Zero new API calls. Pure computation on existing state.

const F = { sans: "'DM Sans','Inter',system-ui,sans-serif" };

const INACTIVIDAD_DIAS = 21;   // client considered inactive after N days
const ROTACION_FACTOR  = 1.8;  // selling ≥ X× dailyUsage = high rotation
const VENC_DIAS        = 14;   // expiry alert window in days

function Badge({ count, color }) {
  if (!count) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, borderRadius: 9, background: color,
      color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 5px',
      fontFamily: F.sans, marginLeft: 6,
    }}>{count}</span>
  );
}

function AlertRow({ icon, title, subtitle, accent, action, actionLabel, secondAction, secondActionLabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderBottom: '1px solid #f0f0ec',
      background: '#fff',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: F.sans, fontSize: 13, fontWeight: 600,
          color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        <div style={{ fontFamily: F.sans, fontSize: 11, color: '#9a9a98', marginTop: 1 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {action && (
          <button onClick={action} style={{
            padding: '4px 12px', background: accent + '18', color: accent,
            border: `1px solid ${accent}44`, borderRadius: 6,
            fontFamily: F.sans, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>{actionLabel}</button>
        )}
        {secondAction && (
          <button onClick={secondAction} style={{
            padding: '4px 12px', background: '#3a7d1e18', color: '#3a7d1e',
            border: '1px solid #3a7d1e44', borderRadius: 6,
            fontFamily: F.sans, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>{secondActionLabel}</button>
        )}
      </div>
    </div>
  );
}

function Section({ title, accent, items, renderItem }) {
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;
  const visible = expanded ? items.slice(0, 4) : [];
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <button onClick={() => setExpanded(e => !e)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 0 8px', textAlign: 'left',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0,
        }} />
        <span style={{
          fontFamily: F.sans, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a98', flex: 1,
        }}>{title}</span>
        <Badge count={items.length} color={accent} />
        <span style={{ fontFamily: F.sans, fontSize: 10, color: '#c8c8c4' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e2de' }}>
          {visible.map((item, i) => (
            <div key={item.id || i} style={{
              borderBottom: i < visible.length - 1 ? '1px solid #f0f0ec' : 'none',
            }}>
              {renderItem(item)}
            </div>
          ))}
          {items.length > 4 && (
            <div style={{
              padding: '8px 14px', background: '#f9f9f7',
              fontFamily: F.sans, fontSize: 11, color: '#9a9a98',
            }}>
              +{items.length - 4} más
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertasPanel({ setTab }) {
  const { ventas, clientes, lotes, products, movements } = useApp();
  const now = Date.now(); // recalculates on each render — correct for time comparisons

  // ── 1. CLIENTES INACTIVOS ─────────────────────────────────────────────────
  const clientesInactivos = useMemo(() => {
    // Build last-sale date per client
    const lastSale = {};
    ventas
      .filter(v => v.estado !== 'cancelada')
      .forEach(v => {
        const ts = new Date(v.creadoEn).getTime();
        if (!lastSale[v.clienteId] || ts > lastSale[v.clienteId].ts) {
          lastSale[v.clienteId] = { ts, nroVenta: v.nroVenta, total: v.total };
        }
      });
    // Clients with at least one past sale but silent for ≥ INACTIVIDAD_DIAS
    return clientes
      .filter(c => {
        const ls = lastSale[c.id];
        if (!ls) return false; // never bought — different issue, not inactivity
        const dias = Math.floor((now - ls.ts) / 86400000);
        return dias >= INACTIVIDAD_DIAS;
      })
      .map(c => {
        const ls = lastSale[c.id];
        const dias = Math.floor((now - ls.ts) / 86400000);
        return { id: c.id, nombre: c.nombre, tipo: c.tipo, dias, ultimaVenta: ls.nroVenta, total: ls.total };
      })
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8);
  }, [ventas, clientes, now]);

  // ── 2. PRODUCTOS EN ALTA ROTACIÓN ────────────────────────────────────────
  const altaRotacion = useMemo(() => {
    // Sum outgoing movements (venta / manual_out) per product in last 7 days
    const cutoff7 = now - 7 * 86400000;
    const salidas7 = {};
    movements
      .filter(m => new Date(m.timestamp).getTime() >= cutoff7 &&
                   ['venta', 'manual_out', 'scanner_out'].includes(m.type))
      .forEach(m => {
        salidas7[m.productId] = (salidas7[m.productId] || 0) + Math.abs(m.qty || 0);
      });
    // Compare to dailyUsage baseline
    return products
      .filter(p => {
        const salidaDiaria7 = (salidas7[p.id] || 0) / 7;
        const baseline = p.dailyUsage || 0;
        return baseline > 0 && salidaDiaria7 >= baseline * ROTACION_FACTOR;
      })
      .map(p => {
        const salidaDiaria7 = (salidas7[p.id] || 0) / 7;
        const factor = salidaDiaria7 / (p.dailyUsage || 1);
        return {
          id: p.id, name: p.name, unit: p.unit, stock: p.stock,
          factor: factor.toFixed(1),
          salida7: (salidas7[p.id] || 0).toFixed(1),
          diasStock: p.dailyUsage > 0 && salidaDiaria7 > 0
            ? Math.floor(p.stock / salidaDiaria7) : null,
        };
      })
      .sort((a, b) => Number(b.factor) - Number(a.factor))
      .slice(0, 6);
  }, [products, movements, now]);

  // ── 3. LOTES POR VENCER ──────────────────────────────────────────────────
  const lotesPorVencer = useMemo(() => {
    const cutoffMs = VENC_DIAS * 86400000;
    return lotes
      .filter(l => {
        if (!l.fechaVenc || Number(l.cantidad) <= 0) return false;
        const diff = new Date(l.fechaVenc + 'T12:00:00').getTime() - now;
        return diff >= 0 && diff <= cutoffMs;        // not yet expired, within window
      })
      .map(l => {
        const dias = Math.ceil((new Date(l.fechaVenc + 'T12:00:00').getTime() - now) / 86400000);
        return { ...l, dias };
      })
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 8);
  }, [lotes, now]);

  const total = clientesInactivos.length + altaRotacion.length + lotesPorVencer.length;
  const [panelOpen, setPanelOpen] = useState(true);

  if (total === 0) return null;

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Panel toggle header */}
      <button onClick={() => setPanelOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 0 12px', textAlign: 'left',
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a98', flex: 1 }}>
          Alertas del negocio
        </span>
        <Badge count={total} color="#d97706" />
        <span style={{ fontFamily: F.sans, fontSize: 10, color: '#c8c8c4' }}>
          {panelOpen ? '▲' : '▼'}
        </span>
      </button>

      {panelOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>

          {/* Clientes inactivos */}
          <Section
            title={`Clientes sin comprar (${INACTIVIDAD_DIAS}d+)`}
            accent="#6366f1"
            items={clientesInactivos}
            renderItem={c => (
              <AlertRow
                icon="👤"
                title={c.nombre}
                subtitle={`Hace ${c.dias} días · Última: ${c.ultimaVenta}`}
                accent="#6366f1"
                action={() => setTab('clientes')}
                actionLabel="Ver →"
              />
            )}
          />

          {/* Alta rotación */}
          <Section
            title="Alta rotación (7d)"
            accent="#d97706"
            items={altaRotacion}
            renderItem={p => (
              <AlertRow
                icon="🔥"
                title={p.name}
                subtitle={`${p.factor}× lo normal · Stock: ${p.stock} ${p.unit}${p.diasStock !== null ? ` · ~${p.diasStock}d` : ''}`}
                accent="#d97706"
                action={() => setTab('inventory')}
                actionLabel="Ver stock"
              />
            )}
          />

          {/* Lotes por vencer */}
          <Section
            title={`Lotes vencen en ${VENC_DIAS}d`}
            accent="#dc2626"
            items={lotesPorVencer}
            renderItem={l => (
              <AlertRow
                icon="⏰"
                title={l.productoNombre}
                subtitle={`Lote ${l.lote} · ${Number(l.cantidad).toFixed(1)} u. · Vence en ${l.dias}d`}
                accent="#dc2626"
                action={() => setTab('lotes')}
                actionLabel="Ver lotes"
                secondAction={() => setTab('ventas')}
                secondActionLabel="Crear venta"
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
