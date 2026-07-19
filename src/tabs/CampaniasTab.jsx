import React from 'react';
import { getAuthHeaders } from '../lib/constants.js';

// CampaniasTab — Dashboard visual de Meta Ads (Facebook / Instagram).
// ----------------------------------------------------------------------------
// NO es un chat: es un tablero que LEE el rendimiento de las campañas de la
// cuenta publicitaria conectada (api/meta-ads.js, fase 1 = solo lectura) y, arriba
// de todo, un panel de sugerencias de Claude actuando como experto en Meta Ads.
// Genérico multi-tenant: muestra la cuenta conectada de la org del usuario.
//
// Si la org todavía no conectó Meta Ads, muestra un estado vacío que lleva a
// Config → Integraciones. La conexión (OAuth) vive en MetaAdsCard (ConfigInline).

const C = {
  ink: '#1a1a18', sub: '#6a6a68', faint: '#9a9a98',
  line: '#ecebe6', bg: '#faf9f6', card: '#ffffff',
  blue: '#2563eb', blueBg: '#eff6ff',
  green: '#059669', greenBg: '#f0fdf4',
  red: '#dc2626', redBg: '#fef2f2',
  amber: '#d97706', amberBg: '#fffbeb',
  sans: "'Inter',system-ui,sans-serif",
};

const RANGES = [
  { id: 'last_7d',  label: '7 días' },
  { id: 'last_14d', label: '14 días' },
  { id: 'last_30d', label: '30 días' },
  { id: 'last_90d', label: '90 días' },
];

function fmtMoney(n, currency) {
  if (n == null || isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n);
  } catch { return (currency || '$') + ' ' + Math.round(n).toLocaleString('es-UY'); }
}
function fmtNum(n, dec = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-UY', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n) { return n == null || isNaN(n) ? '—' : fmtNum(n, 2) + '%'; }

// ── KPI card ────────────────────────────────────────────────────────────────
function Kpi({ label, value, hint, accent }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || C.ink, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ── Sugerencia de Claude ──────────────────────────────────────────────────────
function Suggestion({ s }) {
  const sev = s.severidad || 'info';
  const style = sev === 'alta' ? { bg: C.redBg, c: C.red, t: 'Prioridad alta' }
    : sev === 'media' ? { bg: C.amberBg, c: C.amber, t: 'A revisar' }
    : { bg: C.greenBg, c: C.green, t: 'OK' };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${style.c}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ background: style.bg, color: style.c, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{style.t}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{s.titulo}</span>
      </div>
      {s.detalle && <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{s.detalle}</div>}
      {s.accion && <div style={{ fontSize: 12.5, color: C.ink, marginTop: 6 }}><b>→ </b>{s.accion}</div>}
    </div>
  );
}

// ── Mini gráfico de barras (gasto diario) — SVG puro, sin librerías ──────────
function TrendBars({ trend, currency }) {
  if (!trend || !trend.length) return null;
  const max = Math.max(...trend.map(d => d.spend || 0), 1);
  const W = 100, H = 40, gap = 1.2;
  const bw = Math.max(0.5, (W - gap * (trend.length - 1)) / trend.length);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Gasto diario</div>
        <div style={{ fontSize: 11.5, color: C.faint }}>máx {fmtMoney(max, currency)}/día</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 90, display: 'block' }}>
        {trend.map((d, i) => {
          const h = ((d.spend || 0) / max) * H;
          return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={0.4} fill={C.blue} opacity={0.85} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.faint, marginTop: 6 }}>
        <span>{trend[0]?.date}</span>
        <span>{trend[trend.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ── Tabla de anuncios (mejores / peores) ──────────────────────────────────────
function AdsTable({ title, ads, currency, sortedBy, tone }) {
  if (!ads || !ads.length) return null;
  const accent = tone === 'best' ? C.green : C.red;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {ads.map((a, i) => (
          <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: i < ads.length - 1 ? `1px solid ${C.line}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>Gasto {fmtMoney(a.spend, currency)} · CTR {fmtPct(a.ctr)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                {sortedBy === 'roas' ? (a.roas != null ? fmtNum(a.roas, 2) + 'x' : '—') : (a.cpa != null ? fmtMoney(a.cpa, currency) : '—')}
              </div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{sortedBy === 'roas' ? 'ROAS' : 'costo/result.'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaniasTab() {
  const [status, setStatus] = React.useState(null);   // null=loading
  const [range, setRange] = React.useState('last_30d');
  const [metrics, setMetrics] = React.useState(null);
  const [advice, setAdvice] = React.useState(null);    // { suggestions } | { warning }
  const [loadingM, setLoadingM] = React.useState(false);
  const [loadingA, setLoadingA] = React.useState(false);
  const [err, setErr] = React.useState('');

  // 1) Estado de conexión.
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/meta-ads?action=status', { headers: getAuthHeaders() });
        setStatus(r.ok ? await r.json() : { connected: false });
      } catch { setStatus({ connected: false }); }
    })();
  }, []);

  // 2) Métricas + análisis cuando hay conexión o cambia el rango.
  React.useEffect(() => {
    if (!status?.connected) return;
    let alive = true;
    setLoadingM(true); setLoadingA(true); setErr(''); setAdvice(null);
    (async () => {
      try {
        const r = await fetch(`/api/meta-ads?action=metrics&range=${range}`, { headers: getAuthHeaders() });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) { setErr(d?.error || 'No se pudieron cargar las métricas.'); setMetrics(null); }
        else setMetrics(d);
      } catch { if (alive) setErr('No se pudieron cargar las métricas.'); }
      if (alive) setLoadingM(false);
    })();
    (async () => {
      try {
        const r = await fetch(`/api/meta-ads?action=advice&range=${range}`, { headers: getAuthHeaders() });
        const d = r.ok ? await r.json() : {};
        if (alive) setAdvice(d);
      } catch { if (alive) setAdvice({ warning: 'No se pudo generar el análisis.' }); }
      if (alive) setLoadingA(false);
    })();
    return () => { alive = false; };
  }, [status?.connected, range]);

  const goIntegraciones = () => window.dispatchEvent(new CustomEvent('pazque-nav', { detail: { tab: 'integraciones' } }));

  // ── Estados base ──
  if (status == null) {
    return <div style={{ padding: 40, fontFamily: C.sans, color: C.faint }}>Cargando…</div>;
  }

  if (!status.connected) {
    return (
      <div style={{ fontFamily: C.sans, maxWidth: 520, margin: '60px auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Conectá Meta Ads</h2>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: '0 0 20px' }}>
          Conectá tu cuenta publicitaria de Facebook / Instagram para ver el rendimiento de tus campañas
          con métricas claras y sugerencias de un experto, todo en un solo tablero.
        </p>
        <button onClick={goIntegraciones}
          style={{ padding: '10px 22px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Ir a Integraciones
        </button>
      </div>
    );
  }

  const t = metrics?.total || {};
  const cur = metrics?.currency || status.currency;

  return (
    <div style={{ fontFamily: C.sans, padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>Campañas Meta</h1>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
            {status.account_name || 'Cuenta publicitaria'}{cur ? ` · ${cur}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                background: range === r.id ? C.blue : 'transparent', color: range === r.id ? '#fff' : C.sub }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}22`, borderRadius: 10, padding: '12px 14px', fontSize: 13, marginBottom: 16 }}>{err}</div>}

      {/* Panel de sugerencias de Claude */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Análisis del experto</span>
          <span style={{ fontSize: 11, color: C.faint }}>por Claude, sobre tus datos reales</span>
        </div>
        {loadingA ? (
          <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 10, padding: '16px 14px', fontSize: 13, color: C.faint }}>
            Analizando tus campañas…
          </div>
        ) : advice?.suggestions?.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {advice.suggestions.map((s, i) => <Suggestion key={i} s={s} />)}
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 10, padding: '14px', fontSize: 13, color: C.faint }}>
            {advice?.warning || 'Sin sugerencias para este período.'}
          </div>
        )}
      </div>

      {/* KPIs */}
      {loadingM ? (
        <div style={{ padding: 30, color: C.faint, fontSize: 13 }}>Cargando métricas…</div>
      ) : metrics ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Kpi label="Gasto" value={fmtMoney(t.spend, cur)} />
            <Kpi label={t.resultLabel || 'Resultados'} value={fmtNum(t.results)} accent={C.green} />
            <Kpi label="Costo / resultado" value={fmtMoney(t.cpa, cur)} hint={t.resultLabel ? `por ${t.resultLabel.toLowerCase()}` : null} />
            <Kpi label="ROAS" value={t.roas != null ? fmtNum(t.roas, 2) + 'x' : '—'} hint="retorno por $ gastado" accent={t.roas >= 1 ? C.green : t.roas != null ? C.red : null} />
            <Kpi label="CTR" value={fmtPct(t.ctr)} hint="tasa de clics" />
            <Kpi label="Alcance" value={fmtNum(t.reach)} hint={`${fmtNum(t.clicks)} clics`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <TrendBars trend={metrics.trend} currency={cur} />
            <AdsTable title="Mejores anuncios" ads={metrics.best} currency={cur} sortedBy={metrics.sortedBy} tone="best" />
            <AdsTable title="Peores anuncios" ads={metrics.worst} currency={cur} sortedBy={metrics.sortedBy} tone="worst" />
          </div>

          {metrics.ads_count === 0 && (
            <div style={{ marginTop: 16, background: C.amberBg, color: C.amber, borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
              No hay anuncios con gasto en este período. Probá ampliar el rango o revisá que tus campañas estén activas.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
