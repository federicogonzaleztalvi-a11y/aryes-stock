import ReorderPointWidget from '../components/ReorderPointWidget.jsx';
import { fmt } from '../lib/constants.js';
import React from 'react';
import { T, ALERT_CFG, AlertPill, StockBar, Btn, fmtDate, totalLead } from '../lib/ui.jsx';
import { useApp } from '../context/AppContext.tsx';
import SetupChecklist from '../components/SetupChecklist.jsx';
import AlertasPanel from '../components/AlertasPanel.jsx';

const F = {
  sans:  "'DM Sans','Inter',system-ui,sans-serif",
  serif: "'Playfair Display',Georgia,serif",
  mono:  "'DM Mono','Fira Code',monospace",
};

const G = '#1a8a3c';


function Sparkline({ data=[], color=T.green, height=32, width=80 }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*width;
    const y = height - ((v-min)/range)*(height*0.8) - height*0.1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function KpiCard({ label, value, sub, accent=T.border, danger=false, warn=false, click, spark, sparkColor, icon }) {
  const valNum = Number(String(value).replace(/[^0-9.-]/g,'')) || 0;
  const isRed  = danger && valNum > 0;
  const isAmber= warn   && valNum > 0;
  const valColor = isRed ? '#dc2626' : isAmber ? '#d97706' : '#1a1a18';
  const [hov, setHov] = React.useState(false);

  return (
    <div onClick={click}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="kpi-card"
      style={{
        background: '#ffffff',
        padding: '20px 22px',
        borderRadius: 16,
        cursor: click ? 'pointer' : 'default',
        boxShadow: hov && click
          ? '0 4px 24px rgba(0,0,0,.10)'
          : '0 2px 12px rgba(0,0,0,.06)',
        border: '1px solid #f0ede8',
        transition: 'box-shadow 0.18s, transform 0.18s',
        transform: hov && click ? 'translateY(-1px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}>
      {/* Accent line top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: isRed ? '#dc2626' : isAmber ? '#d97706' : accent !== T.border ? accent : '#1a8a3c',
        borderRadius: '16px 16px 0 0',
        opacity: (isRed || isAmber || accent !== T.border) ? 1 : 0,
      }}/>
      <div style={{ fontFamily:F.sans, fontSize:11, fontWeight:500, color:'#9a9a98', marginBottom:8, letterSpacing:'0.01em' }}>{label}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div style={{ fontFamily:F.serif, fontSize:30, fontWeight:500, lineHeight:1, color: valColor }}>{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor||accent||T.green} height={28} width={64}/>}
      </div>
      {sub && <div style={{ fontFamily:F.sans, fontSize:11, color:'#9a9a98', marginTop:6 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, action, actionLabel }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <div style={{ fontFamily:F.sans, fontSize:11, fontWeight:600, letterSpacing:'0.01em',
        textTransform:'none', color:'#b0aca6' }}>{title}</div>
      {action && <button onClick={action} style={{ background:'none', border:'none', cursor:'pointer',
        fontFamily:F.sans, fontSize:11, fontWeight:600, color:T.green, padding:0 }}>{actionLabel} →</button>}
    </div>
  );
}

function DashboardInline({products, suppliers, orders, movements, session, setTab, critN, alerts, enriched, setModal, tfCols, cfes=[], cobros=[], confirmOrder, showMsg, demoMode}) {
  const exportarReporte = () => {
    const hoy = new Date().toISOString().split('T')[0];
    const rows = [['Reporte Aryes Stock — '+hoy],[],['KPI','Valor'],['Total productos',(products||[]).length],['En cero',(products||[]).filter(p=>Number(p.stock)<=0).length],['Bajo minimo',(products||[]).filter(p=>Number(p.stock)>0&&Number(p.stock)<=Number(p.minStock||0)).length],['Capital en stock',(products||[]).reduce((s,p)=>s+(Number(p.stock||0)*Number(p.unitCost||p.precio||0)),0)],[],['Producto','Stock','Min','Costo','PrecioVenta','Valor'],...(products||[]).map(p=>[p.nombre||p.name,p.stock||0,p.minStock||0,p.unitCost||p.precio||0,p.precioVenta||0,(Number(p.stock||0)*Number(p.unitCost||p.precio||0))])];
    const csv=rows.map(r=>r.map(v=>String(v||'').includes(',')?'"'+String(v||'')+'"':String(v||'')).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='reporte-aryes-'+hoy+'.csv';a.click();
    URL.revokeObjectURL(url);
  };

  

  // Cargar pedidos a proveedores con ETA
  const [purchaseOrders, setPurchaseOrders] = React.useState([]);
  React.useEffect(() => {
    const SB = import.meta.env.VITE_SUPABASE_URL;
    const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${SB}/rest/v1/purchase_invoices?status=eq.pendiente&select=id,supplier_id,expected_arrival,total,created_at&order=expected_arrival.asc&limit=50`,
      {headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}})
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setPurchaseOrders(d); }).catch(()=>{});
  }, []);


  // Pull ventas reactively — avoids adding a prop to the parent call site
  const { ventas = [], clientes = [], brandCfg = {} } = useApp();

  // today: stable reference that only changes when the calendar day changes
  // Using useMemo with a day-key prevents both stale-midnight and every-render issues
  // ── Resumen diario WhatsApp — Amazon: system pushes info to operator ────
  // today como const simple — no useMemo para evitar TDZ con esbuild
  const today = new Date();

  const generarResumenWA = React.useCallback(() => {
    const hoy    = new Date();
    const ayer   = new Date(hoy - 86400000);
    const fechaStr = hoy.toLocaleDateString('es-UY', { weekday:'long', day:'numeric', month:'long' });
    const ventasAyer = ventas.filter(v => {
      const d = new Date(v.creadoEn);
      return d >= ayer && d < hoy && v.estado !== 'cancelada';
    });
    const totalAyer  = ventasAyer.reduce((s, v) => s + Number(v.total || 0), 0);
    const enCero     = (products || []).filter(p => Number(p.stock) <= 0);
    const bajMin     = (products || []).filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock));
    const deuda      = cfes.filter(f => ['emitida','cobrado_parcial'].includes(f.status))
                           .reduce((s, f) => s + (f.saldoPendiente || f.total || 0), 0);
    const lines = [
      `📊 *Resumen ${fechaStr}*`,
      ``,
      `💰 Ventas ayer: *${ventasAyer.length} órdenes* · U$S ${totalAyer.toLocaleString('es-UY',{minimumFractionDigits:0})}`,
      enCero.length   > 0 ? `🔴 Stock en cero: *${enCero.length} productos*` : `✅ Sin productos en cero`,
      bajMin.length   > 0 ? `🟡 Bajo mínimo: *${bajMin.length} productos*` : null,
      (() => {
        // inline demand sensing count (avoids temporal dead zone)
        const ds = ventas.filter(v => {
          if (!v.clienteId || v.estado === 'cancelada') return false;
          const cliVentas = ventas.filter(x => x.clienteId === v.clienteId && x.estado !== 'cancelada');
          return cliVentas.length >= 2;
        });
        const uniqueClients = [...new Set(ds.map(v => v.clienteId))].length;
        return uniqueClients > 0 ? `📞 Clientes a contactar: *${uniqueClients}*` : null;
      })(),
      deuda           > 0 ? `💳 Deuda pendiente: *U$S ${deuda.toLocaleString('es-UY',{minimumFractionDigits:0})}*` : null,
      ``,
      `_Aryes Stock · ${hoy.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})}_`
    ].filter(Boolean).join('\n');
    const tel = (brandCfg?.ownerPhone || '').replace(/[^0-9]/g, '');
    if (!tel) { alert('Configurá tu número en Configuración → Marca y empresa'); return; }
    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(lines), '_blank');
  }, [ventas, products, cfes, brandCfg]);

  const orderNow   = alerts.filter(p=>p.alert.level==='order_now').length;
  const orderSoon  = alerts.filter(p=>p.alert.level==='order_soon').length;
  const pending    = orders.filter(o=>o.status==='pending');
  const stockValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||p.precio||0),0);
  const transitVal = pending.reduce((s,o)=>s+(+o.totalCost||0),0);
  const critCov    = products.filter(p=>(p.dailyUsage||0)>0&&p.stock>0&&(p.stock/(p.dailyUsage||0.001))<14).length;

  // ── Dynamic reorder point — velocity-based stock coverage ─────────────────
  // Uses last 30 days of 'Salida' movements to compute daily velocity per product
  // diasRestantes = stock / velocidad_diaria
  // Semaforo: rojo < 7d, amarillo 7-14d, verde > 14d
  // Web Push Notifications — inline (evita dependencia circular en bundle)
  const [pushState, setPushState] = React.useState('loading');
  const subscribePush = React.useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushState('unsupported'); return; }
    if (Notification.permission === 'denied') { setPushState('denied'); return; }
    try {
      setPushState('loading');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const kr = await fetch('/api/push?action=vapid-key');
      if (!kr.ok) throw new Error('no key');
      const { publicKey } = await kr.json();
      const raw = atob((publicKey + '='.repeat((4 - publicKey.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/'));
      const key = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const orgId = getOrgId();
      await fetch('/api/push?action=subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: sub.toJSON(), orgId, role:'admin' }) });
      setPushState('subscribed');
    } catch { setPushState('prompt'); }
  }, []);
  React.useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushState('unsupported'); return; }
    if (Notification.permission === 'denied') { setPushState('denied'); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushState(sub ? 'subscribed' : 'prompt'))
      .catch(() => setPushState('prompt'));
  }, []);

  const velocityData = React.useMemo(() => {
    const DAYS = 30;
    const now      = Date.now();
    const cutoff   = new Date(now - DAYS * 86400000).toISOString();
    // Same window, one year ago — for seasonality comparison (Unilever demand planning)
    const yearMs   = 365 * 86400000;
    const cutoffYA = new Date(now - yearMs - DAYS * 86400000).toISOString();
    const endYA    = new Date(now - yearMs).toISOString();

    // Sum Salida movements — current 30d and same period last year
    const salidaMap = {};
    const salidaYA  = {}; // year-ago
    for (const m of (movements || [])) {
      if (m.tipo !== 'Salida') continue;
      const pid = m.productoId || m.producto_id;
      if (!pid) continue;
      const ts = m.timestamp || '';
      if (ts >= cutoff) {
        salidaMap[pid] = (salidaMap[pid] || 0) + (Number(m.cantidad) || 0);
      } else if (ts >= cutoffYA && ts < endYA) {
        salidaYA[pid] = (salidaYA[pid] || 0) + (Number(m.cantidad) || 0);
      }
    }

    return (products || [])
      .filter(p => salidaMap[p.id] > 0)
      .map(p => {
        const totalSalida  = salidaMap[p.id] || 0;
        const unidadDia    = totalSalida / DAYS;

        // Seasonality: compare vs same period last year
        const totalYA      = salidaYA[p.id] || 0;
        const unidadDiaYA  = totalYA > 0 ? totalYA / DAYS : null;
        // Season index: >1.2 = higher than usual, <0.8 = lower than usual
        const seasonIndex  = unidadDiaYA ? unidadDia / unidadDiaYA : null;
        // Adjusted velocity: if we have year-ago data, use max(current, yearAgo*1.1) to anticipate peaks
        const unidadDiaAdj = unidadDiaYA && seasonIndex < 0.9
          ? unidadDiaYA * 1.1  // last year was higher — use that as floor
          : unidadDia;

        const diasRestantes = unidadDiaAdj > 0 ? Math.floor((p.stock || 0) / unidadDiaAdj) : 999;
        const semaforo      = diasRestantes < 7 ? 'rojo' : diasRestantes < 14 ? 'amarillo' : 'verde';

        // Season alert
        let seasonAlert = null;
        if (seasonIndex !== null) {
          if (seasonIndex > 1.3)  seasonAlert = { tipo: 'alta',  label: `+${Math.round((seasonIndex-1)*100)}% vs año pasado` };
          if (seasonIndex < 0.75) seasonAlert = { tipo: 'baja',  label: `-${Math.round((1-seasonIndex)*100)}% vs año pasado` };
        }

        return { id: p.id, nombre: p.nombre || p.name, stock: p.stock, unidad: p.unit,
                 unidadDia, unidadDiaAdj, diasRestantes, semaforo,
                 totalSalida, totalYA, seasonIndex, seasonAlert };
      })
      .filter(p => p.semaforo !== 'verde')
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 10);
  }, [products, movements]);

  const velocityRojo    = velocityData.filter(p => p.semaforo === 'rojo').length;
  const velocityAmar    = velocityData.filter(p => p.semaforo === 'amarillo').length;

  // ── Sugerencias de reposicion — Amazon-style: system detects, human confirms ──
  // Combina velocity data con proveedor + EOQ para generar sugerencias completas
  const sugerenciasReposicion = React.useMemo(() => {
    return velocityData
      .filter(p => p.semaforo === 'rojo') // solo los criticos < 7 dias
      .map(p => {
        const prod = products.find(pr => pr.id === p.id);
        if (!prod) return null;
        const sup  = suppliers.find(s => s.id === prod.supplierId);
        // EOQ simplificado: (velocidad_30d * lead_time * 1.5) redondeado
        const lead   = sup ? Object.values(sup.times||{}).reduce((s,v)=>s+Number(v||0),0) : 14;
        const eqSugg = Math.ceil(p.unidadDia * (lead || 14) * 1.5);
        const costo  = eqSugg * Number(prod.unitCost || 0);
        return {
          id:         p.id,
          nombre:     p.nombre,
          stock:      p.stock,
          unidad:     p.unidad,
          diasRestantes: p.diasRestantes,
          unidadDia:  p.unidadDia,
          cantSugerida: eqSugg,
          costo,
          sup,
          prod,
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  }, [velocityData, products, suppliers]);

  // ── Demand sensing — Unilever-style customer replenishment prediction ──────
  // Calculates avg days between orders per client.
  // If days_since_last_order > avg_interval * 0.8 → alert: cliente listo para reponer
  const demandSensing = React.useMemo(() => {
    return clientes
      .map(cli => {
        const cliVentas = ventas
          .filter(v => v.clienteId === cli.id && v.estado !== 'cancelada')
          .sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));

        if (cliVentas.length < 2) return null; // need at least 2 orders to calc interval

        // Calculate average days between orders
        let totalDays = 0;
        for (let i = 1; i < cliVentas.length; i++) {
          const d1 = new Date(cliVentas[i - 1].creadoEn);
          const d2 = new Date(cliVentas[i].creadoEn);
          totalDays += Math.abs(d2 - d1) / 86400000;
        }
        const avgInterval    = totalDays / (cliVentas.length - 1);
        const lastOrder      = new Date(cliVentas[cliVentas.length - 1].creadoEn);
        const diasDesdeUltima = Math.floor((Date.now() - lastOrder) / 86400000);
        const ratio           = diasDesdeUltima / avgInterval;

        if (ratio < 0.8) return null; // not yet ready to replenish

        return {
          id:            cli.id,
          nombre:        cli.nombre,
          diasDesde:     diasDesdeUltima,
          avgInterval:   Math.round(avgInterval),
          ratio,
          urgencia:      ratio >= 1.2 ? 'alta' : 'media',
          telefono:      cli.telefono || '',
          ultimaCompra:  lastOrder.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 6);
  }, [clientes, ventas]);

  // ── Billing metrics — cfes and cobros received as reactive props from AppContext

  const deudaTotal = cfes
    .filter(f=>['emitida','cobrado_parcial'].includes(f.status))
    .reduce((s,f)=>s+(f.saldoPendiente||f.total||0),0);
  const vencidasN = cfes.filter(f=>['emitida','cobrado_parcial'].includes(f.status)&&f.fechaVenc&&
    Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0).length;
  const facMes = cfes.filter(f=>{
    const d=new Date(f.createdAt||f.fecha);
    return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear()&&
      ['emitida','aceptada','cobrada'].includes(f.status);
  }).reduce((s,f)=>s+f.total,0);

  // Monthly billing sparkline (last 6 months)
  const facSpark = React.useMemo(()=>{
    const months = [];
    for(let i=5;i>=0;i--){
      const d = new Date(); d.setMonth(d.getMonth()-i);
      months.push(cfes.filter(f=>{
        const fd=new Date(f.createdAt||f.fecha);
        return fd.getMonth()===d.getMonth()&&fd.getFullYear()===d.getFullYear()&&
          ['emitida','aceptada','cobrada'].includes(f.status);
      }).reduce((s,f)=>s+f.total,0));
    }
    return months;
  },[cfes]);

  // Top deudores
  const deudores = React.useMemo(()=>{
    const map={};
    cfes.filter(f=>['emitida','cobrado_parcial'].includes(f.status)&&(f.saldoPendiente||f.total)>0)
      .forEach(f=>{
        if(!map[f.clienteId]){ map[f.clienteId]={nombre:f.clienteNombre,deuda:0,vencidas:0}; }
        map[f.clienteId].deuda+=(f.saldoPendiente||f.total||0);
        if(f.fechaVenc&&Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0)
          map[f.clienteId].vencidas++;
      });
    return Object.values(map).sort((a,b)=>b.deuda-a.deuda).slice(0,5);
  },[cfes]);

  // ── Activity + arrivals ────────────────────────────────────────────────────
  const in30 = new Date(); in30.setDate(new Date().getDate()+30);
  const arrivingSoon = pending
    .filter(o=>o.expectedArrival&&new Date(o.expectedArrival)<=in30)
    .sort((a,b)=>new Date(a.expectedArrival)-new Date(b.expectedArrival))
    .slice(0,4);

  const recentIds = new Set(movements
    .filter(m=>(today-new Date(m.timestamp||m.date||0))<30*864e5)
    .map(m=>m.productId));
  const stagnant = products
    .filter(p=>p.stock>0&&!recentIds.has(p.id))
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost)).slice(0,4);

  const recentMovs = [...movements]
    .sort((a,b)=>new Date(b.timestamp||b.date||0)-new Date(a.timestamp||a.date||0))
    .slice(0,6);

  const MOV_ICONS={order_placed:'🛒',delivery:'📦',excel_in:'📊',excel_out:'📊',
    manual_in:'➕',manual_out:'➖',scanner_in:'⌨',adjustment:'⚖'};
  const MOV_LABELS={order_placed:'Pedido generado',delivery:'Mercadería recibida',
    excel_in:'Stock actualizado ↑',excel_out:'Stock actualizado ↓',
    manual_in:'Ingreso manual',manual_out:'Egreso manual',
    scanner_in:'Ingreso scanner',adjustment:'Ajuste de stock'};

  const timeAgo = ts=>{
    if(!ts)return'';
    const mins=Math.round((today-new Date(ts))/60000);
    if(mins<60)return`hace ${mins}m`;
    const hrs=Math.round(mins/60);
    if(hrs<24)return`hace ${hrs}h`;
    return`hace ${Math.round(hrs/24)}d`;
  };

  // ── Ventas metrics ─────────────────────────────────────────────────────────
  const ventasActivas = React.useMemo(() =>
    ventas.filter(v => v.estado !== 'cancelada'), [ventas]);

  // Sales by month (last 6) for bar chart — revenue bars
  const ventasPorMes = React.useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('es-UY', { month: 'short' });
      const total = ventasActivas
        .filter(v => { const vd = new Date(v.creadoEn); return vd.getMonth() === d.getMonth() && vd.getFullYear() === d.getFullYear(); })
        .reduce((s, v) => s + Number(v.total || 0), 0);
      const costo = ventasActivas
        .filter(v => { const vd = new Date(v.creadoEn); return vd.getMonth() === d.getMonth() && vd.getFullYear() === d.getFullYear(); })
        .reduce((s, v) => s + (v.items || []).reduce((ss, it) => ss + Number(it.cantidad || 0) * Number(it.costoUnit || 0), 0), 0);
      months.push({ label, total, costo, margen: total > 0 ? ((total - costo) / total * 100) : 0 });
    }
    return months;
  }, [ventasActivas]);

  // Margin by product category
  const margenPorCategoria = React.useMemo(() => {
    const map = {};
    ventasActivas.forEach(v => {
      (v.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.productoId);
        const cat = prod?.category || 'Sin categoría';
        if (!map[cat]) map[cat] = { venta: 0, costo: 0 };
        map[cat].venta += Number(it.cantidad || 0) * Number(it.precioUnit || 0);
        map[cat].costo += Number(it.cantidad || 0) * Number(it.costoUnit || 0);
      });
    });
    return Object.entries(map)
      .map(([cat, { venta, costo }]) => ({
        cat, venta, costo,
        margen: venta > 0 ? ((venta - costo) / venta * 100) : 0,
      }))
      .filter(r => r.venta > 0)
      .sort((a, b) => b.venta - a.venta)
      .slice(0, 5);
  }, [ventasActivas, products]);

  // Top 5 clients this month by sales volume
  const topClientesMes = React.useMemo(() => {
    const map = {};
    ventasActivas
      .filter(v => { const d = new Date(v.creadoEn); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); })
      .forEach(v => {
        const k = v.clienteId || v.clienteNombre;
        if (!map[k]) map[k] = { nombre: v.clienteNombre, total: 0, ventas: 0 };
        map[k].total += Number(v.total || 0);
        map[k].ventas++;
      });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [ventasActivas]);

  // ── Billing bar chart (last 6 months) ──────────────────────────────────────

  return (
    <div className="au" style={{display:'grid',gap:24,fontFamily:F.sans}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400&family=Playfair+Display:wght@400;500&display=swap"/>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.4); opacity: .6; }
        }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:nth-child(1) { animation-delay: 0.05s; }
        .kpi-card:nth-child(2) { animation-delay: 0.10s; }
        .kpi-card:nth-child(3) { animation-delay: 0.15s; }
        .kpi-card:nth-child(4) { animation-delay: 0.20s; }
      `}</style>

      {/* ── WhatsApp resumen diario ─────────────────────────────────── */}

      {/* ── Setup Progress Checklist — full width banner ── */}
      {!demoMode && <SetupChecklist products={products} setTab={setTab} />}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:12}}>
        <div>

          <h1 style={{fontFamily:F.serif,fontSize:28,fontWeight:500,color:'#1a1a18',
            margin:0,letterSpacing:'-.02em',lineHeight:1}}>
            {today.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
          </h1>
          <div style={{fontFamily:F.sans,fontSize:13,color:'#6a6a68',marginTop:4}}>
            Buenos días, {session?.name?.split(' ')[0]||session?.email?.split('@')[0]||'Admin'}
          </div>
        </div>

      {critN>0&&(
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,
            padding:'10px 18px',display:'flex',gap:10,alignItems:'center',cursor:'pointer'}}
            onClick={()=>setTab('inventory')}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',flexShrink:0,
              animation:'pulseDot 1.8s ease infinite'}}/>
            <span style={{fontFamily:F.sans,fontSize:13,color:'#dc2626',fontWeight:700}}>
              {critN} producto{critN>1?'s':''} requiere{critN>1?'n':''} pedido urgente
            </span>
            <span style={{fontSize:11,color:'#dc2626'}}>Ver →</span>
          </div>
        )}
      </div>

      {/* ── KPI Row 1: Operaciones ────────────────────────────────── */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:0}}>
          <SectionHeader title="Operaciones" />

        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <KpiCard label="Capital en stock" value={fmt.currencyCompact(stockValue)}
            sub="Valor total del inventario" accent={T.green}/>
          <KpiCard label="Cobertura < 14d" value={critCov}
            sub={critCov>0?`productos con riesgo`:'Todo con cobertura OK'}
            accent={critCov>0?'#d97706':'#e2e2de'} warn={critCov>0}
            click={critCov>0?()=>setTab('inventory'):null}/>
          <KpiCard label="En tránsito" value={pending.length}
            sub={pending.length>0?`${fmt.currencyCompact(transitVal)} comprometido`:'Sin pedidos activos'}
            accent={pending.length>0?'#6366f1':'#e2e2de'}
            click={pending.length>0?()=>setTab('orders'):null}/>
          <KpiCard label="Requieren acción" value={orderNow+orderSoon}
            sub={orderNow>0?`${orderNow} urgente · ${orderSoon} pronto`:`${orderSoon} a preparar`}
            accent={(orderNow+orderSoon)>0?(orderNow>0?'#dc2626':'#d97706'):'#e2e2de'}
            danger={orderNow>0} warn={orderNow===0&&orderSoon>0}
            click={(orderNow+orderSoon)>0?()=>setTab('inventory'):null}/>
        </div>
      </div>

      {/* ── KPI Row 2: Financiero ─────────────────────────────────── */}
      <div>
        <SectionHeader title="Financiero" action={()=>setTab('facturacion')} actionLabel="Ver facturación"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <KpiCard label="Facturado este mes" value={facMes>0?fmt.currency(facMes):'—'}
            sub={`${cfes.filter(f=>{const d=new Date(f.createdAt||f.fecha);return d.getMonth()===today.getMonth()}).length} CFEs emitidos`}
            accent={T.green} spark={facSpark} sparkColor={T.green}
            click={()=>setTab('facturacion')}/>
          <KpiCard label="Deuda total" value={deudaTotal>0?fmt.currency(deudaTotal):'—'}
            sub={`${deudores.length} clientes con saldo`}
            accent={deudaTotal>0?'#dc2626':'#e2e2de'} danger={deudaTotal>0}
            click={deudaTotal>0?()=>setTab('facturacion'):null}/>
          <KpiCard label="Facturas vencidas" value={vencidasN}
            sub="sin cobrar" accent={vencidasN>0?'#dc2626':'#e2e2de'} danger={vencidasN>0}
            click={vencidasN>0?()=>setTab('facturacion'):null}/>
          <KpiCard label="Cobros este mes"
            value={fmt.currency(cobros.filter(c=>{const d=new Date(c.fecha);return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();}).reduce((s,c)=>s+c.monto,0))}
            sub={`${cobros.filter(c=>{const d=new Date(c.fecha);return d.getMonth()===today.getMonth();}).length} cobros registrados`}
            accent={T.green} click={()=>setTab('facturacion')}/>
        </div>
      </div>

      {/* ── Main grid: alertas + deudores + llegadas ─────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>

        {/* ── Web Push Notification banner — Delivery Hero: opt-in para recibir alertas */}
        {pushState === 'prompt' && (
          <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,
            padding:'14px 18px',display:'flex',alignItems:'center',gap:14,marginBottom:4}}>
            <span style={{fontSize:24}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:F.sans,fontSize:13,fontWeight:700,color:'#1e40af',marginBottom:2}}>
                Activar notificaciones push
              </div>
              <div style={{fontFamily:F.sans,fontSize:12,color:'#3b82f6'}}>
                Recibite alertas en este dispositivo cuando hay pedidos nuevos, stock critico o entregas confirmadas
              </div>
            </div>
            <button onClick={subscribePush}
              style={{padding:'8px 16px',background:'#3b82f6',color:'#fff',border:'none',
                borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
              Activar
            </button>
          </div>
        )}
        {pushState === 'subscribed' && (
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,
            padding:'10px 18px',display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <span>🔔</span>
            <span style={{fontFamily:F.sans,fontSize:12,color:'#16a34a',fontWeight:600}}>
              Notificaciones activas en este dispositivo
            </span>
          </div>
        )}
        {pushState === 'denied' && (
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:12,
            padding:'10px 18px',display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <span>🔕</span>
            <span style={{fontFamily:F.sans,fontSize:12,color:'#dc2626'}}>
              Notificaciones bloqueadas — activalas desde la configuracion del browser
            </span>
          </div>
        )}

        {/* ── Sugerencias de reposicion (Amazon: sistema detecta, humano confirma) ── */}
        {sugerenciasReposicion.length > 0 && (
          <div style={{marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <div style={{fontFamily:F.sans,fontSize:11,fontWeight:700,color:'#dc2626',textTransform:'uppercase',letterSpacing:.5}}>
                  Reposicion urgente
                </div>
                <div style={{fontFamily:F.sans,fontSize:12,color:'#6a6a68',marginTop:2}}>
                  {sugerenciasReposicion.length} producto{sugerenciasReposicion.length!==1?'s':''} con stock para menos de 7 dias
                </div>
              </div>
              <button onClick={()=>setTab('orders')}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:G,padding:0}}>
                Ver pedidos →
              </button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {sugerenciasReposicion.map(s=>{
                const tel = (s.sup?.whatsapp||s.sup?.phone||'').replace(/[^0-9]/g,'');
                const waMsg = tel ? [
                  `Hola${s.sup?.contact?' '+s.sup.contact.split(' ')[0]:''},`,
                  `Necesitamos reponer *${s.nombre}*.`,
                  `Cantidad sugerida: *${s.cantSugerida} ${s.unidad}*`,
                  `Stock actual: ${s.stock} ${s.unidad} (${s.diasRestantes}d restantes al ritmo actual)`,
                  `Por favor confirmar disponibilidad y fecha de entrega.`
                ].join('\n') : null;

                return (
                  <div key={s.id} style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',border:'1px solid #fecaca',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>

                    {/* Urgency dot + info */}
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',flexShrink:0,animation:'pulseDot 1.8s ease infinite'}}/>
                        <span style={{fontFamily:F.sans,fontSize:13,fontWeight:700,color:'#1a1a18'}}>{s.nombre}</span>
                        <span style={{fontFamily:F.sans,fontSize:11,color:'#dc2626',fontWeight:700}}>
                          {s.diasRestantes < 1 ? 'HOY' : `${s.diasRestantes}d`}
                        </span>
                      </div>
                      <div style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68'}}>
                        Stock: {s.stock} {s.unidad} · {s.unidadDia.toFixed(1)} {s.unidad}/dia
                        {s.sup && ` · ${s.sup.flag||''} ${s.sup.name}`}
                      </div>
                    </div>

                    {/* Suggested quantity + cost */}
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:700,color:'#1a1a18'}}>
                        Sugerido: {s.cantSugerida} {s.unidad}
                      </div>
                      {s.costo > 0 && (
                        <div style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68'}}>
                          USD {s.costo.toLocaleString('es-UY',{minimumFractionDigits:0})}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {/* Revisar detalles via OrderModal con cantidad pre-cargada */}
                      <button onClick={()=>setModal({type:'order',product:s.prod,suggestedQty:s.cantSugerida})}
                        style={{padding:'7px 14px',background:'#fff',border:`1px solid ${G}`,borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,color:G}}>
                        Revisar pedido
                      </button>
                      {/* Confirmar directo — Amazon: system suggests, human confirms with one click */}
                      <button onClick={()=>{
                        confirmOrder(s.prod, s.cantSugerida);
                        showMsg(`Pedido creado: ${s.cantSugerida} ${s.unidad} de ${s.nombre}`);
                        // Auto-open WhatsApp to supplier after confirming
                        if(waMsg && tel){
                          setTimeout(()=>{
                            if(window.confirm(`Pedido creado. Notificar a ${s.sup?.name||'proveedor'} por WhatsApp?`)){
                              window.open(`https://wa.me/${tel}?text=${encodeURIComponent(waMsg)}`, '_blank');
                            }
                          }, 300);
                        }
                      }} style={{padding:'7px 14px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                        Confirmar pedido
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEFT: alertas de inventario */}
        <div>
          <SectionHeader title="Acciones requeridas" action={()=>setTab('inventory')} actionLabel="Ver inventario"/>
          {alerts.length>0?(
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {alerts.slice(0,6).map(({id,name,stock, _unit,sup,alert})=>{
                const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                return(
                  <div key={id} style={{background:'#fff',padding:'12px 16px',display:'flex',
                    alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontFamily:F.sans,fontSize:13,fontWeight:600,color:'#1a1a18'}}>{name}</div>
                      <div style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68',marginTop:2}}>
                        [{sup?.flag}] {sup?.name} · {alert.daily.toFixed(1)}/día
                      </div>
                      <div style={{marginTop:7,width:120}}>
                        <StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/>
                      </div>
                    </div>
                    <AlertPill level={alert.level}/>
                    <div style={{textAlign:'right',minWidth:80}}>
                      <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,letterSpacing:'0.1em',
                        textTransform:'none',color:'#9a9a98',marginBottom:3}}>
                        {alert.level==='order_now'?'Pedir':'Antes del'}
                      </div>
                      <div style={{fontFamily:F.serif,fontSize:14,fontWeight:500,
                        color:ALERT_CFG[alert.level].txt}}>
                        {alert.level==='order_now'?'HOY':fmtDate(ropDate)}
                      </div>
                    </div>
                    <Btn small onClick={()=>setModal({type:'order',product:products.find(p=>p.id===id)})}>
                      Pedir
                    </Btn>
                  </div>
                );
              })}
              {alerts.length>6&&(
                <div style={{background:'#f9f9f7',padding:'9px 16px',cursor:'pointer'}}
                  onClick={()=>setTab('inventory')}>
                  <span style={{fontFamily:F.sans,fontSize:11,color:'#6a6a68'}}>
                    Ver {alerts.length-6} alertas más →
                  </span>
                </div>
              )}
            </div>
          ):(
            <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,
              padding:'16px 20px',display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontSize:18}}>✓</span>
              <span style={{fontFamily:F.sans,fontSize:13,color:'#16a34a',fontWeight:500}}>
                Todo el inventario dentro de parámetros.
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: deudores + llegadas */}
        <div style={{display:'grid',gap:16,alignContent:'start'}}>

          {/* Deudores */}
          {deudores.length>0&&(
            <div>
              <SectionHeader title="Top deudores" action={()=>setTab('facturacion')} actionLabel="Ver todos"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {deudores.map((d,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'10px 14px',
                    borderBottom:i<deudores.length-1?'1px solid #f0f0ec':'none',
                    background:d.vencidas>0?'#fef9f9':'#fff'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,
                        color:'#1a1a18',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {d.nombre}
                      </div>
                      {d.vencidas>0&&(
                        <div style={{fontFamily:F.sans,fontSize:10,color:'#dc2626',marginTop:1,fontWeight:600}}>
                          ⚠ {d.vencidas} vencida{d.vencidas>1?'s':''}
                        </div>
                      )}
                    </div>
                    <div style={{fontFamily:F.serif,fontSize:15,color:'#dc2626',flexShrink:0,marginLeft:8}}>
                      {fmt.currency(d.deuda)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximas llegadas */}
          {arrivingSoon.length>0&&(
            <div>
              <SectionHeader title="Próximas llegadas" action={()=>setTab('orders')} actionLabel="Ver pedidos"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {arrivingSoon.map((o,i)=>{
                  const daysLeft=Math.ceil((new Date(o.expectedArrival)-today)/864e5);
                  return(
                    <div key={o.id} style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center',padding:'10px 14px',
                      borderBottom:i<arrivingSoon.length-1?'1px solid #f0f0ec':'none'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.productName}</div>
                        <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                          {o.qty} {o.unit} · {o.supplierName}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                        <div style={{fontFamily:F.sans,fontSize:12,fontWeight:700,
                          color:daysLeft<=3?'#d97706':T.green}}>
                          {daysLeft<=0?'Hoy':daysLeft===1?'Mañana':`${daysLeft}d`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Alertas del negocio ───────────────────────────────── */}
      <AlertasPanel setTab={setTab} />

      {/* ── Ventas: gráfico de barras 6 meses + margen por categoría + top clientes ── */}
      {ventasActivas.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>

          {/* Ventas últimos 6 meses — bar chart */}
          <div>
            <SectionHeader title="Ventas últimos 6 meses" action={()=>setTab('ventas')} actionLabel="Ver ventas"/>
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',padding:'16px 16px 8px'}}>
              {(() => {
                const maxVal = Math.max(...ventasPorMes.map(m => m.total), 1);
                return (
                  <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
                    {ventasPorMes.map((m, i) => {
                      const h = Math.max((m.total / maxVal) * 72, m.total > 0 ? 4 : 0);
                      const isThisMes = i === 5;
                      return (
                        <div key={m.label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                          <div style={{width:'100%',height:h,background: isThisMes ? T.green : T.greenBd,
                            borderRadius:'3px 3px 0 0',transition:'height .3s',minHeight: m.total > 0 ? 4 : 0}}/>
                          <div style={{fontFamily:F.sans,fontSize:9,color:'#9a9a98',textAlign:'center',
                            fontWeight: isThisMes ? 700 : 400}}>{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{borderTop:'1px solid #f0f0ec',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between'}}>
                <span style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98'}}>Este mes</span>
                <span style={{fontFamily:F.sans,fontSize:12,fontWeight:700,color:T.green}}>
                  {fmt.currency(ventasPorMes[5]?.total || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Margen por categoría */}
          <div>
            <SectionHeader title="Margen por categoría" action={()=>setTab('kpis')} actionLabel="Ver KPIs"/>
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
              {margenPorCategoria.length === 0 ? (
                <div style={{padding:'24px 16px',textAlign:'center',color:'#9a9a98',fontFamily:F.sans,fontSize:12}}>
                  Configurá costos en productos para ver márgenes
                </div>
              ) : margenPorCategoria.map((r, i) => {
                const color = r.margen >= 15 ? T.green : r.margen >= 0 ? '#d97706' : '#dc2626';
                return (
                  <div key={r.cat} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',
                    borderBottom: i < margenPorCategoria.length - 1 ? '1px solid #f0f0ec' : 'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.cat}</div>
                      <div style={{marginTop:3,height:3,borderRadius:2,background:'#f0f0ec',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${Math.min(Math.abs(r.margen),100)}%`,background:color,borderRadius:2}}/>
                      </div>
                    </div>
                    <span style={{fontFamily:F.sans,fontSize:12,fontWeight:700,color,flexShrink:0}}>
                      {r.margen.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top clientes del mes */}
          <div>
            <SectionHeader title="Top clientes (mes)" action={()=>setTab('clientes')} actionLabel="Ver clientes"/>
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
              {topClientesMes.length === 0 ? (
                <div style={{padding:'24px 16px',textAlign:'center',color:'#9a9a98',fontFamily:F.sans,fontSize:12}}>
                  Sin ventas este mes
                </div>
              ) : topClientesMes.map((c, i) => (
                <div key={c.nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',
                  borderBottom: i < topClientesMes.length - 1 ? '1px solid #f0f0ec' : 'none'}}>
                  <span style={{width:18,height:18,borderRadius:'50%',background:T.green+'22',color:T.green,
                    fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {i+1}
                  </span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,color:'#1a1a18',
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.nombre}</div>
                    <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                      {c.ventas} orden{c.ventas > 1 ? 'es' : ''}
                    </div>
                  </div>
                  <span style={{fontFamily:F.sans,fontSize:12,fontWeight:700,color:T.green,flexShrink:0}}>
                    {fmt.currency(c.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom row: proveedores + actividad ──────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

        {/* Estado por proveedor */}
        <div>
          <SectionHeader title="Estado por proveedor"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,
            background:'#e2e2de',borderRadius:10,overflow:'hidden'}}>
            {suppliers.map(sup=>{
              const prods=enriched.filter(p=>p.supplierId===sup.id);
              const now=prods.filter(p=>p.alert.level==='order_now').length;
              const soon=prods.filter(p=>p.alert.level==='order_soon').length;
              const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==='pending').length;
              const supVal=prods.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
              return(
                <div key={sup.id} style={{background:'#fff',padding:'16px 18px',borderRadius:14,boxShadow:'0 2px 10px rgba(0,0,0,.05)',border:'1px solid #f0ede8'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div>
                      <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,letterSpacing:'0.1em',
                        textTransform:'uppercase',color:sup.color,marginBottom:2}}>
                        [{sup.flag}] {sup.name}
                      </div>
                      <div style={{fontFamily:F.serif,fontSize:22,fontWeight:500,color:'#1a1a18',lineHeight:1}}>
                        {prods.length}
                        <span style={{fontFamily:F.sans,fontSize:12,fontWeight:400,color:'#9a9a98',marginLeft:4}}>prod.</span>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:F.sans,fontSize:11,fontWeight:600,color:'#1a1a18'}}>
                        {fmt.currencyCompact(supVal)}
                      </div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                        Lead {totalLead(sup)}d
                      </div>
                      {(()=>{
                        const po=purchaseOrders.find(o=>o.supplier_id===sup.id);
                        if(!po?.expected_arrival) return null;
                        const dias=Math.ceil((new Date(po.expected_arrival)-new Date())/86400000);
                        const color=dias<=0?'#dc2626':dias<=3?'#d97706':'#1a8a3c';
                        return <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,color,marginTop:2}}>
                          {dias<=0?'⚠ Llegó hoy':dias===1?'📦 Llega mañana':`📦 ETA: ${dias}d`}
                        </div>;
                      })()}
                    </div>
                  </div>
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',gap:2,height:6,borderRadius:4,overflow:'hidden',marginBottom:3}}>
                      {Object.values(sup.times).map((v,i)=>(
                        <div key={i} style={{flex:v||.1,background:tfCols[i],borderRadius:2}}/>
                      ))}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98'}}>
                        {['Prep','Aduana','Flete','Dep'].map((l,i)=>(
                          <span key={i} style={{marginRight:6}}>
                            <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:tfCols[i],marginRight:2,verticalAlign:'middle'}}/>
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {now>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#dc2626',fontWeight:700}}>⚡ {now} ya</span>}
                    {soon>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#d97706',fontWeight:600}}>● {soon} pronto</span>}
                    {pend>0&&<span style={{fontFamily:F.sans,fontSize:11,color:'#6366f1',fontWeight:600}}>📦 {pend} tránsito</span>}
                    {!now&&!soon&&!pend&&<span style={{fontFamily:F.sans,fontSize:11,color:'#16a34a',fontWeight:500}}>✓ Normal</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actividad reciente */}
        <div>
          <SectionHeader title="Actividad reciente" action={()=>setTab('movimientos')} actionLabel="Ver todo"/>
          {recentMovs.length>0?(
            <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
              {recentMovs.map((m,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                  borderBottom:i<recentMovs.length-1?'1px solid #f5f5f3':'none',
                  background:i%2===0?'#fff':'#fafaf8'}}>
                  <span style={{fontSize:14,flexShrink:0}}>{MOV_ICONS[m.type]||'•'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {m.productName||'—'}
                    </div>
                    <div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',marginTop:1}}>
                      {MOV_LABELS[m.type]||m.type}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    {m.qty>0&&<div style={{fontFamily:F.mono,fontSize:12,fontWeight:600,color:'#1a1a18'}}>
                      {m.qty} {m.unit||''}
                    </div>}
                    <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                      {timeAgo(m.timestamp||m.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{padding:'32px',textAlign:'center',color:'#9a9a98',
              fontFamily:F.sans,fontSize:13,background:'#f9f9f7',borderRadius:10}}>
              Sin actividad registrada aún
            </div>
          )}

          {/* ── Dynamic reorder point widget ───────────────────────── */}
          {velocityData.length > 0 && (
            <div style={{marginTop:12}}>
              <SectionHeader title={`Cobertura por velocidad de venta`}/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {/* Summary badges */}
                <div style={{display:'flex',gap:8,padding:'10px 14px',borderBottom:'1px solid #f5f5f3',flexWrap:'wrap'}}>
                  {velocityRojo > 0 && (
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#fef2f2',color:'#dc2626'}}>
                      🔴 {velocityRojo} {velocityRojo===1?'producto':'productos'} &lt; 7 días
                    </span>
                  )}
                  {velocityAmar > 0 && (
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#fffbeb',color:'#d97706'}}>
                      🟡 {velocityAmar} {velocityAmar===1?'producto':'productos'} &lt; 14 días
                    </span>
                  )}
                </div>
                {/* Product rows */}
                {velocityData.map((p, i) => (
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'9px 14px',borderBottom:i<velocityData.length-1?'1px solid #f5f5f3':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                        Stock: {p.stock} {p.unidad} · {p.unidadDia.toFixed(1)} uds/día
                        {p.unidadDiaAdj > p.unidadDia * 1.05 && (
                          <span style={{color:'#d97706',marginLeft:4}}>
                            (ajustado a {p.unidadDiaAdj.toFixed(1)} por estacionalidad)
                          </span>
                        )}
                      </div>
                      {p.seasonAlert && (
                        <div style={{fontFamily:F.sans,fontSize:10,fontWeight:700,marginTop:2,
                          color:p.seasonAlert.tipo==='alta'?'#dc2626':'#3b82f6'}}>
                          {p.seasonAlert.tipo==='alta'?'📈':'📉'} {p.seasonAlert.label}
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}>
                      <div style={{fontFamily:F.sans,fontSize:13,fontWeight:700,
                        color:p.semaforo==='rojo'?'#dc2626':'#d97706'}}>
                        {p.diasRestantes < 1 ? '< 1 día' : `${p.diasRestantes} días`}
                      </div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98'}}>
                        {p.semaforo==='rojo'?'⚠️ Reponer urgente':'🕐 Planificar reposición'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Demand sensing widget — clientes a contactar hoy ─────── */}
          {demandSensing.length > 0 && (
            <div style={{marginTop:12}}>
              <SectionHeader title="Clientes a contactar hoy" action={()=>setTab('clientes')} actionLabel="Ver clientes"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                <div style={{padding:'8px 14px',borderBottom:'1px solid #f5f5f3',background:'#f9f9f7',fontSize:11,color:'#6a6a68'}}>
                  Basado en su frecuencia de compra histórica — listos para reponer
                </div>
                {demandSensing.map((c, i) => {
                  const isAlta = c.urgencia === 'alta';
                  const tel    = (c.telefono||'').replace(/\D/g,'');
                  const waUrl  = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${c.nombre.split(' ')[0]}, ¿te quedaste sin stock? Te ayudamos a reponer 🚚`)}` : null;
                  return (
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderBottom:i<demandSensing.length-1?'1px solid #f5f5f3':'none'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:isAlta?'#dc2626':'#f59e0b',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,color:'#1a1a18',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.nombre}</div>
                        <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>
                          Última compra: {c.ultimaCompra} · Compra cada ~{c.avgInterval}d · Han pasado {c.diasDesde}d
                        </div>
                      </div>
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noreferrer"
                          style={{background:'#25D366',color:'#fff',border:'none',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer',textDecoration:'none',flexShrink:0}}>
                          💬 WA
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock estancado */}
          {stagnant.length>0&&(
            <div style={{marginTop:12}}>
              <SectionHeader title="Sin movimiento (30d)"/>
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #e2e2de',overflow:'hidden'}}>
                {stagnant.map((p,i)=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'9px 14px',
                    borderBottom:i<stagnant.length-1?'1px solid #f5f5f3':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:F.sans,fontSize:12,fontWeight:500,color:'#1a1a18',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                      <div style={{fontFamily:F.sans,fontSize:10,color:'#9a9a98',marginTop:1}}>{p.stock} {p.unit}</div>
                    </div>
                    <div style={{fontFamily:F.sans,fontSize:12,fontWeight:600,color:'#d97706',flexShrink:0}}>
                      {fmt.currencyCompact((p.stock||0)*(p.unitCost||0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      
      

      <button onClick={exportarReporte} title="Exportar reporte CSV"
        style={{position:'fixed',bottom:80,right:20,zIndex:800,width:48,height:48,borderRadius:'50%',
          background:'#1a8a3c',color:'#fff',border:'none',cursor:'pointer',fontSize:20,
          boxShadow:'0 4px 12px rgba(0,0,0,.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        📥
      </button>
</div>
    </div>
  );
}

export default DashboardInline;
