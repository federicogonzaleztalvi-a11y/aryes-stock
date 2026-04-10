import { useState, useMemo } from 'react';
import { fmt } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

// ─── helpers ─────────────────────────────────────────────────────────────────
const G    = '#059669';
const RED  = '#dc2626';
const AMB  = '#d97706';
const F    = { sans:"'DM Sans','Inter',system-ui,sans-serif", serif:"'Playfair Display',Georgia,serif" };

const fmtM = (n, cur='UYU') => {
  const sym = cur==='USD'?'US$':cur==='EUR'?'€':'$';
  return `${sym} ${fmt.int(n||0)}`;
};
const fmtPct = n => `${Number(n||0).toFixed(1)}%`;

// Month label: 'mar 25'
const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString('es-UY',{month:'short',year:'2-digit'});

// Build YYYY-MM key
const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;

// Last N calendar months (including current), newest last
const lastNMonths = (n) => {
  const months = [];
  const now = new Date();
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d.getFullYear(), d.getMonth()), year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
};

// ─── sub-components ───────────────────────────────────────────────────────────

function PLRow({ label, value, pct, bold, indent, positive, negative, separator }) {
  if (separator) return (
    <tr><td colSpan={8} style={{ padding:'4px 0', borderBottom:'1px solid #e2e2de' }} />  </tr>
  );
  const color = positive ? G : negative ? RED : '#1a1a18';
  const bg    = bold ? '#f9f9f7' : 'transparent';
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding:'8px 14px', fontFamily:F.sans, fontSize:13,
        fontWeight: bold ? 700 : 400, color: '#1a1a18',
        paddingLeft: indent ? 28 : 14 }}>
        {label}
      </td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:F.sans, fontSize:13,
        fontWeight: bold ? 700 : 400, color }}>
        {value !== null ? fmtM(value) : '—'}
      </td>
      {pct !== undefined && (
        <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:F.sans, fontSize:12,
          color: '#9a9a98' }}>
          {pct !== null ? fmtPct(pct) : ''}
        </td>
      )}
    </tr>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(Math.abs(value) / max, 1) * 100 : 0;
  return (
    <div style={{ height:24, background:'#f0f0ec', borderRadius:3, overflow:'hidden', position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, height:'100%',
        width:`${pct}%`, background:color, borderRadius:3, transition:'width .4s' }} />
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
        paddingLeft:6, fontFamily:F.sans, fontSize:11, fontWeight:700,
        color: pct > 40 ? '#fff' : '#1a1a18' }}>
        {fmtM(value)}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ResultadosTab() {
  const { ventas, purchaseInvoices, products } = useApp();

  const [mesesVista, setMesesVista] = useState(6);  // 3 | 6 | 12

  const months = useMemo(() => lastNMonths(mesesVista), [mesesVista]);

  // ── Monthly P&L computation ────────────────────────────────────────────────
  const byMonth = useMemo(() => {
    return months.map(({ key, label, year, month }) => {

      // Ingresos brutos: ventas no canceladas del mes
      const ventasMes = ventas.filter(v => {
        if (v.estado === 'cancelada') return false;
        const d = new Date(v.creadoEn);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const ingresos = ventasMes.reduce((s,v) => s + Number(v.total||0), 0);

      // COGS: costo real de las unidades vendidas (costoUnit snapshot)
      const cogs = ventasMes.reduce((s,v) =>
        s + (v.items||[]).reduce((ss,it) =>
          ss + Number(it.cantidad||0) * Number(it.costoUnit||0), 0), 0);

      const margenBruto     = ingresos - cogs;
      const margenBrutoPct  = ingresos > 0 ? margenBruto / ingresos * 100 : 0;

      // Compras del mes (from purchase_invoices — approximate operating cost)
      const comprasMes = purchaseInvoices
        .filter(pi => {
          const d = new Date(pi.fecha);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s,pi) => s + Number(pi.total||0), 0);

      const cantVentas   = ventasMes.length;
      const ticketProm   = cantVentas > 0 ? ingresos / cantVentas : 0;
      const cogsHasData  = cogs > 0;

      return { key, label, ingresos, cogs, margenBruto, margenBrutoPct,
               comprasMes, cantVentas, ticketProm, cogsHasData };
    });
  }, [months, ventas, purchaseInvoices]);

  // ── Totals for the period ──────────────────────────────────────────────────
  const totals = useMemo(() => {
    const ingresos     = byMonth.reduce((s,m) => s + m.ingresos, 0);
    const cogs         = byMonth.reduce((s,m) => s + m.cogs, 0);
    const margenBruto  = ingresos - cogs;
    const margenPct    = ingresos > 0 ? margenBruto / ingresos * 100 : 0;
    const compras      = byMonth.reduce((s,m) => s + m.comprasMes, 0);
    const cantVentas   = byMonth.reduce((s,m) => s + m.cantVentas, 0);
    const cogsHasData  = cogs > 0;
    return { ingresos, cogs, margenBruto, margenPct, compras, cantVentas, cogsHasData };
  }, [byMonth]);

  // ── Inventario valorizado ─────────────────────────────────────────────────
  const stockValorizado = useMemo(() =>
    products.reduce((s,p) => s + Number(p.stock||0) * Number(p.unitCost||0), 0),
  [products]);

  // ── Bar chart max ─────────────────────────────────────────────────────────
  const maxIngresos = Math.max(...byMonth.map(m => m.ingresos), 1);

  const hasCOGS = totals.cogsHasData;

  return (
    <section style={{ padding:'28px 36px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between',
                    marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:F.serif, fontSize:28, color:'#1a1a18', margin:0 }}>
            Estado de Resultados
          </h2>
          <p style={{ fontSize:12, color:'#9a9a98', margin:'4px 0 0', fontFamily:F.sans }}>
            P&L simplificado · {months[0]?.label} — {months[months.length-1]?.label}
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[3,6,12].map(n => (
            <button key={n} onClick={() => setMesesVista(n)}
              style={{ padding:'6px 14px', borderRadius:20,
                border:`2px solid ${mesesVista===n ? G : '#e5e7eb'}`,
                background: mesesVista===n ? G : '#fff',
                color: mesesVista===n ? '#fff' : '#666',
                fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:F.sans }}>
              {n}m
            </button>
          ))}
        </div>
      </div>

      {/* Warning if no COGS data */}
      {!hasCOGS && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10,
                      padding:'12px 18px', marginBottom:20, display:'flex', gap:10, alignItems:'center',
                      fontFamily:F.sans }}>
          <span style={{ fontSize:18 }}>⚠</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>
              Costos no configurados — margen bruto no disponible
            </div>
            <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>
              Configurá el costo unitario en los productos o registrá facturas de compra con líneas de detalle para calcular el margen real.
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
                    background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
        {[
          { l:'Ingresos período',  v:fmtM(totals.ingresos),          accent:G },
          { l:'COGS período',      v:hasCOGS ? fmtM(totals.cogs) : '—', accent:'#6366f1' },
          { l:'Margen bruto',      v:hasCOGS ? fmtM(totals.margenBruto) : '—',
            sub:hasCOGS ? fmtPct(totals.margenPct) : 'Sin datos de costo',
            accent: hasCOGS ? (totals.margenPct>=15 ? G : AMB) : '#9a9a98' },
          { l:'Compras período',   v:fmtM(totals.compras),            accent:'#d97706' },
        ].map(k => (
          <div key={k.l} style={{ background:'#fff', padding:'18px 20px' }}>
            <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
                          textTransform:'uppercase', color:'#9a9a98', marginBottom:6 }}>{k.l}</div>
            <div style={{ fontFamily:F.serif, fontSize:26, fontWeight:400, color:k.accent }}>
              {k.v}
            </div>
            {k.sub && <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Main content: bar chart + P&L table */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>

        {/* Left: Monthly bar chart */}
        <div style={{ background:'#fff', borderRadius:12, padding:20,
                      boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
                        textTransform:'uppercase', color:'#9a9a98', marginBottom:16 }}>
            Ingresos por mes
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {byMonth.map(m => (
              <div key={m.key}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:F.sans, fontSize:11, color:'#6a6a68', fontWeight:600 }}>{m.label}</span>
                  <span style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98' }}>
                    {m.cantVentas} venta{m.cantVentas!==1?'s':''}
                    {m.cogsHasData && ` · ${fmtPct(m.margenBrutoPct)} mg`}
                  </span>
                </div>
                <MiniBar value={m.ingresos} max={maxIngresos}
                  color={m.margenBrutoPct >= 15 ? G : m.margenBrutoPct > 0 ? AMB : '#e2e2de'} />
              </div>
            ))}
          </div>

          {/* Stock valorizado footer */}
          <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #f0f0ec' }}>
            <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
                          textTransform:'uppercase', color:'#9a9a98', marginBottom:4 }}>
              Inventario valorizado (hoy)
            </div>
            <div style={{ fontFamily:F.serif, fontSize:22, fontWeight:400, color:'#6366f1' }}>
              {fmtM(stockValorizado,'USD')}
            </div>
            <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:2 }}>
              {products.filter(p=>p.stock>0).length} productos con stock · costo promedio ponderado
            </div>
          </div>
        </div>

        {/* Right: P&L statement table */}
        <div style={{ background:'#fff', borderRadius:12, overflow:'hidden',
                      boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f9f9f7', borderBottom:'2px solid #e2e2de' }}>
                <th style={{ padding:'12px 14px', textAlign:'left', fontFamily:F.sans,
                              fontSize:10, fontWeight:700, letterSpacing:'0.1em',
                              textTransform:'uppercase', color:'#9a9a98' }}>
                  Concepto
                </th>
                <th style={{ padding:'12px 14px', textAlign:'right', fontFamily:F.sans,
                              fontSize:10, fontWeight:700, color:'#9a9a98' }}>
                  Período
                </th>
                <th style={{ padding:'12px 14px', textAlign:'right', fontFamily:F.sans,
                              fontSize:10, fontWeight:700, color:'#9a9a98' }}>
                  % Ing.
                </th>
              </tr>
            </thead>
            <tbody>
              <PLRow label="Ingresos por ventas" value={totals.ingresos}
                pct={100} bold positive />

              <PLRow label="(−) Costo de ventas (COGS)"
                value={hasCOGS ? totals.cogs : null}
                pct={hasCOGS ? (totals.ingresos>0 ? totals.cogs/totals.ingresos*100 : null) : null}
                indent negative={hasCOGS} />

              <PLRow separator />

              <PLRow label="Margen bruto"
                value={hasCOGS ? totals.margenBruto : null}
                pct={hasCOGS ? totals.margenPct : null}
                bold
                positive={hasCOGS && totals.margenBruto > 0}
                negative={hasCOGS && totals.margenBruto < 0} />

              <PLRow separator />

              <PLRow label="Compras a proveedores (período)"
                value={totals.compras}
                pct={totals.ingresos > 0 ? totals.compras/totals.ingresos*100 : null}
                indent />

              <PLRow separator />

              {/* Nota explicativa */}
              <tr>
                <td colSpan={3} style={{ padding:'12px 14px', fontFamily:F.sans,
                  fontSize:11, color:'#9a9a98', fontStyle:'italic' }}>
                  * Gastos operativos no incluidos (alquiler, sueldos, etc.)
                  {!hasCOGS && ' · COGS requiere costos configurados en productos'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Per-month detail */}
          {byMonth.length > 0 && (
            <>
              <div style={{ padding:'10px 14px 6px', borderTop:'2px solid #e2e2de',
                fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.1em',
                textTransform:'uppercase', color:'#9a9a98' }}>
                Detalle mensual
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f9f9f7', borderBottom:'1px solid #e2e2de' }}>
                    {['Mes','Ingresos','COGS','Mg.Bruto','Mg.%'].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign: h==='Mes'?'left':'right',
                        fontFamily:F.sans, fontSize:10, fontWeight:600, color:'#9a9a98',
                        textTransform:'uppercase', letterSpacing:.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byMonth.map((m,i) => (
                    <tr key={m.key} style={{ borderBottom:'1px solid #f0f0ec',
                      background: i%2===0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding:'7px 10px', fontFamily:F.sans, fontSize:12, fontWeight:600 }}>{m.label}</td>
                      <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12, color:G, fontWeight:600 }}>{fmtM(m.ingresos)}</td>
                      <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12, color:'#6366f1' }}>{m.cogsHasData ? fmtM(m.cogs) : '—'}</td>
                      <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12,
                        fontWeight:600,
                        color: !m.cogsHasData ? '#9a9a98' : m.margenBruto>=0 ? G : RED }}>
                        {m.cogsHasData ? fmtM(m.margenBruto) : '—'}
                      </td>
                      <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12,
                        color: !m.cogsHasData ? '#9a9a98' : m.margenBrutoPct>=15 ? G : m.margenBrutoPct>=0 ? AMB : RED }}>
                        {m.cogsHasData ? fmtPct(m.margenBrutoPct) : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ borderTop:'2px solid #e2e2de', background:'#f9f9f7', fontWeight:700 }}>
                    <td style={{ padding:'8px 10px', fontFamily:F.sans, fontSize:12, fontWeight:700 }}>Total</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12, color:G, fontWeight:700 }}>{fmtM(totals.ingresos)}</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12, color:'#6366f1', fontWeight:700 }}>{hasCOGS ? fmtM(totals.cogs) : '—'}</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12,
                      fontWeight:700, color: hasCOGS ? (totals.margenBruto>=0?G:RED) : '#9a9a98' }}>
                      {hasCOGS ? fmtM(totals.margenBruto) : '—'}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:F.sans, fontSize:12,
                      fontWeight:700,
                      color: hasCOGS ? (totals.margenPct>=15?G:totals.margenPct>=0?AMB:RED) : '#9a9a98' }}>
                      {hasCOGS ? fmtPct(totals.margenPct) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
