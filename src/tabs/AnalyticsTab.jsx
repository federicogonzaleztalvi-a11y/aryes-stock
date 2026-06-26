// AnalyticsTab — Panel de analítica web del portal B2B (admin).
// Lee api/analytics (que agrega web_events scopeado al org) y muestra cómo se
// comportan los clientes en el portal: visitas, tiempo, productos vistos,
// búsquedas y embudo de pedido. Mismo lenguaje visual que KPIs/Dashboard.
import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../lib/constants.js';

const T = {
  green: '#059669', greenBg: '#f0fdf4', border: '#f0ede8',
  text: '#1a1a18', textSm: '#5a5a58', textXs: '#9a9a98',
  blue: '#2563eb', amber: '#d97706', card: '#ffffff', bg: '#faf9f6',
};

const fmtDur = (seg) => {
  if (!seg || seg < 1) return '0s';
  if (seg < 60) return seg + 's';
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + s + 's' : '');
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
};

function Card({ label, value, sub, accent = T.border }) {
  return (
    <div style={{ position: 'relative', background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 11, color: T.textXs, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.text, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textSm, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function BarList({ title, rows, unit, accent = T.green }) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return (
    <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>{title}</div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: T.textXs, padding: '8px 0' }}>Sin datos todavía.</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.text, marginBottom: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{r.k}</span>
            <span style={{ fontWeight: 700, color: T.textSm }}>{r.v}{unit ? ' ' + unit : ''}{r.seg != null ? ' · ' + fmtDur(r.seg) : ''}</span>
          </div>
          <div style={{ height: 7, background: T.greenBg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: (r.v / max * 100) + '%', height: '100%', background: accent, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/analytics?days=' + days, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error('http ' + r.status);
      setData(await r.json());
    } catch (e) {
      setErr('No se pudo cargar la analítica. ' + (e?.message || ''));
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const wrap = { padding: '8px 4px 40px', maxWidth: 1100 };
  const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 };

  return (
    <div style={wrap}>
      <div style={headRow}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Analítica web</h1>
          <p style={{ fontSize: 13, color: T.textSm, margin: '4px 0 0' }}>Cómo usan tus clientes el portal de pedidos.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid ' + (days === d ? T.green : T.border),
                background: days === d ? T.green : T.card, color: days === d ? '#fff' : T.textSm }}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.textXs }}>Cargando…</div>}
      {err && !loading && <div style={{ padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, fontSize: 13 }}>{err}</div>}

      {!loading && !err && data?.pendingSetup && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Falta un paso para activar la analítica</div>
          <p style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.6, margin: 0 }}>
            La tabla de datos todavía no está creada en la base. Pegá el archivo <b>supabase-web-events.sql</b> en
            Supabase → SQL Editor → Run (una sola vez). Apenas esté, los clientes que entren al portal empezarán a
            sumar datos acá automáticamente.
          </p>
        </div>
      )}

      {!loading && !err && data && !data.pendingSetup && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
            <Card label="Visitas" value={data.resumen.visitas ?? 0} accent={T.green} sub="sesiones en el portal" />
            <Card label="Clientes activos" value={data.resumen.clientesActivos ?? 0} accent={T.blue} sub="entraron logueados" />
            <Card label="Pedidos" value={data.resumen.pedidos ?? 0} accent={T.green} sub="confirmados" />
            <Card label="Tiempo medio" value={fmtDur(data.resumen.duracionMediaSeg)} accent={T.amber} sub="por visita" />
            <Card label="Productos vistos" value={data.resumen.productosVistos ?? 0} accent={T.blue} />
            <Card label="Agregados" value={data.resumen.productosAgregados ?? 0} accent={T.green} sub="al carrito" />
            <Card label="Búsquedas" value={data.resumen.busquedas ?? 0} accent={T.amber} />
          </div>

          {/* Embudo de pedido */}
          <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Embudo de pedido</div>
            {(() => {
              const f = data.embudo || {};
              const steps = [
                { k: 'Vio el catálogo', v: f.catalogo || 0 },
                { k: 'Vio un producto', v: f.productoVisto || 0 },
                { k: 'Agregó al carrito', v: f.agregado || 0 },
                { k: 'Confirmó pedido', v: f.pedido || 0 },
              ];
              const top = Math.max(1, steps[0].v);
              return steps.map((s, i) => {
                const prev = i > 0 ? steps[i - 1].v : s.v;
                const conv = prev > 0 ? Math.round(s.v / prev * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text, marginBottom: 4 }}>
                      <span>{s.k}</span>
                      <span style={{ fontWeight: 700 }}>{s.v}{i > 0 && <span style={{ color: T.textXs, fontWeight: 500, marginLeft: 6 }}>({conv}%)</span>}</span>
                    </div>
                    <div style={{ height: 22, background: T.bg, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: (s.v / top * 100) + '%', height: '100%', background: i === 3 ? T.green : T.blue, borderRadius: 6, transition: 'width .3s' }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Visitas por día */}
          <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Visitas por día</div>
            {(!data.porDia || data.porDia.length === 0)
              ? <div style={{ fontSize: 13, color: T.textXs }}>Sin datos todavía.</div>
              : (() => {
                const max = Math.max(1, ...data.porDia.map(d => d.visitas));
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, overflowX: 'auto' }}>
                    {data.porDia.map((d, i) => (
                      <div key={i} title={d.dia + ': ' + d.visitas + ' visitas, ' + d.pedidos + ' pedidos'}
                        style={{ flex: '1 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', maxWidth: 26, height: (d.visitas / max * 90 + 4) + 'px', background: d.pedidos > 0 ? T.green : '#cbd5d0', borderRadius: '4px 4px 0 0' }} />
                        <span style={{ fontSize: 9, color: T.textXs, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.dia.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div style={{ fontSize: 11, color: T.textXs, marginTop: 8 }}>Verde = hubo pedidos ese día.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <BarList title="Productos más vistos" rows={data.topProductos || []} accent={T.blue} />
            <BarList title="Más agregados al carrito" rows={data.topAgregados || []} accent={T.green} />
            <BarList title="Pantallas más usadas" rows={data.topPaginas || []} accent={T.amber} />
            <BarList title="Búsquedas más frecuentes" rows={data.busquedas || []} accent={T.blue} />
          </div>

          {data.rango?.sampled && (
            <div style={{ fontSize: 11, color: T.textXs, marginTop: 14 }}>
              * Mostrando una muestra de los eventos más recientes (hay mucho volumen en este rango).
            </div>
          )}
        </>
      )}
    </div>
  );
}
