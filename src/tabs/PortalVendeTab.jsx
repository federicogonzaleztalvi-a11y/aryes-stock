// src/tabs/PortalVendeTab.jsx
// "El portal vende" — la plata que el portal B2B vendió solo.
// ----------------------------------------------------------------------------
// Pantalla-resumen pensada como artefacto comercial: responde de un vistazo
// "¿cuánta plata me vendió el portal sin que mueva un dedo?". Números DUROS,
// no inventados: total facturado por pedidos que entraron por el portal
// (b2b_orders, scopeado al org por RLS) + el "vendió de más" honesto de las
// recomendaciones (/api/analytics, atribuido sólo a pedidos confirmados).
//
// Genérico por-org: sirve para cualquier distribuidor, no hardcodea ningún
// cliente. Demo-mode aware (sin sesión no consulta Supabase).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fmt, SB_URL, getAuthHeaders } from '../lib/constants.js';
import { useApp } from '../context/AppContext.tsx';

const G    = '#059669';
const BLUE = '#2563eb';
const AMB  = '#d97706';
const F    = { sans:"'DM Sans','Inter',system-ui,sans-serif", serif:"'Playfair Display',Georgia,serif" };

const money = (n) => '$ ' + fmt.int(n || 0);

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString('es', { month:'short', year:'2-digit' });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const lastNMonths = (n) => {
  const out = []; const now = new Date();
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    out.push({ key: monthKey(d), label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return out;
};

// ¿El pedido entró fuera del horario comercial? (lun-vie 9–18). Es la métrica
// "el portal vende cuando vos no estás" — honesta, derivada de creado_en.
function esFueraDeHorario(iso) {
  const d = new Date(iso);
  const day = d.getDay();             // 0 dom · 6 sáb
  const h = d.getHours();
  return day === 0 || day === 6 || h < 9 || h >= 18;
}

function Stat({ label, value, sub, accent = G }) {
  return (
    <div style={{ background:'#fff', padding:'18px 20px' }}>
      <div style={{ fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.12em',
        textTransform:'uppercase', color:'#9a9a98', marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:F.serif, fontSize:26, fontWeight:400, color:accent }}>{value}</div>
      {sub && <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, label, right }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontFamily:F.sans, fontSize:11, color:'#6a6a68', fontWeight:600 }}>{label}</span>
        <span style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98' }}>{right}</span>
      </div>
      <div style={{ height:24, background:'#f0f0ec', borderRadius:3, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, height:'100%', width:`${pct}%`,
          background:G, borderRadius:3, transition:'width .4s' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
          paddingLeft:6, fontFamily:F.sans, fontSize:11, fontWeight:700,
          color: pct > 40 ? '#fff' : '#1a1a18' }}>{money(value)}</div>
      </div>
    </div>
  );
}

export default function PortalVendeTab() {
  const { isDemoMode } = useApp();
  const [meses, setMeses] = useState(6);           // 3 | 6 | 12
  const [orders, setOrders] = useState([]);
  const [reco, setReco] = useState(null);          // { recoRevenuePedido, pedidosConReco, recoAddsPedido }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const cargar = useCallback(async () => {
    if (isDemoMode) { setLoading(false); return; }
    setLoading(true); setErr('');
    try {
      const [oRes, aRes] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/b2b_orders?order=creado_en.desc&limit=2000&select=total,creado_en,cliente_id,cliente_nombre,cliente_tel,estado`,
          { headers: getAuthHeaders() }),
        fetch('/api/analytics?days=365', { headers: getAuthHeaders() }).catch(() => null),
      ]);
      const o = oRes.ok ? await oRes.json() : [];
      setOrders(Array.isArray(o) ? o : []);
      if (aRes && aRes.ok) {
        const a = await aRes.json();
        setReco(a?.recomendaciones || null);
      }
    } catch (e) {
      setErr('No se pudieron cargar los pedidos del portal. ' + (e?.message || ''));
    } finally { setLoading(false); }
  }, [isDemoMode]);

  useEffect(() => { cargar(); }, [cargar]);

  const months = useMemo(() => lastNMonths(meses), [meses]);

  const stats = useMemo(() => {
    const monthSet = new Set(months.map(m => m.key));
    // "Vendido" = pedidos que no se cancelaron, dentro del rango de meses elegido.
    const vivos = orders.filter(o => o.estado !== 'cancelado' && o.creado_en);
    const enRango = vivos.filter(o => monthSet.has(monthKey(new Date(o.creado_en))));

    const total    = enRango.reduce((s,o) => s + Number(o.total || 0), 0);
    const nPedidos = enRango.length;
    const clientes = new Set(enRango.map(o => o.cliente_id || o.cliente_tel || '∅')).size;
    const ticket   = nPedidos > 0 ? total / nPedidos : 0;

    const fueraHorario = enRango.filter(o => esFueraDeHorario(o.creado_en)).length;
    const fueraPct = nPedidos > 0 ? Math.round(fueraHorario / nPedidos * 100) : 0;

    // Serie mensual
    const byMonthMap = {};
    months.forEach(m => { byMonthMap[m.key] = { ...m, ingresos:0, pedidos:0 }; });
    enRango.forEach(o => {
      const k = monthKey(new Date(o.creado_en));
      if (byMonthMap[k]) { byMonthMap[k].ingresos += Number(o.total || 0); byMonthMap[k].pedidos++; }
    });
    const byMonth = months.map(m => byMonthMap[m.key]);
    const maxIngresos = Math.max(1, ...byMonth.map(m => m.ingresos));

    // Top clientes por plata
    const cliMap = {};
    enRango.forEach(o => {
      const k = o.cliente_nombre || o.cliente_id || o.cliente_tel || '—';
      if (!cliMap[k]) cliMap[k] = { nombre:k, total:0, pedidos:0 };
      cliMap[k].total += Number(o.total || 0); cliMap[k].pedidos++;
    });
    const topClientes = Object.values(cliMap).sort((a,b) => b.total - a.total).slice(0, 5);

    return { total, nPedidos, clientes, ticket, fueraHorario, fueraPct, byMonth, maxIngresos, topClientes };
  }, [orders, months]);

  const wrap = { padding:'28px 36px', maxWidth:1100, margin:'0 auto', fontFamily:F.sans };

  // ── Demo / vacíos ──────────────────────────────────────────────────────────
  if (isDemoMode) {
    return (
      <section style={wrap}>
        <h2 style={{ fontFamily:F.serif, fontSize:28, color:'#1a1a18', margin:'0 0 6px' }}>El portal vende</h2>
        <p style={{ fontSize:13, color:'#9a9a98', margin:0 }}>
          En modo demo no hay pedidos reales. Cuando tus clientes pidan por el portal, vas a ver acá cuánta plata vendió solo.
        </p>
      </section>
    );
  }

  return (
    <section style={wrap}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:F.serif, fontSize:28, color:'#1a1a18', margin:0 }}>El portal vende</h2>
          <p style={{ fontSize:12, color:'#9a9a98', margin:'4px 0 0' }}>
            La plata que el portal te vendió solo · {months[0]?.label} — {months[months.length-1]?.label}
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[3,6,12].map(n => (
            <button key={n} onClick={() => setMeses(n)}
              style={{ padding:'6px 14px', borderRadius:20,
                border:`2px solid ${meses===n ? G : '#e5e7eb'}`,
                background: meses===n ? G : '#fff', color: meses===n ? '#fff' : '#666',
                fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:F.sans }}>{n}m</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:'#9a9a98', fontSize:13 }}>Cargando…</div>}
      {err && !loading && <div style={{ padding:16, background:'#fef2f2', color:'#b91c1c', borderRadius:10, fontSize:13 }}>{err}</div>}

      {!loading && !err && stats.nPedidos === 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'22px 24px' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#92400e', marginBottom:6 }}>Todavía no hay pedidos del portal en este período</div>
          <div style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>
            Apenas tus clientes empiecen a pedir por el portal, vas a ver acá cuánta plata vendió solo —
            total facturado, ticket promedio y qué clientes son los que más compran.
          </div>
        </div>
      )}

      {!loading && !err && stats.nPedidos > 0 && (
        <>
          {/* Hero — la plata */}
          <div style={{ background:G, borderRadius:16, padding:'26px 28px', color:'#fff', marginBottom:22 }}>
            <div style={{ fontSize:12.5, fontWeight:600, opacity:.92, marginBottom:4 }}>El portal te vendió</div>
            <div style={{ fontFamily:F.serif, fontSize:48, fontWeight:500, lineHeight:1 }}>{money(stats.total)}</div>
            <div style={{ fontSize:12.5, opacity:.92, marginTop:8 }}>
              en {stats.nPedidos} pedido{stats.nPedidos===1?'':'s'} de {stats.clientes} cliente{stats.clientes===1?'':'s'} · sin que muevas un dedo
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
            background:'#e2e2de', borderRadius:12, overflow:'hidden', marginBottom:22 }}>
            <Stat label="Vendido por el portal" value={money(stats.total)} accent={G} />
            <Stat label="Pedidos" value={fmt.int(stats.nPedidos)} sub="entraron solos" accent={BLUE} />
            <Stat label="Clientes que pidieron" value={fmt.int(stats.clientes)} sub="sin vendedor" accent={BLUE} />
            <Stat label="Ticket promedio" value={money(stats.ticket)} accent={AMB} />
          </div>

          {/* Bloque medio: tendencia + "de más" / 24-7 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:22 }}>
            {/* Tendencia mensual */}
            <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9a98', marginBottom:16 }}>
                Vendido por mes
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {stats.byMonth.map(m => (
                  <MiniBar key={m.key} value={m.ingresos} max={stats.maxIngresos}
                    label={m.label} right={`${m.pedidos} pedido${m.pedidos!==1?'s':''}`} />
                ))}
              </div>
            </div>

            {/* Columna derecha: "vendió de más" + 24/7 */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {reco && reco.recoRevenuePedido > 0 && (
                <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)', borderTop:`3px solid ${G}` }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9a98', marginBottom:8 }}>
                    Y además te vendió de más
                  </div>
                  <div style={{ fontFamily:F.serif, fontSize:32, fontWeight:500, color:G, lineHeight:1 }}>
                    {money(reco.recoRevenuePedido)}
                  </div>
                  <div style={{ fontSize:12, color:'#6a6a68', marginTop:8, lineHeight:1.5 }}>
                    en mercadería que <b>sugirió el portal</b> (volver a comprar, recomendados) y terminó
                    en {reco.pedidosConReco} pedido{reco.pedidosConReco===1?'':'s'} confirmado{reco.pedidosConReco===1?'':'s'}.
                  </div>
                </div>
              )}

              <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)', borderTop:`3px solid ${BLUE}` }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9a98', marginBottom:8 }}>
                  Vende cuando vos no estás
                </div>
                <div style={{ fontFamily:F.serif, fontSize:32, fontWeight:500, color:BLUE, lineHeight:1 }}>
                  {stats.fueraPct}%
                </div>
                <div style={{ fontSize:12, color:'#6a6a68', marginTop:8, lineHeight:1.5 }}>
                  de los pedidos entraron <b>fuera del horario comercial</b> (noches y fines de semana).
                  El portal toma pedidos 24/7.
                </div>
              </div>
            </div>
          </div>

          {/* Top clientes */}
          <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9a98', marginBottom:14 }}>
              Quién más compra por el portal
            </div>
            {(() => {
              const max = Math.max(1, ...stats.topClientes.map(c => c.total));
              return stats.topClientes.map((c, i) => (
                <div key={i} style={{ marginBottom:11 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'#1a1a18', marginBottom:4 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>{c.nombre}</span>
                    <span style={{ fontWeight:700, color:'#6a6a68' }}>{money(c.total)} · {c.pedidos} ped.</span>
                  </div>
                  <div style={{ height:7, background:'#f0f0ec', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:(c.total/max*100)+'%', height:'100%', background:G, borderRadius:4 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </>
      )}
    </section>
  );
}
