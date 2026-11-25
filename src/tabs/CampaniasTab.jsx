import React from 'react';
import { getAuthHeaders } from '../lib/constants.js';

// CampaniasTab — Dashboard de Meta Ads (Facebook / Instagram).
// ----------------------------------------------------------------------------
// NO es un chat: es un tablero que LEE el rendimiento de las campañas de la
// cuenta publicitaria conectada (api/meta-ads.js, fase 1 = solo lectura) y, arriba,
// un panel de análisis de Claude como experto en Meta Ads.
// Genérico multi-tenant: muestra la cuenta conectada de la org del usuario.
// Si la org todavía no conectó, muestra un estado vacío que lleva a Integraciones.

const C = {
  ink: '#16150f', sub: '#6b6a63', faint: '#a2a098',
  line: '#eceae3', hair: '#f3f1ea', bg: '#faf9f5', card: '#ffffff',
  blue: '#2563eb', blueInk: '#1e40af',
  green: '#059669', red: '#dc2626', amber: '#b45309',
  greenBg: '#ecfdf5', redBg: '#fef2f2', amberBg: '#fffbeb', blueBg: '#eff6ff',
  sans: "'Inter',system-ui,sans-serif",
};
const NUM = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' };

const RANGES = [
  { id: 'last_7d',   label: '7 días' },
  { id: 'last_14d',  label: '14 días' },
  { id: 'last_30d',  label: '30 días' },
  { id: 'last_90d',  label: '90 días' },
  { id: 'this_year', label: 'Este año' },
  { id: 'maximum',   label: 'Máximo' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtMoney(n, currency) {
  if (n == null || isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n);
  } catch { return (currency || '$') + ' ' + Math.round(n).toLocaleString('es-UY'); }
}
function fmtMoneyShort(n, currency) {
  if (n == null || isNaN(n)) return '—';
  const sym = currency === 'USD' ? 'US$' : '$';
  const abs = Math.abs(n);
  if (abs >= 1e6) return sym + (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (abs >= 1e3) return sym + (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace('.0', '') + 'k';
  return sym + Math.round(n).toLocaleString('es-UY');
}
function fmtNum(n, dec = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-UY', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtNumShort(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'k';
  return fmtNum(n);
}
function fmtPct(n) { return n == null || isNaN(n) ? '—' : fmtNum(n, 2) + '%'; }
function fmtDate(str, unit) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  if (!m) return str;
  if (unit === 'mes') return `${MESES[m - 1]} ${String(y).slice(2)}`;
  return `${d} ${MESES[m - 1]}`;
}

// ── Chip de variación vs período anterior ────────────────────────────────────
function DeltaChip({ pct, goodWhen = 'up' }) {
  if (pct == null || isNaN(pct)) return null;
  const flat = Math.abs(pct) < 0.5;
  const up = pct >= 0;
  const good = goodWhen === 'neutral' ? null : (goodWhen === 'down' ? !up : up);
  const color = flat || good == null ? C.sub : good ? C.green : C.red;
  const bg = flat || good == null ? C.hair : good ? C.greenBg : C.redBg;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, color, fontSize: 11,
      fontWeight: 700, padding: '2px 7px', borderRadius: 20, ...NUM }}>
      {flat ? '→' : up ? '↑' : '↓'} {fmtNum(Math.abs(pct), 0)}%
    </span>
  );
}

// ── Tarjeta de métrica ────────────────────────────────────────────────────────
function Metric({ label, value, hint, delta, goodWhen, primary }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '15px 17px',
      boxShadow: primary ? `0 0 0 1.5px ${C.blue}22, 0 1px 2px #0000000a` : '0 1px 2px #00000008' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.055em' }}>{label}</span>
        <DeltaChip pct={delta} goodWhen={goodWhen} />
      </div>
      <div style={{ fontSize: 27, fontWeight: 760, color: C.ink, lineHeight: 1.1, marginTop: 9, letterSpacing: '-0.02em', ...NUM }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ── Gráfico de área (SVG puro, con hover) ─────────────────────────────────────
function AreaChart({ data, currency, unit }) {
  const wrapRef = React.useRef(null);
  const [w, setW] = React.useState(720);
  const [hi, setHi] = React.useState(null);
  React.useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(es => { for (const e of es) setW(Math.max(280, e.contentRect.width)); });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const H = 260;
  const pad = { t: 14, r: 14, b: 30, l: 52 };
  const plotW = Math.max(1, w - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const n = data.length;
  const rawMax = Math.max(...data.map(d => d.spend || 0), 1);
  // Techo "lindo" para la escala (1/2/5 × 10^k).
  const niceMax = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(rawMax)));
    for (const m of [1, 2, 2.5, 5, 10]) if (p * m >= rawMax) return p * m;
    return p * 10;
  })();
  const x = i => n <= 1 ? pad.l + plotW / 2 : pad.l + (i / (n - 1)) * plotW;
  const y = v => pad.t + plotH - (v / niceMax) * plotH;

  const pts = data.map((d, i) => [x(i), y(d.spend || 0)]);
  const linePath = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = n ? `M${pts[0][0].toFixed(1)},${(pad.t + plotH).toFixed(1)} `
    + pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    + ` L${pts[n - 1][0].toFixed(1)},${(pad.t + plotH).toFixed(1)} Z` : '';

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => niceMax * f);
  const xTickIdx = (() => {
    if (n <= 1) return [0];
    const want = Math.min(n, w < 420 ? 3 : 6);
    const step = (n - 1) / (want - 1);
    return Array.from({ length: want }, (_, k) => Math.round(k * step));
  })();

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (w / r.width);
    const i = n <= 1 ? 0 : Math.round(((mx - pad.l) / plotW) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const hv = hi != null ? data[hi] : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} style={{ display: 'block' }}
        onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <defs>
          <linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.20" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* gridlines + labels Y */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={i === 0 ? C.line : C.hair} strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill={C.faint} fontFamily={C.sans} style={NUM}>
              {fmtMoneyShort(v, currency)}
            </text>
          </g>
        ))}
        {/* área + línea */}
        {n > 1 && <path d={areaPath} fill="url(#mFill)" />}
        {n > 1 && <path d={linePath} fill="none" stroke={C.blue} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {n === 1 && <circle cx={x(0)} cy={y(data[0].spend || 0)} r="4" fill={C.blue} />}
        {/* labels X */}
        {xTickIdx.map(i => (
          <text key={i} x={x(i)} y={H - 10} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="10.5" fill={C.faint} fontFamily={C.sans}>{fmtDate(data[i]?.date, unit)}</text>
        ))}
        {/* crosshair */}
        {hv && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={pad.t + plotH} stroke={C.blue} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={x(hi)} cy={y(hv.spend || 0)} r="4.5" fill={C.card} stroke={C.blue} strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hv && (
        <div style={{ position: 'absolute', top: 6, pointerEvents: 'none',
          left: Math.min(Math.max((x(hi) / w) * 100, 12), 88) + '%', transform: 'translateX(-50%)',
          background: C.ink, color: '#fff', borderRadius: 9, padding: '7px 10px', fontSize: 11.5, whiteSpace: 'nowrap',
          boxShadow: '0 6px 20px #0003', fontFamily: C.sans }}>
          <div style={{ fontWeight: 600, opacity: 0.7, fontSize: 10.5, marginBottom: 2 }}>{fmtDate(hv.date, unit)}</div>
          <div style={{ fontWeight: 700, ...NUM }}>{fmtMoney(hv.spend, currency)}</div>
          {hv.results > 0 && <div style={{ opacity: 0.8, fontSize: 11, ...NUM }}>{fmtNum(hv.results)} result.</div>}
        </div>
      )}
    </div>
  );
}

// ── Panel de análisis de Claude ───────────────────────────────────────────────
function Suggestion({ s }) {
  const sev = s.severidad || 'info';
  const st = sev === 'alta' ? { c: C.red, bg: C.redBg, t: 'Prioridad alta' }
    : sev === 'media' ? { c: C.amber, bg: C.amberBg, t: 'A revisar' }
    : { c: C.green, bg: C.greenBg, t: 'OK' };
  return (
    <div style={{ padding: '13px 15px', borderBottom: `1px solid ${C.hair}`, display: 'flex', gap: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: 7, background: st.c, marginTop: 6, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: st.bg, color: st.c, fontSize: 10, fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{st.t}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{s.titulo}</span>
        </div>
        {s.detalle && <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55, marginTop: 4 }}>{s.detalle}</div>}
        {s.accion && <div style={{ fontSize: 12.5, color: C.ink, marginTop: 6, fontWeight: 500 }}>→ {s.accion}</div>}
      </div>
    </div>
  );
}

// ── Tabla de anuncios ─────────────────────────────────────────────────────────
function AdsTable({ title, subtitle, ads, currency, sortedBy, tone }) {
  const accent = tone === 'best' ? C.green : C.red;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px #00000008' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>{subtitle}</div>
      </div>
      {(!ads || !ads.length) ? (
        <div style={{ padding: '6px 16px 18px', fontSize: 12.5, color: C.faint }}>Sin anuncios con gasto en este período.</div>
      ) : ads.map((a, i) => (
        <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
          borderTop: `1px solid ${C.hair}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, width: 14, ...NUM }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 1, ...NUM }}>{fmtMoney(a.spend, currency)} · CTR {fmtPct(a.ctr)}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: accent, ...NUM }}>
              {sortedBy === 'roas' ? (a.roas != null ? fmtNum(a.roas, 2) + 'x' : '—') : (a.cpa != null ? fmtMoney(a.cpa, currency) : '—')}
            </div>
            <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{sortedBy === 'roas' ? 'ROAS' : 'costo/result.'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const Card = ({ children, pad = '16px 18px', style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: pad, boxShadow: '0 1px 2px #00000008', ...style }}>{children}</div>
);

export default function CampaniasTab() {
  const [status, setStatus] = React.useState(null);
  const [range, setRange] = React.useState('last_30d');
  const [account, setAccount] = React.useState(null);   // 'all' | account_id | '' (activa)
  const [metrics, setMetrics] = React.useState(null);
  const [advice, setAdvice] = React.useState(null);
  const [loadingM, setLoadingM] = React.useState(false);
  const [loadingA, setLoadingA] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/meta-ads?action=status', { headers: getAuthHeaders() });
        setStatus(r.ok ? await r.json() : { connected: false });
      } catch { setStatus({ connected: false }); }
    })();
  }, []);

  // Cuenta por defecto: si hay varias de la misma moneda → "Todas"; si no, la activa.
  React.useEffect(() => {
    if (!status?.connected) return;
    const accts = status.accounts || [];
    if (accts.length > 1) {
      const sameCur = accts.every(a => (a.currency || '') === (accts[0].currency || ''));
      setAccount(sameCur ? 'all' : (status.account_id || accts[0].account_id));
    } else {
      setAccount(status.account_id || accts[0]?.account_id || '');
    }
  }, [status]);

  React.useEffect(() => {
    if (!status?.connected || account == null) return;
    let alive = true;
    const qs = `range=${range}&account=${encodeURIComponent(account)}`;
    setLoadingM(true); setLoadingA(true); setErr(''); setAdvice(null);
    (async () => {
      try {
        const r = await fetch(`/api/meta-ads?action=metrics&${qs}`, { headers: getAuthHeaders() });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) { setErr(d?.error || 'No se pudieron cargar las métricas.'); setMetrics(null); }
        else setMetrics(d);
      } catch { if (alive) setErr('No se pudieron cargar las métricas.'); }
      if (alive) setLoadingM(false);
    })();
    (async () => {
      try {
        const r = await fetch(`/api/meta-ads?action=advice&${qs}`, { headers: getAuthHeaders() });
        const d = r.ok ? await r.json() : {};
        if (alive) setAdvice(d);
      } catch { if (alive) setAdvice({ warning: 'No se pudo generar el análisis.' }); }
      if (alive) setLoadingA(false);
    })();
    return () => { alive = false; };
  }, [status?.connected, range, account]);

  const goIntegraciones = () => window.dispatchEvent(new CustomEvent('pazque-nav', { detail: { tab: 'integraciones' } }));

  if (status == null) return <div style={{ padding: 40, fontFamily: C.sans, color: C.faint }}>Cargando…</div>;

  if (!status.connected) {
    return (
      <div style={{ fontFamily: C.sans, maxWidth: 520, margin: '60px auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Conectá Meta Ads</h2>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: '0 0 20px' }}>
          Conectá tu cuenta publicitaria de Facebook / Instagram para ver el rendimiento de tus campañas
          con métricas claras y análisis de un experto, todo en un solo tablero.
        </p>
        <button onClick={goIntegraciones}
          style={{ padding: '10px 22px', background: C.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Ir a Integraciones
        </button>
      </div>
    );
  }

  const t = metrics?.total || {};
  const cur = metrics?.currency || status.currency;
  const primary = t.roas != null ? 'roas' : t.results ? 'results' : 'reach';
  const noData = metrics && metrics.ads_count === 0 && !(t.spend > 0);
  const accts = status.accounts || [];
  const multiAcct = accts.length > 1;
  const sameCur = multiAcct && accts.every(a => (a.currency || '') === (accts[0].currency || ''));

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, minHeight: '100%', padding: '22px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 780, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>Campañas Meta</h1>
            {multiAcct ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select value={account || ''} onChange={e => setAccount(e.target.value)}
                    style={{ appearance: 'none', WebkitAppearance: 'none', padding: '6px 28px 6px 11px', background: C.card,
                      border: `1px solid ${C.line}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: C.ink,
                      cursor: 'pointer', fontFamily: C.sans, maxWidth: 260 }}>
                    {sameCur && <option value="all">Todas las cuentas</option>}
                    {accts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}{!sameCur && a.currency ? ` · ${a.currency}` : ''}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: C.faint, fontSize: 10 }}>▼</span>
                </div>
                {cur && <span style={{ fontSize: 12, color: C.faint }}>{cur}</span>}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>
                {status.account_name || 'Cuenta publicitaria'}{cur ? ` · ${cur}` : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3, flexWrap: 'wrap' }}>
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                style={{ padding: '6px 13px', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  background: range === r.id ? C.blue : 'transparent', color: range === r.id ? '#fff' : C.sub, transition: 'background .12s' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}22`, borderRadius: 11, padding: '12px 14px', fontSize: 13, marginBottom: 18 }}>{err}</div>}

        {loadingM ? (
          <div style={{ padding: 50, color: C.faint, fontSize: 13, textAlign: 'center' }}>Cargando métricas…</div>
        ) : metrics ? (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: 12, marginBottom: 14 }}>
              <Metric label="Alcance" value={fmtNumShort(t.reach)} hint="personas alcanzadas" delta={t.delta?.reach} goodWhen="up" primary={primary === 'reach'} />
              <Metric label={t.resultLabel || 'Resultados'} value={fmtNum(t.results)} hint="resultados del período" delta={t.delta?.results} goodWhen="up" primary={primary === 'results'} />
              <Metric label="Gasto" value={fmtMoney(t.spend, cur)} hint="inversión total" delta={t.delta?.spend} goodWhen="neutral" />
              <Metric label="CTR" value={fmtPct(t.ctr)} hint={`${fmtNum(t.clicks)} clics`} delta={t.delta?.ctr} goodWhen="up" />
              <Metric label="Costo / result." value={fmtMoney(t.cpa, cur)} hint={t.resultLabel ? `por ${t.resultLabel.toLowerCase()}` : 'por resultado'} delta={t.delta?.cpa} goodWhen="down" />
              <Metric label="ROAS" value={t.roas != null ? fmtNum(t.roas, 2) + 'x' : '—'} hint="retorno por $ gastado" delta={t.delta?.roas} goodWhen="up" primary={primary === 'roas'} />
            </div>

            {/* Gráfico de evolución */}
            <Card pad="16px 18px 10px" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evolución del gasto</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                    <span style={{ fontSize: 26, fontWeight: 780, color: C.ink, letterSpacing: '-0.02em', ...NUM }}>{fmtMoney(t.spend, cur)}</span>
                    <DeltaChip pct={t.delta?.spend} goodWhen="neutral" />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, textAlign: 'right' }}>
                  por {metrics.trendUnit === 'mes' ? 'mes' : 'día'}
                </div>
              </div>
              {metrics.trend?.length ? <AreaChart data={metrics.trend} currency={cur} unit={metrics.trendUnit} /> : (
                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint, fontSize: 13 }}>
                  Sin gasto para graficar en este período.
                </div>
              )}
            </Card>

            {/* Análisis de Claude */}
            <Card pad="0" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${C.hair}` }}>
                <span style={{ fontSize: 15 }}>✦</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Análisis del experto</span>
                <span style={{ fontSize: 11, color: C.faint }}>por Claude, sobre tus datos reales</span>
              </div>
              {loadingA ? (
                <div style={{ padding: '16px', fontSize: 13, color: C.faint }}>Analizando tus campañas…</div>
              ) : advice?.suggestions?.length ? (
                advice.suggestions.map((s, i) => <Suggestion key={i} s={s} />)
              ) : (
                <div style={{ padding: '14px 16px', fontSize: 13, color: C.faint }}>{advice?.warning || 'Sin sugerencias para este período.'}</div>
              )}
            </Card>

            {/* Anuncios */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <AdsTable title="Mejores anuncios" subtitle={metrics.sortedBy === 'roas' ? 'por mayor retorno (ROAS)' : 'por menor costo por resultado'} ads={metrics.best} currency={cur} sortedBy={metrics.sortedBy} tone="best" />
              <AdsTable title="Peores anuncios" subtitle={metrics.sortedBy === 'roas' ? 'por menor retorno (ROAS)' : 'por mayor costo por resultado'} ads={metrics.worst} currency={cur} sortedBy={metrics.sortedBy} tone="worst" />
            </div>

            {noData && (
              <div style={{ marginTop: 14, background: C.amberBg, color: C.amber, border: `1px solid ${C.amber}22`, borderRadius: 11, padding: '12px 15px', fontSize: 13 }}>
                No hay anuncios con gasto en este período. Si tus campañas son más viejas, probá el rango <b>“Máximo”</b> (arriba a la derecha) para ver todo el historial.
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
